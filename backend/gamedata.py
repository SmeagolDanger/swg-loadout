"""Read-only access to the SWG game data tables (tables.db)."""
import os
import sqlite3
from functools import lru_cache
from typing import List, Dict, Any, Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "tables.db")


def get_game_db():
    conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


@lru_cache(maxsize=1)
def get_chassis_list() -> List[Dict[str, Any]]:
    db = get_game_db()
    rows = db.execute("SELECT * FROM chassis").fetchall()
    db.close()
    result = []
    for r in rows:
        result.append({
            "name": r[0], "mass": _float(r[1]),
            "slots": [r[i] for i in range(2, 10)],
            "accel": _float(r[10]), "decel": _float(r[11]),
            "pitch_accel": _float(r[12]), "yaw_accel": _float(r[13]), "roll_accel": _float(r[14]),
            "speed_mod": _float(r[15]), "speed_foils": _float(r[16]),
            "min_throttle": _float(r[17]), "opt_throttle": _float(r[18]), "max_throttle": _float(r[19]),
            "slide": _float(r[20])
        })
    return result


def get_chassis(name: str) -> Optional[Dict[str, Any]]:
    for c in get_chassis_list():
        if c["name"] == name:
            return c
    return None


@lru_cache(maxsize=1)
def get_component_stats() -> List[Dict[str, Any]]:
    db = get_game_db()
    rows = db.execute("SELECT * FROM component").fetchall()
    db.close()
    result = []
    for r in rows:
        result.append({
            "type": r[0],
            "stat_names": [r[i] for i in range(1, 9)],
            "stat_re_names": [r[i] for i in range(9, 17)],
            "stat_display_names": [r[i] for i in range(17, 25)],
        })
    return result


def get_component_stat_info(comp_type: str) -> Optional[Dict]:
    for c in get_component_stats():
        if c["type"] and c["type"].lower() == comp_type.lower():
            return c
    return None


@lru_cache(maxsize=1)
def get_fc_programs() -> List[Dict[str, Any]]:
    db = get_game_db()
    rows = db.execute("SELECT * FROM fcprogram").fetchall()
    db.close()
    result = []
    for r in rows:
        result.append({
            "command": r[0], "name": r[1], "size": _float(r[2]),
            "target": r[3], "delay": _float(r[4]),
            "energy_efficiency": _float(r[5]), "gen_efficiency": _float(r[6]),
            "comp_damage": _float(r[7]),
            "front_to_back_reinf": _float(r[8]), "back_to_front_reinf": _float(r[9]),
            "cap_reinf_percent": _float(r[10]), "front_shield_ratio": _float(r[11]),
            "desc1": r[12], "desc2": r[13], "desc3": r[14], "desc4": r[15]
        })
    return result


@lru_cache(maxsize=1)
def get_ordnance_types() -> List[Dict[str, Any]]:
    db = get_game_db()
    rows = db.execute("SELECT * FROM ordnance").fetchall()
    db.close()
    return [{"type": r[0], "multiplier": _float(r[1]), "shield_eff": _float(r[2]),
             "armor_eff": _float(r[3]), "min_mass": _float(r[4]), "max_mass": _float(r[5]),
             "min_max": _float(r[6]), "max_max": _float(r[7])} for r in rows]


@lru_cache(maxsize=1)
def get_complib() -> List[Dict[str, Any]]:
    db = get_game_db()
    rows = db.execute("SELECT * FROM complib").fetchall()
    db.close()
    return [{"type": r[0], "name": r[1],
             "stats": [_float(r[i]) for i in range(2, 10)]} for r in rows]


@lru_cache(maxsize=1)
def get_brands() -> List[Dict[str, Any]]:
    db = get_game_db()
    rows = db.execute("SELECT * FROM brands").fetchall()
    db.close()
    result = []
    for r in rows:
        result.append({
            "path": r[0], "name": r[1], "re_level": _float(r[2]), "weight": _float(r[3]),
            "stats": [{"mean": _float(r[i*2+4]), "mod": _float(r[i*2+5])} for i in range(9)]
        })
    return result


@lru_cache(maxsize=1)
def get_npc_ships() -> List[Dict[str, Any]]:
    db = get_game_db()
    rows = db.execute("SELECT * FROM npcships").fetchall()
    db.close()
    return [{"type": r[0], "string": r[1], "loot_rolls": _float(r[2]),
             "drop_rate": _float(r[3]), "loot_group": r[4], "ship_type": r[5]} for r in rows]


@lru_cache(maxsize=1)
def get_loot_groups() -> List[Dict[str, Any]]:
    db = get_game_db()
    rows = db.execute("SELECT * FROM lootgroups").fetchall()
    db.close()
    return [{"loot_group": r[0], "tables": [r[i] for i in range(1, 7)]} for r in rows]


@lru_cache(maxsize=1)
def get_loot_tables() -> Dict[str, List[str]]:
    db = get_game_db()
    rows = db.execute("SELECT * FROM loottables").fetchall()
    db.close()
    result = {}
    for r in rows:
        items = [r[i] for i in range(1, len(r)) if r[i] and str(r[i]).strip()]
        result[r[0]] = items
    return result


@lru_cache(maxsize=1)
def get_ship_types() -> List[Dict[str, Any]]:
    db = get_game_db()
    rows = db.execute("SELECT * FROM shiptypes").fetchall()
    db.close()
    result = []
    for r in rows:
        ship = {"name": r[0], "chassis_hp": _float(r[1])}
        # Basic stats
        ship["reactor_hp"] = _float(r[2])
        ship["reactor_armor"] = _float(r[3])
        ship["engine_hp"] = _float(r[4])
        ship["engine_armor"] = _float(r[5])
        # Weapons (up to 8)
        ship["weapons"] = []
        for i in range(8):
            base = 24 + i * 9
            if base + 8 < len(r) and r[base]:
                ship["weapons"].append({
                    "type": r[base], "hp": _float(r[base+1]), "armor": _float(r[base+2]),
                    "refire": _float(r[base+3]), "min_dam": _float(r[base+4]),
                    "max_dam": _float(r[base+5]), "vss": _float(r[base+6]),
                    "vsa": _float(r[base+7]), "ammo": _float(r[base+8]) if base+8 < len(r) else 0
                })
        result.append(ship)
    return result


def _float(x) -> float:
    try:
        return float(x)
    except (TypeError, ValueError):
        return 0.0
