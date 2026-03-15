"""OCR-based component parsing from screenshots.

Accepts an image of an SWG component examine window, converts it to
a clean PNG via Pillow, runs Tesseract OCR, and attempts to extract
the component type, name, and stat values.
Returns structured data for the user to review before saving.
"""

import io
import logging
import re
import subprocess
import tempfile
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from PIL import Image

router = APIRouter(prefix="/api/ocr", tags=["ocr"])
logger = logging.getLogger(__name__)

# ─── In-game stat names → internal stat mapping ─────────────────────
# SWG displays stats with varying names. This maps all known variants
# to the internal stat name used by the app. Stats may appear in any order.

STAT_ALIASES: dict[str, str] = {
    # Drain
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
    # Weapon
    "minimum damage": "min damage",
    "min damage": "min damage",
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

# Internal stat name → stat position index per component type
# Position matches stat1..stat8 in the database
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

# Keywords in the examine window that hint at the component type
TYPE_HINTS: dict[str, list[str]] = {
    "reactor": ["reactor", "energy generation"],
    "engine": ["engine", "pitch rate", "yaw rate", "roll rate"],
    "booster": ["booster"],
    "shield": ["shield", "front shield", "shield hit points"],
    "armor": ["armor"],
    "capacitor": ["capacitor"],
    "droidinterface": ["droid interface", "droid command"],
    "weapon": ["weapon", "energy per shot", "refire rate", "vs. shields", "vs. armor", "min damage", "max damage"],
    "ordnancelauncher": ["ordnance", "launcher", "pve multiplier", "ammunition"],
    "countermeasurelauncher": ["countermeasure"],
    "cargohold": ["cargo"],
}


def _convert_to_png(contents: bytes) -> bytes:
    """Convert any image format to PNG using Pillow."""
    try:
        img = Image.open(io.BytesIO(contents))
        # Convert to RGB if necessary (handles RGBA, palette, etc.)
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
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
            raise RuntimeError(
                f"Tesseract failed: {stderr[:200]}" if stderr else "Tesseract failed: Error during processing"
            )
        return result.stdout
    except FileNotFoundError:
        raise RuntimeError("Tesseract is not installed on the server") from None
    except subprocess.TimeoutExpired:
        raise RuntimeError("OCR timed out") from None


def _clean_value(raw: str) -> float | None:
    """Parse a stat value string, handling SWG's > and < prefixes."""
    raw = raw.strip()
    raw = raw.lstrip("><")
    raw = raw.replace(",", "")
    try:
        return float(raw)
    except ValueError:
        return None


def _guess_component_type(text_lower: str) -> str | None:
    """Guess the component type from OCR text based on keyword hints."""
    scores: dict[str, int] = {}
    for comp_type, keywords in TYPE_HINTS.items():
        score = sum(1 for kw in keywords if kw in text_lower)
        if score > 0:
            scores[comp_type] = score
    if not scores:
        return None
    return max(scores, key=lambda k: scores[k])


def _extract_name(lines: list[str]) -> str:
    """Try to extract the component name from the first few lines."""
    for line in lines[:5]:
        stripped = line.strip()
        if not stripped:
            continue
        if re.match(r"^.+:\s*[\d<>.]", stripped):
            continue
        if len(stripped) < 3:
            continue
        return stripped
    return ""


def _parse_stats(text: str, comp_type: str) -> dict:
    """Parse stat values from OCR text for a given component type."""
    stat_order = COMP_STAT_ORDER.get(comp_type, [])
    if not stat_order:
        return {}

    found_stats: dict[str, float] = {}

    for line in text.split("\n"):
        line = line.strip()
        if not line:
            continue

        # Try "Label: Value" first
        match = re.match(r"^(.+?):\s*([\d<>.,]+)", line)
        if not match:
            # Try "Label Value" where value starts with digit or > or <
            match = re.match(r"^(.+?)\s+([<>]?[\d.,]+)$", line)
        if not match:
            continue

        label = match.group(1).strip().lower()
        value_str = match.group(2).strip()
        value = _clean_value(value_str)
        if value is None:
            continue

        internal_name = STAT_ALIASES.get(label)
        if not internal_name:
            for alias, internal in STAT_ALIASES.items():
                if alias in label or label in alias:
                    internal_name = internal
                    break

        if internal_name and internal_name in stat_order:
            found_stats[internal_name] = value

    stats: list[float] = []
    for stat_name in stat_order:
        stats.append(found_stats.get(stat_name, 0))

    return {
        "stats": stats,
        "found": found_stats,
        "stat_labels": stat_order,
    }


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

    # Convert to clean PNG via Pillow (handles HEIC, JPEG, etc.)
    try:
        png_bytes = _convert_to_png(contents)
    except RuntimeError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    # Write PNG to temp file for Tesseract
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

    logger.info("ocr_text_extracted", extra={"char_count": len(raw_text), "preview": raw_text[:200]})

    lines = [line.strip() for line in raw_text.strip().split("\n") if line.strip()]
    text_lower = raw_text.lower()

    guessed_type = _guess_component_type(text_lower)
    guessed_name = _extract_name(lines)

    parsed: dict = {}
    if guessed_type:
        parsed = _parse_stats(raw_text, guessed_type)

    return {
        "raw_text": raw_text,
        "guessed_type": guessed_type,
        "guessed_name": guessed_name,
        "stats": parsed.get("stats", []),
        "found_stats": parsed.get("found", {}),
        "stat_labels": parsed.get("stat_labels", []),
    }
