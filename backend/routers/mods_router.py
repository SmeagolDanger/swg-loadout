from __future__ import annotations

import os
import io
import mimetypes
import re
import zipfile
from typing import Iterable
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

from auth import require_role
from database import Mod, ModFile, ModScreenshot, User, get_db

router = APIRouter(prefix="/api/mods", tags=["mods"])
admin_router = APIRouter(prefix="/api/admin/mods", tags=["mods-admin"])

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "mods"
UPLOADS_DIR = DATA_DIR / "uploads"
SCREENSHOTS_DIR = DATA_DIR / "screenshots"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)



MAX_MOD_FILE_SIZE = int(os.getenv("MAX_MOD_FILE_SIZE", str(10 * 1024 * 1024)))
MAX_SCREENSHOT_SIZE = int(os.getenv("MAX_SCREENSHOT_SIZE", str(2 * 1024 * 1024)))
MAX_UPLOAD_BATCH = int(os.getenv("MAX_MOD_UPLOAD_BATCH", "10"))
ALLOWED_MOD_EXTENSIONS = {
    ".zip", ".7z", ".rar", ".tre", ".dds", ".tga", ".cfg", ".ini", ".xml", ".lua", ".txt", ".md", ".pdf"
}
ALLOWED_SCREENSHOT_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
ALLOWED_SCREENSHOT_CONTENT_TYPES = {"image/png", "image/jpeg", "image/webp", "image/gif"}


def _ensure_upload_count(files: Iterable[UploadFile]) -> None:
    if len(list(files)) > MAX_UPLOAD_BATCH:
        raise HTTPException(status_code=400, detail=f"A maximum of {MAX_UPLOAD_BATCH} files can be uploaded at once")


def _ensure_allowed_extension(filename: str, allowed_extensions: set[str], detail: str) -> None:
    suffix = Path(filename).suffix.lower()
    if suffix not in allowed_extensions:
        raise HTTPException(status_code=400, detail=detail)


def _ensure_payload_size(payload: bytes, max_size: int, detail: str) -> None:
    if len(payload) > max_size:
        raise HTTPException(status_code=400, detail=detail)


def _looks_like_image(payload: bytes, content_type: str) -> bool:
    if content_type == "image/png":
        return payload.startswith(b"\x89PNG\r\n\x1a\n")
    if content_type == "image/jpeg":
        return payload.startswith(b"\xff\xd8\xff")
    if content_type == "image/gif":
        return payload.startswith((b"GIF87a", b"GIF89a"))
    if content_type == "image/webp":
        return len(payload) >= 12 and payload.startswith(b"RIFF") and payload[8:12] == b"WEBP"
    return False


class ModImageOut(BaseModel):
    id: int
    url: str
    caption: str = ""
    sort_order: int = 0


class ModFileOut(BaseModel):
    id: int
    label: str = ""
    original_filename: str
    file_size: int = 0


class ModSummaryOut(BaseModel):
    id: int
    slug: str
    title: str
    author_name: str = ""
    summary: str = ""
    category: str = "general"
    tags: str = ""
    version: str = "1.0"
    compatibility: str = "SWG Legends"
    is_featured: bool = False
    is_published: bool = False
    created_at: str | None = None
    updated_at: str | None = None
    file_count: int = 0
    screenshot_count: int = 0
    primary_image_url: str | None = None


class ModDetailOut(ModSummaryOut):
    description: str = ""
    install_instructions: str = ""
    files: list[ModFileOut] = Field(default_factory=list)
    screenshots: list[ModImageOut] = Field(default_factory=list)


