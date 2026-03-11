"""Reverse Engineering calculator engine.

Ported from Seraph's Loadout Tool reCalcUtility.py.
Implements the Gaussian mixture model rarity calculations,
unicorn detection, stat matching, and RE outcome analysis.
"""

from __future__ import annotations

import math
from typing import Any

from gamedata import get_game_db

# ── RE level multipliers ────────────────────────────────────
RE_MULTS = [0.02, 0.03, 0.03, 0.04, 0.04, 0.05, 0.05, 0.06, 0.07, 0.07]

# ── Component types that have special RE behavior ───────────
COMP_TYPES = ["Armor", "Booster", "Capacitor", "Droid Interface", "Engine", "Reactor", "Shield", "Weapon"]


def _tf(x: Any) -> float:
    try:
        return float(x)
    except (TypeError, ValueError):
        return 0.0


def _ti(x: Any) -> int:
    try:
        return int(x)
    except (TypeError, ValueError):
        return 0


# ── Statistical primitives ──────────────────────────────────


def normal_cdf(z: float) -> float:
    """Standard normal cumulative distribution function."""
    return 0.5 * (1 + math.erf(z / math.sqrt(2)))


def log_mean(values: list[float]) -> float:
    """Geometric mean via logarithms (ignores non-positive)."""
    total = 0.0
    count = 0
    for v in values:
        if v > 0:
            total += math.log10(v)
            count += 1
    if count == 0:
        return 0.0
    return math.pow(10, total / count)


def get_rarity(x, means: list[float], stdevs: list[float], weights: list[float]) -> float | str:
    """Calculate rarity of a value against a Gaussian mixture model."""
    if x == "" or x is None:
        return ""
    x = _tf(x)
    rarity = 0.0
    try:
        for i in range(len(means)):
            mean = means[i]
            stdev = stdevs[i]
            if stdev == 0:
                continue
            z = (x - mean) / stdev
            cdf = normal_cdf(z)
            rarity += cdf * weights[i]
        return float(rarity)
    except Exception:
        return ""


def format_rarity(rarity) -> str:
    """Format a rarity value as '1 in X'."""
    if isinstance(rarity, str) or rarity == 0:
        return ""
    if rarity > 0 and rarity <= 1:
        rarity = 1
    else:
        rarity = int(rarity)
    if rarity >= 100_000_000_000:
        return "Improbable"
    elif rarity >= 10_000_000_000:
        return f"1 in {int(round(rarity / 1_000_000_000, 0))}B"
    elif rarity >= 1_000_000_000:
        return f"1 in {round(rarity / 1_000_000_000, 1)}B"
    elif rarity >= 10_000_000:
        return f"1 in {int(round(rarity / 1_000_000, 0))}M"
    elif rarity >= 1_000_000:
        return f"1 in {round(rarity / 1_000_000, 1)}M"
    elif rarity >= 10_000:
        return f"1 in {int(round(rarity / 1_000, 0))}k"
    elif rarity >= 1_000:
        return f"1 in {round(rarity / 1_000, 1)}k"
    else:
        return f"1 in {int(round(rarity, 0))}"


def get_log_delta(a: float, b: float) -> float:
    if b <= 0:
        return math.log10(a) if a > 0 else 0
    elif a <= 0:
        return math.log10(b) if b > 0 else 0
    return math.log10(a) - math.log10(b)


# ── Game data helpers ───────────────────────────────────────


def get_comp_info(comp_type: str) -> dict:
    """Get component stat names, display names, and tails from tables.db."""
    db = get_game_db()
    row = db.execute("SELECT * FROM component WHERE type = ?", [comp_type]).fetchone()
    db.close()
    if not row:
        return {}

    stat_names = [row[i] for i in range(1, 9)]
    re_tails = [row[i] for i in range(9, 17)]
    display_names = [row[i] for i in range(17, 25)]

    # Clean stat display names (remove trailing colon for matching)
    clean_display = [s[:-1] if s and s.endswith(":") else s for s in display_names]

    return {
        "stat_names": [s for s in stat_names if s],
        "re_tails": re_tails,
        "display_names": display_names,
        "clean_display": clean_display,
    }


