"""Core SWG ship loadout calculations, ported from the desktop application."""

import math
from typing import Any

from gamedata import get_fc_programs, get_ordnance_types


def try_float(x) -> float:
    try:
        return float(x)
    except (TypeError, ValueError):
        return 0.0


def ceil_custom(x):
    try:
        return round(x + 0.5)
    except Exception:
        return 0


def get_overload_data():
    """Get first 16 FC programs (overload data)."""
    programs = get_fc_programs()
    return programs[:16]


def calc_overload_multipliers(ro_level, eo_level, co_level, wo_level):
    """Calculate overload multipliers for all systems."""
    overloads = get_overload_data()
    result = {
        "ro_gen_eff": 1,
        "eo_eff": 1,
        "eo_gen_eff": 1,
        "co_eff": 1,
        "co_gen_eff": 1,
        "wo_eff": 1,
        "wo_gen_eff": 1,
        "ro_desc": {},
        "eo_desc": {},
        "co_desc": {},
        "wo_desc": {},
    }

    if ro_level is not None and ro_level != "None" and ro_level > 0:
        idx = ro_level - 1
        if idx < len(overloads):
            result["ro_gen_eff"] = try_float(overloads[idx]["gen_efficiency"])
            result["ro_desc"] = {"generation": f"{result['ro_gen_eff']}x"}

    if eo_level is not None and eo_level != "None" and eo_level > 0:
        idx = eo_level + 3
        if idx < len(overloads):
            ee = try_float(overloads[idx]["energy_efficiency"])
            result["eo_eff"] = round(1 / ee, 2) if ee != 0 else 1
            result["eo_gen_eff"] = try_float(overloads[idx]["gen_efficiency"])
            result["eo_desc"] = {"ts_pyr": f"{result['eo_gen_eff']}x", "drain": f"{result['eo_eff']}x"}

    if co_level is not None and co_level != "None" and co_level > 0:
        idx = co_level + 7
        if idx < len(overloads):
            ee = try_float(overloads[idx]["energy_efficiency"])
            result["co_eff"] = round(1 / ee, 2) if ee != 0 else 1
            result["co_gen_eff"] = try_float(overloads[idx]["gen_efficiency"])
            result["co_desc"] = {"ce_rr": f"{result['co_gen_eff']}x", "drain": f"{result['co_eff']}x"}

    if wo_level is not None and wo_level != "None" and wo_level > 0:
        idx = wo_level + 11
        if idx < len(overloads):
            ee = try_float(overloads[idx]["energy_efficiency"])
            result["wo_eff"] = round(1 / ee, 2) if ee != 0 else 1
            result["wo_gen_eff"] = try_float(overloads[idx]["gen_efficiency"])
            result["wo_desc"] = {"damage": f"{result['wo_gen_eff']}x", "drain_eps": f"{result['wo_eff']}x"}

    return result


def calc_shield_adjust(adjust_setting: str):
    """Calculate shield front/back ratio from adjust setting."""
    if not adjust_setting or adjust_setting == "None":
        return 1.0

    programs = get_fc_programs()
    halves = adjust_setting.split(" - ", 1)
    if len(halves) != 2:
        return 1.0

    name = f"Shield {halves[0]} Adjust - {halves[1]}"
    for p in programs:
        if p["name"] == name:
            return try_float(p["front_shield_ratio"])
    return 1.0


