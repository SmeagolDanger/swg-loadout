from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from database import get_db, Loadout, UserComponent, User
from auth import require_user, get_current_user

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
    owner_name: Optional[str] = None

    class Config:
        from_attributes = True


@router.get("/loadouts", response_model=List[LoadoutResponse])
def list_loadouts(user: User = Depends(require_user), db: Session = Depends(get_db)):
    loadouts = db.query(Loadout).filter(Loadout.user_id == user.id).all()
    result = []
    for l in loadouts:
        r = LoadoutResponse.model_validate(l)
        r.owner_name = user.display_name or user.username
        result.append(r)
    return result


@router.get("/loadouts/public", response_model=List[LoadoutResponse])
def list_public_loadouts(db: Session = Depends(get_db)):
    loadouts = db.query(Loadout).filter(Loadout.is_public == True).limit(100).all()
    result = []
    for l in loadouts:
        r = LoadoutResponse.model_validate(l)
        owner = db.query(User).filter(User.id == l.user_id).first()
        r.owner_name = owner.display_name or owner.username if owner else "Unknown"
        result.append(r)
    return result


@router.get("/loadouts/{loadout_id}", response_model=LoadoutResponse)
def get_loadout(loadout_id: int, user: Optional[User] = Depends(get_current_user), db: Session = Depends(get_db)):
    l = db.query(Loadout).filter(Loadout.id == loadout_id).first()
    if not l:
        raise HTTPException(status_code=404, detail="Loadout not found")
    if not l.is_public and (not user or l.user_id != user.id):
        raise HTTPException(status_code=403, detail="Access denied")
    r = LoadoutResponse.model_validate(l)
    owner = db.query(User).filter(User.id == l.user_id).first()
    r.owner_name = owner.display_name or owner.username if owner else "Unknown"
    return r


@router.post("/loadouts", response_model=LoadoutResponse)
def create_loadout(req: LoadoutCreate, user: User = Depends(require_user), db: Session = Depends(get_db)):
    existing = db.query(Loadout).filter(Loadout.user_id == user.id, Loadout.name == req.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="A loadout with this name already exists")

    loadout = Loadout(user_id=user.id, **req.model_dump())
    db.add(loadout)
    db.commit()
    db.refresh(loadout)
    r = LoadoutResponse.model_validate(loadout)
    r.owner_name = user.display_name or user.username
    return r


@router.put("/loadouts/{loadout_id}", response_model=LoadoutResponse)
def update_loadout(loadout_id: int, req: LoadoutCreate, user: User = Depends(require_user), db: Session = Depends(get_db)):
    l = db.query(Loadout).filter(Loadout.id == loadout_id, Loadout.user_id == user.id).first()
    if not l:
        raise HTTPException(status_code=404, detail="Loadout not found")

    for key, val in req.model_dump().items():
        setattr(l, key, val)
    db.commit()
    db.refresh(l)
    r = LoadoutResponse.model_validate(l)
    r.owner_name = user.display_name or user.username
    return r


@router.post("/loadouts/{loadout_id}/duplicate", response_model=LoadoutResponse)
def duplicate_loadout(loadout_id: int, new_name: str = "", user: User = Depends(require_user), db: Session = Depends(get_db)):
    l = db.query(Loadout).filter(Loadout.id == loadout_id).first()
    if not l:
        raise HTTPException(status_code=404, detail="Loadout not found")
    if not l.is_public and l.user_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    name = new_name or f"{l.name} (Copy)"
    existing = db.query(Loadout).filter(Loadout.user_id == user.id, Loadout.name == name).first()
    if existing:
        raise HTTPException(status_code=400, detail="A loadout with this name already exists")

    new_loadout = Loadout(
        user_id=user.id, name=name, chassis=l.chassis, mass=l.mass,
        reactor=l.reactor, engine=l.engine, booster=l.booster, shield=l.shield,
        front_armor=l.front_armor, rear_armor=l.rear_armor, capacitor=l.capacitor,
        cargo_hold=l.cargo_hold, droid_interface=l.droid_interface,
        slot1=l.slot1, slot2=l.slot2, slot3=l.slot3, slot4=l.slot4,
        slot5=l.slot5, slot6=l.slot6, slot7=l.slot7, slot8=l.slot8,
        pack1=l.pack1, pack2=l.pack2, pack3=l.pack3, pack4=l.pack4,
        pack5=l.pack5, pack6=l.pack6, pack7=l.pack7, pack8=l.pack8,
        ro_level=l.ro_level, eo_level=l.eo_level, co_level=l.co_level,
        wo_level=l.wo_level, shield_adjust=l.shield_adjust, is_public=False
    )
    db.add(new_loadout)
    db.commit()
    db.refresh(new_loadout)
    r = LoadoutResponse.model_validate(new_loadout)
    r.owner_name = user.display_name or user.username
    return r


@router.delete("/loadouts/{loadout_id}")
def delete_loadout(loadout_id: int, user: User = Depends(require_user), db: Session = Depends(get_db)):
    l = db.query(Loadout).filter(Loadout.id == loadout_id, Loadout.user_id == user.id).first()
    if not l:
        raise HTTPException(status_code=404, detail="Loadout not found")
    db.delete(l)
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

    class Config:
        from_attributes = True


@router.get("/components", response_model=List[ComponentResponse])
def list_components(comp_type: Optional[str] = None, user: User = Depends(require_user), db: Session = Depends(get_db)):
    q = db.query(UserComponent).filter(UserComponent.user_id == user.id)
    if comp_type:
        q = q.filter(UserComponent.comp_type == comp_type)
    return q.order_by(UserComponent.name).all()


@router.post("/components", response_model=ComponentResponse)
def create_component(req: ComponentCreate, user: User = Depends(require_user), db: Session = Depends(get_db)):
    existing = db.query(UserComponent).filter(
        UserComponent.user_id == user.id,
        UserComponent.comp_type == req.comp_type,
        UserComponent.name == req.name
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="A component with this name and type already exists")

    comp = UserComponent(user_id=user.id, **req.model_dump())
    db.add(comp)
    db.commit()
    db.refresh(comp)
    return comp


@router.put("/components/{comp_id}", response_model=ComponentResponse)
def update_component(comp_id: int, req: ComponentCreate, user: User = Depends(require_user), db: Session = Depends(get_db)):
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