def pull_stats_data(re_level: str) -> tuple[list, list, list, list]:
    """Pull brand means, mods, stdevs, and mixture weights for a given RE level code."""
    db = get_game_db()
    brand_weights = [
        _ti(r[0]) for r in db.execute("SELECT weight FROM brands WHERE relevel = ?", [re_level]).fetchall()
    ]
    raw_means = db.execute(
        "SELECT stat1mean, stat2mean, stat3mean, stat4mean, stat5mean, stat6mean, stat7mean, stat8mean, stat9mean FROM brands WHERE relevel = ?",
        [re_level],
    ).fetchall()
    raw_mods = db.execute(
        "SELECT stat1mod, stat2mod, stat3mod, stat4mod, stat5mod, stat6mod, stat7mod, stat8mod, stat9mod FROM brands WHERE relevel = ?",
        [re_level],
    ).fetchall()
    db.close()

    means = []
    mods = []
    stdevs = []

    num_stats = len(raw_means[0]) if raw_means else 0
    num_brands = len(raw_means)

    for i in range(num_stats):
        row_stdevs = []
        row_means = []
        row_mods = []
        for j in range(num_brands):
            m = _tf(raw_means[j][i])
            mod = _tf(raw_mods[j][i])
            row_stdevs.append(m * mod / 2)
            row_means.append(m)
            row_mods.append(mod)
        stdevs.append(row_stdevs)
        means.append(row_means)
        mods.append(row_mods)

    total_count = sum(brand_weights)
    weights = [_tf(w) / total_count for w in brand_weights] if total_count > 0 else []

    return means, mods, stdevs, weights


def get_brand_names(re_level: str) -> list[str]:
    db = get_game_db()
    rows = db.execute("SELECT name FROM brands WHERE relevel = ?", [re_level]).fetchall()
    db.close()
    return [r[0] for r in rows]


# ── Reward detection ────────────────────────────────────────


def is_reward(stat_value, comp_type: str, level: int, stat: str) -> tuple[bool, list]:
    """Check if a stat value is a reward (near-zero variance brand)."""
    db = get_game_db()
    row = db.execute("SELECT * FROM component WHERE type = ?", [comp_type]).fetchone()
    db.close()
    if not row:
        return False, []

    comp_stats = list(row[17:25])
    tails = list(row[9:17])
    if "A/HP:" not in comp_stats:
        comp_stats.insert(0, "A/HP:")
        tails.insert(0, 1)
    else:
        comp_stats.append("")
        tails.append(1)

    if stat not in comp_stats:
        return False, []

    idx = comp_stats.index(stat)
    tail = int(_tf(tails[idx]))

    best = [0, 0] if tail > 0 else [1_000_000, 1_000_000]

    if stat_value in [0, "", None]:
        return False, best

    re_level = comp_type[0] + str(level % 10)
    stat_idx = str(idx + 1)

    db = get_game_db()
    means_raw = db.execute(f"SELECT stat{stat_idx}mean FROM brands WHERE relevel = ?", [re_level]).fetchall()
    mods_raw = db.execute(f"SELECT stat{stat_idx}mod FROM brands WHERE relevel = ?", [re_level]).fetchall()
    db.close()

    is_rewards = []
    low_high_list = []

    for i in range(len(means_raw)):
        mean = float(means_raw[i][0])
        mod = float(mods_raw[i][0])
        if mod < 0.001:
            low = mean * (1 - 3 * mod)
            high = mean * (1 + 3 * mod)
            if stat in ["Vs. Shields:", "Vs. Armor:", "Refire Rate:"]:
                low, high = round(low, 3), round(high, 3)
                if low == high:
                    low -= 0.001
                    high += 0.001
            elif stat == "Recharge:" and comp_type == "Shield":
                low, high = round(low, 2), round(high, 2)
                if low == high:
                    low -= 0.01
                    high += 0.01
            else:
                low, high = round(low, 1), round(high, 1)
                if low == high:
                    low -= 0.1
                    high += 0.1
            low_high_list.append([low, high])
            sv = _tf(stat_value)
            is_rewards.append(sv >= low and sv <= high)
        else:
            low_high_list.append([])
            is_rewards.append(False)

    for i in range(len(means_raw)):
        if is_rewards[i] and (
            (tail > 0 and low_high_list[i][1] > best[1]) or (tail < 0 and low_high_list[i][0] < best[1])
        ):
            best = low_high_list[i]

    try:
        reward = is_rewards[low_high_list.index(best)]
    except (ValueError, IndexError):
        reward = False

    if stat in ["Vs. Shields:", "Vs. Armor:", "Refire Rate:"]:
        best = [best[0] - 0.005, best[1] + 0.00499999]

    if tail < 0:
        best.reverse()

    return reward, best


# ── Worst case / rounding helpers for Vs and Refire ─────────


def worst_case_vs_refire(x, stat: str, re_mult: float) -> float:
    if "Refire" in stat:
        mult = 1 - re_mult
        pre_round = round(round(x, 2) * mult, 2)
        post_round = round(x * mult, 2)
        target = min(pre_round, post_round)
        wc_post = target + 0.00499999
        to_raw = wc_post / mult
        if round(to_raw, 2) < to_raw:
            return float(round(to_raw, 2) + 0.00499999)
        return float(to_raw)
    elif "Vs. Shields" in stat or "Vs. Armor" in stat:
        mult = 1 + re_mult
        pre_round = round(round(x, 2) * mult, 2)
        post_round = round(x * mult, 2)
        target = max(pre_round, post_round)
        wc_post = target - 0.005
        to_raw = wc_post / mult
        if round(to_raw, 2) > to_raw:
            return float(round(to_raw, 2) - 0.005)
        return float(to_raw)
    return x