def calc_weapon_stats(
    weapons: list[dict], slot_headers: list[str], packs: list[dict], co_level, wo_level
) -> dict[str, Any]:
    """Calculate weapon DPS, fire time, cap drain etc.

    FIX: co_gen_eff was computed but discarded (never assigned).
    FIX: wo_eff must use the RAW energy_efficiency for EPS division
         (matching Seraph: epsList.append(tryFloat(stats[6]) / woEff)
          where woEff is the raw energy_efficiency from the overload table).
    """
    overloads = get_overload_data()

    co_gen_eff = 1.0  # FIX: was computed but never stored
    wo_eff = 1.0      # raw energy_efficiency (for dividing EPS)
    wo_gen_eff = 1.0   # gen_efficiency (for multiplying damage)

    if co_level is not None and co_level != "None" and co_level > 0:
        idx = co_level + 7
        if idx < len(overloads):
            co_gen_eff = try_float(overloads[idx]["gen_efficiency"])  # FIX: now assigned

    if wo_level is not None and wo_level != "None" and wo_level > 0:
        idx = wo_level + 11
        if idx < len(overloads):
            ee = try_float(overloads[idx]["energy_efficiency"])
            wo_eff = ee if ee != 0 else 1  # raw energy_efficiency for EPS division
            wo_gen_eff = try_float(overloads[idx]["gen_efficiency"])

    dp_shot_pve = []
    dp_shot_pvp = []
    eps_list = []
    refire_list = []
    loaded_weapons = []
    weapon_owners = []
    loaded_ordnance = []
    ord_damage_pve = []
    ord_damage_pvp = []
    pilot_pve = 0
    pilot_pvp = 0

    ordnance_types = {o["type"]: o for o in get_ordnance_types()}

    for i, wep in enumerate(weapons):
        if not wep or wep.get("type") == "None":
            continue

        comp_type = wep.get("comp_type", "")
        header = slot_headers[i] if i < len(slot_headers) else ""

        if comp_type == "weapon":
            avg_dmg = (try_float(wep.get("min_damage", 0)) + try_float(wep.get("max_damage", 0))) / 2 * wo_gen_eff
            vss = try_float(wep.get("vs_shields", 0))
            vsa = try_float(wep.get("vs_armor", 0))
            dp_shot = avg_dmg * (2 * vss + 2 * vss * vsa + 1) / 5

            dp_shot_pve.append(dp_shot)
            dp_shot_pvp.append(dp_shot * 0.375)
            eps_list.append(try_float(wep.get("energy_per_shot", 0)) / wo_eff)
            refire_list.append(try_float(wep.get("refire_rate", 0)))
            loaded_weapons.append(header)

            if "Turret" in header:
                weapon_owners.append("Turret")
                dp_shot_pve[-1] *= 2.75
            else:
                weapon_owners.append("Pilot")
                pilot_pve += dp_shot
                pilot_pvp += dp_shot * 0.375

        elif comp_type == "ordnance" and i < len(packs) and packs[i]:
            pack = packs[i]
            avg_dmg = (try_float(pack.get("min_damage", 0)) + try_float(pack.get("max_damage", 0))) / 2 * wo_gen_eff
            ord_type = pack.get("ord_type", "")
            type_stats = ordnance_types.get(ord_type, {})
            vss = try_float(type_stats.get("shield_eff", 0))
            vsa = try_float(type_stats.get("armor_eff", 0))
            ord_dmg = avg_dmg * (2 * vss + 2 * vss * vsa + 1) / 5
            ord_damage_pve.append(ord_dmg * try_float(type_stats.get("multiplier", 1)))
            ord_damage_pvp.append(ord_dmg * 0.5)
            loaded_ordnance.append(header)

    result = {
        "weapon_damages": [],
        "pilot_total_pve": round(pilot_pve, 1),
        "pilot_total_pvp": round(pilot_pvp, 1),
        "cap_stats": {},
    }

    # Combine weapons and ordnance for display
    all_names = loaded_weapons + loaded_ordnance
    all_pve = dp_shot_pve + ord_damage_pve
    all_pvp = dp_shot_pvp + ord_damage_pvp

    for i in range(len(all_names)):
        result["weapon_damages"].append(
            {"slot": all_names[i], "pve": round(all_pve[i], 1), "pvp": round(all_pvp[i], 1)}
        )

    # FIX: Run cap combat simulation inline so we have access to all data
    cap_energy = try_float(weapons[0].get("_cap_energy", 0)) if weapons else 0
    cap_recharge = try_float(weapons[0].get("_cap_recharge", 0)) if weapons else 0

    # Cap combat data is returned separately via calc_cap_combat
    # Store eps_list, refire_list, dp_shot_pve, co_gen_eff for the caller
    result["_eps_list"] = eps_list
    result["_refire_list"] = refire_list
    result["_dp_shot_pve"] = dp_shot_pve
    result["_co_gen_eff"] = co_gen_eff

    return result


