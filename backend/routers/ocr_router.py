"""OCR-based component parsing from SWG screenshots.

Handles the actual SWG examine window format:
  - "Damage - Minimum": 1756.4
  - "Reactor Energy Drain": 1596.3 (B Tier)
  - "Armor": 592.4/592.4
  - "Vs. Shields": 0.624
  - "Energy/Shot": 36.5
"""

import io
import logging
import re
import subprocess
import tempfile
from pathlib import Path

import pillow_heif
from fastapi import APIRouter, File, HTTPException, UploadFile
from PIL import Image

pillow_heif.register_heif_opener()

router = APIRouter(prefix="/api/ocr", tags=["ocr"])
logger = logging.getLogger(__name__)

# ─── SWG stat label → internal stat name ─────────────────────────────
# Keys are lowercase. SWG uses many different label formats.
STAT_ALIASES: dict[str, str] = {
    # Drain — SWG shows "Reactor Energy Drain"
    "reactor energy drain": "drain",
    "energy drain": "drain",
    "energy maintenance": "drain",
    "drain": "drain",
    # Mass
    "mass": "mass",
    # Generation (reactor)
    "energy generation rate": "generation",
    "generation rate": "generation",
    "generation": "generation",
    # Pitch / Yaw / Roll (engine)
    "pitch rate": "pitch",
    "pitch": "pitch",
    "yaw rate": "yaw",
    "yaw": "yaw",
    "roll rate": "roll",
    "roll": "roll",
    # Top Speed (engine / booster)
    "top speed": "top speed",
    "speed": "top speed",
    "maximum speed": "top speed",
    # Booster
    "booster energy": "energy",
    "booster recharge rate": "recharge rate",
    "booster consumption rate": "consumption",
    "booster acceleration": "acceleration",
    "booster top speed": "booster top speed",
    "acceleration": "acceleration",
    "consumption rate": "consumption",
    "consumption": "consumption",
    # Shield
    "shield hit points": "hp",
    "front shield hit points": "hp",
    "shield recharge rate": "recharge rate",
    "hit points": "hp",
    "hitpoints": "hp",
    "hp": "hp",
    # Armor
    "armor hit points": "hp",
    # Capacitor
    "capacitor energy": "cap energy",
    "capacitor recharge rate": "cap recharge",
    "energy": "energy",
    "recharge rate": "recharge rate",
    "recharge": "recharge rate",
    # Droid Interface
    "droid command speed": "cmd speed",
    "command speed": "cmd speed",
    "cmd speed": "cmd speed",
    # Weapon — SWG shows "Damage - Minimum" and "Damage - Maximum"
    "damage - minimum": "min damage",
    "damage-minimum": "min damage",
    "minimum damage": "min damage",
    "min damage": "min damage",
    "damage - maximum": "max damage",
    "damage-maximum": "max damage",
    "maximum damage": "max damage",
    "max damage": "max damage",
    "vs. shields": "vs shields",
    "vs shields": "vs shields",
    "vs. armor": "vs armor",
    "vs armor": "vs armor",
    "energy per shot": "energy/shot",
    "energy/shot": "energy/shot",
    "refire rate": "refire rate",
    "refire": "refire rate",
    # Ordnance
    "ammo": "ammo",
    "ammunition": "ammo",
    "pve multiplier": "pve multiplier",
    "pve damage multiplier": "pve multiplier",
}

COMP_STAT_ORDER: dict[str, list[str]] = {
    "reactor": ["mass", "generation"],
    "engine": ["drain", "mass", "pitch", "yaw", "roll", "top speed"],
    "booster": ["drain", "mass", "energy", "recharge rate", "consumption", "acceleration", "top speed"],
    "shield": ["drain", "mass", "hp", "recharge rate"],
    "armor": ["hp", "mass"],
    "capacitor": ["drain", "mass", "cap energy", "cap recharge"],
    "droidinterface": ["drain", "mass", "cmd speed"],
    "cargohold": ["mass"],
    "weapon": ["drain", "mass", "min damage", "max damage", "vs shields", "vs armor", "energy/shot", "refire rate"],
    "ordnancelauncher": [
        "drain",
        "mass",
        "min damage",
        "max damage",
        "vs shields",
        "vs armor",
        "ammo",
        "pve multiplier",
    ],
    "countermeasurelauncher": ["drain", "mass", "ammo"],
}

