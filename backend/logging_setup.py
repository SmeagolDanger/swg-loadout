import atexit
import contextvars
import json
import logging
import os
import queue
import sys
import threading
import time
from contextlib import suppress
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

import requests

REQUEST_ID_CTX: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="-")

_LOCAL_SKIP_FIELDS = {
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


@dataclass(frozen=True)
class LoggingSettings:
    env: str
    level: int
    provider: str
    include_access_logs: bool
    include_healthchecks: bool
    service_name: str
    better_stack_source_token: str
    better_stack_ingesting_host: str
    better_stack_http_api_url: str
    grafana_cloud_logs_url: str
    grafana_cloud_logs_user_id: str
    grafana_cloud_api_key: str
    grafana_cloud_job: str
    remote_timeout_s: float
    remote_batch_size: int
    remote_flush_interval_s: float


class RequestContextFilter(logging.Filter):
    def __init__(self, env: str, service_name: str) -> None:
        super().__init__()
        self._env = env
        self._service_name = service_name

    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "request_id"):
            record.request_id = REQUEST_ID_CTX.get()
        if not hasattr(record, "service"):
            record.service = self._service_name
        if not hasattr(record, "environment"):
            record.environment = self._env
        return True


class JsonFormatter(logging.Formatter):
    def __init__(self, env: str) -> None:
        super().__init__()
        self._env = env

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", REQUEST_ID_CTX.get()),
            "service": getattr(record, "service", "backend"),
            "environment": getattr(record, "environment", self._env),
        }
        for key, value in record.__dict__.items():
            if key not in _LOCAL_SKIP_FIELDS and key not in payload:
                payload[key] = value
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


class RemoteNoiseFilter(logging.Filter):
    def __init__(self, *, include_access_logs: bool, include_healthchecks: bool) -> None:
        super().__init__()
        self._include_access_logs = include_access_logs
        self._include_healthchecks = include_healthchecks

    def filter(self, record: logging.LogRecord) -> bool:
        message = record.getMessage()
        path = str(getattr(record, "path", ""))

        if not self._include_access_logs and message in {"request_started", "request_finished"}:
            return False

        if not self._include_healthchecks and path.startswith("/api/health"):
            return False

        return True


class SafeGrafanaLokiHandler(logging.Handler):
    def __init__(
        self,
        *,
        url: str,
        user_id: str,
        api_key: str,
        timeout_s: float,
        batch_size: int,
        flush_interval_s: float,
        labels: dict[str, str],
    ) -> None:
        super().__init__()
        self._url = url
        self._auth = (user_id, api_key)
        self._timeout_s = timeout_s
        self._batch_size = max(1, batch_size)
        self._flush_interval_s = max(0.5, flush_interval_s)
        self._labels = labels
        self._queue: queue.Queue[tuple[str, str, str] | None] = queue.Queue(maxsize=5000)
        self._session = requests.Session()
        self._stop_event = threading.Event()
        self._thread = threading.Thread(target=self._worker, name="grafana-loki-log-forwarder", daemon=True)
        self._warned = False
        self._thread.start()
        atexit.register(self.close)

    def emit(self, record: logging.LogRecord) -> None:
        try:
            rendered = self.format(record)
            timestamp_ns = str(time.time_ns())
            level = record.levelname.lower()
            self._queue.put_nowait((timestamp_ns, rendered, level))
        except queue.Full:
            self._warn_once("grafana_cloud_log_queue_full")
        except Exception:
            self.handleError(record)

    def close(self) -> None:
        if not self._stop_event.is_set():
            self._stop_event.set()
            with suppress(Exception):
                self._queue.put_nowait(None)
            if self._thread.is_alive():
                self._thread.join(timeout=max(1.0, self._flush_interval_s + 1.0))
            with suppress(Exception):
                self._session.close()
        super().close()

    def _worker(self) -> None:
        batch: list[tuple[str, str, str]] = []
        deadline = time.monotonic() + self._flush_interval_s

        while True:
            timeout = max(0.1, deadline - time.monotonic())
            try:
                item = self._queue.get(timeout=timeout)
            except queue.Empty:
                item = None

            if item is None:
                if batch:
                    self._flush(batch)
                    batch = []
                if self._stop_event.is_set():
                    break
                deadline = time.monotonic() + self._flush_interval_s
                continue

            batch.append(item)
            if len(batch) >= self._batch_size or time.monotonic() >= deadline:
                self._flush(batch)
                batch = []
                deadline = time.monotonic() + self._flush_interval_s

    def _flush(self, batch: list[tuple[str, str, str]]) -> None:
        if not batch:
            return

        values = [[timestamp_ns, line] for timestamp_ns, line, _level in batch]
        stream_labels = dict(self._labels)
        stream_labels["level"] = batch[-1][2]
        payload = {"streams": [{"stream": stream_labels, "values": values}]}

        try:
            response = self._session.post(
                self._url,
                auth=self._auth,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=self._timeout_s,
            )
            if response.status_code >= 400:
                self._warn_once(f"grafana_cloud_logging_http_{response.status_code}")
        except Exception as exc:  # pragma: no cover - network failures are runtime-only
            self._warn_once(f"grafana_cloud_logging_failed:{type(exc).__name__}")

    def _warn_once(self, message: str) -> None:
        if self._warned:
            return
        self._warned = True
        print(message, file=sys.stderr)


class RemoteProviderConfigurationError(RuntimeError):
    pass


