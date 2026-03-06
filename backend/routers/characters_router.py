"""
Characters API router — drop into backend/routers/

Endpoints ported from the Node/Express collections backend:
  GET    /api/characters                       - list/search characters
  GET    /api/characters/:id                   - character detail + completed
  POST   /api/characters                       - create character
  PUT    /api/characters/:id                   - update character
  DELETE /api/characters/:id                   - delete character
  POST   /api/characters/:id/collections       - mark item collected
  POST   /api/characters/:id/collections/bulk  - bulk mark items collected
  DELETE /api/characters/:cid/collections/:iid - uncollect item
  GET    /api/characters/:id/stats             - per-category breakdown
  GET    /api/stats                            - global stats
  GET    /api/leaderboard                      - public leaderboard
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, and_
from sqlalchemy.orm import Session

from auth import get_current_user, require_user
from database import (
    Character,
    CharacterCollection,
    CollectionGroup,
    CollectionItem,
    User,
    get_db,
)

router = APIRouter(tags=["characters"])


# ── Schemas ──────────────────────────────────────────────────────────

class CharacterCreate(BaseModel):
    name: str
    server: str = "Legends"
    species: str = ""
    profession: str = ""
    combat_level: int = 1
    guild: str = ""
    bio: str = ""
    is_public: bool = True


class CharacterUpdate(BaseModel):
    name: Optional[str] = None
    server: Optional[str] = None
    species: Optional[str] = None
    profession: Optional[str] = None
    combat_level: Optional[int] = None
    guild: Optional[str] = None
    bio: Optional[str] = None
    is_public: Optional[bool] = None


class CollectRequest(BaseModel):
    item_id: int
    notes: str = ""


class BulkCollectRequest(BaseModel):
    item_ids: list[int]


class CharacterOut(BaseModel):
    id: int
    user_id: int
    name: str
    server: str
    species: str
    profession: str
    combat_level: int
    guild: str
    bio: str
    is_public: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    # Populated by queries, not the ORM directly
    username: Optional[str] = None
    owner_name: Optional[str] = None
    collection_count: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


# ── Helpers ──────────────────────────────────────────────────────────

def _own_or_admin(user: User, character: Character):
    if character.user_id != user.id and not getattr(user, "is_admin", False):
        raise HTTPException(status_code=403, detail="Not your character")


def _visible(user: Optional[User], character: Character):
    if not character.is_public and (not user or user.id != character.user_id):
        raise HTTPException(status_code=403, detail="Character is private")


# ── CRUD ─────────────────────────────────────────────────────────────

@router.get("/api/characters")
def list_characters(
    search: Optional[str] = None,
    user_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(
        Character,
        User.username,
        User.display_name.label("owner_name"),
        func.count(CharacterCollection.id).label("collection_count"),
    ).join(User, Character.user_id == User.id).outerjoin(
        CharacterCollection, CharacterCollection.character_id == Character.id
    ).group_by(Character.id, User.username, User.display_name)

    # Visibility
    if user:
        q = q.filter((Character.is_public == True) | (Character.user_id == user.id))
    else:
        q = q.filter(Character.is_public == True)

    if search:
        like = f"%{search}%"
        q = q.filter(
            (Character.name.ilike(like))
            | (Character.profession.ilike(like))
            | (Character.guild.ilike(like))
            | (User.username.ilike(like))
        )
    if user_id:
        q = q.filter(Character.user_id == user_id)

    total = q.count()
    rows = q.order_by(Character.updated_at.desc()).offset((page - 1) * limit).limit(limit).all()

    characters = []
    for char, username, owner_name, cc_count in rows:
        d = {
            "id": char.id, "user_id": char.user_id, "name": char.name,
            "server": char.server, "species": char.species, "profession": char.profession,
            "combat_level": char.combat_level, "guild": char.guild, "bio": char.bio,
            "is_public": char.is_public, "created_at": char.created_at,
            "updated_at": char.updated_at, "username": username,
            "owner_name": owner_name, "collection_count": cc_count,
        }
        characters.append(d)

    return {"characters": characters, "total": total, "page": page, "limit": limit}


@router.get("/api/characters/{char_id}")
def get_character(
    char_id: int,
    user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    char = db.query(Character).filter(Character.id == char_id).first()
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    _visible(user, char)

    owner = db.query(User).filter(User.id == char.user_id).first()
    completed = (
        db.query(
            CharacterCollection,
            CollectionItem.name.label("item_name"),
            CollectionItem.notes.label("item_notes"),
            CollectionItem.difficulty,
            CollectionGroup.name.label("group_name"),
            CollectionGroup.icon,
            CollectionGroup.category,
        )
        .join(CollectionItem, CharacterCollection.item_id == CollectionItem.id)
        .join(CollectionGroup, CollectionItem.group_id == CollectionGroup.id)
        .filter(CharacterCollection.character_id == char_id)
        .order_by(CollectionGroup.sort_order, CollectionItem.sort_order)
        .all()
    )

    completed_list = [
        {
            "id": cc.id, "item_id": cc.item_id, "character_id": cc.character_id,
            "completed_at": cc.completed_at, "notes": cc.notes,
            "item_name": item_name, "item_notes": item_notes,
            "difficulty": diff, "group_name": gname, "icon": icon, "category": cat,
        }
        for cc, item_name, item_notes, diff, gname, icon, cat in completed
    ]

    return {
        "id": char.id, "user_id": char.user_id, "name": char.name,
        "server": char.server, "species": char.species, "profession": char.profession,
        "combat_level": char.combat_level, "guild": char.guild, "bio": char.bio,
        "is_public": char.is_public, "created_at": char.created_at,
        "updated_at": char.updated_at,
        "username": owner.username if owner else None,
        "owner_name": owner.display_name if owner else None,
        "completed_collections": completed_list,
    }


@router.post("/api/characters")
def create_character(
    data: CharacterCreate,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    char = Character(user_id=user.id, **data.model_dump())
    db.add(char)
    db.commit()
    db.refresh(char)
    return {"id": char.id}


@router.put("/api/characters/{char_id}")
def update_character(
    char_id: int,
    data: CharacterUpdate,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    char = db.query(Character).filter(Character.id == char_id).first()
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    _own_or_admin(user, char)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(char, field, value)
    char.updated_at = datetime.utcnow()
    db.commit()
    return {"success": True}


@router.delete("/api/characters/{char_id}")
def delete_character(
    char_id: int,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    char = db.query(Character).filter(Character.id == char_id).first()
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    _own_or_admin(user, char)
    db.delete(char)
    db.commit()
    return {"success": True}


# ── Collection tracking ──────────────────────────────────────────────

@router.post("/api/characters/{char_id}/collections")
def collect_item(
    char_id: int,
    data: CollectRequest,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    char = db.query(Character).filter(Character.id == char_id).first()
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    _own_or_admin(user, char)

    existing = db.query(CharacterCollection).filter(
        CharacterCollection.character_id == char_id,
        CharacterCollection.item_id == data.item_id,
    ).first()
    if existing:
        return {"success": True, "message": "Already collected"}

    cc = CharacterCollection(character_id=char_id, item_id=data.item_id, notes=data.notes)
    db.add(cc)
    char.updated_at = datetime.utcnow()
    db.commit()
    return {"success": True}


@router.post("/api/characters/{char_id}/collections/bulk")
def bulk_collect(
    char_id: int,
    data: BulkCollectRequest,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    char = db.query(Character).filter(Character.id == char_id).first()
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    _own_or_admin(user, char)

    existing_ids = set(
        r[0] for r in db.query(CharacterCollection.item_id)
        .filter(CharacterCollection.character_id == char_id, CharacterCollection.item_id.in_(data.item_ids))
        .all()
    )
    count = 0
    for item_id in data.item_ids:
        if item_id not in existing_ids:
            db.add(CharacterCollection(character_id=char_id, item_id=item_id))
            count += 1
    char.updated_at = datetime.utcnow()
    db.commit()
    return {"success": True, "added": count}


@router.delete("/api/characters/{char_id}/collections/{item_id}")
def uncollect_item(
    char_id: int,
    item_id: int,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    char = db.query(Character).filter(Character.id == char_id).first()
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    _own_or_admin(user, char)

    cc = db.query(CharacterCollection).filter(
        CharacterCollection.character_id == char_id,
        CharacterCollection.item_id == item_id,
    ).first()
    if cc:
        db.delete(cc)
        char.updated_at = datetime.utcnow()
        db.commit()
    return {"success": True}


# ── Stats & Leaderboard ─────────────────────────────────────────────

@router.get("/api/characters/{char_id}/stats")
def character_stats(
    char_id: int,
    user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    char = db.query(Character).filter(Character.id == char_id).first()
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    _visible(user, char)

    groups = db.query(CollectionGroup).order_by(CollectionGroup.sort_order).all()
    breakdown = []
    total_items = 0
    total_completed = 0

    for g in groups:
        item_count = db.query(func.count(CollectionItem.id)).filter(CollectionItem.group_id == g.id).scalar()
        completed_count = (
            db.query(func.count(CharacterCollection.id))
            .join(CollectionItem, CharacterCollection.item_id == CollectionItem.id)
            .filter(
                CharacterCollection.character_id == char_id,
                CollectionItem.group_id == g.id,
            )
            .scalar()
        )
        breakdown.append({
            "group_id": g.id, "group_name": g.name, "category": g.category,
            "icon": g.icon, "total_items": item_count, "completed_items": completed_count,
        })
        total_items += item_count
        total_completed += completed_count

    return {"breakdown": breakdown, "totalItems": total_items, "totalCompleted": total_completed}


@router.get("/api/stats")
def global_stats(db: Session = Depends(get_db)):
    total_items = db.query(func.count(CollectionItem.id)).scalar()
    total_groups = db.query(func.count(CollectionGroup.id)).scalar()
    total_users = db.query(func.count(User.id)).scalar()
    total_characters = db.query(func.count(Character.id)).filter(Character.is_public == True).scalar()

    top_characters = (
        db.query(
            Character.name, Character.profession, Character.guild,
            User.display_name.label("owner"),
            func.count(CharacterCollection.id).label("count"),
        )
        .join(User, Character.user_id == User.id)
        .outerjoin(CharacterCollection, CharacterCollection.character_id == Character.id)
        .filter(Character.is_public == True)
        .group_by(Character.id, Character.name, Character.profession, Character.guild, User.display_name)
        .order_by(func.count(CharacterCollection.id).desc())
        .limit(10)
        .all()
    )

    return {
        "totalItems": total_items,
        "totalGroups": total_groups,
        "totalUsers": total_users,
        "totalCharacters": total_characters,
        "topCharacters": [
            {"name": c.name, "profession": c.profession, "guild": c.guild, "owner": c.owner, "count": c.count}
            for c in top_characters
        ],
    }


@router.get("/api/leaderboard")
def leaderboard(
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    category: Optional[str] = None,
    db: Session = Depends(get_db),
):
    if category:
        # Count of characters that have at least one item in this category
        total = (
            db.query(func.count(func.distinct(Character.id)))
            .filter(Character.is_public == True)
            .join(CharacterCollection, CharacterCollection.character_id == Character.id)
            .join(CollectionItem, CharacterCollection.item_id == CollectionItem.id)
            .join(CollectionGroup, CollectionItem.group_id == CollectionGroup.id)
            .filter(CollectionGroup.category == category)
            .scalar()
        )
        total_in_cat = (
            db.query(func.count(CollectionItem.id))
            .join(CollectionGroup, CollectionItem.group_id == CollectionGroup.id)
            .filter(CollectionGroup.category == category)
            .scalar()
        )

        # Subquery for collected count in category
        collected_sub = (
            db.query(
                CharacterCollection.character_id,
                func.count(CharacterCollection.id).label("collected"),
            )
            .join(CollectionItem, CharacterCollection.item_id == CollectionItem.id)
            .join(CollectionGroup, CollectionItem.group_id == CollectionGroup.id)
            .filter(CollectionGroup.category == category)
            .group_by(CharacterCollection.character_id)
            .subquery()
        )

        entries = (
            db.query(
                Character.id, Character.name, Character.species, Character.profession,
                Character.combat_level, Character.guild,
                User.display_name.label("owner"), User.username,
                collected_sub.c.collected,
            )
            .join(User, Character.user_id == User.id)
            .join(collected_sub, collected_sub.c.character_id == Character.id)
            .filter(Character.is_public == True)
            .order_by(collected_sub.c.collected.desc(), Character.name)
            .offset(offset).limit(limit)
            .all()
        )

        return {
            "entries": [
                {
                    "id": e.id, "name": e.name, "species": e.species,
                    "profession": e.profession, "combat_level": e.combat_level,
                    "guild": e.guild, "owner": e.owner, "username": e.username,
                    "collected": e.collected, "total_in_cat": total_in_cat,
                }
                for e in entries
            ],
            "total": total,
            "category": category,
        }
    else:
        total = db.query(func.count(Character.id)).filter(Character.is_public == True).scalar()
        total_items = db.query(func.count(CollectionItem.id)).scalar()

        collected_sub = (
            db.query(
                CharacterCollection.character_id,
                func.count(CharacterCollection.id).label("collected"),
            )
            .group_by(CharacterCollection.character_id)
            .subquery()
        )

        entries = (
            db.query(
                Character.id, Character.name, Character.species, Character.profession,
                Character.combat_level, Character.guild,
                User.display_name.label("owner"), User.username,
                func.coalesce(collected_sub.c.collected, 0).label("collected"),
            )
            .join(User, Character.user_id == User.id)
            .outerjoin(collected_sub, collected_sub.c.character_id == Character.id)
            .filter(Character.is_public == True)
            .order_by(func.coalesce(collected_sub.c.collected, 0).desc(), Character.name)
            .offset(offset).limit(limit)
            .all()
        )

        return {
            "entries": [
                {
                    "id": e.id, "name": e.name, "species": e.species,
                    "profession": e.profession, "combat_level": e.combat_level,
                    "guild": e.guild, "owner": e.owner, "username": e.username,
                    "collected": e.collected,
                }
                for e in entries
            ],
            "total": total,
            "totalItems": total_items,
        }
