"""Utilities for parsing SWG space buildout tab files.

This module adapts the legacy desktop parser into structured data that fits the
site's existing API patterns. It supports bundled buildout files as well as
uploaded `.tab` files parsed on demand.
"""

from __future__ import annotations

import csv
import itertools
import math
from functools import lru_cache
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).resolve().parent / "data" / "buildouts"
SQUADS_PATH = DATA_DIR / "squads.tab"
ZONE_LIMIT = 8160
MAX_BRUTE_FORCE_POINTS = 8

Coordinate = list[float]
BuildoutRow = list[str]


def _read_tab_file(path: str | Path) -> list[BuildoutRow]:
    """Read a tab-delimited buildout file and skip the schema rows."""
    with Path(path).open("r", encoding="utf-8", errors="ignore", newline="") as handle:
        rows = list(csv.reader(handle, delimiter="\t"))
    return rows[2:] if len(rows) > 2 else []


@lru_cache(maxsize=1)
def load_squads() -> dict[str, list[str]]:
    """Load squad definitions used to expand grouped ship spawns."""
    squads: dict[str, list[str]] = {}
    for row in _read_tab_file(SQUADS_PATH):
        if not row:
            continue

        name = row[0]
        ships = [value for value in row[3:13] if value and str(value).lower() != "nan"]
        squads[name] = ships
    return squads


def _to_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _extract_coordinates(row: BuildoutRow) -> Coordinate:
    return [_to_float(row[7]), _to_float(row[8]), _to_float(row[9])]


def _objvar_map(objvars: str) -> dict[str, list[str]]:
    """Parse the SWG objvars pipe-delimited payload into a keyed mapping."""
    parts = (objvars or "").split("|")
    data: dict[str, list[str]] = {}
    index = 0

    while index + 2 < len(parts):
        key = parts[index]
        type_marker = parts[index + 1]
        value = parts[index + 2]

        if not key:
            index += 1
            continue

        data.setdefault(key, []).append(value)
        index += 3

    return data


def _normalize_zone_name(filename: str | Path) -> str:
    zone = Path(filename).stem
    return "space_kessel" if zone == "space_light1" else zone


def _waypoint(zone: str, coords: Coordinate, name: str, label: str, color: str) -> str:
    return f"/way {zone} {coords[0]:.2f} {coords[1]:.2f} {coords[2]:.2f} {name} ({label}) {color};"


def _distance(a: Coordinate, b: Coordinate) -> float:
    return math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)


def _extract_point_list(items: list[BuildoutRow]) -> list[Coordinate]:
    return [_extract_coordinates(row) for row in items]


def _build_patrol_lookup(patrol_points: list[BuildoutRow]) -> dict[str, Coordinate]:
    return {row[10]: _extract_coordinates(row) for row in patrol_points if len(row) > 10}


def _expand_ship_groups(ship_groups: list[str], squads: dict[str, list[str]]) -> list[str]:
    expanded_ships: list[str] = []
    for ship_group in ship_groups:
        if ship_group in squads:
            expanded_ships.extend(squads[ship_group])
        else:
            expanded_ships.append(ship_group)
    return expanded_ships


def _resolve_patrol_points(
    patrol_ids: list[str],
    patrol_lookup: dict[str, Coordinate],
    objvars: str,
) -> tuple[str, list[Coordinate]]:
    patrol_points = [
        coords for point_id, coords in patrol_lookup.items() if any(patrol_id in point_id for patrol_id in patrol_ids)
    ]

    if not patrol_points:
        return "Static", []

    spawner_type = "Patrol (No Recycle)" if "patrolNoRecycle" in objvars else "Patrol"
    if spawner_type == "Patrol":
        patrol_points = patrol_points + [patrol_points[0]]

    return spawner_type, patrol_points