def calc_cap_combat(
    cap_energy: float,
    cap_recharge: float,
    eps_list: list[float],
    refire_list: list[float],
    dp_shot_pve: list[float],
    co_gen_eff: float,
) -> dict[str, Any]:
    """Simulate combat firing until cap is empty."""
    cap_energy *= co_gen_eff
    cap_recharge *= co_gen_eff

    if cap_energy == 0 or len(eps_list) == 0:
        return {}

    t = 0
    last_recharge_tick = 0
    current_energy = cap_energy
    server_tickrate = 30
    last_shot = [-1.0] * len(eps_list)
    refire_adjustment = 0.11
    fire_time = 0
    damage_per_weapon = [0.0] * len(eps_list)

    while t < 300:
        if t - last_recharge_tick >= 1.5:
            last_recharge_tick = t
            current_energy += cap_recharge * 1.5
            if current_energy > cap_energy:
                current_energy = cap_energy

        for i in range(len(eps_list)):
            refire = refire_list[i] + refire_adjustment
            if t - last_shot[i] > refire:
                last_shot[i] = t
                current_energy -= eps_list[i]
                damage_per_weapon[i] += dp_shot_pve[i]

        if current_energy < 0:
            fire_time = t
            break
        t += 1 / server_tickrate

    full_cap_damage = round(sum(damage_per_weapon), 1)

    try:
        cap_recharge_time = round(ceil_custom(cap_energy / (1.5 * cap_recharge)) * 1.5, 1)
    except Exception:
        cap_recharge_time = 0

    if fire_time > 0:
        firing_ratio = round(fire_time / (fire_time + cap_recharge_time) * 100, 1)
        fire_time_str = f"{round(fire_time, 1)}s"
    else:
        firing_ratio = None
        fire_time_str = ">300s"

    return {
        "overloaded_ce": cap_energy,
        "overloaded_rr": cap_recharge,
        "full_cap_damage": full_cap_damage,
        "fire_time": fire_time_str,
        "cap_recharge_time": f"{cap_recharge_time}s",
        "firing_ratio": f"{firing_ratio}%" if firing_ratio else "",
    }


