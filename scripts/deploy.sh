#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# SWG:L Loadout Tool — Server Setup Script
#
# Usage:
#   curl -sSL https://raw.githubusercontent.com/OWNER/REPO/main/scripts/deploy.sh | bash
#
# Or clone and run locally:
#   chmod +x scripts/deploy.sh
#   ./scripts/deploy.sh
# ============================================================

DEPLOY_DIR="${DEPLOY_PATH:-/opt/slt}"
COMPOSE_FILE="docker-compose.prod.yml"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SWG:L Loadout Tool — Deployment Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check prerequisites
for cmd in docker git; do
    if ! command -v "$cmd" &> /dev/null; then
        echo "ERROR: $cmd is required but not installed."
        exit 1
    fi
done

if ! docker compose version &> /dev/null; then
    echo "ERROR: docker compose (v2) is required."
    exit 1
fi

# Create deploy directory
echo ""
echo "[1/5] Creating deployment directory: $DEPLOY_DIR"
sudo mkdir -p "$DEPLOY_DIR"
sudo chown "$(whoami):$(whoami)" "$DEPLOY_DIR"

# Copy files if running from repo
if [ -f "$COMPOSE_FILE" ]; then
    echo "[2/5] Copying project files..."
    cp -r . "$DEPLOY_DIR/"
else
    echo "[2/5] Skipping file copy (run from repo root)"
fi

cd "$DEPLOY_DIR"

# Generate .env if not present
if [ ! -f .env ]; then
    echo "[3/5] Generating .env file..."

    SECRET_KEY=$(openssl rand -hex 32)
    PG_PASSWORD=$(openssl rand -hex 16)

    cat > .env <<EOF
# Generated on $(date -u +"%Y-%m-%dT%H:%M:%SZ")
POSTGRES_DB=slt_db
POSTGRES_USER=slt_user
POSTGRES_PASSWORD=${PG_PASSWORD}
SECRET_KEY=${SECRET_KEY}
LOG_LEVEL=info
HTTP_PORT=80
HTTPS_PORT=443
EOF

    chmod 600 .env
    echo "  → .env created with random secrets"
    echo "  → IMPORTANT: Back up this file securely!"
else
    echo "[3/5] .env already exists, skipping generation"
fi

# Build and start
echo "[4/5] Building and starting services..."
docker compose -f "$COMPOSE_FILE" up -d --build

# Wait for health
echo "[5/5] Waiting for services to become healthy..."
for i in $(seq 1 60); do
    if curl -sf http://localhost:8000/api/health > /dev/null 2>&1; then
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  ✓ Deployment successful!"
        echo ""
        echo "  App:    http://$(hostname -f 2>/dev/null || echo localhost)"
        echo "  Health: http://localhost:8000/api/health"
        echo "  Logs:   docker compose -f $COMPOSE_FILE logs -f"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        exit 0
    fi
    printf "."
    sleep 2
done

echo ""
echo "WARNING: Health check timed out. Check logs:"
echo "  docker compose -f $COMPOSE_FILE logs"
exit 1
