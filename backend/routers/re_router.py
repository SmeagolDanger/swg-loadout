"""Reverse Engineering Calculator API endpoints."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import require_role, require_user
from database import REProject, TierThreshold, User, get_db
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


def _get_tier(rarity_prob, threshold: TierThreshold | None) -> str | None:
    """Convert a raw rarity probability to a tier letter using STAJ thresholds."""
    if rarity_prob == "" or rarity_prob is None or rarity_prob == 0:
        return None
    if threshold is None:
        return None
    try:
        one_in_x = int(1 / float(rarity_prob))
    except (ZeroDivisionError, ValueError, TypeError):
        return None
    if one_in_x >= threshold.a_threshold:
        return "A"
    if one_in_x >= threshold.b_threshold:
        return "B"
    if one_in_x >= threshold.c_threshold:
        return "C"
    if one_in_x >= threshold.d_threshold:
        return "D"
    return None


@router.post("/analyze")
def analyze(req: AnalyzeRequest, db: Session = Depends(get_db)):
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

    # Annotate each stat with a tier from STAJ thresholds
    comp_code = req.comp_type[0] + str(req.level % 10)
    threshold = db.query(TierThreshold).filter(TierThreshold.comp_code == comp_code).first()
    for stat in result.get("stats", []):
        display = stat.get("rarity_display", "")
        if display == "Reward":
            stat["tier"] = "reward"
        elif display and "⋆" in display:
            stat["tier"] = "unicorn"
        else:
            stat["tier"] = _get_tier(stat.get("rarity"), threshold)

    return result


@router.get("/tier-thresholds")
def get_tier_thresholds(db: Session = Depends(get_db)):
    """Return all tier thresholds."""
    rows = db.query(TierThreshold).order_by(TierThreshold.comp_code).all()
    return [
        {
            "comp_code": r.comp_code,
            "d_threshold": r.d_threshold,
            "c_threshold": r.c_threshold,
            "b_threshold": r.b_threshold,
            "a_threshold": r.a_threshold,
        }
        for r in rows
    ]


class TierThresholdUpdate(BaseModel):
    d_threshold: int
    c_threshold: int
    b_threshold: int
    a_threshold: int


@router.put("/tier-thresholds/{comp_code}")
def update_tier_threshold(
    comp_code: str,
    body: TierThresholdUpdate,
    _admin=Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Update tier thresholds for a component code (admin only)."""
    row = db.query(TierThreshold).filter(TierThreshold.comp_code == comp_code).first()
    if not row:
        row = TierThreshold(comp_code=comp_code)
        db.add(row)
    row.d_threshold = body.d_threshold
    row.c_threshold = body.c_threshold
    row.b_threshold = body.b_threshold
    row.a_threshold = body.a_threshold
    db.commit()
    return {
        "comp_code": comp_code,
        "d_threshold": row.d_threshold,
        "c_threshold": row.c_threshold,
        "b_threshold": row.b_threshold,
        "a_threshold": row.a_threshold,
    }


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
