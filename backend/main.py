import logging
import os
import time
import uuid
from contextlib import asynccontextmanager
from secrets import compare_digest

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, Histogram, generate_latest
from sqlalchemy import text

from database import CollectionGroup, CollectionItem, SessionLocal, init_db
from logging_setup import REQUEST_ID_CTX, configure_logging
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

APP_VERSION = "3.0.0"
REQUEST_COUNT = Counter(
    "slt_http_requests_total",
    "Total HTTP requests handled by the backend.",
    ["method", "path", "status_code"],
)
REQUEST_DURATION = Histogram(
    "slt_http_request_duration_seconds",
    "HTTP request duration in seconds.",
    ["method", "path", "status_code"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0),
)
REQUEST_IN_PROGRESS = Gauge(
    "slt_http_requests_in_progress",
    "Current number of HTTP requests being processed.",
    ["method", "path"],
)
AUTH_CALLBACK_TOTAL = Counter(
    "slt_auth_discord_callback_total",
    "Total Discord OAuth callbacks handled by outcome.",
    ["outcome"],
)
AUTH_ME_TOTAL = Counter(
    "slt_auth_me_total",
    "Total /api/auth/me requests by outcome.",
    ["outcome"],
)
settings = configure_logging()
logger = logging.getLogger("slt")
METRICS_ENABLED = os.getenv("METRICS_ENABLED", "false").strip().lower() == "true"
METRICS_USERNAME = os.getenv("METRICS_BASIC_AUTH_USERNAME", "").strip()
METRICS_PASSWORD = os.getenv("METRICS_BASIC_AUTH_PASSWORD", "").strip()


if settings.provider not in {"", "none", "off", "disabled"}:
    logger.info("observability_provider_selected", extra={"provider": settings.provider})


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


def _metric_path_label(request: Request) -> str:
    route = request.scope.get("route")
    path = getattr(route, "path", request.url.path)
    if isinstance(path, str):
        return path
    return request.url.path


def _check_metrics_auth(request: Request) -> None:
    if not METRICS_USERNAME and not METRICS_PASSWORD:
        return

    auth_header = request.headers.get("authorization", "")
    scheme, _, encoded = auth_header.partition(" ")
    if scheme.lower() != "basic" or not encoded:
        raise HTTPException(status_code=401, headers={"WWW-Authenticate": "Basic"})

    import base64

    try:
        decoded = base64.b64decode(encoded).decode("utf-8")
        username, _, password = decoded.partition(":")
    except Exception as exc:  # pragma: no cover - malformed credentials
        raise HTTPException(status_code=401, headers={"WWW-Authenticate": "Basic"}) from exc

    if not (compare_digest(username, METRICS_USERNAME) and compare_digest(password, METRICS_PASSWORD)):
        raise HTTPException(status_code=401, headers={"WWW-Authenticate": "Basic"})


def seed_collections() -> None:
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

        import json

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
        logger.info("collections_seed_complete", extra={"group_count": group_order, "item_count": total_items})
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
    token = REQUEST_ID_CTX.set(request_id)
    start = time.perf_counter()
    initial_path = request.url.path

    logger.info(
        "request_started",
        extra={
            "request_id": request_id,
            "method": request.method,
            "path": initial_path,
            "client_ip": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent"),
        },
    )

    metric_labels = {"method": request.method, "path": initial_path}
    REQUEST_IN_PROGRESS.labels(**metric_labels).inc()
    status_code = 500

    try:
        response = await call_next(request)
        status_code = response.status_code
    except Exception:
        duration_ms = round((time.perf_counter() - start) * 1000, 3)
        logger.exception(
            "request_failed",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": initial_path,
                "duration_ms": duration_ms,
            },
        )
        response = JSONResponse(status_code=500, content={"detail": "Internal server error"})
    finally:
        REQUEST_IN_PROGRESS.labels(**metric_labels).dec()

    resolved_path = _metric_path_label(request)
    duration_s = max(0.0, time.perf_counter() - start)
    metric_result_labels = {"method": request.method, "path": resolved_path, "status_code": str(status_code)}
    REQUEST_COUNT.labels(**metric_result_labels).inc()
    REQUEST_DURATION.labels(**metric_result_labels).observe(duration_s)

    if resolved_path == "/api/auth/discord/callback":
        outcome = "success" if 200 <= status_code < 400 else "error"
        AUTH_CALLBACK_TOTAL.labels(outcome=outcome).inc()
    elif resolved_path == "/api/auth/me":
        outcome = "success" if 200 <= status_code < 400 else "error"
        AUTH_ME_TOTAL.labels(outcome=outcome).inc()

    response.headers["X-Request-ID"] = request_id
    logger.info(
        "request_finished",
        extra={
            "request_id": request_id,
            "method": request.method,
            "path": resolved_path,
            "status_code": response.status_code,
            "duration_ms": round(duration_s * 1000, 3),
        },
    )
    REQUEST_ID_CTX.reset(token)
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


@app.get("/api/metrics")
def metrics(request: Request):
    if not METRICS_ENABLED:
        raise HTTPException(status_code=404, detail="Metrics disabled")
    _check_metrics_auth(request)
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


frontend_path = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
