import json
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from database import (
    CollectionGroup,
    CollectionItem,
    SessionLocal,
    init_db,
)
from routers.auth_router import router as auth_router
from routers.characters_router import router as characters_router
from routers.collections_router import router as collections_router
from routers.fc_router import router as fc_router
from routers.gamedata_router import router as gamedata_router
from routers.import_router import router as import_router
from routers.loadout_router import router as loadout_router
from routers.re_router import router as re_router

logger = logging.getLogger("slt")


def seed_collections():
    """Seed collection groups and items from JSON if the DB is empty."""
    data_path = os.path.join(os.path.dirname(__file__), "data", "collections-data.json")
    if not os.path.exists(data_path):
        logger.warning("collections-data.json not found — skipping seed")
        return

    db = SessionLocal()
    try:
        existing = db.query(CollectionGroup).count()
        if existing > 0:
            logger.info(f"Collections already seeded ({existing} groups)")
            return

        with open(data_path) as f:
            collections = json.load(f)

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
                db.add(CollectionItem(
                    group_id=group.id,
                    name=item_name,
                    notes=item_data.get("notes", ""),
                    difficulty=item_data.get("difficulty", "medium"),
                    sort_order=item_order,
                ))
                total_items += 1

        db.commit()
        logger.info(f"Seeded {group_order} collection groups with {total_items} items")
    except Exception as e:
        db.rollback()
        logger.error(f"Collection seed failed: {e}")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(application: FastAPI):
    init_db()
    seed_collections()
    yield


app = FastAPI(title="SWG:L Space Tools", version="3.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(characters_router)
app.include_router(collections_router)
app.include_router(fc_router)
app.include_router(gamedata_router)
app.include_router(import_router)
app.include_router(loadout_router)
app.include_router(re_router)


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "3.0.0"}


# Serve frontend static files in production
frontend_path = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(frontend_path):
