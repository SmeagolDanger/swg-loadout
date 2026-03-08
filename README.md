# SWG:L Tools

Unified toolkit for SWG Legends with curated tools, build sharing, collections tracking, buildout mapping, GCW utilities, entertainer buff planning, and curated mod downloads.

> **Space tools and buildouts are based on [Seraph's Loadout Tool](https://github.com/SeraphExodus/Seraphs-Loadout-Tool)** by [SeraphExodus](https://github.com/SeraphExodus).
> The loadout builder, RE/FC calculators, component library, game data tables, and buildout functionality are derived from or inspired by Seraph's original desktop application.
>
> **GCW calculator** is based on the original `gcwcalc` project.
>
> **Entertainer buffs** are based on the original SWG entertainer buff builder by Sipherius.

This project is licensed under the [GNU General Public License v2.0](LICENSE), matching the original Seraph tool lineage.

## Current feature set

### Space tools
- Ship loadout builder with real-time stat calculations
- Component library and custom component management
- Reverse Engineering calculator
- Flight Computer calculator
- Loot source lookup and best-source analysis
- Public, community, and starter build support

### Buildouts
- Space buildout explorer with interactive 2D/3D map views
- Zone parsing and bundled buildout data
- Waypoint and route export helpers

### Collections
- 920+ trackable collection items across dozens of categories
- Per-character progress tracking with completion stats
- Character directory and leaderboard

### Utility tools
- GCW rank calculator aligned to the original source behavior
- Entertainer buff builder with compact request planning

### Curated mods
- Admin-managed game mod library
- Screenshots, install instructions, and compatibility notes
- Multiple uploaded files bundled into a single download
- Single uploaded zip served directly without re-zipping

### Shared platform features
- Shared authentication across the site
- Admin panel for users, collections, starter builds, and curated mods
- Responsive React frontend with a unified design system

---

## Quick start (development)

### Prerequisites
- Docker & Docker Compose
- Node.js 20+
- Python 3.12+

### 1. Start the database

```bash
docker compose up -d
```

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

Visit `http://localhost:5173`.

---

## Production deployment

### Docker deployment

#### 1. Create `.env`

Minimum required values:

```bash
POSTGRES_PASSWORD=replace_me
SECRET_KEY=replace_me_with_a_long_random_secret
POSTGRES_DB=slt_db
POSTGRES_USER=slt_user
HTTP_PORT=80
HTTPS_PORT=443
```

#### 2. Prepare persistent mod storage

Curated mod uploads are stored outside the repo checkout so future `git pull` operations do not get polluted by uploaded files.

Create the host directories:

```bash
sudo mkdir -p /opt/swg-loadout-data/mods/files
sudo mkdir -p /opt/swg-loadout-data/mods/screenshots
sudo mkdir -p /opt/swg-loadout-data/mods/uploads
```

Set ownership for the in-container `slt` user, which uses UID/GID `999:999` in the production image:

```bash
sudo chown -R 999:999 /opt/swg-loadout-data/mods
sudo chmod -R u+rwX,go+rX /opt/swg-loadout-data/mods
```

The production compose file mounts this host path to `/app/data/mods` inside the container.

#### 3. Build and start

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

#### 4. Verify health

```bash
curl -sf http://localhost/api/health
```

#### 5. Promote an admin user

Register through the UI, then run:

```bash
docker compose -f docker-compose.prod.yml exec db \
  psql -U slt_user -d slt_db \
  -c "UPDATE users SET is_admin = true, role = 'admin' WHERE username = 'your-username';"
```

### Deployment script

The included deployment helper:

```bash
./scripts/deploy.sh
```

now:
- creates `/opt/swg-loadout-data/mods/{files,screenshots,uploads}`
- applies the correct upload ownership (`999:999`)
- generates a `.env` file if missing
- starts the production stack
- checks the real production health endpoint

---

## Main routes

| Path | Page |
|------|------|
| `/` | Welcome screen |
| `/tools` | Space tools / builder |
| `/tools/buildouts` | Buildout explorer |
| `/tools/gcw` | GCW calculator |
| `/tools/ent-buffs` | Entertainer buffs |
| `/starter-builds` | Starter builds |
| `/community` | Community builds |
| `/collections` | Collection tracker |
| `/mods` | Curated game mods |
| `/auth` | Sign in / register |
| `/admin` | Admin panel |

---

## Architecture

```text
┌─────────────────────────────────────────┐
│ Nginx (port 80/443)                     │
│ ├─ /assets/*  → static frontend assets  │
│ ├─ /api/*     → Gunicorn / FastAPI      │
│ └─ /*         → SPA fallback            │
├─────────────────────────────────────────┤
│ FastAPI backend                         │
│ ├─ auth_router                          │
│ ├─ loadout_router                       │
│ ├─ buildout_router                      │
│ ├─ gamedata_router                      │
│ ├─ re_router                            │
│ ├─ fc_router                            │
│ ├─ collections_router                   │
│ ├─ characters_router                    │
│ ├─ mods_router                          │
│ └─ admin_router                         │
├─────────────────────────────────────────┤
│ PostgreSQL                              │
│ ├─ users                                │
│ ├─ loadouts / starter metadata          │
│ ├─ collections                          │
│ ├─ characters                           │
│ └─ curated mods metadata                │
├─────────────────────────────────────────┤
│ Host-mounted persistent storage         │
│ └─ /opt/swg-loadout-data/mods           │
│    ├─ files                             │
│    ├─ screenshots                       │
│    └─ uploads                           │
└─────────────────────────────────────────┘
```

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `POSTGRES_PASSWORD` | Yes | — | PostgreSQL password |
| `SECRET_KEY` | Yes | — | JWT signing key |
| `POSTGRES_DB` | No | `slt_db` | Database name |
| `POSTGRES_USER` | No | `slt_user` | Database user |
| `LOG_LEVEL` | No | `info` | Application log level |
| `HTTP_PORT` | No | `80` | Public HTTP bind port |
| `HTTPS_PORT` | No | `443` | Public HTTPS bind port |
| `REGISTRY` | No | `ghcr.io` | Optional registry prefix |
| `IMAGE_NAME` | No | `seraphs-loadout-tool` | Image name |
| `IMAGE_TAG` | No | `latest` | Image tag |

---

## Notes on curated mod uploads

- Uploaded mod files and screenshots are **not** stored in the database.
- They are written to `/app/data/mods` inside the container.
- In production, that path should stay bind-mounted to `/opt/swg-loadout-data/mods` on the host.
- If uploads begin failing after a server migration, check ownership first:

```bash
sudo chown -R 999:999 /opt/swg-loadout-data/mods
sudo chmod -R u+rwX,go+rX /opt/swg-loadout-data/mods
```

- If only one uploaded mod file is already a `.zip`, the download endpoint serves it directly.
- If multiple files are uploaded for a mod, the download endpoint bundles them into a generated zip.
