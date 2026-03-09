import contextvars
import json
import logging
import os
import secrets
import time
import uuid
from contextlib import asynccontextmanager
from datetime import UTC, datetime

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from prometheus_client import multiprocess
from prometheus_client import (
    CONTENT_TYPE_LATEST,
    CollectorRegistry,
    Counter,
    Gauge,
    Histogram,
    generate_latest,
)
from sqlalchemy import text

from database import (
    CollectionGroup,
    CollectionItem,
    SessionLocal,
    init_db,
)
from routers.admin_router import router as admin_router
from routers.auth_router import router as auth_router
from routers.buildout_router import router as buildout_router
from routers.characters_router import router as characters_router
from routers.collections_router import router as collections_router
from routers.fc_router import router as fc_router
from routers.gamedata_router import router as gamedata_router
from routers.import_router import router as import_router
from routers.loadout_router import router as loadout_router
from routers.mods_router import admin_router as admin_mods_router
from routers.mods_router import router as mods_router
from routers.re_router import router as re_router

logger = logging.getLogger("slt")
APP_VERSION = "3.0.0"
_REQUEST_ID_CTX: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="-")


class RequestContextFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "request_id"):
            record.request_id = _REQUEST_ID_CTX.get()
        if not hasattr(record, "service"):
            record.service = "backend"
        if not hasattr(record, "environment"):
            record.environment = os.getenv("ENV", "development")
        return True


class JsonFormatter(logging.Formatter):
    _skip_fields = {
        "args",
        "asctime",
        "created",
        "exc_info",
        "exc_text",
        "filename",
        "funcName",
        "levelname",
        "levelno",
        "lineno",
        "module",
        "msecs",
        "message",
        "msg",
        "name",
        "pathname",
        "process",
        "processName",
        "relativeCreated",
        "stack_info",
        "thread",
        "threadName",
    }

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", _REQUEST_ID_CTX.get()),
            "service": getattr(record, "service", "backend"),
            "environment": getattr(record, "environment", os.getenv("ENV", "development")),
        }
        for key, value in record.__dict__.items():
            if key not in self._skip_fields and key not in payload:
                payload[key] = value
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


def configure_logging() -> None:
    root = logging.getLogger()
    if getattr(root, "_slt_logging_configured", False):
        return

    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    context_filter = RequestContextFilter()
    handler.addFilter(context_filter)

    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper(), logging.INFO))
    root.addFilter(context_filter)
    root._slt_logging_configured = True  # type: ignore[attr-defined]


configure_logging()


def _env_flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


METRICS_ENABLED = _env_flag("METRICS_ENABLED", default=False)
METRICS_PATH = os.getenv("METRICS_PATH", "/api/metrics")
_METRICS_MULTIPROC_DIR = os.getenv("PROMETHEUS_MULTIPROC_DIR", "").strip()

REQUEST_COUNTER = Counter(
    "slt_http_requests_total",
    "Total HTTP requests handled by the application.",
    ["method", "path", "status_code"],
)
REQUEST_DURATION = Histogram(
    "slt_http_request_duration_seconds",
    "HTTP request duration in seconds.",
    ["method", "path"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0),
)
REQUESTS_IN_PROGRESS = Gauge(
    "slt_http_requests_in_progress",
    "HTTP requests currently in progress.",
    ["method", "path"],
    multiprocess_mode="livesum",
)
AUTH_ME_COUNTER = Counter(
    "slt_auth_me_total",
    "Total /api/auth/me responses by status code.",
    ["status_code"],
)
DISCORD_CALLBACK_COUNTER = Counter(
    "slt_discord_callback_total",
    "Total Discord callback responses by status code.",
    ["status_code"],
)


def _check_basic_auth(request: Request) -> bool:
    expected_username = os.getenv("METRICS_BASIC_AUTH_USERNAME", "")
    expected_password = os.getenv("METRICS_BASIC_AUTH_PASSWORD", "")
    if not expected_username or not expected_password:
        return False

    authorization = request.headers.get("authorization", "")
    if not authorization.startswith("Basic "):
        return False

    import base64

    try:
        decoded = base64.b64decode(authorization.split(" ", 1)[1]).decode("utf-8")
        username, password = decoded.split(":", 1)
    except Exception:
        return False

    return secrets.compare_digest(username, expected_username) and secrets.compare_digest(password, expected_password)


def _build_metrics_payload() -> bytes:
    if _METRICS_MULTIPROC_DIR:
        registry = CollectorRegistry()
        multiprocess.MultiProcessCollector(registry)
        return generate_latest(registry)
    return generate_latest()


def _uptime_seconds(application: FastAPI) -> float:
    started_at = getattr(application.state, "started_at", time.monotonic())
    return round(max(0.0, time.monotonic() - started_at), 3)


def _db_ready() -> tuple[bool, str | None]:
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        return True, None
    except Exception as exc:  # pragma: no cover - defensive guard for runtime only
        logger.warning("database_health_check_failed", extra={"error_type": type(exc).__name__})
        return False, type(exc).__name__
    finally:
        db.close()


