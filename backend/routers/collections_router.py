"""
Collections API router — drop into backend/routers/

Endpoints ported from the Node/Express collections backend:
  GET    /api/collections                  - list all groups + items
  GET    /api/collections/:groupId         - single group + items
  PUT    /api/admin/collections/groups/:id - edit group (admin)
  PUT    /api/admin/collections/items/:id  - edit item (admin)
  POST   /api/admin/collections/groups     - create group (admin)
  POST   /api/admin/collections/items      - create item (admin)
  DELETE /api/admin/collections/items/:id  - delete item (admin)
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
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

router = APIRouter(tags=["collections"])


# ── Schemas ──────────────────────────────────────────────────────────

class CollectionItemOut(BaseModel):
    id: int
    group_id: int
    name: str
    notes: str = ""
    difficulty: str = "medium"
    sort_order: int = 0

    class Config:
        from_attributes = True


class CollectionGroupOut(BaseModel):
    id: int
    name: str
    icon: str = "default"
    category: str = "other"
    description: str = ""
    sort_order: int = 0
    items: list[CollectionItemOut] = []

    class Config:
        from_attributes = True


class GroupUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None


class GroupCreate(BaseModel):
    name: str
    icon: str = "default"
    category: str = "other"
    description: str = ""


class ItemUpdate(BaseModel):
    name: Optional[str] = None
    notes: Optional[str] = None
    difficulty: Optional[str] = None


class ItemCreate(BaseModel):
    group_id: int
    name: str
    notes: str = ""
    difficulty: str = "medium"


# ── Helpers ──────────────────────────────────────────────────────────

def _require_admin(user: User):
    if not user or not getattr(user, "is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")


# ── Public endpoints ─────────────────────────────────────────────────

@router.get("/api/collections", response_model=list[CollectionGroupOut])
def list_collections(db: Session = Depends(get_db)):
    groups = db.query(CollectionGroup).order_by(CollectionGroup.sort_order).all()
    return groups


@router.get("/api/collections/{group_id}", response_model=CollectionGroupOut)
def get_collection_group(group_id: int, db: Session = Depends(get_db)):
    group = db.query(CollectionGroup).filter(CollectionGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return group


# ── Admin endpoints ──────────────────────────────────────────────────

@router.put("/api/admin/collections/groups/{group_id}")
def update_group(
    group_id: int,
    data: GroupUpdate,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    _require_admin(user)
    group = db.query(CollectionGroup).filter(CollectionGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(group, field, value)
    db.commit()
    return {"success": True}


@router.put("/api/admin/collections/items/{item_id}")
def update_item(
    item_id: int,
    data: ItemUpdate,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    _require_admin(user)
    item = db.query(CollectionItem).filter(CollectionItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    return {"success": True}


@router.post("/api/admin/collections/groups")
def create_group(
    data: GroupCreate,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    _require_admin(user)
    max_order = db.query(func.max(CollectionGroup.sort_order)).scalar() or 0
    group = CollectionGroup(
        name=data.name,
        icon=data.icon,
        category=data.category,
        description=data.description,
        sort_order=max_order + 1,
    )
    db.add(group)
    db.commit()
    db.refresh(group)
    return {"id": group.id}


@router.post("/api/admin/collections/items")
def create_item(
    data: ItemCreate,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    _require_admin(user)
    group = db.query(CollectionGroup).filter(CollectionGroup.id == data.group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    max_order = (
        db.query(func.max(CollectionItem.sort_order))
        .filter(CollectionItem.group_id == data.group_id)
        .scalar()
        or 0
    )
    item = CollectionItem(
        group_id=data.group_id,
        name=data.name,
        notes=data.notes,
        difficulty=data.difficulty,
        sort_order=max_order + 1,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"id": item.id}


@router.delete("/api/admin/collections/items/{item_id}")
def delete_item(
    item_id: int,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    _require_admin(user)
    item = db.query(CollectionItem).filter(CollectionItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return {"success": True}