def calc_propulsion(chassis: dict, engine: dict | None, booster: dict | None, eo_level) -> dict[str, Any]:
    """Calculate top speed, boosted speed, boost distance, uptime."""
    overloads = get_overload_data()

    speed_mod = try_float(chassis.get("speed_mod", 0))
    speed_mod_foils = try_float(chassis.get("speed_foils", 0))
    accel = try_float(chassis.get("accel", 0))
    decel = try_float(chassis.get("decel", 0))

    eo_gen_eff = 1.0
    if eo_level is not None and eo_level != "None" and eo_level > 0:
        idx = eo_level + 3
        if idx < len(overloads):
            eo_gen_eff = try_float(overloads[idx]["gen_efficiency"])

    result = {
        "speed_mod": speed_mod,
        "speed_mod_foils": speed_mod_foils if speed_mod_foils != speed_mod and speed_mod_foils != 0 else None,
        "accel": int(accel),
        "decel": int(decel),
        "pitch": int(try_float(chassis.get("pitch_accel", 0))),
        "yaw": int(try_float(chassis.get("yaw_accel", 0))),
        "roll": int(try_float(chassis.get("roll_accel", 0))),
        "slide": try_float(chassis.get("slide", 0)),
        "top_speed": None,
        "top_speed_foils": None,
        "boosted_top_speed": None,
        "boosted_top_speed_foils": None,
        "boost_distance": None,
        "boost_distance_foils": None,
        "booster_uptime": None,
    }

    if engine:
        engine_ts = try_float(engine.get("top_speed", 0))
        speed = engine_ts * eo_gen_eff * speed_mod * 10
        result["top_speed"] = int(speed)

        if speed_mod_foils and speed_mod_foils != speed_mod and speed_mod_foils != 0:
            result["top_speed_foils"] = int(engine_ts * eo_gen_eff * speed_mod_foils * 10)

        if booster:
            booster_energy = try_float(booster.get("energy", 0))
            booster_recharge = try_float(booster.get("recharge_rate", 0))
            booster_cons = try_float(booster.get("consumption", 0))
            booster_accel = try_float(booster.get("acceleration", 0)) + accel
            booster_ts = try_float(booster.get("top_speed", 0))

            booster_uptime = ceil_custom(booster_energy / (booster_cons * 1.5)) * 1.5 if booster_cons > 0 else 0
            booster_recharge_time = (
                ceil_custom(booster_energy / (booster_recharge * 1.5)) * 1.5 if booster_recharge > 0 else 0
            )

            if booster_uptime + booster_recharge_time > 0:
                result["booster_uptime"] = round(booster_uptime / (booster_uptime + booster_recharge_time) * 100, 1)

            boosted_ts = (engine_ts * eo_gen_eff + booster_ts) * speed_mod * 10
            result["boosted_top_speed"] = int(boosted_ts)

            accel_time = (booster_ts * speed_mod) / (booster_accel + accel) if (booster_accel + accel) > 0 else 0
            decel_time = (booster_ts * speed_mod) / decel if decel > 0 else 0
            accel_loss = accel_time * booster_ts * speed_mod / 2
            decel_gain = decel_time * booster_ts * speed_mod / 2
            result["boost_distance"] = int(round(boosted_ts / 10 * booster_uptime - accel_loss + decel_gain, 0))

            if speed_mod_foils and speed_mod_foils != speed_mod and speed_mod_foils != 0:
                boosted_foils = (engine_ts * eo_gen_eff + booster_ts) * speed_mod_foils * 10
                result["boosted_top_speed_foils"] = int(boosted_foils)
                accel_time = (
                    (booster_ts * speed_mod_foils) / (booster_accel + accel) if (booster_accel + accel) > 0 else 0
                )
                decel_time = (booster_ts * speed_mod_foils) / decel if decel > 0 else 0
                accel_loss = accel_time * booster_ts * speed_mod_foils / 2
                decel_gain = decel_time * booster_ts * speed_mod_foils / 2
                result["boost_distance_foils"] = int(
                    round(boosted_foils / 10 * booster_uptime - accel_loss + decel_gain)
                )

    return result


def calc_throttle_profile(chassis: dict) -> list[dict[str, Any]]:
    """Calculate the throttle profile for a chassis."""
    min_throttle = try_float(chassis.get("min_throttle", 0))
    opt_throttle = try_float(chassis.get("opt_throttle", 0))
    max_throttle = try_float(chassis.get("max_throttle", 0))

    profile = []
    for i in range(11):
        speed_pct = (10 - i) / 10  # 100% down to 0%

        if speed_pct < opt_throttle:
            pct_to_optimal = speed_pct / opt_throttle if opt_throttle > 0 else 0
            per = (1 - min_throttle) * pct_to_optimal + min_throttle
        else:
            pct_from_optimal = (speed_pct - opt_throttle) / (1 - opt_throttle) if (1 - opt_throttle) > 0 else 0
            per = (max_throttle - 1) * pct_from_optimal + 1

        per = math.floor(per * 10 + 0.5) / 10
        pyr_pct = int(per * 100)

        profile.append(
            {
                "throttle": f"{int(speed_pct * 100)}%",
                "pyr_modifier": pyr_pct,
            }
        )

    return profile


