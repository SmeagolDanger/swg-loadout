"""Entertainer Buff Build save/load endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from auth import require_user
from database import EntBuffBuild, User, get_db

router = APIRouter(prefix="/api/ent-buff-builds", tags=["ent-buff-builds"])


class EntBuffBuildSave(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    serialized: str = Field(..., max_length=500)


def _to_response(build: EntBuffBuild) -> dict:
    return {
        "id": build.id,
        "name": build.name,
        "serialized": build.serialized,
        "created_at": build.created_at.isoformat() if build.created_at else None,
        "updated_at": build.updated_at.isoformat() if build.updated_at else None,
    }


@router.get("")
def list_builds(user: User = Depends(require_user), db: Session = Depends(get_db)):
    builds = db.query(EntBuffBuild).filter(EntBuffBuild.user_id == user.id).order_by(EntBuffBuild.name).all()
    return [_to_response(b) for b in builds]


@router.post("")
def save_build(req: EntBuffBuildSave, user: User = Depends(require_user), db: Session = Depends(get_db)):
    existing = db.query(EntBuffBuild).filter(EntBuffBuild.user_id == user.id, EntBuffBuild.name == req.name).first()
    if existing:
        existing.serialized = req.serialized
    else:
        db.add(EntBuffBuild(user_id=user.id, name=req.name, serialized=req.serialized))
    db.commit()
    return {"message": "Build saved"}


@router.delete("/{build_id}")
def delete_build(build_id: int, user: User = Depends(require_user), db: Session = Depends(get_db)):
    build = db.query(EntBuffBuild).filter(EntBuffBuild.id == build_id, EntBuffBuild.user_id == user.id).first()
    if not build:
        raise HTTPException(status_code=404, detail="Build not found")
    db.delete(build)
    db.commit()
    return {"message": "Build deleted"}
