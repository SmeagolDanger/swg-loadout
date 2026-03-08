from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import or_
from sqlalchemy.orm import Session

from auth import get_current_user, require_user
from database import Loadout, User, UserComponent, get_db

router = APIRouter(prefix="/api", tags=["loadouts"])


# --- Loadout models ---


class LoadoutCreate(BaseModel):
    name: str
    chassis: str
    mass: float = 0
    reactor: str = "None"
    engine: str = "None"
    booster: str = "None"
    shield: str = "None"
    front_armor: str = "None"
    rear_armor: str = "None"
    capacitor: str = "None"
    cargo_hold: str = "None"
    droid_interface: str = "None"
    slot1: str = "None"
    slot2: str = "None"
    slot3: str = "None"
    slot4: str = "None"
    slot5: str = "None"
    slot6: str = "None"
    slot7: str = "None"
    slot8: str = "None"
    pack1: str = "None"
    pack2: str = "None"
    pack3: str = "None"
    pack4: str = "None"
    pack5: str = "None"
    pack6: str = "None"
    pack7: str = "None"
    pack8: str = "None"
    ro_level: str = "None"
    eo_level: str = "None"
    co_level: str = "None"
    wo_level: str = "None"
    shield_adjust: str = "None"
    is_public: bool = False
    is_starter: bool = False
    starter_description: str = ""
    starter_tags: str = ""


class LoadoutResponse(BaseModel):
    id: int
    name: str
    chassis: str
    mass: float
    reactor: str
    engine: str
    booster: str
    shield: str
    front_armor: str
    rear_armor: str
    capacitor: str
    cargo_hold: str
    droid_interface: str
    slot1: str
    slot2: str
    slot3: str
    slot4: str
    slot5: str
    slot6: str
    slot7: str
    slot8: str
    pack1: str
    pack2: str
    pack3: str
    pack4: str
    pack5: str
    pack6: str
    pack7: str
    pack8: str
    ro_level: str
    eo_level: str
    co_level: str
    wo_level: str
    shield_adjust: str
    is_public: bool
    is_featured: bool = False
    is_starter: bool = False
    starter_description: str = ""
    starter_tags: str = ""
    owner_name: str | None = None
    resolved_components: dict | None = None

    model_config = ConfigDict(from_attributes=True)


def _loadout_to_response(loadout: Loadout) -> LoadoutResponse:
    payload = {
        column.name: getattr(loadout, column.name)
        for column in Loadout.__table__.columns
        if column.name in LoadoutResponse.model_fields
    }
    payload["is_featured"] = bool(payload.get("is_featured"))
    payload["is_starter"] = bool(payload.get("is_starter"))
    payload["starter_description"] = payload.get("starter_description") or ""
    payload["starter_tags"] = payload.get("starter_tags") or ""
    return LoadoutResponse.model_validate(payload)


@router.get("/loadouts", response_model=list[LoadoutResponse])
def list_loadouts(user: User = Depends(require_user), db: Session = Depends(get_db)):
    loadouts = db.query(Loadout).filter(Loadout.user_id == user.id).all()
    result = []
    for lo in loadouts:
        r = _loadout_to_response(lo)
        r.owner_name = user.display_name or user.username
        result.append(r)
    return result


def _build_loadout_responses(loadouts: list[Loadout], db: Session) -> list[LoadoutResponse]:
    result: list[LoadoutResponse] = []
    for lo in loadouts:
        r = _loadout_to_response(lo)
        owner = db.query(User).filter(User.id == lo.user_id).first()
        r.owner_name = owner.display_name or owner.username if owner else "Unknown"
        result.append(r)
    return result


@router.get("/loadouts/public", response_model=list[LoadoutResponse])
def list_public_loadouts(db: Session = Depends(get_db)):
    loadouts = (
        db.query(Loadout)
        .filter(Loadout.is_public.is_(True), or_(Loadout.is_starter.is_(False), Loadout.is_starter.is_(None)))
        .order_by(Loadout.is_featured.desc(), Loadout.updated_at.desc())
        .limit(100)
        .all()
    )
    return _build_loadout_responses(loadouts, db)


@router.get("/loadouts/starters", response_model=list[LoadoutResponse])
def list_starter_loadouts(db: Session = Depends(get_db)):
    loadouts = (
        db.query(Loadout)
        .filter(Loadout.is_public.is_(True), Loadout.is_starter.is_(True))
        .order_by(Loadout.updated_at.desc())
        .limit(100)
        .all()
    )
    return _build_loadout_responses(loadouts, db)