def calc_mass_summary(components: dict[str, Any], chassis_mass: float) -> dict[str, Any]:
    """Calculate total mass and utilization."""
    total = 0
    for _key, comp in components.items():
        if comp and isinstance(comp, dict) and "mass" in comp:
            total += try_float(comp["mass"])

    total = round(total, 1)
    if chassis_mass > 0:
        pct = round(total / chassis_mass * 100, 1)
        remaining = round(chassis_mass - total, 1)
        return {
            "total_mass": total,
            "chassis_mass": chassis_mass,
            "percent": pct,
            "remaining": remaining,
            "over_limit": total > chassis_mass,
        }
    return {"total_mass": total, "chassis_mass": 0, "percent": 0, "remaining": 0, "over_limit": False}


def _find_last_cm_index(components: dict[str, Any]) -> int:
    """Find the index of the countermeasure that is the 'last loaded' weapon slot.

    FIX: In Seraph, the code reverses the slot list and finds the first CM
    that appears before any non-null component. If a CM is the very last
    loaded slot, its drain is reduced to 1/10.

    Returns the 1-based slot index (1-8) of the last-loaded CM, or 0 if none.
    """
    comp_types = []
    for i in range(1, 9):
        slot = components.get(f"slot{i}", {})
        if slot and slot.get("comp_type"):
            comp_types.append(slot["comp_type"])
        else:
            comp_types.append("Null")

    # Reverse and find first CM before any non-null component
    comp_types_rev = list(reversed(comp_types))
    cm_index = 0
    for i, ct in enumerate(comp_types_rev):
        if ct == "countermeasure":
            cm_index = 8 - i  # Convert back to 1-based forward index
            break
        if ct != "Null":
            cm_index = 0
            break

    return cm_index


def calc_drain_summary(components: dict[str, Any], ro_level, eo_level, co_level, wo_level) -> dict[str, Any]:
    """Calculate total energy drain and reactor utilization.

    FIX 1: Countermeasure and ordnance drains must also be affected by weapon overload.
            In Seraph, ALL slot drains go through: drain / woEff (raw energy_efficiency).
            The wiki confirms: 'weapon overload increases your weapon, ordnance, and
            countermeasure drain by 5x'.

    FIX 2: Added countermeasure 'last loaded' 1/10 drain reduction. When a CM is the
            last-loaded weapon slot (i.e., nothing is loaded after it), it only uses
            1/10 of its drain. This matches Seraph's updateDrainStrings logic.

    FIX 3: Added per-component power status (powered/partial/unpowered) to match
            Seraph's green/yellow/red reactor priority visualization.
    """
    overloads = calc_overload_multipliers(ro_level, eo_level, co_level, wo_level)

    reactor_gen = try_float(components.get("reactor", {}).get("generation", 0))
    ro_eff = overloads["ro_gen_eff"]

    # Find last-loaded CM index for 1/10 drain reduction
    cm_index = _find_last_cm_index(components)

    # Build ordered drain list matching Seraph's priority order:
    # engine, shield, capacitor, booster, droid_interface, slot1..slot8
    powered_keys = ["engine", "shield", "capacitor", "booster", "droid_interface"]
    for i in range(1, 9):
        powered_keys.append(f"slot{i}")

    drains = []
    for key in powered_keys:
        comp = components.get(key, {})
        if not comp:
            drains.append(0)
            continue

        raw_drain = try_float(comp.get("drain", 0))

        if key == "engine":
            drains.append(raw_drain * overloads["eo_eff"])
        elif key == "capacitor":
            drains.append(raw_drain * overloads["co_eff"])
        elif key.startswith("slot"):
            slot_idx = int(key[4:])
            ct = comp.get("comp_type", "")
            # FIX 1: ALL slot types (weapon, ordnance, countermeasure) get wo_eff
            effective_drain = raw_drain * overloads["wo_eff"]

            # FIX 2: Last-loaded CM gets 1/10 drain
            if ct == "countermeasure" and slot_idx == cm_index and cm_index != 0:
                effective_drain = effective_drain / 10

            drains.append(effective_drain)
        else:
            # shield, booster, droid_interface — no overload modifier
            drains.append(raw_drain)

    overloaded_gen = round(reactor_gen * ro_eff, 1)

    # FIX 3: Calculate per-component power status
    total_drain = 0
    reactor_remaining = overloaded_gen
    component_power = []

    for i, key in enumerate(powered_keys):
        comp = components.get(key, {})
        has_component = comp and (comp.get("name", "None") != "None" if "name" in comp else comp.get("drain", 0) != 0 or comp.get("comp_type"))

        current_drain = drains[i]

        if has_component and current_drain > 0:
            if reactor_remaining <= 0:
                status = "unpowered"
            elif current_drain > reactor_remaining:
                if reactor_remaining < 0.1 * current_drain:
                    status = "unpowered"
                else:
                    # Special case: last-loaded CM with partial power still counts as powered
                    if key.startswith("slot"):
                        slot_idx = int(key[4:])
                        ct = comp.get("comp_type", "")
                        if ct == "countermeasure" and slot_idx == cm_index and cm_index != 0 and reactor_remaining >= 0.1 * current_drain:
                            status = "powered"
                        else:
                            status = "partial"
                    else:
                        status = "partial"
            else:
                status = "powered"

            total_drain += current_drain
            reactor_remaining -= current_drain
        elif has_component:
            status = "powered"
        else:
            status = "none"

        component_power.append({"key": key, "drain": round(current_drain, 2), "status": status})

    total_drain = round(total_drain, 1)

    if overloaded_gen > 0:
        utilization = round(total_drain / overloaded_gen * 100, 1)
    else:
        utilization = 0

    return {
        "total_drain": total_drain,
        "overloaded_gen": overloaded_gen,
        "utilization": utilization,
        "over_limit": total_drain > overloaded_gen,
        "min_gen_required": round(total_drain / ro_eff, 1) if ro_eff > 0 else 0,
        "component_power": component_power,  # FIX 3: per-component power status
    }


