# SWG:L Space Tools

Unified toolkit for SWG Legends — combines the **Loadout Builder** and **Collection Tracker** into a single application with shared authentication.

> **Space tools based on [Seraph's Loadout Tool](https://github.com/SeraphExodus/Seraphs-Loadout-Tool)** by [SeraphExodus](https://github.com/SeraphExodus).
> The loadout builder, RE/FC calculators, component library, and game data tables are derived from Seraph's original desktop application.
> This project is licensed under the [GNU General Public License v2.0](LICENSE), the same license as the original.

## Features

### Loadout Tool
- Ship loadout builder with real-time stat calculations
- Component library and custom component management
- Reverse Engineering (RE) calculator with brand tables
- Flight Computer (FC) calculator with macro generation
- Loot source lookup with best-source analysis
- Community loadout sharing

### Collection Tracker
- 920+ trackable collection items across dozens of categories
- Per-character progress tracking with completion stats
- Category filtering and full-text search
- Waypoint copy-to-clipboard for in-game use
- Character directory with public profiles
- Global leaderboard with category breakdowns

### Shared
- Single user account works across all tools
- Admin panel for user and collection data management
- Responsive design — works on desktop and mobile
- Optional Discord OAuth login alongside local auth

---

## Quick Start (Development)

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for frontend dev)
- Python 3.12+ (for backend dev)

### 1. Start the database

```bash
docker compose up -d
```

This starts PostgreSQL on port 5432. The backend auto-creates all tables and seeds the 920+ collection items on first boot.

### 2. Start the backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173`. The Vite dev server proxies API calls to the backend.

---

## Production Deployment

### Option A: Docker (recommended)

#### 1. Create a `.env` file

```bash
POSTGRES_PASSWORD=your-secure-password-here
SECRET_KEY=your-jwt-secret-here-at-least-32-chars
POSTGRES_DB=slt_db
POSTGRES_USER=slt_user
```

Optional Discord OAuth settings:

```bash
PUBLIC_BASE_URL=https://your-domain.example
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret
DISCORD_REDIRECT_URI=https://your-domain.example/api/auth/discord/callback
```

Optional Better Stack logging settings:

```bash
BETTER_STACK_ENABLED=true
BETTER_STACK_SOURCE_TOKEN=your-better-stack-source-token
BETTER_STACK_INGESTING_HOST=your-ingesting-host
# Or use BETTER_STACK_HTTP_API_URL if Better Stack gave you a full URL
BETTER_STACK_INCLUDE_ACCESS_LOGS=false
BETTER_STACK_INCLUDE_HEALTHCHECKS=false
```

This integration keeps local JSON logs in place and, when configured, forwards backend application logs to Better Stack. Access logs and health-check request logs are excluded from Better Stack by default to keep noise and free-tier usage under control.

#### 2. Build and deploy

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

This builds a single container with Nginx + Gunicorn + the compiled frontend, plus a PostgreSQL container. The app will be available on port 80.

On first startup:
- All database tables are created automatically
- The 920+ collection items are seeded from `collections-data.json`

#### 3. Create your admin user

After the app is running, register a normal account through the UI, then promote it to admin via the database:

```bash
docker compose -f docker-compose.prod.yml exec db \
  psql -U slt_user -d slt_db \
  -c "UPDATE users SET is_admin = true, role = 'admin' WHERE username = 'your-username';"
```

Available roles: `user`, `admin`, `collection_admin`. The `admin` role has full access. The `collection_admin` role can manage collection groups and items but cannot access user management.

### Option B: Manual deployment

#### 1. Build the frontend

```bash
cd frontend
npm install
npm run build
```

This outputs to `frontend/dist/`.

#### 2. Copy frontend build to backend

```bash
cp -r frontend/dist backend/static
```

#### 3. Run the backend with Gunicorn

```bash
cd backend
pip install -r requirements.txt gunicorn

DATABASE_URL="postgresql://user:pass@localhost:5432/slt_db" \
SECRET_KEY="your-secret-key" \
gunicorn main:app -k uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 --workers 4
```

#### 4. Put Nginx in front

Use the provided `nginx/nginx.prod.conf` as a starting point, adjusting the upstream to point at your Gunicorn socket or port.

For uptime monitoring, point your monitor at `/api/health/ready`. The endpoint returns HTTP 200 only when startup has completed and the database check passes.

---

## Domain Configuration

### If migrating from separate subdomains

Previously:
```
space.jawatracks.com       → loadout tool
collections.jawatracks.com → collections tracker
```

Now everything runs at `space.jawatracks.com`. Add a redirect for the old collections domain:

```nginx
server {
    listen 80;
    server_name collections.jawatracks.com;
    return 301 https://space.jawatracks.com/collections$request_uri;
}
```

### URL structure

| Path | Page |
|------|------|
| `/` | Loadout Builder |
| `/auth` | Sign In / Register |
| `/loadouts` | My Loadouts |
| `/components` | My Components |
| `/re` | RE Calculator |
| `/fc` | FC Calculator |
| `/loot` | Loot Lookup |
| `/community` | Community Loadouts |
| `/collections` | Collection Tracker |
| `/characters` | Character Directory |
| `/leaderboard` | Collection Leaderboard |

---

## Architecture