@router.get("/loadouts/{loadout_id}", response_model=LoadoutResponse)
def get_loadout(loadout_id: int, user: User | None = Depends(get_current_user), db: Session = Depends(get_db)):
    lo = db.query(Loadout).filter(Loadout.id == loadout_id).first()
    if not lo:
        raise HTTPException(status_code=404, detail="Loadout not found")
    if not lo.is_public and (not user or lo.user_id != user.id):
        raise HTTPException(status_code=403, detail="Access denied")
    r = _loadout_to_response(lo)
    owner = db.query(User).filter(User.id == lo.user_id).first()
    r.owner_name = owner.display_name or owner.username if owner else "Unknown"

    # Resolve component stats from the owner's library so any viewer gets full data
    owner_comps = db.query(UserComponent).filter(UserComponent.user_id == lo.user_id).all()
    comp_by_name: dict[str, UserComponent] = {}
    for c in owner_comps:
        comp_by_name[c.name] = c

    resolved = {}
    all_keys = [
        "reactor",
        "engine",
        "booster",
        "shield",
        "front_armor",
        "rear_armor",
        "capacitor",
        "cargo_hold",
        "droid_interface",
    ] + [f"slot{i}" for i in range(1, 9)]

    for key in all_keys:
        name = getattr(lo, key, "None") or "None"
        if name == "None":
            continue
        comp = comp_by_name.get(name)
        if comp:
            resolved[key] = {
                "name": comp.name,
                "comp_type": comp.comp_type,
                "stats": [
                    comp.stat1,
                    comp.stat2,
                    comp.stat3,
                    comp.stat4,
                    comp.stat5,
                    comp.stat6,
                    comp.stat7,
                    comp.stat8,
                ],
            }

    r.resolved_components = resolved
    return r


@router.post("/loadouts", response_model=LoadoutResponse)
def create_loadout(req: LoadoutCreate, user: User = Depends(require_user), db: Session = Depends(get_db)):
    existing = db.query(Loadout).filter(Loadout.user_id == user.id, Loadout.name == req.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="A loadout with this name already exists")

    payload = req.model_dump()
    wants_starter = payload.get("is_starter", False)
    if wants_starter and not (user.role == "admin" or user.is_admin):
        raise HTTPException(status_code=403, detail="Only admins can create starter builds")
    if wants_starter:
        payload["is_public"] = True

    loadout = Loadout(user_id=user.id, **payload)
    db.add(loadout)
    db.commit()
    db.refresh(loadout)
    r = _loadout_to_response(loadout)
    r.owner_name = user.display_name or user.username
    return r


@router.put("/loadouts/{loadout_id}", response_model=LoadoutResponse)
def update_loadout(
    loadout_id: int, req: LoadoutCreate, user: User = Depends(require_user), db: Session = Depends(get_db)
):
    lo = db.query(Loadout).filter(Loadout.id == loadout_id, Loadout.user_id == user.id).first()
    if not lo:
        raise HTTPException(status_code=404, detail="Loadout not found")

    payload = req.model_dump()
    wants_starter = payload.get("is_starter", False)
    if wants_starter and not (user.role == "admin" or user.is_admin):
        raise HTTPException(status_code=403, detail="Only admins can manage starter builds")
    if lo.is_starter and not wants_starter and not (user.role == "admin" or user.is_admin):
        raise HTTPException(status_code=403, detail="Only admins can change starter build status")
    if wants_starter:
        payload["is_public"] = True

    for key, val in payload.items():
        setattr(lo, key, val)
    db.commit()
    db.refresh(lo)
    r = _loadout_to_response(lo)
    r.owner_name = user.display_name or user.username
    return r