def get_next_best_vs_refire(val, stat: str, mean, stdev, weights, re_mult: float):
    if val == "":
        return val
    if stat in ["Vs. Shields", "Vs. Armor"]:
        next_best = max(round(val * (1 + re_mult), 2), round(round(val, 2) * (1 + re_mult), 2)) + 0.01
        next_best_raw = worst_case_vs_refire(next_best / (1 + re_mult), stat, re_mult)
        rarity = get_rarity(next_best_raw, mean, stdev, weights)
        return 1 - rarity if isinstance(rarity, float) else rarity
    elif stat == "Refire Rate":
        next_best = min(round(val * (1 - re_mult), 2), round(round(val, 2) * (1 - re_mult), 2)) - 0.01
        next_best_raw = worst_case_vs_refire(next_best / (1 - re_mult), stat, re_mult)
        return get_rarity(next_best_raw, mean, stdev, weights)
    return val


# ── Unicorn detection ───────────────────────────────────────


def generate_threshold(part_level: str, unicorn_stat: int, unicorn_post: float) -> float:
    means, _mods, stdevs, weights = pull_stats_data(part_level)

    comp_types_map = {
        "A": "Armor",
        "B": "Booster",
        "C": "Capacitor",
        "D": "Droid Interface",
        "E": "Engine",
        "R": "Reactor",
        "S": "Shield",
        "W": "Weapon",
    }
    comp_type = comp_types_map.get(part_level[0], "")

    if unicorn_stat == 0:
        tail = 1
    elif unicorn_stat == 1 and part_level[0] == "A":
        tail = -1
    else:
        db = get_game_db()
        tail_col = f"stat{unicorn_stat}re"
        row = db.execute(f"SELECT {tail_col} FROM component WHERE type = ?", [comp_type]).fetchone()
        db.close()
        tail = int(row[0]) if row else 1

    re_level = _ti(part_level[1])
    if re_level == 0:
        re_level = 10
    re_level -= 1

    re_mult = RE_MULTS[re_level]
    re_mult = 1 + tail * re_mult

    threshold = get_rarity(unicorn_post / re_mult, means[unicorn_stat], stdevs[unicorn_stat], weights)

    db = get_game_db()
    counts = db.execute("SELECT weight FROM brands WHERE relevel = ?", [part_level]).fetchall()
    db.close()
    count = sum(_ti(c[0]) for c in counts)

    if tail == 1:
        threshold = (1 - _tf(threshold)) * count
    else:
        threshold = _tf(threshold) * count

    return threshold


def compute_unicorn_threshold() -> float:
    """Compute the calibrated unicorn threshold from canonical reference points."""
    thresholds = [
        generate_threshold("A0", 1, 2499.9),
        generate_threshold("C0", 4, 69),
        generate_threshold("E0", 6, 127),
        generate_threshold("R6", 2, 30000),
        generate_threshold("S0", 3, 4400),
        generate_threshold("W8", 4, 4200),
        generate_threshold("W0", 4, 5700),
    ]
    return math.pow(10, sum(math.log10(x) for x in thresholds if x > 0) / len(thresholds))


def detect_unicorns(
    rarity_list: list, comp_type: str, level: int, input_stats: list, raw_stats: list
) -> tuple[list[str], float]:
    """Detect unicorn stats and return the threshold rarity."""
    threshold = compute_unicorn_threshold()

    re_level = comp_type[0] + str(level % 10)

    info = get_comp_info(comp_type)
    comp_stats = list(info["display_names"])
    if "A/HP:" not in comp_stats:
        comp_stats.insert(0, "A/HP:")
    comp_stats = [x for x in comp_stats if x]

    db = get_game_db()
    counts = db.execute("SELECT weight FROM brands WHERE relevel = ?", [re_level]).fetchall()
    db.close()
    count = sum(_ti(c[0]) for c in counts)

    unicorns = []
    for i in range(len(rarity_list)):
        if rarity_list[i] != "" and rarity_list[i] is not None and isinstance(rarity_list[i], (int, float)):
            scaled = rarity_list[i] * count / math.sqrt(len(comp_stats) / 9)
            stat_label = comp_stats[i] if i < len(comp_stats) else ""
            reward, _ = is_reward(input_stats[i] if i < len(input_stats) else 0, comp_type, level, stat_label)
            if scaled <= threshold and not reward:
                unicorns.append(stat_label.rstrip(":"))
            else:
                unicorns.append("")
        else:
            unicorns.append("")

    threshold_rarity = threshold / count * math.sqrt(len(comp_stats) / 9) if count > 0 else 0
    return unicorns, threshold_rarity


