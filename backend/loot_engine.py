"""Enhanced loot lookup with best sources calculation."""

from __future__ import annotations

from gamedata import get_game_db
from re_engine import format_rarity, normal_cdf


def _tf(x) -> float:
    try:
        return float(x)
    except (TypeError, ValueError):
        return 0.0


def best_sources(
    component: str,
    level: int,
    stat: str | None = None,
    value: float | None = None,
) -> list[dict]:
    """Calculate the best NPC sources for a component at a given RE level.

    If stat and value are provided, factors in the rarity of that stat
    to compute combined drop+stat odds.
    """
    db = get_game_db()

    re_level = component[0] + str(level % 10)

    # Get stat info
    row = db.execute("SELECT * FROM component WHERE type = ?", [component]).fetchone()
    if not row:
        db.close()
        return []

    comp_stats = [x for x in row[17:25] if x]
    tails = [int(x) for x in row[9:17] if x]
    if component != "Armor":
        comp_stats = ["A/HP:"] + comp_stats
        tails = [1] + tails

    # Get brands for this RE level
    brands_raw = db.execute("SELECT * FROM brands WHERE relevel = ?", [re_level]).fetchall()
    brand_paths = [r[0] for r in brands_raw]
    brand_names = [r[1] for r in brands_raw]

    # Compute stat rarity per brand if stat is specified
    brand_rarity = [1.0] * len(brand_names)  # Default: no stat filter
    if stat and value is not None:
        stat_key = stat if stat.endswith(":") else stat + ":"
        if stat_key in comp_stats:
            stat_idx = comp_stats.index(stat_key)
            tail = tails[stat_idx] if stat_idx < len(tails) else 1

            for i in range(len(brands_raw)):
                mean = _tf(brands_raw[i][4 + 2 * stat_idx])
                mod = _tf(brands_raw[i][5 + 2 * stat_idx])
                stdev = mean * mod / 2
                if stdev == 0:
                    brand_rarity[i] = 0
                    continue
                z = (value - mean) / stdev
                z_zero = (0 - mean) / stdev
                cdf = normal_cdf(z) - normal_cdf(z_zero)
                if tail == 1:
                    brand_rarity[i] = 1 - cdf
                else:
                    brand_rarity[i] = cdf

    # Build loot table density (which brands appear in which tables)
    loot_tables = db.execute("SELECT * FROM loottables").fetchall()
    table_names = [r[0] for r in loot_tables]
    density = []
    for table_row in loot_tables:
        items = [x for x in table_row if x and x != ""]
        brand_density = []
        for bp in brand_paths:
            if len(items) <= 1:
                brand_density.append(0)
            else:
                brand_density.append(items[1:].count(bp) / len(items[1:]))
        density.append(brand_density)

    # Build loot group density
    groups = db.execute("SELECT * FROM lootgroups").fetchall()
    group_names = [r[0] for r in groups]
    grouped_density = []

    for grp in groups:
        sub_tables = [x for x in grp[1:] if x and x != ""]

        # Determine table rates based on group type
        if "convoy" in grp[0]:
            tier = int(grp[0][-1]) if grp[0][-1].isdigit() else 1
            table_rates = [
                (12 + 5 * tier) / 100,  # rare
                0.15,  # reward
                (60 - 5 * tier) / 100,  # standard
                0,  # deco
                0.05,  # flight plan
                0.08,  # schematic
            ]
        elif "gcw2_crate" in grp[0]:
            table_rates = [0.35, 0.65]
        elif "beacon" in grp[0]:
            p_count = int(grp[0][-1]) if grp[0][-1].isdigit() else 1
            grp_mod = p_count * 4
            table_rates = [
                0.7 - grp_mod / 100,
                0.1,
                ((100 - (p_count**2) / 15) - (80 - grp_mod)) / 100,
            ]
        else:
            table_rates = [1 / len(sub_tables)] * len(sub_tables) if sub_tables else []

        grp_density = [0.0] * len(brand_paths)
        for j, st in enumerate(sub_tables):
            if st in table_names and j < len(table_rates):
                t_idx = table_names.index(st)
                for k in range(len(brand_paths)):
                    grp_density[k] += density[t_idx][k] * table_rates[j]

        grouped_density.append(grp_density)

    # Compute per-NPC odds
    ships = db.execute("SELECT * FROM npcships").fetchall()
    db.close()

    ships_table = []
    for ship in ships:
        drop_rate = _tf(ship[2]) * _tf(ship[3])
        if ship[4] not in group_names:
            continue
        g_idx = group_names.index(ship[4])
        ship_density = [x * drop_rate for x in grouped_density[g_idx]]

        # Combined: sum(brand_drop_chance × brand_stat_rarity)
        combined = sum(ship_density[k] * brand_rarity[k] for k in range(len(brand_paths)))

        if combined < 1e-8:
            continue

        # Format the result
        name = ship[1]
        npc_type = ship[0]
        display = f"{name} [{npc_type}]"

        # Determine kill/crate multiplier
        if "Convoy Reward" in name:
            tier = int(name.split("Tier ")[1][0]) if "Tier " in name else 1
            unit = f"Crates ({format_rarity(int((3 + 2 * tier) / combined))} Items)" if combined > 0 else "Crates"
        elif "Beacon" in name or "Space Battle" in name:
            unit = "Crates"
        elif "Reward" in name:
            unit = "Runs"
        else:
            unit = "Kills"

        odds_str = format_rarity(int(1 / combined)) if combined > 0 else "Improbable"

        ships_table.append(
            {
                "npc": display,
                "npc_type": npc_type,
                "odds": odds_str,
                "raw_odds": combined,
                "unit": unit,
                "drop_rate": drop_rate,
            }
        )

    # Sort by best odds
    ships_table.sort(key=lambda x: x["raw_odds"], reverse=True)

    return ships_table[:200]
