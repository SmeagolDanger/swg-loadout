#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# SWG:L Tools — Deployment Setup Script
#
# Run from the repo root:
#   chmod +x scripts/deploy.sh
#   ./scripts/deploy.sh
#
# Optional env overrides:
#   DEPLOY_PATH=/opt/swg-loadout
#   MOD_DATA_PATH=/opt/swg-loadout-data/mods
# ============================================================

DEPLOY_DIR="${DEPLOY_PATH:-/opt/swg-loadout}"
MOD_DATA_DIR="${MOD_DATA_PATH:-/opt/swg-loadout-data/mods}"
COMPOSE_FILE="docker-compose.prod.yml"
APP_UID="999"
APP_GID="999"

banner() {
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  SWG:L Tools — Deployment Setup"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: $1 is required but not installed."
    exit 1
  fi
}

banner

for cmd in docker git openssl curl; do
  require_cmd "$cmd"
done

if ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: docker compose (v2) is required."
  exit 1
fi

echo ""
echo "[1/6] Preparing deployment directory: $DEPLOY_DIR"
sudo mkdir -p "$DEPLOY_DIR"
sudo chown "$(whoami):$(whoami)" "$DEPLOY_DIR"

echo "[2/6] Preparing persistent curated mod storage: $MOD_DATA_DIR"
sudo mkdir -p "$MOD_DATA_DIR/files" "$MOD_DATA_DIR/screenshots" "$MOD_DATA_DIR/uploads"
sudo chown -R "$APP_UID:$APP_GID" "$MOD_DATA_DIR"
sudo chmod -R u+rwX,go+rX "$MOD_DATA_DIR"

if [ -f "$COMPOSE_FILE" ]; then
  echo "[3/6] Copying project files into deployment directory"
  cp -r . "$DEPLOY_DIR/"
else
  echo "[3/6] No local compose file found, assuming files already exist in $DEPLOY_DIR"
fi

cd "$DEPLOY_DIR"

if [ ! -f .env ]; then
  echo "[4/6] Generating .env file"
  SECRET_KEY=$(openssl rand -hex 32)
  PG_PASSWORD=$(openssl rand -hex 16)

  cat > .env <<ENVEOF
# Generated on $(date -u +"%Y-%m-%dT%H:%M:%SZ")
POSTGRES_DB=slt_db
POSTGRES_USER=slt_user
POSTGRES_PASSWORD=${PG_PASSWORD}
SECRET_KEY=${SECRET_KEY}
LOG_LEVEL=info
HTTP_PORT=80
HTTPS_PORT=443
ENVEOF

  chmod 600 .env
  echo "  → .env created with random secrets"
  echo "  → back this file up somewhere safe"
else
  echo "[4/6] .env already exists, leaving it untouched"
fi

echo "[5/6] Building and starting services"
docker compose -f "$COMPOSE_FILE" up -d --build --remove-orphans

echo "[6/6] Waiting for health endpoint"
for i in $(seq 1 60); do
  if curl -sf "http://localhost/api/health" >/dev/null 2>&1; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  ✓ Deployment successful"
    echo ""
    echo "  App URL:        http://$(hostname -f 2>/dev/null || echo localhost)"
    echo "  Health:         http://localhost/api/health"
    echo "  Mod storage:    $MOD_DATA_DIR"
    echo "  Upload owner:   ${APP_UID}:${APP_GID}"
    echo "  Logs:           docker compose -f $COMPOSE_FILE logs -f"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    exit 0
  fi
  printf "."
  sleep 2
done

echo ""
echo "WARNING: Health check timed out. Check logs with:"
echo "  docker compose -f $COMPOSE_FILE logs"
exit 1
