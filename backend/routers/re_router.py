"""Reverse Engineering Calculator API endpoints."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import require_user
from database import REProject, User, get_db
from re_engine import COMP_TYPES, RE_MULTS, analyze_component, brand_rarity_table, get_comp_info

router = APIRouter(prefix="/api/re", tags=["re-calculator"])


class AnalyzeRequest(BaseModel):
    comp_type: str
    level: int
    raw_stats: list[str | float] = []
    matching_target: str = "Average Rarity"
    direction: int = 1  # 1 = raw→post, -1 = post→raw


class ProjectSave(BaseModel):
    name: str
    comp_type: str
    re_level: int
    stats: list[float] = []


@router.get("/component-types")
def list_re_component_types():
    """Available component types for RE calculator."""
    return COMP_TYPES


@router.get("/levels")
def list_re_levels():
    """Available RE levels with their multipliers."""
    return [{"level": i + 1, "multiplier": f"{RE_MULTS[i] * 100:.0f}%"} for i in range(10)]


@router.get("/stats/{comp_type}")
def get_re_stats(comp_type: str):
    """Get stat names and metadata for a component type."""
    info = get_comp_info(comp_type)
    if not info:
        return {"error": "Unknown component type"}

    disp = list(info["display_names"])
    tails = list(info["re_tails"])

    if "A/HP:" not in disp:
        disp.insert(0, "A/HP:")
        tails.insert(0, "1")

    stats = []
    for i in range(len(disp)):
        if not disp[i]:
            continue
        stats.append(
            {
                "index": i,
                "name": disp[i].rstrip(":"),
                "display_name": disp[i],
                "tail": int(float(tails[i])) if i < len(tails) and tails[i] else 1,
            }
        )

    return {"comp_type": comp_type, "stats": stats}


@router.post("/analyze")
def analyze(req: AnalyzeRequest):
    """Run full RE analysis on a component."""
    if req.comp_type not in COMP_TYPES:
        return {"error": "Invalid component type"}
    if req.level < 1 or req.level > 10:
        return {"error": "Level must be 1-10"}

    # Convert incoming stats - preserve empty strings, convert numbers
    clean_stats = []
    for s in req.raw_stats:
        if s == "" or s is None:
            clean_stats.append("")
        else:
            try:
                clean_stats.append(float(s))
            except (TypeError, ValueError):
                clean_stats.append("")

    result = analyze_component(
        comp_type=req.comp_type,
        level=req.level,
        raw_stats=clean_stats,
        matching_target=req.matching_target,
        direction=req.direction,
    )
    return result


@router.post("/brand-table")
def get_brand_table(req: AnalyzeRequest):
    """Generate per-brand rarity breakdown."""
    if req.comp_type not in COMP_TYPES:
        return {"error": "Invalid component type"}

    clean_stats = []
    for s in req.raw_stats:
        if s == "" or s is None:
            clean_stats.append("")
        else:
            try:
                clean_stats.append(float(s))
            except (TypeError, ValueError):
                clean_stats.append("")

    return brand_rarity_table(req.comp_type, req.level, clean_stats)


# ── RE Project Save/Load ────────────────────────────────────


@router.get("/projects")
def list_projects(user: User = Depends(require_user), db: Session = Depends(get_db)):
    projects = db.query(REProject).filter(REProject.user_id == user.id).order_by(REProject.name).all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "comp_type": p.comp_type,
            "re_level": p.re_level,
            "stats": [p.stat0, p.stat1, p.stat2, p.stat3, p.stat4, p.stat5, p.stat6, p.stat7, p.stat8],
        }
        for p in projects
    ]


@router.post("/projects")
def save_project(req: ProjectSave, user: User = Depends(require_user), db: Session = Depends(get_db)):
    # Pad stats to 9
    stats = list(req.stats) + [0.0] * (9 - len(req.stats))

    existing = db.query(REProject).filter(REProject.user_id == user.id, REProject.name == req.name).first()
    if existing:
        existing.comp_type = req.comp_type
        existing.re_level = req.re_level
        for i in range(9):
            setattr(existing, f"stat{i}", stats[i])
    else:
        project = REProject(
            user_id=user.id,
            name=req.name,
            comp_type=req.comp_type,
            re_level=req.re_level,
            stat0=stats[0],
            stat1=stats[1],
            stat2=stats[2],
            stat3=stats[3],
            stat4=stats[4],
            stat5=stats[5],
            stat6=stats[6],
            stat7=stats[7],
            stat8=stats[8],
        )
        db.add(project)

    db.commit()
    return {"message": "Project saved"}


@router.delete("/projects/{project_id}")
def delete_project(project_id: int, user: User = Depends(require_user), db: Session = Depends(get_db)):
    project = db.query(REProject).filter(REProject.id == project_id, REProject.user_id == user.id).first()
    if not project:
        return {"error": "Project not found"}
    db.delete(project)
    db.commit()
    return {"message": "Project deleted"}
