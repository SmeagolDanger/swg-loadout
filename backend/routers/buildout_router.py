"""API routes for the SWG buildout explorer feature."""

from __future__ import annotations

import tempfile
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from buildout_parser import list_bundled_buildouts, parse_buildout, parse_bundled_buildout

router = APIRouter(prefix="/api/buildouts", tags=["buildouts"])


@router.get("/zones")
def list_zones():
    """Return the bundled buildout zones available to the frontend."""
    return list_bundled_buildouts()


@router.get("/zones/{zone_id}")
def get_zone(zone_id: str):
    """Parse and return a single bundled buildout zone."""
    try:
        return parse_bundled_buildout(zone_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Zone not found") from exc


@router.post("/parse")
async def parse_uploaded_buildout(file: UploadFile = File(...)):
    """Parse an uploaded buildout tab file and return explorer data."""
    filename = file.filename or ""
    if not filename.lower().endswith(".tab"):
        raise HTTPException(status_code=400, detail="Please upload a .tab buildout file")

    temp_path: Path | None = None
    try:
        suffix = Path(filename).suffix or ".tab"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(await file.read())
            temp_path = Path(temp_file.name)

        return parse_buildout(temp_path)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to parse buildout: {exc}") from exc
    finally:
        if temp_path and temp_path.exists():
            temp_path.unlink()
