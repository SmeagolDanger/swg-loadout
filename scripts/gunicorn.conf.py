"""Gunicorn production configuration for SWG:L Loadout Tool."""

import multiprocessing
import os

# ── Server socket ────────────────────────────────────────────
bind = "unix:/var/run/slt/gunicorn.sock"
backlog = 2048

# ── Workers ──────────────────────────────────────────────────
# Use uvicorn workers for async FastAPI
worker_class = "uvicorn.workers.UvicornWorker"
workers = int(os.getenv("WEB_CONCURRENCY", multiprocessing.cpu_count() * 2 + 1))
worker_connections = 1000
max_requests = 1000
max_requests_jitter = 50
timeout = 120
graceful_timeout = 30
keepalive = 5

# ── Security ─────────────────────────────────────────────────
limit_request_line = 4094
limit_request_fields = 100
limit_request_field_size = 8190

# ── Logging ──────────────────────────────────────────────────
accesslog = "/var/log/slt/gunicorn-access.log"
errorlog = "/var/log/slt/gunicorn-error.log"
loglevel = os.getenv("LOG_LEVEL", "info")
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# ── Process naming ───────────────────────────────────────────
proc_name = "slt-backend"

# ── Preload for memory efficiency ────────────────────────────
preload_app = True

# ── Server hooks ─────────────────────────────────────────────
def on_starting(server):
    """Called just before the master process is initialized."""
    pass

def post_fork(server, worker):
    """Called just after a worker has been forked."""
    server.log.info(f"Worker spawned (pid: {worker.pid})")

def pre_exec(server):
    """Called just before a new master process is forked."""
    server.log.info("Forked child, re-executing.")

def when_ready(server):
    """Called just after the server is started."""
    server.log.info("Server is ready. Spawning workers")

def worker_exit(server, worker):
    """Called when a worker exits."""
    pass