# Type detection based on which stats are present (more reliable than keyword matching)
TYPE_STAT_SIGNATURES: dict[str, set[str]] = {
    "weapon": {"min damage", "max damage", "energy/shot", "refire rate"},
    "ordnancelauncher": {"min damage", "max damage", "ammo"},
    "engine": {"pitch", "yaw", "roll"},
    "booster": {"acceleration", "consumption"},
    "shield": {"hp", "recharge rate", "drain"},
    "capacitor": {"cap energy", "cap recharge"},
    "reactor": {"generation"},
    "armor": {"hp"},
    "droidinterface": {"cmd speed"},
    "countermeasurelauncher": {"ammo"},
    "cargohold": {"mass"},
}


def _convert_to_png(contents: bytes) -> bytes:
    """Convert any image format to a reasonably sized PNG."""
    try:
        img = Image.open(io.BytesIO(contents))
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        max_width = 1500
        if img.width > max_width:
            ratio = max_width / img.width
            img = img.resize((max_width, int(img.height * ratio)), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()
    except Exception as exc:
        raise RuntimeError(f"Could not process image: {exc}") from exc


def _run_tesseract(image_path: str) -> str:
    """Run Tesseract OCR on an image file and return extracted text."""
    try:
        result = subprocess.run(
            ["tesseract", image_path, "stdout", "--psm", "3", "-l", "eng"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode != 0:
            stderr = result.stderr.strip()
            logger.warning("tesseract_failed", extra={"stderr": stderr[:500], "returncode": result.returncode})
            msg = f"Tesseract failed: {stderr[:200]}" if stderr else "Tesseract failed: Error during processing"
            raise RuntimeError(msg)
        return result.stdout
    except FileNotFoundError:
        raise RuntimeError("Tesseract is not installed on the server") from None
    except subprocess.TimeoutExpired:
        raise RuntimeError("OCR timed out") from None


def _clean_value(raw: str) -> float | None:
    """Extract a numeric value from SWG stat text.

    Handles formats like:
      "1596.3 (B Tier)"  → 1596.3
      "592.4/592.4"      → 592.4  (takes first number)
      ">0.676"           → 0.676
      "33,433.2"         → 33433.2
    """
    raw = raw.strip()
    # Strip tier info: "1596.3 (B Tier)" → "1596.3"
    raw = re.sub(r"\s*\([^)]*\)\s*$", "", raw)
    # Take first value from "592.4/592.4" format
    if "/" in raw:
        raw = raw.split("/")[0]
    # Strip comparison operators
    raw = raw.lstrip("><")
    # Remove commas
    raw = raw.replace(",", "")
    # Remove any trailing non-numeric chars (OCR artifacts like *)
    raw = re.sub(r"[^0-9.\-]", "", raw)
    try:
        return float(raw)
    except ValueError:
        return None


def _normalize_label(label: str) -> str:
    """Clean up an OCR'd stat label for matching."""
    label = label.strip().lower()
    # Remove OCR artifacts: ~, ^, *, trailing colons
    label = re.sub(r"[~^*°]+", "", label)
    label = label.rstrip(":")
    label = label.strip()
    return label


def _match_stat(label: str) -> str | None:
    """Match a normalized label to an internal stat name."""
    # Exact match first
    if label in STAT_ALIASES:
        return STAT_ALIASES[label]
    # Substring match — check if any alias is contained in the label or vice versa
    for alias, internal in STAT_ALIASES.items():
        if alias in label or label in alias:
            return internal
    return None


def _extract_name(lines: list[str]) -> str:
    """Extract the component name from OCR text.

    In SWG the name is typically the first bold line, like "Certified"
    before "Level 8 Ship Equipment Certification".
    """
    for line in lines[:8]:
        stripped = line.strip()
        if not stripped or len(stripped) < 3:
            continue
        # Skip lines that look like stats (contain : followed by numbers)
        if re.search(r":\s*[\d<>.]", stripped):
            continue
        # Skip known SWG boilerplate
        lower = stripped.lower()
        if any(
            kw in lower
            for kw in [
                "ship component",
                "guaranteed",
                "item attributes",
                "reverse engineering",
                "volume:",
                "projectile style",
                "component style",
                "level 8",
                "level 7",
                "level 6",
                "level 5",
                "level 4",
                "level 3",
                "level 2",
                "level 1",
                "certification",
                "looted space",
                "part notes",
            ]
        ):
            continue
        return stripped
    return ""


def _parse_all_stats(text: str) -> dict[str, float]:
    """Parse all stat values from OCR text, returning {internal_name: value}."""
    found: dict[str, float] = {}

    for line in text.split("\n"):
        line = line.strip()
        if not line:
            continue

        # Try multiple patterns for "Label: Value"
        # Pattern 1: "Label: Value" (standard)
        match = re.match(r"^(.+?):\s*(.+)$", line)
        if not match:
            # Pattern 2: "Label Value" (OCR drops colon)
            match = re.match(r"^(.+?)\s{2,}(.+)$", line)
        if not match:
            continue

        label_raw = match.group(1)
        value_raw = match.group(2)

        label = _normalize_label(label_raw)
        internal = _match_stat(label)
        if not internal:
            continue

        value = _clean_value(value_raw)
        if value is None:
            continue

        # Don't overwrite if we already found this stat
        if internal not in found:
            found[internal] = value

    return found


def _guess_type_from_stats(found_stats: dict[str, float]) -> str | None:
    """Guess component type based on which stats were found."""
    stat_names = set(found_stats.keys())
    if not stat_names:
        return None

    best_type = None
    best_score = 0
    for comp_type, signature in TYPE_STAT_SIGNATURES.items():
        overlap = len(stat_names & signature)
        if overlap > best_score:
            best_score = overlap
            best_type = comp_type

    return best_type


@router.post("/parse-component")
async def parse_component_image(file: UploadFile = File(...)):
    """Accept an image upload, run OCR, and return parsed component data."""
    content_type = file.content_type or ""
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 10MB)")

    logger.info("ocr_upload_received", extra={"content_type": content_type, "size": len(contents)})

    try:
        png_bytes = _convert_to_png(contents)
    except RuntimeError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
        tmp.write(png_bytes)
        tmp_path = tmp.name

    try:
        raw_text = _run_tesseract(tmp_path)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    if not raw_text.strip():
        raise HTTPException(status_code=422, detail="No text could be extracted from the image")

    logger.info("ocr_text_extracted", extra={"char_count": len(raw_text), "preview": raw_text[:300]})

    lines = [line.strip() for line in raw_text.strip().split("\n") if line.strip()]

    # Extract name
    guessed_name = _extract_name(lines)

    # Parse all recognizable stats from the text
    found_stats = _parse_all_stats(raw_text)

    # Guess type from what stats we found (more reliable than keyword matching)
    guessed_type = _guess_type_from_stats(found_stats)

    # Build ordered stat array for the guessed type
    stat_labels: list[str] = []
    stats: list[float] = []
    if guessed_type:
        stat_labels = COMP_STAT_ORDER.get(guessed_type, [])
        stats = [found_stats.get(s, 0) for s in stat_labels]

    return {
        "raw_text": raw_text,
        "guessed_type": guessed_type,
        "guessed_name": guessed_name,
        "stats": stats,
        "found_stats": {k: v for k, v in found_stats.items()},
        "stat_labels": stat_labels,
    }