@router.post("/loadouts/{loadout_id}/duplicate", response_model=LoadoutResponse)
def duplicate_loadout(
    loadout_id: int, new_name: str = "", user: User = Depends(require_user), db: Session = Depends(get_db)
):
    lo = db.query(Loadout).filter(Loadout.id == loadout_id).first()
    if not lo:
        raise HTTPException(status_code=404, detail="Loadout not found")
    if not lo.is_public and lo.user_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    name = new_name or f"{lo.name} (Copy)"
    existing = db.query(Loadout).filter(Loadout.user_id == user.id, Loadout.name == name).first()
    if existing:
        raise HTTPException(status_code=400, detail="A loadout with this name already exists")

    new_loadout = Loadout(
        user_id=user.id,
        name=name,
        chassis=lo.chassis,
        mass=lo.mass,
        reactor=lo.reactor,
        engine=lo.engine,
        booster=lo.booster,
        shield=lo.shield,
        front_armor=lo.front_armor,
        rear_armor=lo.rear_armor,
        capacitor=lo.capacitor,
        cargo_hold=lo.cargo_hold,
        droid_interface=lo.droid_interface,
        slot1=lo.slot1,
        slot2=lo.slot2,
        slot3=lo.slot3,
        slot4=lo.slot4,
        slot5=lo.slot5,
        slot6=lo.slot6,
        slot7=lo.slot7,
        slot8=lo.slot8,
        pack1=lo.pack1,
        pack2=lo.pack2,
        pack3=lo.pack3,
        pack4=lo.pack4,
        pack5=lo.pack5,
        pack6=lo.pack6,
        pack7=lo.pack7,
        pack8=lo.pack8,
        ro_level=lo.ro_level,
        eo_level=lo.eo_level,
        co_level=lo.co_level,
        wo_level=lo.wo_level,
        shield_adjust=lo.shield_adjust,
        is_public=False,
        is_starter=False,
        starter_description="",
        starter_tags="",
    )
    db.add(new_loadout)
    db.commit()
    db.refresh(new_loadout)
    r = _loadout_to_response(new_loadout)
    r.owner_name = user.display_name or user.username
    return r


@router.delete("/loadouts/{loadout_id}")
def delete_loadout(loadout_id: int, user: User = Depends(require_user), db: Session = Depends(get_db)):
    lo = db.query(Loadout).filter(Loadout.id == loadout_id, Loadout.user_id == user.id).first()
    if not lo:
        raise HTTPException(status_code=404, detail="Loadout not found")
    db.delete(lo)
    db.commit()
    return {"message": "Loadout deleted"}


# --- Components ---


class ComponentCreate(BaseModel):
    comp_type: str
    name: str
    stat1: float = 0
    stat2: float = 0
    stat3: float = 0
    stat4: float = 0
    stat5: float = 0
    stat6: float = 0
    stat7: float = 0
    stat8: float = 0


class ComponentResponse(BaseModel):
    id: int
    comp_type: str
    name: str
    stat1: float
    stat2: float
    stat3: float
    stat4: float
    stat5: float
    stat6: float
    stat7: float
    stat8: float

    model_config = ConfigDict(from_attributes=True)


@router.get("/components", response_model=list[ComponentResponse])
def list_components(comp_type: str | None = None, user: User = Depends(require_user), db: Session = Depends(get_db)):
    q = db.query(UserComponent).filter(UserComponent.user_id == user.id)
    if comp_type:
        q = q.filter(UserComponent.comp_type == comp_type)
    return q.order_by(UserComponent.name).all()


@router.post("/components", response_model=ComponentResponse)
def create_component(req: ComponentCreate, user: User = Depends(require_user), db: Session = Depends(get_db)):
    existing = (
        db.query(UserComponent)
        .filter(
            UserComponent.user_id == user.id, UserComponent.comp_type == req.comp_type, UserComponent.name == req.name
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="A component with this name and type already exists")

    comp = UserComponent(user_id=user.id, **req.model_dump())
    db.add(comp)
    db.commit()
    db.refresh(comp)
    return comp


@router.put("/components/{comp_id}", response_model=ComponentResponse)
def update_component(
    comp_id: int, req: ComponentCreate, user: User = Depends(require_user), db: Session = Depends(get_db)
):
    comp = db.query(UserComponent).filter(UserComponent.id == comp_id, UserComponent.user_id == user.id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Component not found")
    for key, val in req.model_dump().items():
        setattr(comp, key, val)
    db.commit()
    db.refresh(comp)
    return comp


@router.delete("/components/{comp_id}")
def delete_component(comp_id: int, user: User = Depends(require_user), db: Session = Depends(get_db)):
    comp = db.query(UserComponent).filter(UserComponent.id == comp_id, UserComponent.user_id == user.id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Component not found")
    db.delete(comp)
    db.commit()
    return {"message": "Component deleted"}
