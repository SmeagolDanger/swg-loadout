from fastapi import APIRouter, Query
from typing import Optional, List
from gamedata import (get_chassis_list, get_chassis, get_component_stats,
                      get_fc_programs, get_ordnance_types, get_complib, get_brands)
from calculations import (calc_throttle_profile, calc_overload_multipliers,
                          calc_propulsion, calc_weapon_stats, calc_cap_combat,
                          calc_mass_summary, calc_drain_summary, loot_lookup,
                          calc_shield_adjust, try_float)
from pydantic import BaseModel

router = APIRouter(prefix="/api/gamedata", tags=["gamedata"])


@router.get("/chassis")
def list_chassis():
    return get_chassis_list()


@router.get("/chassis/{name}")
def get_chassis_detail(name: str):
    c = get_chassis(name)
    if not c:
        return {"error": "Chassis not found"}
    c["throttle_profile"] = calc_throttle_profile(c)
    return c


@router.get("/component-types")
def list_component_types():
    return get_component_stats()


@router.get("/fc-programs")
def list_fc_programs():
    return get_fc_programs()


@router.get("/ordnance-types")
def list_ordnance_types():
    return get_ordnance_types()


@router.get("/complib")
def list_complib(comp_type: Optional[str] = None):
    items = get_complib()
    if comp_type:
        items = [i for i in items if i["type"] and comp_type.lower() in i["type"].lower()]
    return items


@router.get("/brands")
def list_brands(path: Optional[str] = None):
    items = get_brands()
    if path:
        items = [i for i in items if i["path"] and path.lower() in i["path"].lower()]
    return items


@router.get("/overload-levels")
def get_overload_levels():
    """Return available overload levels."""
    return {
        "reactor": [{"value": "None", "label": "None"}] + [{"value": i, "label": f"Level {i}"} for i in range(1, 5)],
        "engine": [{"value": "None", "label": "None"}] + [{"value": i, "label": f"Level {i}"} for i in range(1, 5)],
        "capacitor": [{"value": "None", "label": "None"}] + [{"value": i, "label": f"Level {i}"} for i in range(1, 5)],
        "weapon": [{"value": "None", "label": "None"}] + [{"value": i, "label": f"Level {i}"} for i in range(1, 5)],
    }


@router.get("/shield-adjust-options")
def get_shield_adjust_options():
    programs = get_fc_programs()
    options = [{"value": "None", "label": "None"}]
    for p in programs:
        if "Shield" in str(p.get("name", "")) and "Adjust" in str(p.get("name", "")):
            name = p["name"]
            parts = name.replace("Shield ", "").split(" Adjust - ")
            if len(parts) == 2:
                label = f"{parts[0]} - {parts[1]}"
                options.append({"value": label, "label": label})
    return options


class CalcRequest(BaseModel):
    chassis_name: str
    components: dict = {}
    ro_level: Optional[str] = "None"
    eo_level: Optional[str] = "None"
    co_level: Optional[str] = "None"
    wo_level: Optional[str] = "None"
    shield_adjust: Optional[str] = "None"


@router.post("/calculate")
def calculate_loadout(req: CalcRequest):
    chassis = get_chassis(req.chassis_name)
    if not chassis:
        return {"error": "Chassis not found"}

    def parse_level(v):
        if v is None or v == "None" or v == "":
            return None
        try:
            return int(v)
        except:
            return None

    ro = parse_level(req.ro_level)
    eo = parse_level(req.eo_level)
    co = parse_level(req.co_level)
    wo = parse_level(req.wo_level)

    overloads = calc_overload_multipliers(ro, eo, co, wo)
    throttle = calc_throttle_profile(chassis)

    # Build engine/booster dicts from components
    engine = req.components.get("engine")
    booster = req.components.get("booster")
    propulsion = calc_propulsion(chassis, engine, booster, eo)

    mass = calc_mass_summary(req.components, try_float(req.components.get("chassis_mass", chassis["mass"])))
    drain = calc_drain_summary(req.components, ro, eo, co, wo)

    # Shield adjust
    shield_front_ratio = calc_shield_adjust(req.shield_adjust)
    shield_hp = try_float(req.components.get("shield", {}).get("hp", 0))
    shield_info = {
        "front_ratio": shield_front_ratio,
        "front_hp": round(shield_hp * shield_front_ratio, 1) if shield_front_ratio != 1 else None,
        "back_hp": round(shield_hp * (2 - shield_front_ratio), 1) if shield_front_ratio != 1 else None,
    }

    return {
        "overloads": overloads,
        "throttle_profile": throttle,
        "propulsion": propulsion,
        "mass": mass,
        "drain": drain,
        "shield": shield_info,
    }


@router.get("/loot-lookup")
def do_loot_lookup(query: str = Query(...), search_type: str = Query("component")):
    return loot_lookup(query, search_type)