# ── Main RE analysis endpoint logic ─────────────────────────


def match_stat(means, stdevs, weights, initial, target_rarity) -> float:
    """Binary search to find the stat value that hits a target rarity.

    This mirrors Seraph's original matchStat logic, including the left-tail
    zero-mass correction used for stats that cannot go below zero.
    """
    test_min = -6 * initial
    test_max = 6 * initial
    delta = 1.0
    value = initial
    zero_rarity = _tf(get_rarity(0, means, stdevs, weights))

    loop_count = 0
    while delta > 0.000000000001:
        if loop_count > 10000:
            break

        test_rarity = _tf(get_rarity(value, means, stdevs, weights)) - zero_rarity
        if test_rarity < 0:
            test_rarity = 0

        if test_rarity < target_rarity:
            test_min = value
        else:
            test_max = value

        value = (test_min + test_max) / 2
        delta = abs(test_rarity - target_rarity)
        loop_count += 1

    return value


def analyze_component(
    comp_type: str,
    level: int,
    raw_stats: list[float | str],
    matching_target: str = "Average Rarity",
    direction: int = 1,  # 1 = raw→post, -1 = post→raw
) -> dict[str, Any]:
    """Full RE analysis for a component.

    Args:
        comp_type: e.g. 'Armor', 'Weapon'
        level: RE level 1-10
        raw_stats: list of up to 9 stat values (empty string for blanks)
        matching_target: 'Average Rarity', 'Best Stat', 'Worst Stat', or a stat name
        direction: 1 for raw input, -1 for post-RE input

    Returns:
        Dict with rarities, matches, post-RE values, log deltas, unicorns, etc.
    """
    re_level = comp_type[0] + str(level % 10)
    re_mult = RE_MULTS[level - 1]

    # Get component stat metadata
    info = get_comp_info(comp_type)
    disp_names = list(info["display_names"])
    tails_raw = list(info["re_tails"])

    # Add A/HP if not armor
    if "A/HP:" not in disp_names:
        disp_names.insert(0, "A/HP:")
        tails_raw.insert(0, "1")
    else:
        disp_names.append("")
        tails_raw.append("1")

    comp_stats = [s for s in disp_names if s]
    tails = [_tf(t) for t in tails_raw if t != ""]

    # Pad input stats
    while len(raw_stats) < len(comp_stats):
        raw_stats.append("")

    # Pull brand data
    means, mods, stdevs, weights = pull_stats_data(re_level)
    get_brand_names(re_level)

    # Compute weighted stat means
    stat_means = []
    for i in range(len(comp_stats)):
        if i < len(means):
            sm = sum(means[i][j] * weights[j] for j in range(len(weights)))
            stat_means.append(sm)
        else:
            stat_means.append(0)

    # Compute post-RE or reverse outputs
    outputs = []
    for i in range(len(comp_stats)):
        input_val = _tf(raw_stats[i]) if raw_stats[i] != "" else 0
        if input_val == 0 or raw_stats[i] == "" or i >= len(tails):
            outputs.append("")
            continue

        tail = tails[i]
        multiplier = float(tail) * re_mult + 1

        stat_name = comp_stats[i]
        d = direction

        if stat_name in ["Vs. Shields:", "Vs. Armor:"]:
            if d != 1:
                iv = round(input_val, 2) - 0.005
                outputs.append(
                    f"{min(round(iv / multiplier, 3) + 0.001, round(iv / multiplier + 0.005, 2) - 0.004):.3f}"
                )
            else:
                outputs.append(
                    f"{max(round(round(input_val, 2) * multiplier, 2), round(input_val * multiplier, 2)):.3f}"
                )
        elif stat_name == "Refire Rate:":
            if d != 1:
                iv = round(input_val, 2) + 0.00499999
                outputs.append(
                    f"{max(round(iv / multiplier, 3) - 0.001, round(iv / multiplier - 0.00499999, 2) + 0.004):.3f}"
                )
            else:
                outputs.append(
                    f"{min(round(round(input_val, 2) * multiplier, 2), round(input_val * multiplier, 2)):.3f}"
                )
        elif stat_name == "Recharge:" and comp_type == "Shield":
            if d != 1:
                outputs.append(f"{round(input_val / multiplier, 2):.2f}")
            else:
                outputs.append(f"{round(input_val * multiplier, 2):.2f}")
        else:
            if d != 1:
                outputs.append(f"{round(input_val / multiplier, 1):.1f}")
            else:
                outputs.append(f"{round(input_val * multiplier, 1):.1f}")

    # Determine effective raw stats for rarity calculation
    effective_stats = []
    rewards = []
    cutoffs_high = []
    cutoffs_low = []

    for i in range(len(comp_stats)):
        val = raw_stats[i]
        if direction != 1 and i < len(outputs) and outputs[i]:
            val = outputs[i]  # Use the converted raw value for rarity

        reward, low_high = is_reward(val, comp_type, level, comp_stats[i])
        rewards.append(reward)
        cutoffs_high.append(low_high[1] if len(low_high) >= 2 else 0)
        cutoffs_low.append(low_high[0] if len(low_high) >= 2 else 0)

        if val != "" and val is not None:
            fval = _tf(val)
            if reward:
                effective_stats.append(cutoffs_high[-1])
            else:
                effective_stats.append(worst_case_vs_refire(fval, comp_stats[i], re_mult))
        else:
            effective_stats.append("")

    # Calculate per-stat rarities
    rarity_list = []
    rarity_1inx = []

    for i in range(len(comp_stats)):
        if i >= len(means) or effective_stats[i] == "":
            rarity_list.append("")
            rarity_1inx.append("")
            continue

        zero_check = get_rarity(0, means[i], stdevs[i], weights) if tails[i] < 0 else 0
        rarity = _tf(get_rarity(effective_stats[i], means[i], stdevs[i], weights)) - _tf(zero_check)
        if rarity < 0:
            rarity = 0

        if rarity in [0, 1] or rarity == "":
            rarity_list.append("")
            rarity_1inx.append("Improbable")
        elif tails[i] > 0:
            rarity_list.append(1 - rarity)
            rarity_1inx.append(format_rarity(int(1 / (1 - rarity))) if (1 - rarity) > 0 else "Improbable")
        else:
            rarity_list.append(rarity)
            rarity_1inx.append(format_rarity(int(1 / rarity)) if rarity > 0 else "Improbable")

    # Desktop app also computes reward cutoff rarities for average matching and log deltas.
    cutoff_rarities_high = []
    cutoff_rarities_low = []
    for i in range(len(cutoffs_high)):
        cutoff_rarity_high = get_rarity(cutoffs_high[i], means[i], stdevs[i], weights)
        cutoff_rarity_low = get_rarity(cutoffs_low[i], means[i], stdevs[i], weights)
        if tails[i] > 0:
            cutoff_rarities_high.append(1 - _tf(cutoff_rarity_high))
            cutoff_rarities_low.append(1 - _tf(cutoff_rarity_low))
        else:
            cutoff_rarities_high.append(_tf(cutoff_rarity_high))
            cutoff_rarities_low.append(_tf(cutoff_rarity_low))

    # Detect unicorns
    unicorns, unicorn_threshold = detect_unicorns(rarity_list, comp_type, level, raw_stats, effective_stats)

    # Mark rewards and unicorns in display
    for i in range(len(rarity_1inx)):
        if rewards[i]:
            rarity_1inx[i] = "Reward"
        elif i < len(comp_stats) and comp_stats[i].rstrip(":") in unicorns and unicorns[i]:
            rarity_1inx[i] = f"⋆{rarity_1inx[i]}⋆"

    # ── Matching ────────────────────────────────────────────

    # Determine target rarity / matching mode using the original desktop flow.
    target = matching_target
    clean_stats = [s.rstrip(":") for s in comp_stats]
    display_targets = list(info.get("clean_display", []))
    if "A/HP" not in clean_stats:
        display_targets.insert(0, "Armor/Hitpoints")

    if target == "Shield Recharge Rate":
        target = "Recharge"
    elif target in display_targets:
        target = clean_stats[display_targets.index(target)]
    elif "Shield Hitpoints" in str(target):
        target = str(target).replace("Shield Hitpoints", "HP")

    # All inputs reward or targeting a reward stat returns empty matching output.
    blank_stats = sum(1 for r in rarity_list if r == "")
    reward_stats = sum(1 for r in rewards if r)
    if blank_stats + reward_stats == len(comp_stats):
        return _build_result(
            comp_stats, tails, raw_stats, outputs, rarity_list, rarity_1inx, unicorns, unicorn_threshold, [], [], 0
        )
    if target not in ["Average Rarity", "Best Stat", "Worst Stat"]:
        if target in clean_stats and rewards[clean_stats.index(target)]:
            return _build_result(
                comp_stats, tails, raw_stats, outputs, rarity_list, rarity_1inx, unicorns, unicorn_threshold, [], [], 0
            )

    next_best_stats = []
    next_bests = []
    for i, stat_name in enumerate(clean_stats):
        if stat_name in ["Vs. Shields", "Vs. Armor", "Refire Rate"]:
            next_best_rarity = get_next_best_vs_refire(raw_stats[i], stat_name, means[i], stdevs[i], weights, re_mult)
            next_best_stats.append(stat_name)
            next_bests.append(next_best_rarity)

    rarity = 0

    if target in clean_stats:
        idx = clean_stats.index(target)
        rarity = rarity_list[idx]
        if rarity == "":
            target = "Average Rarity"

    if target == "Best Stat":
        rarity_temp = [x for idx, x in enumerate(rarity_list) if not rewards[idx] and x != ""]
        if rarity_temp == []:
            target = "Average Rarity"
        else:
            rarity = min(rarity_temp)

    if target == "Worst Stat":
        rarity_temp = [x for idx, x in enumerate(rarity_list) if not rewards[idx] and x != ""]
        if rarity_temp == []:
            target = "Average Rarity"
        else:
            rarity = max(rarity_temp)

    if target == "Average Rarity":
        exclude0 = []
        remaining_stats = []
        reward_cutoff = []

        # 0. Remove blank stats
        for i in range(len(rarity_list)):
            if rarity_list[i] != "":
                exclude0.append(rarity_list[i])
                remaining_stats.append(clean_stats[i])
                reward_cutoff.append(cutoff_rarities_high[i])

        # 1. Remove A/HP if not armor, unless it's the only stat
        if comp_type != "Armor":
            if "A/HP" in remaining_stats and len(remaining_stats) > 1:
                exclude1 = exclude0[1:]
                remaining_stats = remaining_stats[1:]
                reward_cutoff = reward_cutoff[1:]
                rewards_check = rewards[1:]
            else:
                exclude1 = exclude0
                rewards_check = rewards
        else:
            exclude1 = exclude0
            rewards_check = rewards

        # 2. Remove suspected rewards
        exclude2 = []
        for i in range(len(exclude1)):
            if not rewards_check[i]:
                exclude2.append(exclude1[i])

        average1 = log_mean(exclude2)

        # 4. If average is below reward cutoff rarity, exclude rewards using cutoffs
        exclude3 = []
        stats_temp = remaining_stats
        remaining_stats = []
        for i in range(len(reward_cutoff)):
            orig_idx = clean_stats.index(stats_temp[i]) if stats_temp[i] in clean_stats else i
            if rewards[orig_idx]:
                if average1 < reward_cutoff[i]:
                    exclude3.append(reward_cutoff[i])
                    remaining_stats.append(stats_temp[i])
            else:
                exclude3.append(exclude1[i])
                remaining_stats.append(stats_temp[i])

        # Exclude vs/refire for second average if they are not the only stats involved
        exclude4 = []
        for i in range(len(remaining_stats)):
            if remaining_stats[i] not in ["Vs. Shields", "Vs. Armor", "Refire Rate"]:
                exclude4.append(exclude3[i])
        if stats_temp == []:
            exclude4 = exclude3

        stats_temp = remaining_stats
        remaining_stats = []
        average2 = log_mean(exclude4)

        if comp_type == "Weapon":
            exclude5 = []
            for i in range(len(stats_temp)):
                idx = clean_stats.index(stats_temp[i])
                if stats_temp[i] in ["Vs. Shields", "Vs. Armor", "Refire Rate"]:
                    input_stat = raw_stats[idx]
                    next_best_rarity = get_next_best_vs_refire(input_stat, stats_temp[i], means[idx], stdevs[idx], weights, re_mult)
                    if average2 <= next_best_rarity:
                        exclude5.append(next_best_rarity)
                    elif average2 >= exclude3[i]:
                        exclude5.append(exclude3[i])
                    remaining_stats.append(stats_temp[i])
                else:
                    exclude5.append(exclude3[i])
                    remaining_stats.append(stats_temp[i])
        else:
            exclude5 = exclude3
            remaining_stats = stats_temp

        average3 = log_mean(exclude5)
        rarity = average3

    if rarity == 0:
        return _build_result(
            comp_stats, tails, raw_stats, outputs, rarity_list, rarity_1inx, unicorns, unicorn_threshold, [], [], 0
        )

    # Account for weird rounding behavior on vs/refire matching
    if target in ["Vs. Shields", "Vs. Armor", "Refire Rate"]:
        rarity = round(rarity - 0.0000000000005, 12)

    matches = []
    matches_raw = []
    post_re = []

    for i in range(len(clean_stats)):
        if i >= len(means):
            matches.append("")
            matches_raw.append(0)
            post_re.append("")
            continue

        target_rarity = rarity if tails[i] < 0 else 1 - rarity
        value = match_stat(means[i], stdevs[i], weights, stat_means[i], target_rarity)

        stat_name = clean_stats[i]
        if stat_name in ["Vs. Shields", "Vs. Armor", "Refire Rate"]:
            multiplier = 1 + re_mult * _tf(tails[i])
            post_not_rounded = float(round(value * multiplier, 2))
            post_pre_rounded = float(round(round(value, 2) * multiplier, 2))
            if stat_name == "Refire Rate":
                sign = "<"
                optimal = min(post_pre_rounded, post_not_rounded)
                optimal_worst_case = optimal + 0.005
                opt_wc_raw = optimal_worst_case / multiplier
                if round(opt_wc_raw, 2) > opt_wc_raw:
                    worst_case_raw = round(opt_wc_raw, 3) - 0.001
                else:
                    worst_case_raw = round(opt_wc_raw, 2) + 0.004
            else:
                sign = ">"
                optimal = max(post_pre_rounded, post_not_rounded)
                optimal_worst_case = optimal - 0.00499999
                opt_wc_raw = optimal_worst_case / multiplier
                if round(opt_wc_raw, 2) < opt_wc_raw:
                    worst_case_raw = round(opt_wc_raw, 3) + 0.001
                else:
                    worst_case_raw = round(opt_wc_raw, 2) - 0.004
            matches.append(f"{sign}{worst_case_raw:.3f}")
            matches_raw.append(worst_case_raw)
            post_re.append(f"{optimal:.3f}")
        elif stat_name == "Recharge" and comp_type == "Shield":
            matches.append(f"{float(round(value,2)):.2f}")
            matches_raw.append(value)
            post_re.append(f"{float(round((1 + re_mult * _tf(tails[i])) * value,2)):.2f}")
        else:
            matches.append(f"{float(round(value,1)):.1f}")
            matches_raw.append(value)
            post_re.append(f"{float(round((1 + re_mult * _tf(tails[i])) * value,1)):.1f}")

    # Native rarity floor / clamp logic from desktop tool.
    stat_scaling = len(clean_stats) / 9
    average_clamp = unicorn_threshold / pow(10, 1 / (3 * stat_scaling))
    stat_clamp = unicorn_threshold / pow(10, 1 / (2 * stat_scaling))

    if rarity < average_clamp and target == "Average Rarity":
        match_rarity = average_clamp
    elif rarity < stat_clamp and target != "Average Rarity":
        match_rarity = stat_clamp
    else:
        match_rarity = rarity

    log_deltas = []
    matching_deltas = []

    for i in range(len(rarity_list)):
        if rarity_list[i] not in [0, ""] and rarity_1inx[i] != "Reward":
            if clean_stats[i] in next_best_stats:
                range_low = rarity_list[i]
                range_high = next_bests[next_best_stats.index(clean_stats[i])]
                if range_low > rarity and range_high < rarity:
                    log_deltas.append(0)
                elif range_low < rarity:
                    log_deltas.append(round(math.log10(rarity) - math.log10(range_low), 2))
                elif range_high > rarity:
                    log_deltas.append(round(math.log10(rarity) - math.log10(range_high), 2))
                else:
                    log_deltas.append(0)
            else:
                log_deltas.append(round(math.log10(rarity) - math.log10(rarity_list[i]), 2))
        elif rarity_1inx[i] == "Reward":
            if rarity < cutoff_rarities_high[i]:
                log_deltas.append(round(math.log10(rarity) - math.log10(cutoff_rarities_high[i]), 2))
            else:
                log_deltas.append(0)
        else:
            log_deltas.append("")

        if rarity_list[i] not in [0, ""] and rarity_1inx[i] != "Reward":
            if clean_stats[i] in next_best_stats:
                range_low = rarity_list[i]
                range_high = next_bests[next_best_stats.index(clean_stats[i])]
                if range_low < stat_clamp:
                    range_low = stat_clamp
                if range_high < stat_clamp:
                    range_high = stat_clamp
                if range_low > match_rarity and range_high < match_rarity:
                    matching_deltas.append(0)
                elif range_low < match_rarity:
                    matching_deltas.append(round(math.log10(match_rarity) - math.log10(range_low), 2))
                elif range_high > match_rarity:
                    matching_deltas.append(round(math.log10(match_rarity) - math.log10(range_high), 2))
                else:
                    matching_deltas.append(0)
            else:
                if rarity_list[i] < stat_clamp:
                    matching_deltas.append(round(math.log10(match_rarity) - math.log10(stat_clamp), 2))
                else:
                    matching_deltas.append(round(math.log10(match_rarity) - math.log10(rarity_list[i]), 2))
        elif rarity_1inx[i] == "Reward":
            if rarity < cutoff_rarities_high[i]:
                matching_deltas.append(round(math.log10(match_rarity) - math.log10(cutoff_rarities_high[i]), 2))
            else:
                matching_deltas.append(0)
        else:
            matching_deltas.append("")

    return _build_result(
        comp_stats,
        tails,
        raw_stats,
        outputs,
        rarity_list,
        rarity_1inx,
        unicorns,
        unicorn_threshold,
        matches,
        post_re,
        rarity,
        log_deltas,
        matches_raw,
    )


