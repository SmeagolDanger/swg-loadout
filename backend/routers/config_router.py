"""Site configuration endpoints."""

import json

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import require_role
from database import SiteConfig, get_db

router = APIRouter(prefix="/api/config", tags=["config"])

MODULES_KEY = "modules_enabled"


def _get_enabled(db: Session) -> list[str] | None:
    row = db.query(SiteConfig).filter(SiteConfig.key == MODULES_KEY).first()
    if not row or not row.value:
        return None  # None means "all enabled"
    try:
        return json.loads(row.value)
    except (json.JSONDecodeError, TypeError):
        return None


@router.get("/modules")
def get_module_config(db: Session = Depends(get_db)):
    enabled = _get_enabled(db)
    return {"enabled": enabled}


class ModuleConfigUpdate(BaseModel):
    enabled: list[str]


@router.put("/modules", dependencies=[Depends(require_role("admin"))])
def update_module_config(req: ModuleConfigUpdate, db: Session = Depends(get_db)):
    row = db.query(SiteConfig).filter(SiteConfig.key == MODULES_KEY).first()
    value = json.dumps(req.enabled)
    if row:
        row.value = value
    else:
        db.add(SiteConfig(key=MODULES_KEY, value=value))
    db.commit()
    return {"enabled": req.enabled}
