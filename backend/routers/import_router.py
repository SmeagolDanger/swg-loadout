"""Import savedata.db from the desktop Seraph's Loadout Tool."""

import sqlite3
import tempfile
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, UploadFile

from auth import require_user
from database import Loadout, User, UserComponent, get_db

router = APIRouter(prefix="/api/import", tags=["import"])

# Desktop savedata.db component tables → web comp_type + stat column names
COMP_TABLE_MAP = {
    "reactor": {"comp_type": "reactor", "stats": ["mass", "reactorgenerationrate"]},
    "engine": {
        "comp_type": "engine",
        "stats": [
            "reactorenergydrain",
            "mass",
            "pitchratemaximum",
            "yawratemaximum",
            "rollratemaximum",
            "enginetopspeed",
        ],
    },
    "booster": {
        "comp_type": "booster",
        "stats": [
            "reactorenergydrain",
            "mass",
            "boosterenergy",
            "boosterrechargerate",
            "boosterenergyconsumptionrate",
            "acceleration",
            "topboosterspeed",
        ],
    },
    "shield": {
        "comp_type": "shield",
        "stats": ["reactorenergydrain", "mass", "shieldhitpoints", "shieldrechargerate"],
    },
    "armor": {"comp_type": "armor", "stats": ["armorhitpoints", "mass"]},
    "capacitor": {
        "comp_type": "capacitor",
        "stats": ["reactorenergydrain", "mass", "capacitorenergy", "rechargerate"],
    },
    "droidinterface": {
        "comp_type": "droidinterface",
        "stats": ["reactorenergydrain", "mass", "droidcommandspeed"],
    },
    "cargohold": {"comp_type": "cargohold", "stats": ["mass"]},
    "weapon": {
        "comp_type": "weapon",
        "stats": [
            "reactorenergydrain",
            "mass",
            "minimumdamage",
            "maximumdamage",
            "vsshields",
            "vsarmor",
            "energyshot",
            "refirerate",
        ],
    },
    "ordnancelauncher": {
        "comp_type": "ordnancelauncher",
        "stats": ["reactorenergydrain", "mass", "type"],
    },
    "countermeasurelauncher": {
        "comp_type": "countermeasurelauncher",
        "stats": ["reactorenergydrain", "mass"],
    },
    "ordnancepack": {
        "comp_type": "ordnancepack",
        "stats": ["minimumdamage", "maximumdamage", "ammunition", "type"],
    },
    "countermeasurepack": {"comp_type": "countermeasurepack", "stats": ["ammunition"]},
}


def _safe_float(val: Any) -> float:
    try:
        return float(val)
    except (TypeError, ValueError):
        return 0.0


def _safe_str(val: Any) -> str:
    if val is None:
        return "None"
    s = str(val).strip()
    return s if s else "None"


def _read_savedata(db_path: str) -> dict[str, Any]:
    """Read all tables from a desktop savedata.db file."""
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # Discover which tables exist
    existing_tables = [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]

    result: dict[str, Any] = {"loadouts": [], "components": [], "summary": {}}

    # Import loadouts
    if "loadout" in existing_tables:
        rows = cur.execute("SELECT * FROM loadout").fetchall()
        for row in rows:
            cols = [desc[0] for desc in cur.description]
            data = dict(zip(cols, row, strict=False))
            result["loadouts"].append(data)

    # Import components from each table
    for table_name, mapping in COMP_TABLE_MAP.items():
        if table_name not in existing_tables:
            continue
        rows = cur.execute(f"SELECT * FROM [{table_name}]").fetchall()  # noqa: S608
        for row in rows:
            cols = [desc[0] for desc in cur.description]
            data = dict(zip(cols, row, strict=False))
            result["components"].append(
                {
                    "table": table_name,
                    "comp_type": mapping["comp_type"],
                    "stat_columns": mapping["stats"],
                    "data": data,
                }
            )

    conn.close()
    return result


