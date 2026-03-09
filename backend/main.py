import json
import logging
import os
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
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

from logging_setup import configure_logging, reset_request_id, set_request_id

logger = logging.getLogger("slt")
APP_VERSION = "3.0.0"
LOGGING_STATE = configure_logging(service="backend")

if LOGGING_STATE.get("better_stack_requested"):
    if LOGGING_STATE.get("better_stack_enabled"):
        logger.info(
            "better_stack_logging_enabled",
            extra={
                "better_stack_host": LOGGING_STATE.get("better_stack_host"),
                "include_access_logs": LOGGING_STATE.get("better_stack_include_access_logs"),
                "include_healthchecks": LOGGING_STATE.get("better_stack_include_healthchecks"),
            },
        )
    else:
        logger.warning(
            "better_stack_logging_unavailable",
            extra={
                "reason": LOGGING_STATE.get("better_stack_reason"),
                **(
                    {"error_type": LOGGING_STATE.get("better_stack_error_type")}
                    if LOGGING_STATE.get("better_stack_error_type")
                    else {}
                ),
            },
        )


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
    token = set_request_id(request_id)
    start = time.perf_counter()

    logger.info(
        "request_started",
        extra={
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
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
                "path": request.url.path,
                "duration_ms": duration_ms,
            },
        )
        response = JSONResponse(status_code=500, content={"detail": "Internal server error"})

    response.headers["X-Request-ID"] = request_id
    logger.info(
        "request_finished",
        extra={
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "duration_ms": round((time.perf_counter() - start) * 1000, 3),
        },
    )
    reset_request_id(token)
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


# Serve frontend static files in production
frontend_path = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
