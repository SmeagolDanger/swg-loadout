"""
Admin API router

Endpoints (all require admin role unless noted):
  GET    /api/admin/users              - list users with search/pagination
  PUT    /api/admin/users/:id/role     - change user role
  PUT    /api/admin/users/:id/active   - toggle active status
  PUT    /api/admin/users/:id/password - reset user password
  DELETE /api/admin/users/:id          - delete user and all their data
  GET    /api/admin/stats              - site-wide statistics
  PUT    /api/admin/loadouts/:id/featured - toggle featured flag
  GET    /api/admin/featured-loadouts  - list featured loadouts
"""
# pyright: reportArgumentType=false, reportAssignmentType=false, reportAttributeAccessIssue=false, reportOperatorIssue=false

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth import get_password_hash, require_role
from database import (
    Character,
    CharacterCollection,
    CollectionGroup,
    CollectionItem,
    Loadout,
    User,
    UserComponent,
    get_db,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])

VALID_ROLES = ("user", "admin", "collection_admin")


# ── Schemas ──────────────────────────────────────────────────────────


class AdminUserOut(BaseModel):
    id: int
    username: str
    email: str
    display_name: str | None = None
    role: str = "user"
    is_admin: bool = False
    is_active: bool = True
    created_at: str | None = None
    loadout_count: int = 0
    component_count: int = 0
    character_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class RoleUpdate(BaseModel):
    role: Literal["user", "admin", "collection_admin"]


class ActiveUpdate(BaseModel):
    is_active: bool


class PasswordReset(BaseModel):
    new_password: str


class FeaturedUpdate(BaseModel):
    is_featured: bool


class AdminLoadoutOut(BaseModel):
    id: int
    name: str
    chassis: str
    owner_name: str = ""
    is_public: bool = False
    is_featured: bool = False
    created_at: str | None = None


class SiteStats(BaseModel):
    total_users: int = 0
    active_users: int = 0
    total_loadouts: int = 0
    public_loadouts: int = 0
    featured_loadouts: int = 0
    total_components: int = 0
    total_characters: int = 0
    total_collection_groups: int = 0
    total_collection_items: int = 0
    total_items_collected: int = 0


# ── User Management ─────────────────────────────────────────────────


@router.get("/users", response_model=list[AdminUserOut])
def list_users(
    search: str = "",
    role: str = "",
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    q = db.query(User)
    if search:
        pattern = f"%{search}%"
        q = q.filter(User.username.ilike(pattern) | User.email.ilike(pattern) | User.display_name.ilike(pattern))
    if role and role in VALID_ROLES:
        q = q.filter(User.role == role)

    users = q.order_by(User.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    result = []
    for u in users:
        out = AdminUserOut(
            id=u.id,
            username=u.username,
            email=u.email,
            display_name=u.display_name,
            role=u.role or ("admin" if u.is_admin else "user"),
            is_admin=u.is_admin,
            is_active=u.is_active if u.is_active is not None else True,
            created_at=u.created_at.isoformat() if u.created_at else None,
            loadout_count=db.query(func.count(Loadout.id)).filter(Loadout.user_id == u.id).scalar() or 0,
            component_count=db.query(func.count(UserComponent.id)).filter(UserComponent.user_id == u.id).scalar() or 0,
            character_count=db.query(func.count(Character.id)).filter(Character.user_id == u.id).scalar() or 0,
        )
        result.append(out)
    return result


@router.put("/users/{user_id}/role")
def update_user_role(
    user_id: int,
    data: RoleUpdate,
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == user.id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")

    target.role = data.role
    target.is_admin = data.role == "admin"
    db.commit()
    return {"success": True, "role": data.role}


@router.put("/users/{user_id}/active")
def toggle_user_active(
    user_id: int,
    data: ActiveUpdate,
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")

    target.is_active = data.is_active
    db.commit()
    return {"success": True, "is_active": data.is_active}


@router.put("/users/{user_id}/password")
def reset_user_password(
    user_id: int,
    data: PasswordReset,
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    target.hashed_password = get_password_hash(data.new_password)
    db.commit()
    return {"success": True}


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    db.delete(target)
    db.commit()
    return {"success": True}


# ── Featured Loadouts ────────────────────────────────────────────────


@router.get("/featured-loadouts", response_model=list[AdminLoadoutOut])
def list_featured_loadouts(
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    loadouts = db.query(Loadout).filter(Loadout.is_featured).all()
    result = []
    for lo in loadouts:
        owner = db.query(User).filter(User.id == lo.user_id).first()
        result.append(
            AdminLoadoutOut(
                id=lo.id,
                name=lo.name,
                chassis=lo.chassis,
                owner_name=owner.display_name or owner.username if owner else "Unknown",
                is_public=lo.is_public,
                is_featured=lo.is_featured if lo.is_featured else False,
                created_at=lo.created_at.isoformat() if lo.created_at else None,
            )
        )
    return result


@router.put("/loadouts/{loadout_id}/featured")
def toggle_featured(
    loadout_id: int,
    data: FeaturedUpdate,
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    lo = db.query(Loadout).filter(Loadout.id == loadout_id).first()
    if not lo:
        raise HTTPException(status_code=404, detail="Loadout not found")

    lo.is_featured = data.is_featured
    if data.is_featured:
        lo.is_public = True  # Featured loadouts must be public
    db.commit()
    return {"success": True, "is_featured": lo.is_featured}


# ── Site Statistics ──────────────────────────────────────────────────


@router.get("/stats", response_model=SiteStats)
def get_site_stats(
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    return SiteStats(
        total_users=db.query(func.count(User.id)).scalar() or 0,
        active_users=db.query(func.count(User.id)).filter(User.is_active).scalar() or 0,
        total_loadouts=db.query(func.count(Loadout.id)).scalar() or 0,
        public_loadouts=db.query(func.count(Loadout.id)).filter(Loadout.is_public).scalar() or 0,
        featured_loadouts=db.query(func.count(Loadout.id)).filter(Loadout.is_featured).scalar() or 0,
        total_components=db.query(func.count(UserComponent.id)).scalar() or 0,
        total_characters=db.query(func.count(Character.id)).scalar() or 0,
        total_collection_groups=db.query(func.count(CollectionGroup.id)).scalar() or 0,
        total_collection_items=db.query(func.count(CollectionItem.id)).scalar() or 0,
        total_items_collected=db.query(func.count(CharacterCollection.id)).scalar() or 0,
    )
