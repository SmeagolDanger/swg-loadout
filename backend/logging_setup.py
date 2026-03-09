import contextvars
import json
import logging
import os
import sys
from contextlib import suppress
from datetime import UTC, datetime
from typing import Any

_REQUEST_ID_CTX: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="-")


def get_request_id() -> str:
    return _REQUEST_ID_CTX.get()


def set_request_id(request_id: str) -> contextvars.Token[str]:
    return _REQUEST_ID_CTX.set(request_id)


def reset_request_id(token: contextvars.Token[str]) -> None:
    _REQUEST_ID_CTX.reset(token)


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


class RequestContextFilter(logging.Filter):
    def __init__(self, service: str = "backend") -> None:
        super().__init__()
        self.service = service

    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "request_id"):
            record.request_id = get_request_id()
        if not hasattr(record, "service"):
            record.service = self.service
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
            "request_id": getattr(record, "request_id", get_request_id()),
            "service": getattr(record, "service", "backend"),
            "environment": getattr(record, "environment", os.getenv("ENV", "development")),
        }
        for key, value in record.__dict__.items():
            if key not in self._skip_fields and key not in payload:
                payload[key] = value
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


class BetterStackNoiseFilter(logging.Filter):
    def __init__(self, *, include_access_logs: bool, include_healthchecks: bool) -> None:
        super().__init__()
        self.include_access_logs = include_access_logs
        self.include_healthchecks = include_healthchecks

    def filter(self, record: logging.LogRecord) -> bool:
        message = record.getMessage()
        path = getattr(record, "path", None)

        if not self.include_access_logs and message in {"request_started", "request_finished"}:
            return False

        return self.include_healthchecks or not (
            isinstance(path, str)
            and path.startswith("/api/health")
            and message in {"request_started", "request_finished"}
        )


class SafeBetterStackHandler(logging.Handler):
    def __init__(self, *, source_token: str, host: str) -> None:
        super().__init__()
        from logtail import LogtailHandler

        self._handler = LogtailHandler(source_token=source_token, host=host)
        self._reported_failure = False

    def emit(self, record: logging.LogRecord) -> None:
        try:
            self._handler.emit(record)
        except Exception as exc:  # pragma: no cover - defensive runtime guard
            if not self._reported_failure:
                self._reported_failure = True
                with suppress(Exception):
                    sys.stderr.write(f"Better Stack logging disabled after handler error: {type(exc).__name__}\n")

    def flush(self) -> None:
        with suppress(Exception):
            self._handler.flush()

    def close(self) -> None:
        with suppress(Exception):
            self._handler.close()
        super().close()


def _normalize_better_stack_host(raw_value: str | None) -> str | None:
    if not raw_value:
        return None

    value = raw_value.strip()
    if not value:
        return None

    if value.startswith("http://") or value.startswith("https://"):
        return value.rstrip("/")

    return f"https://{value.rstrip('/')}"


def _build_better_stack_handler(service: str) -> tuple[logging.Handler | None, dict[str, Any]]:
    source_token = os.getenv("BETTER_STACK_SOURCE_TOKEN", "").strip()
    host = _normalize_better_stack_host(
        os.getenv("BETTER_STACK_HTTP_API_URL") or os.getenv("BETTER_STACK_INGESTING_HOST")
    )
    requested = bool(
        source_token
        or host
        or os.getenv("BETTER_STACK_ENABLED") is not None
        or os.getenv("BETTER_STACK_INCLUDE_ACCESS_LOGS") is not None
        or os.getenv("BETTER_STACK_INCLUDE_HEALTHCHECKS") is not None
    )

    state: dict[str, Any] = {
        "better_stack_requested": requested,
        "better_stack_enabled": False,
        "better_stack_host": host,
        "better_stack_include_access_logs": _env_bool("BETTER_STACK_INCLUDE_ACCESS_LOGS", False),
        "better_stack_include_healthchecks": _env_bool("BETTER_STACK_INCLUDE_HEALTHCHECKS", False),
    }

    if not _env_bool("BETTER_STACK_ENABLED", True):
        state["better_stack_reason"] = "disabled"
        return None, state

    if not source_token:
        state["better_stack_reason"] = "missing_source_token"
        return None, state

    if not host:
        state["better_stack_reason"] = "missing_host"
        return None, state

    try:
        handler = SafeBetterStackHandler(source_token=source_token, host=host)
    except ImportError:
        state["better_stack_reason"] = "dependency_missing"
        return None, state
    except Exception as exc:  # pragma: no cover - defensive runtime guard
        state["better_stack_reason"] = "handler_init_failed"
        state["better_stack_error_type"] = type(exc).__name__
        return None, state

    handler.setLevel(
        getattr(logging, os.getenv("BETTER_STACK_LOG_LEVEL", os.getenv("LOG_LEVEL", "INFO")).upper(), logging.INFO)
    )
    handler.addFilter(RequestContextFilter(service=service))
    handler.addFilter(
        BetterStackNoiseFilter(
            include_access_logs=state["better_stack_include_access_logs"],
            include_healthchecks=state["better_stack_include_healthchecks"],
        )
    )
    state["better_stack_enabled"] = True
    state["better_stack_reason"] = "configured"
    return handler, state


def configure_logging(*, service: str = "backend") -> dict[str, Any]:
    root = logging.getLogger()
    existing_state = getattr(root, "_slt_logging_state", None)
    if getattr(root, "_slt_logging_configured", False) and isinstance(existing_state, dict):
        return existing_state

    context_filter = RequestContextFilter(service=service)

    console_handler = logging.StreamHandler()
    console_handler.setFormatter(JsonFormatter())
    console_handler.addFilter(context_filter)

    root.handlers.clear()
    root.addHandler(console_handler)
    root.setLevel(getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper(), logging.INFO))
    root.addFilter(context_filter)

    better_stack_handler, state = _build_better_stack_handler(service)
    if better_stack_handler is not None:
        root.addHandler(better_stack_handler)

    root._slt_logging_configured = True  # type: ignore[attr-defined]
    root._slt_logging_state = state  # type: ignore[attr-defined]
    return state