def seed_collections() -> None:
    """Seed collection groups and items from JSON if the DB is empty."""
    data_path = os.path.join(os.path.dirname(__file__), "data", "collections-data.json")
    if not os.path.exists(data_path):
        logger.warning("collections_seed_skipped", extra={"reason": "missing_data_file"})
        return

    db = SessionLocal()
    try:
        existing = db.query(CollectionGroup).count()
        if existing > 0:
            logger.info("collections_seed_skipped", extra={"reason": "already_seeded", "group_count": existing})
            return

        with open(data_path, encoding="utf-8") as file_handle:
            collections = json.load(file_handle)

        group_order = 0
        total_items = 0
        for group_name, group_data in collections.items():
            group = CollectionGroup(
                name=group_name,
                icon=group_data.get("icon", "default"),
                category=group_data.get("category", "other"),
                description=group_data.get("description", ""),
                sort_order=group_order,
            )
            db.add(group)
            db.flush()
            group_order += 1

            for item_order, (item_name, item_data) in enumerate(group_data.get("items", {}).items()):
                db.add(
                    CollectionItem(
                        group_id=group.id,
                        name=item_name,
                        notes=item_data.get("notes", ""),
                        difficulty=item_data.get("difficulty", "medium"),
                        sort_order=item_order,
                    )
                )
                total_items += 1

        db.commit()
        logger.info(
            "collections_seed_complete",
            extra={"group_count": group_order, "item_count": total_items},
        )
    except Exception:
        db.rollback()
        logger.exception("collections_seed_failed")
        raise
    finally:
        db.close()


@asynccontextmanager
async def lifespan(application: FastAPI):
    application.state.started_at = time.monotonic()
    application.state.is_ready = False
    application.state.startup_error = None
    logger.info("app_startup_started", extra={"version": APP_VERSION})
    try:
        init_db()
        logger.info("app_startup_db_initialized")
        seed_collections()
        application.state.is_ready = True
        logger.info("app_startup_complete", extra={"version": APP_VERSION})
        yield
    except Exception as exc:  # pragma: no cover - startup failures are runtime concerns
        application.state.startup_error = type(exc).__name__
        logger.exception("app_startup_failed")
        raise
    finally:
        application.state.is_ready = False
        logger.info("app_shutdown_complete")


app = FastAPI(title="SWG:L Space Tools", version=APP_VERSION, lifespan=lifespan)


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    request.state.request_id = request_id
    token = _REQUEST_ID_CTX.set(request_id)
    start = time.perf_counter()
    request_path = request.url.path
    in_progress = None

    if METRICS_ENABLED and request_path != METRICS_PATH:
        in_progress = REQUESTS_IN_PROGRESS.labels(request.method, request_path)
        in_progress.inc()

    logger.info(
        "request_started",
        extra={
            "request_id": request_id,
            "method": request.method,
            "path": request_path,
            "client_ip": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent"),
        },
    )

    try:
        response = await call_next(request)
    except Exception:
        duration_ms = round((time.perf_counter() - start) * 1000, 3)
        logger.exception(
            "request_failed",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request_path,
                "duration_ms": duration_ms,
            },
        )
        response = JSONResponse(status_code=500, content={"detail": "Internal server error"})

    duration_seconds = max(0.0, time.perf_counter() - start)
    response.headers["X-Request-ID"] = request_id

    if METRICS_ENABLED and request_path != METRICS_PATH:
        REQUEST_COUNTER.labels(request.method, request_path, str(response.status_code)).inc()
        REQUEST_DURATION.labels(request.method, request_path).observe(duration_seconds)
        if request_path == "/api/auth/me":
            AUTH_ME_COUNTER.labels(str(response.status_code)).inc()
        elif request_path == "/api/auth/discord/callback":
            DISCORD_CALLBACK_COUNTER.labels(str(response.status_code)).inc()
        if in_progress is not None:
            in_progress.dec()

    logger.info(
        "request_finished",
        extra={
            "request_id": request_id,
            "method": request.method,
            "path": request_path,
            "status_code": response.status_code,
            "duration_ms": round(duration_seconds * 1000, 3),
        },
    )
    _REQUEST_ID_CTX.reset(token)
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin_router)
app.include_router(auth_router)
app.include_router(buildout_router)
app.include_router(characters_router)
app.include_router(collections_router)
app.include_router(fc_router)
app.include_router(gamedata_router)
app.include_router(import_router)
app.include_router(loadout_router)
app.include_router(mods_router)
app.include_router(admin_mods_router)
app.include_router(re_router)


@app.get("/api/health")
def health(request: Request):
    ready, db_error = _db_ready()
    return {
        "status": "ok",
        "version": APP_VERSION,
        "ready": bool(getattr(request.app.state, "is_ready", False) and ready),
        "uptime_s": _uptime_seconds(request.app),
        "database": "ok" if ready else "degraded",
        **({"database_error": db_error} if db_error else {}),
    }


@app.get("/api/health/live")
def live_health(request: Request):
    return {"status": "ok", "version": APP_VERSION, "uptime_s": _uptime_seconds(request.app)}


@app.get("/api/health/ready")
def ready_health(request: Request):
    startup_ready = bool(getattr(request.app.state, "is_ready", False))
    db_ready, db_error = _db_ready()
    is_ready = startup_ready and db_ready
    payload = {
        "status": "ok" if is_ready else "not_ready",
        "version": APP_VERSION,
        "ready": is_ready,
        "uptime_s": _uptime_seconds(request.app),
        "startup_error": getattr(request.app.state, "startup_error", None),
        "database": "ok" if db_ready else "degraded",
    }
    if db_error:
        payload["database_error"] = db_error
    status_code = 200 if is_ready else 503
    return JSONResponse(status_code=status_code, content=payload)


@app.get(METRICS_PATH, include_in_schema=False)
def metrics(request: Request):
    if not METRICS_ENABLED:
        return JSONResponse(status_code=404, content={"detail": "Not found"})
    if not _check_basic_auth(request):
        response = PlainTextResponse("Unauthorized", status_code=401)
        response.headers["WWW-Authenticate"] = 'Basic realm="metrics"'
        return response
    return PlainTextResponse(_build_metrics_payload(), media_type=CONTENT_TYPE_LATEST)


# Serve frontend static files in production
frontend_path = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