class ModMetaInput(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    slug: str = Field(min_length=2, max_length=120)
    author_name: str = ""
    summary: str = Field(default="", max_length=280)
    description: str = ""
    category: str = "general"
    tags: str = ""
    version: str = "1.0"
    compatibility: str = "SWG Legends"
    install_instructions: str = ""
    is_published: bool = False
    is_featured: bool = False


class ModFileLabelUpdate(BaseModel):
    label: str = ""


class ModMetaUpdate(ModMetaInput):
    pass


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug[:120] or "mod"


def _stored_name(prefix: str, filename: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9._-]+", "_", Path(filename).name)
    return f"{prefix}-{uuid4().hex[:12]}-{safe}"


def _guess_type(path: Path) -> str:
    content_type, _ = mimetypes.guess_type(path.name)
    return content_type or "application/octet-stream"


def _safe_download_name(filename: str) -> str:
    return Path(filename).name.replace('"', "")


def _image_url(image: ModScreenshot) -> str:
    return f"/api/mods/images/{image.id}"


def _summary_out(mod: Mod) -> ModSummaryOut:
    shots = sorted(mod.screenshots, key=lambda item: (item.sort_order, item.id))
    primary = _image_url(shots[0]) if shots else None
    return ModSummaryOut(
        id=mod.id,
        slug=mod.slug,
        title=mod.title,
        author_name=mod.author_name or "",
        summary=mod.summary or "",
        category=mod.category or "general",
        tags=mod.tags or "",
        version=mod.version or "1.0",
        compatibility=mod.compatibility or "SWG Legends",
        is_featured=bool(mod.is_featured),
        is_published=bool(mod.is_published),
        created_at=mod.created_at.isoformat() if mod.created_at else None,
        updated_at=mod.updated_at.isoformat() if mod.updated_at else None,
        file_count=len(mod.files),
        screenshot_count=len(shots),
        primary_image_url=primary,
    )


def _detail_out(mod: Mod) -> ModDetailOut:
    summary = _summary_out(mod).model_dump()
    return ModDetailOut(
        **summary,
        description=mod.description or "",
        install_instructions=mod.install_instructions or "",
        files=[
            ModFileOut(
                id=file.id,
                label=file.label or "",
                original_filename=file.original_filename,
                file_size=file.file_size or 0,
            )
            for file in sorted(mod.files, key=lambda item: item.id)
        ],
        screenshots=[
            ModImageOut(
                id=image.id, url=_image_url(image), caption=image.caption or "", sort_order=image.sort_order or 0
            )
            for image in sorted(mod.screenshots, key=lambda item: (item.sort_order, item.id))
        ],
    )


def _mod_query(db: Session):
    return db.query(Mod).options(joinedload(Mod.files), joinedload(Mod.screenshots))


@router.get("", response_model=list[ModSummaryOut])
def list_mods(
    search: str = "",
    category: str = "",
    featured: bool | None = None,
    db: Session = Depends(get_db),
):
    query = _mod_query(db).filter(Mod.is_published.is_(True))
    if search:
        pattern = f"%{search}%"
        query = query.filter(Mod.title.ilike(pattern) | Mod.summary.ilike(pattern) | Mod.tags.ilike(pattern))
    if category:
        query = query.filter(Mod.category == category)
    if featured is not None:
        query = query.filter(Mod.is_featured.is_(featured))
    mods = query.order_by(Mod.is_featured.desc(), Mod.updated_at.desc(), Mod.created_at.desc()).all()
    return [_summary_out(mod) for mod in mods]


@router.get("/{slug}", response_model=ModDetailOut)
def get_mod(slug: str, db: Session = Depends(get_db)):
    mod = _mod_query(db).filter(Mod.slug == slug, Mod.is_published.is_(True)).first()
    if not mod:
        raise HTTPException(status_code=404, detail="Mod not found")
    return _detail_out(mod)


@router.get("/images/{image_id}")
def get_mod_image(image_id: int, db: Session = Depends(get_db)):
    image = db.query(ModScreenshot).options(joinedload(ModScreenshot.mod)).filter(ModScreenshot.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    path = SCREENSHOTS_DIR / image.stored_filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="Image file not found")
    media_type = _guess_type(path)
    if media_type not in ALLOWED_SCREENSHOT_CONTENT_TYPES:
        raise HTTPException(status_code=404, detail="Image file not found")
    return FileResponse(path, media_type=media_type, filename=_safe_download_name(image.original_filename))


@router.get("/{slug}/download")
def download_mod_zip(slug: str, db: Session = Depends(get_db)):
    mod = _mod_query(db).filter(Mod.slug == slug, Mod.is_published.is_(True)).first()
    if not mod:
        raise HTTPException(status_code=404, detail="Mod not found")
    if not mod.files:
        raise HTTPException(status_code=400, detail="This mod does not have downloadable files yet")

    files = sorted(mod.files, key=lambda item: item.id)
    if len(files) == 1 and files[0].original_filename.lower().endswith(".zip"):
        file = files[0]
        path = UPLOADS_DIR / file.stored_filename
        if not path.exists():
            raise HTTPException(status_code=404, detail="Mod file not found")
        return FileResponse(path, media_type="application/zip", filename=_safe_download_name(file.original_filename))

    buffer = io.BytesIO()
    zip_name = f"{mod.slug}-{mod.version or 'bundle'}.zip"
    with zipfile.ZipFile(buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as archive:
        for file in files:
            path = UPLOADS_DIR / file.stored_filename
            if path.exists():
                archive.write(path, arcname=file.original_filename)
    buffer.seek(0)
    headers = {"Content-Disposition": f'attachment; filename="{_safe_download_name(zip_name)}"'}
    return StreamingResponse(buffer, media_type="application/zip", headers=headers)


@admin_router.get("", response_model=list[ModSummaryOut])
def admin_list_mods(
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    mods = _mod_query(db).order_by(Mod.updated_at.desc(), Mod.created_at.desc()).all()
    return [_summary_out(mod) for mod in mods]


@admin_router.get("/{mod_id}", response_model=ModDetailOut)
def admin_get_mod(mod_id: int, user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    mod = _mod_query(db).filter(Mod.id == mod_id).first()
    if not mod:
        raise HTTPException(status_code=404, detail="Mod not found")
    return _detail_out(mod)


@admin_router.post("", response_model=ModDetailOut)
def admin_create_mod(
    data: ModMetaInput,
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    slug = _slugify(data.slug or data.title)
    exists = db.query(Mod).filter(Mod.slug == slug).first()
    if exists:
        raise HTTPException(status_code=400, detail="A mod with that slug already exists")
    mod = Mod(
        user_id=user.id,
        slug=slug,
        title=data.title.strip(),
        author_name=data.author_name.strip(),
        summary=data.summary.strip(),
        description=data.description.strip(),
        category=data.category.strip() or "general",
        tags=data.tags.strip(),
        version=data.version.strip() or "1.0",
        compatibility=data.compatibility.strip() or "SWG Legends",
        install_instructions=data.install_instructions.strip(),
        is_published=bool(data.is_published),
        is_featured=bool(data.is_featured),
    )
    db.add(mod)
    db.commit()
    db.refresh(mod)
    mod = _mod_query(db).filter(Mod.id == mod.id).first()
    return _detail_out(mod)


@admin_router.put("/{mod_id}", response_model=ModDetailOut)
def admin_update_mod(
    mod_id: int,
    data: ModMetaUpdate,
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    mod = _mod_query(db).filter(Mod.id == mod_id).first()
    if not mod:
        raise HTTPException(status_code=404, detail="Mod not found")
    slug = _slugify(data.slug or data.title)
    conflict = db.query(Mod).filter(Mod.slug == slug, Mod.id != mod_id).first()
    if conflict:
        raise HTTPException(status_code=400, detail="A mod with that slug already exists")

    mod.slug = slug
    mod.title = data.title.strip()
    mod.author_name = data.author_name.strip()
    mod.summary = data.summary.strip()
    mod.description = data.description.strip()
    mod.category = data.category.strip() or "general"
    mod.tags = data.tags.strip()
    mod.version = data.version.strip() or "1.0"
    mod.compatibility = data.compatibility.strip() or "SWG Legends"
    mod.install_instructions = data.install_instructions.strip()
    mod.is_published = bool(data.is_published)
    mod.is_featured = bool(data.is_featured)
    db.commit()
    db.refresh(mod)
    mod = _mod_query(db).filter(Mod.id == mod.id).first()
    return _detail_out(mod)


@admin_router.delete("/{mod_id}")
def admin_delete_mod(mod_id: int, user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    mod = _mod_query(db).filter(Mod.id == mod_id).first()
    if not mod:
        raise HTTPException(status_code=404, detail="Mod not found")
    for file in mod.files:
        path = UPLOADS_DIR / file.stored_filename
        if path.exists():
            path.unlink()
    for image in mod.screenshots:
        path = SCREENSHOTS_DIR / image.stored_filename
        if path.exists():
            path.unlink()
    db.delete(mod)
    db.commit()
    return {"success": True}


@admin_router.post("/{mod_id}/files", response_model=ModDetailOut)
async def admin_upload_files(
    mod_id: int,
    files: list[UploadFile] = File(...),
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    mod = _mod_query(db).filter(Mod.id == mod_id).first()
    if not mod:
        raise HTTPException(status_code=404, detail="Mod not found")
    if len(files) > MAX_UPLOAD_BATCH:
        raise HTTPException(status_code=400, detail=f"A maximum of {MAX_UPLOAD_BATCH} files can be uploaded at once")
    added = False
    for upload in files:
        if not upload.filename:
            continue
        _ensure_allowed_extension(upload.filename, ALLOWED_MOD_EXTENSIONS, "Unsupported mod file type")
        payload = await upload.read()
        if not payload:
            continue
        _ensure_payload_size(payload, MAX_MOD_FILE_SIZE, f"Mod files must be {MAX_MOD_FILE_SIZE // (1024 * 1024)} MB or smaller")
        stored = _stored_name("mod", upload.filename)
        path = UPLOADS_DIR / stored
        path.write_bytes(payload)
        db.add(
            ModFile(
                mod_id=mod.id,
                label="",
                original_filename=Path(upload.filename).name,
                stored_filename=stored,
                file_size=len(payload),
            )
        )
        added = True
    if not added:
        raise HTTPException(status_code=400, detail="No files were uploaded")
    db.commit()
    mod = _mod_query(db).filter(Mod.id == mod.id).first()
    return _detail_out(mod)


@admin_router.post("/{mod_id}/screenshots", response_model=ModDetailOut)
async def admin_upload_screenshots(
    mod_id: int,
    files: list[UploadFile] = File(...),
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    mod = _mod_query(db).filter(Mod.id == mod_id).first()
    if not mod:
        raise HTTPException(status_code=404, detail="Mod not found")
    if len(files) > MAX_UPLOAD_BATCH:
        raise HTTPException(status_code=400, detail=f"A maximum of {MAX_UPLOAD_BATCH} files can be uploaded at once")
    next_order = len(mod.screenshots)
    added = False
    for upload in files:
        if not upload.filename:
            continue
        _ensure_allowed_extension(upload.filename, ALLOWED_SCREENSHOT_EXTENSIONS, "Unsupported screenshot file type")
        if (upload.content_type or "").lower() not in ALLOWED_SCREENSHOT_CONTENT_TYPES:
            raise HTTPException(status_code=400, detail="Unsupported screenshot content type")
        payload = await upload.read()
        if not payload:
            continue
        _ensure_payload_size(payload, MAX_SCREENSHOT_SIZE, f"Screenshots must be {MAX_SCREENSHOT_SIZE // (1024 * 1024)} MB or smaller")
        if not _looks_like_image(payload, (upload.content_type or "").lower()):
            raise HTTPException(status_code=400, detail="Uploaded screenshot content did not match the claimed image type")
        stored = _stored_name("shot", upload.filename)
        path = SCREENSHOTS_DIR / stored
        path.write_bytes(payload)
        db.add(
            ModScreenshot(
                mod_id=mod.id,
                caption="",
                original_filename=Path(upload.filename).name,
                stored_filename=stored,
                sort_order=next_order,
            )
        )
        next_order += 1
        added = True
    if not added:
        raise HTTPException(status_code=400, detail="No screenshots were uploaded")
    db.commit()
    mod = _mod_query(db).filter(Mod.id == mod.id).first()
    return _detail_out(mod)


@admin_router.put("/files/{file_id}", response_model=dict)
def admin_update_file_label(
    file_id: int,
    data: ModFileLabelUpdate,
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    file = db.query(ModFile).filter(ModFile.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    file.label = data.label.strip()
    db.commit()
    return {"success": True}


@admin_router.delete("/files/{file_id}", response_model=dict)
def admin_delete_file(file_id: int, user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    file = db.query(ModFile).filter(ModFile.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    path = UPLOADS_DIR / file.stored_filename
    if path.exists():
        path.unlink()
    db.delete(file)
    db.commit()
    return {"success": True}


@admin_router.delete("/screenshots/{image_id}", response_model=dict)
def admin_delete_screenshot(image_id: int, user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    image = db.query(ModScreenshot).filter(ModScreenshot.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Screenshot not found")
    path = SCREENSHOTS_DIR / image.stored_filename
    if path.exists():
        path.unlink()
    db.delete(image)
    db.commit()
    return {"success": True}