@router.post("/savedata")
async def import_savedata(
    file: UploadFile,
    user: User = Depends(require_user),
    db=Depends(get_db),
):
    """Import a savedata.db file from the desktop Seraph's Loadout Tool.

    Accepts the savedata.db file (typically found in %APPDATA%/Seraph's Loadout Tool/).
    Imports all loadouts and components into the current user's account.
    Skips duplicates by name.
    """
    if not file.filename or not file.filename.endswith(".db"):
        raise HTTPException(status_code=400, detail="File must be a .db SQLite database")

    # Write upload to a temp file so sqlite3 can read it
    with tempfile.NamedTemporaryFile(suffix=".db", delete=True) as tmp:
        content = await file.read()
        if len(content) > 50 * 1024 * 1024:  # 50MB limit
            raise HTTPException(status_code=400, detail="File too large (max 50MB)")
        tmp.write(content)
        tmp.flush()

        try:
            savedata = _read_savedata(tmp.name)
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail=f"Could not read savedata.db: {exc}",
            ) from exc

    # Track import results
    stats = {
        "loadouts_imported": 0,
        "loadouts_skipped": 0,
        "components_imported": 0,
        "components_skipped": 0,
        "errors": [],
    }

    # Import components first (loadouts may reference them)
    existing_comps = {
        (c.comp_type, c.name) for c in db.query(UserComponent).filter(UserComponent.user_id == user.id).all()
    }

    for comp_entry in savedata["components"]:
        comp_data = comp_entry["data"]
        comp_type = comp_entry["comp_type"]
        stat_cols = comp_entry["stat_columns"]
        name = comp_data.get("name", "")

        if not name or (comp_type, name) in existing_comps:
            stats["components_skipped"] += 1
            continue

        # Map stat columns to stat1..stat8
        stat_values = []
        for col in stat_cols:
            val = comp_data.get(col, 0)
            stat_values.append(_safe_float(val))
        while len(stat_values) < 8:
            stat_values.append(0.0)

        try:
            new_comp = UserComponent(
                user_id=user.id,
                comp_type=comp_type,
                name=name,
                stat1=stat_values[0],
                stat2=stat_values[1],
                stat3=stat_values[2],
                stat4=stat_values[3],
                stat5=stat_values[4],
                stat6=stat_values[5],
                stat7=stat_values[6],
                stat8=stat_values[7],
            )
            db.add(new_comp)
            existing_comps.add((comp_type, name))
            stats["components_imported"] += 1
        except Exception as exc:
            stats["errors"].append(f"Component '{name}': {exc}")

    db.flush()

    # Import loadouts
    existing_loadout_names = {lo.name for lo in db.query(Loadout).filter(Loadout.user_id == user.id).all()}

    for lo_data in savedata["loadouts"]:
        name = lo_data.get("name", "")
        if not name or name in existing_loadout_names:
            stats["loadouts_skipped"] += 1
            continue

        # Map desktop column names → web schema
        # Desktop order: name, chassis, mass, armor1, armor2, booster, capacitor,
        #   cargohold, droidinterface, engine, reactor, shield,
        #   slot1..slot8, pack1..pack8, rolevel, eolevel, colevel, wolevel, adjust
        try:
            ro_raw = lo_data.get("rolevel", "None")
            eo_raw = lo_data.get("eolevel", "None")
            co_raw = lo_data.get("colevel", "None")
            wo_raw = lo_data.get("wolevel", "None")

            new_loadout = Loadout(
                user_id=user.id,
                name=name,
                chassis=_safe_str(lo_data.get("chassis")),
                mass=_safe_float(lo_data.get("mass", 0)),
                front_armor=_safe_str(lo_data.get("armor1")),
                rear_armor=_safe_str(lo_data.get("armor2")),
                booster=_safe_str(lo_data.get("booster")),
                capacitor=_safe_str(lo_data.get("capacitor")),
                cargo_hold=_safe_str(lo_data.get("cargohold")),
                droid_interface=_safe_str(lo_data.get("droidinterface")),
                engine=_safe_str(lo_data.get("engine")),
                reactor=_safe_str(lo_data.get("reactor")),
                shield=_safe_str(lo_data.get("shield")),
                slot1=_safe_str(lo_data.get("slot1")),
                slot2=_safe_str(lo_data.get("slot2")),
                slot3=_safe_str(lo_data.get("slot3")),
                slot4=_safe_str(lo_data.get("slot4")),
                slot5=_safe_str(lo_data.get("slot5")),
                slot6=_safe_str(lo_data.get("slot6")),
                slot7=_safe_str(lo_data.get("slot7")),
                slot8=_safe_str(lo_data.get("slot8")),
                pack1=_safe_str(lo_data.get("pack1")),
                pack2=_safe_str(lo_data.get("pack2")),
                pack3=_safe_str(lo_data.get("pack3")),
                pack4=_safe_str(lo_data.get("pack4")),
                pack5=_safe_str(lo_data.get("pack5")),
                pack6=_safe_str(lo_data.get("pack6")),
                pack7=_safe_str(lo_data.get("pack7")),
                pack8=_safe_str(lo_data.get("pack8")),
                ro_level=_safe_str(ro_raw),
                eo_level=_safe_str(eo_raw),
                co_level=_safe_str(co_raw),
                wo_level=_safe_str(wo_raw),
                shield_adjust=_safe_str(lo_data.get("adjust")),
            )
            db.add(new_loadout)
            existing_loadout_names.add(name)
            stats["loadouts_imported"] += 1
        except Exception as exc:
            stats["errors"].append(f"Loadout '{name}': {exc}")

    db.commit()

    return {
        "message": "Import complete",
        "loadouts_imported": stats["loadouts_imported"],
        "loadouts_skipped": stats["loadouts_skipped"],
        "components_imported": stats["components_imported"],
        "components_skipped": stats["components_skipped"],
        "errors": stats["errors"][:20],  # Cap error list
    }