def _best_static_path(zone: str, spawns: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Return an ordered static-spawn route and waypoint macro string."""
    static_spawns = [spawn for spawn in spawns if spawn["spawner_type"] != "Patrol"]
    if len(static_spawns) < 2:
        return None

    if len(static_spawns) > MAX_BRUTE_FORCE_POINTS:
        ordered_spawns = sorted(
            static_spawns,
            key=lambda spawn: (
                spawn["coordinates"][0],
                spawn["coordinates"][1],
                spawn["coordinates"][2],
            ),
        )
    else:
        best_route: tuple[dict[str, Any], ...] | None = None
        best_distance: float | None = None

        for route in itertools.permutations(static_spawns):
            route_distance = sum(
                _distance(route[index]["coordinates"], route[index + 1]["coordinates"])
                for index in range(len(route) - 1)
            )
            if best_distance is None or route_distance < best_distance:
                best_distance = route_distance
                best_route = route

        ordered_spawns = list(best_route or static_spawns)

    total_distance = sum(
        _distance(ordered_spawns[index]["coordinates"], ordered_spawns[index + 1]["coordinates"])
        for index in range(len(ordered_spawns) - 1)
    )
    waypoint_string = "".join(
        _waypoint(zone, spawn["coordinates"], f"Point {index}", f"{spawn['circle_shell'][1]:.0f}m", "green")
        for index, spawn in enumerate(ordered_spawns)
    )

    return {
        "ordered_spawn_ids": [spawn["id"] for spawn in ordered_spawns],
        "waypoints": waypoint_string,
        "total_distance": round(total_distance, 2),
    }


def _parse_spawns(
    rows: list[BuildoutRow], squads: dict[str, list[str]]
) -> tuple[list[dict[str, Any]], list[Coordinate]]:
    spawner_rows = [row for row in rows if row and "spawner" in row[0]]
    patrol_rows = [row for row in rows if row and "patrol_point" in row[0]]
    patrol_lookup = _build_patrol_lookup(patrol_rows)

    parsed_spawns: list[dict[str, Any]] = []
    asteroids: list[Coordinate] = []

    for index, row in enumerate(spawner_rows):
        objvars = row[10] if len(row) > 10 else ""
        data = _objvar_map(objvars)
        coords = _extract_coordinates(row)

        name = data.get("strSpawnerName", [""])[0] or f"Spawner {index + 1}"
        behavior = data.get("strDefaultBehavior", [""])[0]
        spawn_shell = [
            _to_float(data.get("fltMinSpawnDistance", ["0"])[0]),
            _to_float(data.get("fltMaxSpawnDistance", ["0"])[0]),
        ]
        circle_shell = [
            _to_float(data.get("fltMinCircleDistance", ["0"])[0]),
            _to_float(data.get("fltMaxCircleDistance", ["0"])[0]),
        ]
        spawn_count = int(_to_float(data.get("intSpawnCount", ["0"])[0]))

        min_spawn_time = _to_float(data.get("fltMinSpawnTime", ["0"])[0])
        max_spawn_time = _to_float(data.get("fltMaxSpawnTime", ["0"])[0])
        respawn = f"{int(min_spawn_time)}s to {int(max_spawn_time)}s" if min_spawn_time or max_spawn_time else "N/A"

        patrol_ids = [
            value for value in (data.get("strPatrolPoints_mangled.segment.0", [""])[0] or "").split(":") if value
        ]
        spawner_type, patrol_points = _resolve_patrol_points(patrol_ids, patrol_lookup, objvars)

        ship_groups = [value for value in (data.get("strSpawns_mangled.segment.0", [""])[0] or "").split(":") if value]
        if not ship_groups and data.get("strAsteroidType"):
            ship_groups = [f"{data['strAsteroidType'][0]} asteroid"]

        if any("asteroid" in ship_group.lower() for ship_group in ship_groups):
            asteroids.append(coords)
            continue

        parsed_spawns.append(
            {
                "id": index,
                "name": name,
                "spawner_type": spawner_type,
                "spawn_count": spawn_count,
                "respawn": respawn,
                "coordinates": coords,
                "ships": _expand_ship_groups(ship_groups, squads),
                "ship_groups": ship_groups,
                "patrol_points": patrol_points,
                "behavior": behavior,
                "spawn_shell": spawn_shell,
                "circle_shell": circle_shell,
                "waypoint": None,
            }
        )

    return parsed_spawns, asteroids


def parse_buildout(path: str | Path) -> dict[str, Any]:
    """Parse a buildout file into the structure used by the frontend explorer."""
    rows = _read_tab_file(path)
    squads = load_squads()

    static_ship_rows = [row for row in rows if row and "/ship/" in row[0] and "spacestation" not in row[0]]
    minor_station_rows = [row for row in rows if row and "spacestation" in row[0] and "/ship/" not in row[0]]
    major_station_rows = [row for row in rows if row and "spacestation" in row[0] and "/ship/" in row[0]]
    beacon_rows = [row for row in rows if row and "/beacon/" in row[0]]

    spawns, asteroids = _parse_spawns(rows, squads)
    spawns.sort(key=lambda spawn: spawn["name"].lower())

    zone = _normalize_zone_name(path)
    for spawn in spawns:
        color = "green" if spawn["spawner_type"] == "Patrol" else "orange"
        spawn["waypoint"] = _waypoint(zone, spawn["coordinates"], spawn["name"], spawn["spawner_type"].lower(), color)

    return {
        "zone": zone,
        "bounds": {"min": -ZONE_LIMIT, "max": ZONE_LIMIT},
        "spawns": spawns,
        "statics": _extract_point_list(static_ship_rows),
        "minor_stations": _extract_point_list(minor_station_rows),
        "major_stations": _extract_point_list(major_station_rows),
        "beacons": _extract_point_list(beacon_rows),
        "asteroids": asteroids,
        "waypoints_all": "".join(spawn["waypoint"] for spawn in spawns),
        "best_static_path": _best_static_path(zone, spawns),
    }


def list_bundled_buildouts() -> list[dict[str, str]]:
    """List bundled buildout files available from the repo."""
    files = []
    for path in sorted(DATA_DIR.glob("*.tab")):
        if path.name == "squads.tab":
            continue
        files.append({"id": path.stem, "label": _normalize_zone_name(path.name), "filename": path.name})
    return files


def parse_bundled_buildout(zone_id: str) -> dict[str, Any]:
    """Parse one of the repo-bundled buildout tabs by zone id."""
    path = DATA_DIR / f"{zone_id}.tab"
    if not path.exists():
        raise FileNotFoundError(zone_id)
    return parse_buildout(path)