def load_logging_settings() -> LoggingSettings:
    env = os.getenv("ENV", "development")
    return LoggingSettings(
        env=env,
        level=getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper(), logging.INFO),
        provider=os.getenv("OBSERVABILITY_PROVIDER", "none").strip().lower(),
        include_access_logs=os.getenv("OBSERVABILITY_INCLUDE_ACCESS_LOGS", "false").strip().lower() == "true",
        include_healthchecks=os.getenv("OBSERVABILITY_INCLUDE_HEALTHCHECKS", "false").strip().lower() == "true",
        service_name=os.getenv("OBSERVABILITY_SERVICE_NAME", "backend").strip() or "backend",
        better_stack_source_token=os.getenv("BETTER_STACK_SOURCE_TOKEN", "").strip(),
        better_stack_ingesting_host=os.getenv("BETTER_STACK_INGESTING_HOST", "").strip(),
        better_stack_http_api_url=os.getenv("BETTER_STACK_HTTP_API_URL", "").strip(),
        grafana_cloud_logs_url=os.getenv("GRAFANA_CLOUD_LOGS_URL", "").strip(),
        grafana_cloud_logs_user_id=os.getenv("GRAFANA_CLOUD_LOGS_USER_ID", "").strip(),
        grafana_cloud_api_key=os.getenv("GRAFANA_CLOUD_API_KEY", "").strip(),
        grafana_cloud_job=os.getenv("GRAFANA_CLOUD_LOGS_JOB", "backend").strip() or "backend",
        remote_timeout_s=float(os.getenv("OBSERVABILITY_REMOTE_TIMEOUT_S", "3.0")),
        remote_batch_size=int(os.getenv("OBSERVABILITY_REMOTE_BATCH_SIZE", "25")),
        remote_flush_interval_s=float(os.getenv("OBSERVABILITY_REMOTE_FLUSH_INTERVAL_S", "2.0")),
    )


def configure_logging() -> LoggingSettings:
    root = logging.getLogger()
    if getattr(root, "_slt_logging_configured", False):
        return getattr(root, "_slt_logging_settings")

    settings = load_logging_settings()
    context_filter = RequestContextFilter(settings.env, settings.service_name)
    json_formatter = JsonFormatter(settings.env)

    stdout_handler = logging.StreamHandler()
    stdout_handler.setFormatter(json_formatter)
    stdout_handler.addFilter(context_filter)

    root.handlers.clear()
    root.filters.clear()
    root.addHandler(stdout_handler)
    root.addFilter(context_filter)
    root.setLevel(settings.level)

    remote_handler = _build_remote_handler(settings, json_formatter, context_filter)
    if remote_handler is not None:
        root.addHandler(remote_handler)
        logging.getLogger("slt").info(
            "remote_logging_enabled",
            extra={
                "provider": settings.provider,
                "include_access_logs": settings.include_access_logs,
                "include_healthchecks": settings.include_healthchecks,
            },
        )
    else:
        logging.getLogger("slt").info("remote_logging_disabled", extra={"provider": settings.provider})

    root._slt_logging_configured = True  # type: ignore[attr-defined]
    root._slt_logging_settings = settings  # type: ignore[attr-defined]
    return settings


def _build_remote_handler(
    settings: LoggingSettings,
    json_formatter: logging.Formatter,
    context_filter: logging.Filter,
) -> logging.Handler | None:
    if settings.provider in {"", "none", "off", "disabled"}:
        return None

    if settings.provider == "better_stack":
        handler = _build_better_stack_handler(settings)
        formatter: logging.Formatter = json_formatter
    elif settings.provider == "grafana_cloud":
        handler = _build_grafana_cloud_handler(settings)
        formatter = json_formatter
    else:
        raise RemoteProviderConfigurationError(f"Unsupported OBSERVABILITY_PROVIDER: {settings.provider}")

    handler.setLevel(settings.level)
    handler.setFormatter(formatter)
    handler.addFilter(context_filter)
    handler.addFilter(
        RemoteNoiseFilter(
            include_access_logs=settings.include_access_logs,
            include_healthchecks=settings.include_healthchecks,
        )
    )
    return handler


def _build_better_stack_handler(settings: LoggingSettings) -> logging.Handler:
    if not settings.better_stack_source_token:
        raise RemoteProviderConfigurationError("BETTER_STACK_SOURCE_TOKEN is required for Better Stack logging")

    with suppress(ImportError):
        from logtail import LogtailHandler  # type: ignore

        kwargs: dict[str, str] = {"source_token": settings.better_stack_source_token}
        if settings.better_stack_http_api_url:
            kwargs["host"] = settings.better_stack_http_api_url
        elif settings.better_stack_ingesting_host:
            kwargs["host"] = settings.better_stack_ingesting_host
        return LogtailHandler(**kwargs)

    raise RemoteProviderConfigurationError("logtail-python package is not installed")


def _build_grafana_cloud_handler(settings: LoggingSettings) -> logging.Handler:
    if not settings.grafana_cloud_logs_url:
        raise RemoteProviderConfigurationError("GRAFANA_CLOUD_LOGS_URL is required for Grafana Cloud logging")
    if not settings.grafana_cloud_logs_user_id:
        raise RemoteProviderConfigurationError("GRAFANA_CLOUD_LOGS_USER_ID is required for Grafana Cloud logging")
    if not settings.grafana_cloud_api_key:
        raise RemoteProviderConfigurationError("GRAFANA_CLOUD_API_KEY is required for Grafana Cloud logging")

    return SafeGrafanaLokiHandler(
        url=settings.grafana_cloud_logs_url,
        user_id=settings.grafana_cloud_logs_user_id,
        api_key=settings.grafana_cloud_api_key,
        timeout_s=settings.remote_timeout_s,
        batch_size=settings.remote_batch_size,
        flush_interval_s=settings.remote_flush_interval_s,
        labels={
            "job": settings.grafana_cloud_job,
            "service": settings.service_name,
            "environment": settings.env,
        },
    )