```
┌─────────────────────────────────────────┐
│  Nginx (port 80/443)                    │
│  ├─ /assets/*  → static files (cached)  │
│  ├─ /api/*     → Gunicorn (FastAPI)      │
│  └─ /*         → index.html (SPA)        │
├─────────────────────────────────────────┤
│  FastAPI Backend                         │
│  ├─ auth_router      (JWT + bcrypt)      │
│  ├─ loadout_router   (CRUD)              │
│  ├─ gamedata_router  (chassis, calcs)    │
│  ├─ re_router        (RE calculator)     │
│  ├─ fc_router        (FC calculator)     │
│  ├─ import_router    (save file import)  │
│  ├─ collections_router (groups/items)    │
│  └─ characters_router  (chars, tracking) │
├─────────────────────────────────────────┤
│  PostgreSQL                              │
│  ├─ users                                │
│  ├─ loadouts, user_components            │
│  ├─ fc_loadouts, re_projects             │
│  ├─ characters                           │
│  ├─ collection_groups, collection_items  │
│  └─ character_collections                │
└─────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, React Router, Tailwind CSS, Vite, Lucide icons |
| Backend | Python 3.12, FastAPI, SQLAlchemy, Pydantic |
| Database | PostgreSQL 16 |
| Auth | JWT (python-jose) + bcrypt, 7-day token expiry |
| Server | Nginx + Gunicorn/Uvicorn |
| Deploy | Docker Compose |

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | `postgresql://slt_user:slt_pass@db:5432/slt_db` | PostgreSQL connection string |
| `SECRET_KEY` | Yes (prod) | dev default | JWT signing key |
| `POSTGRES_PASSWORD` | Yes (docker) | — | PostgreSQL password |
| `POSTGRES_DB` | No | `slt_db` | Database name |
| `POSTGRES_USER` | No | `slt_user` | Database user |
| `LOG_LEVEL` | No | `info` | Gunicorn log level |
| `BETTER_STACK_ENABLED` | No | `true` when configured | Enable Better Stack log forwarding when credentials are present |
| `BETTER_STACK_SOURCE_TOKEN` | No | — | Better Stack Logs source token |
| `BETTER_STACK_INGESTING_HOST` | No | — | Better Stack ingesting host, such as `s12345.eu-nbg-2.betterstackdata.com` |
| `BETTER_STACK_HTTP_API_URL` | No | — | Full Better Stack HTTP ingest URL, used instead of `BETTER_STACK_INGESTING_HOST` |
| `BETTER_STACK_LOG_LEVEL` | No | `LOG_LEVEL` | Minimum level sent to Better Stack |
| `BETTER_STACK_INCLUDE_ACCESS_LOGS` | No | `false` | Forward per-request access logs to Better Stack |
| `BETTER_STACK_INCLUDE_HEALTHCHECKS` | No | `false` | Forward `/api/health*` request logs to Better Stack |

---

## Collection Data

The 920+ collection items are stored in `backend/data/collections-data.json`. This file is auto-seeded into the database on first startup. To update collection data:

1. Edit `collections-data.json`
2. Delete existing entries: `TRUNCATE collection_groups CASCADE;`
3. Restart the app — it will re-seed from the JSON

The JSON structure:
```json
{
  "Group Name": {
    "icon": "emoji",
    "category": "exploration|combat|loot|profession|event|badge|space|other",
    "description": "Group description",
    "items": {
      "Item Name": {
        "notes": "In-game hints, waypoints, etc.",
        "difficulty": "easy|medium|hard|rare"
      }
    }
  }
}
```

---

## API Reference

All endpoints are prefixed with `/api`.

### Auth
- `POST /api/auth/register` — create account
- `POST /api/auth/login` — sign in (returns JWT)
- `GET /api/auth/me` — current user info

### Loadout Tool
- `GET/POST /api/loadouts` — list/create loadouts
- `GET/PUT/DELETE /api/loadouts/:id` — manage loadout
- `GET/POST /api/components` — list/create custom components
- `GET /api/gamedata/*` — chassis, component library, calculations
- `POST /api/re/analyze` — RE analysis
- `POST /api/fc/cooldowns` — FC calculations

### Collections
- `GET /api/collections` — all groups with items
- `GET /api/collections/:id` — single group
- `GET /api/characters` — search/list characters
- `GET /api/characters/:id` — character with completed collections
- `POST /api/characters` — create character
- `POST /api/characters/:id/collections` — mark item collected
- `POST /api/characters/:id/collections/bulk` — bulk collect
- `DELETE /api/characters/:cid/collections/:iid` — uncollect
- `GET /api/characters/:id/stats` — category breakdown
- `GET /api/stats` — global statistics
- `GET /api/leaderboard` — ranked leaderboard

### Admin (requires `is_admin = true`)
- `PUT /api/admin/collections/groups/:id` — edit group
- `POST /api/admin/collections/groups` — create group
- `PUT /api/admin/collections/items/:id` — edit item
- `POST /api/admin/collections/items` — create item
- `DELETE /api/admin/collections/items/:id` — delete item


## Password reset email

The app supports forgot-password emails through Postmark. Configure these environment variables in production:

- `POSTMARK_SERVER_TOKEN`
- `POSTMARK_FROM_EMAIL`
- `POSTMARK_MESSAGE_STREAM` (optional, defaults to `outbound`)
- `PUBLIC_BASE_URL`

Reset links are sent to `${PUBLIC_BASE_URL}/auth/reset-password?token=...` and expire after 60 minutes. Postmark uses the server token in the `X-Postmark-Server-Token` header for `/email` requests.
