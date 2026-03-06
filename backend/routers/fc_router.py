"""Flight Computer Calculator API endpoints."""

import math

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import require_user
from database import FCLoadout, User, get_db
from gamedata import get_fc_programs

router = APIRouter(prefix="/api/fc", tags=["fc-calculator"])

FC_MEMORY = {1: 20, 2: 40, 3: 70, 4: 110, 5: 125, 6: 150}


def _tf(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return 0.0


@router.get("/programs")
def list_programs():
    """Get all 42 FC programs with full details."""
    programs = get_fc_programs()
    result = []
    for p in programs:
        descs = [p.get(f"desc{i}", "") for i in range(1, 5)]
        descs = [d for d in descs if d]
        result.append(
            {
                "command": p["command"],
                "name": p["name"],
                "size": int(_tf(p.get("size", 0))),
                "target": p.get("target", ""),
                "delay": _tf(p.get("delay", 0)),
                "effects": descs,
            }
        )
    return result


@router.get("/levels")
def list_fc_levels():
    """FC levels and their memory capacities."""
    return [{"level": k, "memory": v} for k, v in FC_MEMORY.items()]


class CalcCooldownRequest(BaseModel):
    program_names: list[str] = []
    dcs: float = 0


@router.post("/cooldowns")
def calc_cooldowns(req: CalcCooldownRequest):
    """Calculate cooldowns for selected programs given DCS."""
    programs = get_fc_programs()
    prog_map = {p["name"]: p for p in programs}

    results = []
    total_memory = 0
    for name in req.program_names:
        if not name or name not in prog_map:
            results.append({"name": name, "memory": 0, "cooldown": 0, "command": ""})
            continue
        p = prog_map[name]
        memory = int(_tf(p.get("size", 0)))
        total_memory += memory
        delay = _tf(p.get("delay", 0))
        if delay == 0 or req.dcs == 0:
            cooldown = 0
        else:
            cooldown = int(math.floor(req.dcs * delay + 1))
        results.append(
            {
                "name": name,
                "memory": memory,
                "cooldown": cooldown,
                "command": p.get("command", ""),
            }
        )

    return {"programs": results, "total_memory": total_memory}


class MacroRequest(BaseModel):
    program_names: list[str] = []
    included: list[bool] = []
    dcs: float = 0


@router.post("/macro")
def generate_macro(req: MacroRequest):
    """Generate a /droid macro string."""
    programs = get_fc_programs()
    prog_map = {p["name"]: p for p in programs}

    lines = []
    for i, name in enumerate(req.program_names):
        if i >= len(req.included) or not req.included[i]:
            continue
        if not name or name not in prog_map:
            continue
        p = prog_map[name]
        cmd = p.get("command", "")
        delay = _tf(p.get("delay", 0))
        if delay == 0 or req.dcs == 0:
            cd = 0
        else:
            cd = int(math.floor(req.dcs * delay + 1))
        lines.append(f"/droid {cmd};")
        lines.append(f"/pause {cd};")

    return {"macro": "\n".join(lines)}


# ── FC Loadout Save/Load ────────────────────────────────────


class FCLoadoutSave(BaseModel):
    name: str
    fc_level: int
    dcs: float = 0
    programs: list[str] = []
    included: list[bool] = []


@router.get("/loadouts")
def list_fc_loadouts(user: User = Depends(require_user), db: Session = Depends(get_db)):
    loadouts = db.query(FCLoadout).filter(FCLoadout.user_id == user.id).order_by(FCLoadout.name).all()
    result = []
    for lo in loadouts:
        # Parse stored programs JSON
        import json

        try:
            data = json.loads(lo.programs) if lo.programs else {}
        except (json.JSONDecodeError, TypeError):
            data = {}
        result.append(
            {
                "id": lo.id,
                "name": lo.name,
                "fc_level": lo.fc_level,
                "dcs": lo.dcs,
                "programs": data.get("names", []),
                "included": data.get("included", []),
            }
        )
    return result


@router.post("/loadouts")
def save_fc_loadout(req: FCLoadoutSave, user: User = Depends(require_user), db: Session = Depends(get_db)):
    import json

    programs_json = json.dumps({"names": req.programs, "included": req.included})

    existing = db.query(FCLoadout).filter(FCLoadout.user_id == user.id, FCLoadout.name == req.name).first()
    if existing:
        existing.fc_level = req.fc_level
        existing.dcs = int(req.dcs)
        existing.programs = programs_json
    else:
        lo = FCLoadout(
            user_id=user.id,
            name=req.name,
            fc_level=req.fc_level,
            dcs=int(req.dcs),
            programs=programs_json,
        )
        db.add(lo)
    db.commit()
    return {"message": "FC loadout saved"}


@router.delete("/loadouts/{loadout_id}")
def delete_fc_loadout(loadout_id: int, user: User = Depends(require_user), db: Session = Depends(get_db)):
    lo = db.query(FCLoadout).filter(FCLoadout.id == loadout_id, FCLoadout.user_id == user.id).first()
    if not lo:
        return {"error": "Loadout not found"}
    db.delete(lo)
    db.commit()
    return {"message": "FC loadout deleted"}