def _build_result(
    comp_stats,
    tails,
    raw_stats,
    outputs,
    rarity_list,
    rarity_1inx,
    unicorns,
    unicorn_threshold,
    matches,
    post_re,
    target_rarity,
    log_deltas=None,
    matches_raw=None,
) -> dict:
    stats = []
    for i in range(len(comp_stats)):
        stat = {
            "name": comp_stats[i].rstrip(":"),
            "display_name": comp_stats[i],
            "tail": tails[i] if i < len(tails) else 1,
            "input": raw_stats[i] if i < len(raw_stats) else "",
            "output": outputs[i] if i < len(outputs) else "",
            "rarity": rarity_list[i] if i < len(rarity_list) else "",
            "rarity_display": rarity_1inx[i] if i < len(rarity_1inx) else "",
            "is_unicorn": bool(unicorns[i]) if i < len(unicorns) else False,
            "match_value": matches[i] if i < len(matches) else "",
            "match_post": post_re[i] if i < len(post_re) else "",
            "log_delta": log_deltas[i] if log_deltas and i < len(log_deltas) else "",
        }
        stats.append(stat)

    # Format target rarity
    if target_rarity and target_rarity > 0:
        try:
            target_display = format_rarity(int(1 / _tf(target_rarity)))
        except (ZeroDivisionError, ValueError):
            target_display = ""
    else:
        target_display = ""

    return {
        "stats": stats,
        "target_rarity": target_rarity,
        "target_rarity_display": target_display,
        "unicorn_threshold": format_rarity(int(1 / _tf(unicorn_threshold))) if unicorn_threshold > 0 else "",
    }


