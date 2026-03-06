# Seraph's Loadout Tool 2.0 — Web Edition

A full-stack web application for building and analyzing starship loadouts in **Star Wars Galaxies: Jump to Lightspeed**. This is a web-based reimagining of the original desktop tool by [SeraphExodus](https://github.com/SeraphExodus/Seraphs-Loadout-Tool), built for both desktop and mobile browsers.

## Features

### Core Loadout Builder
- **52 chassis** with full stat data (mass, speed mods, throttle profiles, PYR, slide)
- **Component selection** for all slot types: Reactor, Engine, Booster, Shield, Armor (front/rear), Capacitor, Cargo Hold, Droid Interface
- **8 dynamic weapon/ordnance/countermeasure slots** per chassis
- **Real-time calculations** for mass utilization, reactor drain, and overload effects
- **Throttle profile visualization** with color-coded PYR modifier display
- **Propulsion calculations**: top speed, boosted speed, boost distance, booster uptime
- **Overload system**: Reactor, Engine, Capacitor, and Weapon overloads (Levels 1-4)
- **Shield adjust** support with front/back HP ratios

### User Accounts (New)
- Register and sign in with JWT-based authentication
- Save unlimited loadouts to your account
- Manage a personal component library
- Share loadouts publicly with the community
- Copy community loadouts to your own collection

### Tools
- **Loot Lookup**: Search by component name or NPC to find drop sources
- **Component Manager**: Full CRUD for your personal component database

### Design
- **Responsive**: Works on desktop, tablet, and mobile
- **Dark space-combat aesthetic** with plasma blue accents
- Custom typography (Rajdhani, Exo 2, JetBrains Mono)

## Architecture

| Layer    | Technology            | Purpose                              |
|----------|-----------------------|--------------------------------------|
| Frontend | React 18, Vite, Tailwind CSS | SPA with responsive UI        |
| Backend  | Python FastAPI        | REST API, game calculations, auth    |
| Database | PostgreSQL 16         | User data, loadouts, components      |
| Game Data| SQLite (read-only)    | 52 chassis, 2565 NPCs, 959 brands, loot tables |
| Proxy    | Nginx                 | Static files, API proxy, SPA routing |
| Container| Docker Compose        | Full-stack orchestration             |

## Quick Start

### Prerequisites
- Docker and Docker Compose

### Run

```bash
# Clone and enter the project
cd seraphs-loadout-tool-web

# Copy environment file
cp .env.example .env

# Edit .env and set a secure SECRET_KEY

# Build and start all services
docker compose up --build

# Access the app at http://localhost
```

### Development

**Backend only:**
```bash
cd backend
pip install -r requirements.txt
DATABASE_URL=postgresql://slt_user:slt_pass@localhost:5432/slt_db uvicorn main:app --reload
```

**Frontend only:**
```bash
cd frontend
npm install
npm run dev
```

## API Endpoints

### Authentication
- `POST /api/auth/register` — Create account
- `POST /api/auth/login` — Sign in (OAuth2 form)
- `GET /api/auth/me` — Get current user

### Game Data
- `GET /api/gamedata/chassis` — List all chassis
- `GET /api/gamedata/chassis/{name}` — Chassis details + throttle profile
- `GET /api/gamedata/component-types` — Component stat definitions
- `GET /api/gamedata/fc-programs` — Flight computer programs
- `GET /api/gamedata/overload-levels` — Available overload levels
- `GET /api/gamedata/shield-adjust-options` — Shield adjust programs
- `POST /api/gamedata/calculate` — Run full loadout calculations
- `GET /api/gamedata/loot-lookup?query=...&search_type=...` — Loot search

### Loadouts (authenticated)
- `GET /api/loadouts` — List user's loadouts
- `GET /api/loadouts/public` — Community loadouts
- `POST /api/loadouts` — Create loadout
- `PUT /api/loadouts/{id}` — Update loadout
- `POST /api/loadouts/{id}/duplicate` — Copy a loadout
- `DELETE /api/loadouts/{id}` — Delete loadout

### Components (authenticated)
- `GET /api/components` — List user's components
- `POST /api/components` — Create component
- `PUT /api/components/{id}` — Update component
- `DELETE /api/components/{id}` — Delete component

## CI/CD Pipeline

The project includes a full GitHub Actions workflow (`.github/workflows/ci.yml`) that runs automatically:

### On every push to `main` / `develop` and on PRs:

| Stage | What it does |
|-------|-------------|
| **Backend Lint** | Ruff linter + format check, Pyright type check |
| **Backend Tests** | pytest against a PostgreSQL service container (auth, gamedata, loadouts, calculations) |
| **Frontend Build** | `npm ci` + `npm run build` — verifies the React app compiles cleanly |
| **Docker Build** | Builds 3 images (backend, frontend, production) with multi-arch (amd64 + arm64) |
| **Registry Push** | Pushes to GitHub Container Registry (`ghcr.io`) with branch/tag/SHA tags |

### On version tags (`v*`):

| Stage | What it does |
|-------|-------------|
| **Deploy** | SSH into production server, pulls latest images, rolling restart, health check verification |

### Branch strategy

```
feature/* → PR → develop → PR → main → tag v2.1.0 → auto-deploy
```

## Production Deployment

### Option A: Single-image deploy (recommended)

The `Dockerfile.prod` builds a single production image containing nginx + gunicorn + the compiled frontend. This is the simplest deployment path.

```bash
# Clone the repo
git clone https://github.com/OWNER/REPO.git && cd REPO

# Generate secrets and start
cp .env.example .env
sed -i "s/CHANGE_ME_TO_RANDOM_PASSWORD/$(openssl rand -hex 16)/" .env
sed -i "s/CHANGE_ME_TO_RANDOM_SECRET/$(openssl rand -hex 32)/" .env

# Build and launch
docker compose -f docker-compose.prod.yml up -d --build
```

The production image includes:
- **Nginx** — static file serving, SPA routing, API reverse proxy, gzip, security headers, rate limiting, SSL-ready
- **Gunicorn + Uvicorn workers** — async Python, auto-scaled to CPU count, Unix socket IPC
- **Supervisor** — process manager keeping both nginx and gunicorn alive
- **Non-root execution** — app runs as `slt` user inside the container
- **Health check** — built-in `HEALTHCHECK` on `/api/health`

### Option B: Automated setup script

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

This script:
1. Checks prerequisites (Docker, git)
2. Creates `/opt/slt` deploy directory
3. Generates `.env` with cryptographically random secrets
4. Builds and starts all containers
5. Waits for health check confirmation

### SSL / HTTPS

The production nginx config has SSL directives pre-written but commented out. To enable:

1. Place your cert files:
   ```
   certs/slt.crt
   private/slt.key
   ```

2. Uncomment the SSL lines in `nginx/nginx.prod.conf`:
   ```nginx
   listen 443 ssl http2;
   ssl_certificate     /etc/ssl/certs/slt.crt;
   ssl_certificate_key /etc/ssl/private/slt.key;
   ```

3. Uncomment the cert volume mounts in `docker-compose.prod.yml`

4. Restart: `docker compose -f docker-compose.prod.yml up -d`

### Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `POSTGRES_PASSWORD` | Yes | — | Database password |
| `SECRET_KEY` | Yes | — | JWT signing key (use `openssl rand -hex 32`) |
| `POSTGRES_DB` | No | `slt_db` | Database name |
| `POSTGRES_USER` | No | `slt_user` | Database user |
| `LOG_LEVEL` | No | `info` | Gunicorn log level |
| `HTTP_PORT` | No | `80` | Host HTTP port |
| `HTTPS_PORT` | No | `443` | Host HTTPS port |

### Security hardening in production

The production config includes:
- **Rate limiting**: Auth endpoints at 5 req/min, API at 30 req/s, general at 60 req/s
- **Security headers**: CSP, X-Frame-Options, X-Content-Type-Options, XSS protection, Referrer-Policy, Permissions-Policy
- **Request size limits**: 2MB max body
- **Hidden server version**: `server_tokens off`
- **Dotfile blocking**: `location ~ /\. { deny all; }`
- **Non-root process**: gunicorn runs as `slt` user
- **Gunicorn hardening**: max requests with jitter (prevents memory leaks), preloaded app, request size limits

## Testing

```bash
cd backend

# Install test dependencies
pip install -r requirements.txt
pip install pytest pytest-asyncio httpx ruff

# Run all tests (needs PostgreSQL running)
DATABASE_URL=postgresql://slt_test:slt_test_pass@localhost:5432/slt_test_db \
  pytest tests/ -v

# Run specific test files
pytest tests/test_calculations.py -v    # Pure unit tests (no DB needed for calc functions)
pytest tests/test_auth.py -v            # Auth endpoints
pytest tests/test_gamedata.py -v        # Game data endpoints
pytest tests/test_loadouts.py -v        # CRUD endpoints

# Lint
ruff check .
ruff format --check .
```

## Project structure

```
slt-web/
├── .github/workflows/
│   └── ci.yml                    # CI/CD pipeline
├── backend/
│   ├── data/tables.db            # Read-only game data (52 chassis, 2565 NPCs, etc.)
│   ├── routers/
│   │   ├── auth_router.py        # Register, login, JWT
│   │   ├── gamedata_router.py    # Chassis, components, calculations, loot
│   │   └── loadout_router.py     # Loadout + component CRUD
│   ├── tests/
│   │   ├── conftest.py           # Test fixtures, DB setup, auth helper
│   │   ├── test_auth.py          # Auth endpoint tests
│   │   ├── test_calculations.py  # Calculation engine unit tests
│   │   ├── test_gamedata.py      # Game data API tests
│   │   └── test_loadouts.py      # CRUD endpoint tests
│   ├── auth.py                   # JWT + bcrypt
│   ├── calculations.py           # All game math (ported from desktop app)
│   ├── database.py               # SQLAlchemy models
│   ├── gamedata.py               # SQLite reader for tables.db
│   ├── main.py                   # FastAPI app
│   ├── Dockerfile                # Dev backend image
│   ├── pyproject.toml            # Ruff + pytest config
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/           # React UI components
│   │   ├── context/AuthContext.jsx
│   │   ├── api.js                # API client
│   │   ├── App.jsx               # Router + layout
│   │   └── main.jsx              # Entry point
│   ├── Dockerfile                # Dev frontend image (nginx)
│   ├── nginx.conf                # Dev nginx config
│   └── ...config files
├── nginx/
│   └── nginx.prod.conf           # Production nginx (security headers, rate limits, SSL)
├── scripts/
│   ├── deploy.sh                 # Automated server setup
│   ├── gunicorn.conf.py          # Production gunicorn config
│   └── supervisord.conf          # Process manager config
├── docker-compose.yml            # Development (3 services)
├── docker-compose.prod.yml       # Production (2 services: db + app)
├── Dockerfile.prod               # Unified production image
└── .env.example
```

## Credits

- **Original Tool**: [SeraphExodus](https://github.com/SeraphExodus/Seraphs-Loadout-Tool)
- **Game Data**: Star Wars Galaxies: Jump to Lightspeed
- **Web Conversion**: Built with FastAPI, React, and Docker