def loot_lookup(search_term: str, search_type: str = "component") -> list[dict[str, Any]]:
    """Search for where a component drops or what an NPC drops."""
    from gamedata import get_complib, get_loot_groups, get_loot_tables, get_npc_ships

    npc_ships = get_npc_ships()
    loot_groups = get_loot_groups()
    loot_tables_data = get_loot_tables()
    get_complib()

    results = []
    search_lower = search_term.lower()

    if search_type == "component":
        # Find which loot tables contain this component
        matching_tables = []
        for table_name, items in loot_tables_data.items():
            for item in items:
                if search_lower in str(item).lower():
                    matching_tables.append(table_name)
                    break

        # Find which loot groups reference these tables
        matching_groups = []
        for lg in loot_groups:
            for table in lg["tables"]:
                if table in matching_tables:
                    matching_groups.append(lg["loot_group"])
                    break

        # Find which NPCs use these loot groups
        for npc in npc_ships:
            if npc["loot_group"] in matching_groups:
                results.append(
                    {
                        "npc_type": npc["type"],
                        "npc_string": npc["string"],
                        "loot_rolls": npc["loot_rolls"],
                        "drop_rate": npc["drop_rate"],
                        "loot_group": npc["loot_group"],
                        "ship_type": npc["ship_type"],
                    }
                )

    elif search_type == "npc":
        for npc in npc_ships:
            if search_lower in str(npc["string"]).lower() or search_lower in str(npc["type"]).lower():
                # Find what this NPC drops
                group = npc["loot_group"]
                drops = []
                for lg in loot_groups:
                    if lg["loot_group"] == group:
                        for table in lg["tables"]:
                            if table and table in loot_tables_data:
                                drops.extend(loot_tables_data[table])
                        break

                results.append(
                    {
                        "npc_type": npc["type"],
                        "npc_string": npc["string"],
                        "loot_rolls": npc["loot_rolls"],
                        "drop_rate": npc["drop_rate"],
                        "loot_group": npc["loot_group"],
                        "ship_type": npc["ship_type"],
                        "drops": list(set(drops))[:50],
                    }
                )

    return results[:100]