# ── Brand rarity table ──────────────────────────────────────


def brand_rarity_table(comp_type: str, level: int, raw_stats: list, rarity_list: list | None = None) -> dict:
    """Generate per-brand rarity breakdown for each stat."""
    re_level = comp_type[0] + str(level % 10)
    RE_MULTS[level - 1]

    info = get_comp_info(comp_type)
    disp_names = list(info["display_names"])
    tails_raw = list(info["re_tails"])

    if "A/HP:" not in disp_names:
        disp_names.insert(0, "A/HP:")
        tails_raw.insert(0, "1")

    comp_stats = [s.rstrip(":") for s in disp_names if s]
    tails = [_tf(t) for t in tails_raw if t != ""]

    means, _mods, stdevs, weights = pull_stats_data(re_level)
    brand_names = get_brand_names(re_level)

    # Build per-stat, per-brand rarity grid
    table = []
    for i in range(len(comp_stats)):
        if i >= len(means):
            break
        val = _tf(raw_stats[i]) if i < len(raw_stats) and raw_stats[i] != "" else 0
        if val == 0:
            table.append({"stat": comp_stats[i], "brands": [{"name": n, "rarity": "-"} for n in brand_names]})
            continue

        stat_name = comp_stats[i]
        reward, lohi = is_reward(val, comp_type, level, stat_name + ":")
        brands = []
        for j in range(len(brand_names)):
            mean = means[i][j]
            stdev = stdevs[i][j]
            if stdev == 0:
                brands.append({"name": brand_names[j], "rarity": "-"})
                continue

            x = val
            if lohi and reward and x >= min(lohi) and x <= max(lohi):
                compare = round(mean, 3 if stat_name in ["Vs. Shields", "Vs. Armor", "Refire Rate"] else 1)
                if compare >= min(lohi) and compare <= max(lohi):
                    x = mean - 6 * stdev if tails[i] > 0 else mean + 6 * stdev

            z = (x - mean) / stdev
            raw_rarity = normal_cdf(z)

            if tails[i] > 0:
                if raw_rarity >= 1:
                    brands.append({"name": brand_names[j], "rarity": "-"})
                else:
                    brands.append({"name": brand_names[j], "rarity": format_rarity(int(1 / (1 - raw_rarity)))})
            else:
                zero_r = normal_cdf(-mean / stdev)
                if raw_rarity <= zero_r:
                    brands.append({"name": brand_names[j], "rarity": "-"})
                else:
                    brands.append({"name": brand_names[j], "rarity": format_rarity(int(1 / (raw_rarity - zero_r)))})

        table.append({"stat": comp_stats[i], "brands": brands})

    return {"brand_names": brand_names, "table": table}