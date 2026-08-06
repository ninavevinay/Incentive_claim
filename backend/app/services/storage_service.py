from __future__ import annotations

import os
import re
import uuid
from pathlib import Path
from typing import Optional, Set

from fastapi import HTTPException, UploadFile, status
from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import settings
from app.models.models import portal_now

MAX_UPLOAD_BYTES = 500 * 1024
PDF_UPLOAD_EXTENSIONS = {".pdf"}
PDF_UPLOAD_CONTENT_TYPES = {"application/pdf"}
SIGNATURE_UPLOAD_EXTENSIONS = {".jpg", ".jpeg", ".png"}
SIGNATURE_UPLOAD_CONTENT_TYPES = {"image/jpeg", "image/png"}
PHOTO_UPLOAD_EXTENSIONS = {".jpg", ".jpeg"}
PHOTO_UPLOAD_CONTENT_TYPES = {"image/jpeg"}
PHOTO_TARGET_SIZE_PX = (600, 600)
PHOTO_TARGET_DPI = (300, 300)
PHOTO_JPEG_QUALITY = 82


def safe_filename_token(value: Optional[str], fallback: str) -> str:
    raw = str(value or "").strip().lower()
    token = re.sub(r"[^a-z0-9]+", "_", raw).strip("_")
    return token or fallback


def preferred_extension(content_type: str) -> Optional[str]:
    if content_type == "application/pdf":
        return ".pdf"
    if content_type == "image/png":
        return ".png"
    if content_type == "image/jpeg":
        return ".jpg"
    return None


def upload_path(name: str) -> Path:
    settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    return settings.UPLOAD_DIR / name


async def save_upload(
    upload_file: Optional[UploadFile],
    applicant_name: str,
    field_name: str,
    *,
    allowed_extensions: Optional[Set[str]] = None,
    allowed_content_types: Optional[Set[str]] = None,
    invalid_type_detail: str = "Only PDF files are allowed for uploads",
) -> Optional[str]:
    if not upload_file or not upload_file.filename:
        return None

    allowed_exts = allowed_extensions or PDF_UPLOAD_EXTENSIONS
    allowed_types = allowed_content_types or PDF_UPLOAD_CONTENT_TYPES
    filename = upload_file.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    content_type = str(upload_file.content_type or "").strip().lower()

    ext_allowed = ext in allowed_exts
    content_type_allowed = content_type in allowed_types

    if not ext_allowed and not content_type_allowed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=invalid_type_detail)

    final_ext = ext if ext_allowed else (preferred_extension(content_type) or sorted(allowed_exts)[0])

    applicant_token = safe_filename_token(applicant_name, "applicant")
    field_token = safe_filename_token(field_name, "document")
    stamp = portal_now().strftime("%Y%m%d%H%M%S")
    unique_suffix = uuid.uuid4().hex[:8]
    name = f"{applicant_token}_{field_token}_{stamp}_{unique_suffix}{final_ext}"

    path = upload_path(name)
    size = 0
    try:
        with path.open("wb") as out:
            while chunk := await upload_file.read(64 * 1024):
                size += len(chunk)
                if size > MAX_UPLOAD_BYTES:
                    out.close()
                    path.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="File too large. Max 500KB.",
                    )
                out.write(chunk)
    except HTTPException:
        raise
    except Exception as exc:
        path.unlink(missing_ok=True)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to save upload") from exc

    return f"/uploads/{name}"


def standardize_photograph(upload_url: str) -> None:
    filename = Path(str(upload_url or "").strip().lstrip("/")).name
    disk_path = settings.UPLOAD_DIR / filename
    if not disk_path.is_file():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Photograph upload failed")

    try:
        with Image.open(disk_path) as image:
            filter_mode = getattr(Image, "Resampling", Image).LANCZOS
            standardized = ImageOps.fit(
                image.convert("RGB"),
                PHOTO_TARGET_SIZE_PX,
                method=filter_mode,
                centering=(0.5, 0.5),
            )
            standardized.save(
                disk_path,
                format="JPEG",
                quality=PHOTO_JPEG_QUALITY,
                optimize=True,
                dpi=PHOTO_TARGET_DPI,
            )
    except (UnidentifiedImageError, OSError, ValueError):
        disk_path.unlink(missing_ok=True)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid photograph file")

    if disk_path.stat().st_size > MAX_UPLOAD_BYTES:
        disk_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Photograph too large after resizing. Max 500KB.",
        )


async def save_photograph_upload(upload_file: Optional[UploadFile], applicant_name: str) -> Optional[str]:
    upload_url = await save_upload(
        upload_file,
        applicant_name,
        "photograph",
        allowed_extensions=PHOTO_UPLOAD_EXTENSIONS,
        allowed_content_types=PHOTO_UPLOAD_CONTENT_TYPES,
        invalid_type_detail="Only JPG files are allowed for photograph upload",
    )
    if upload_url:
        standardize_photograph(upload_url)
    return upload_url


async def save_generic_upload(upload_file: Optional[UploadFile]) -> Optional[str]:
    if not upload_file or not upload_file.filename:
        return None

    filename = upload_file.filename
    ext = os.path.splitext(filename)[1].lower()
    name = f"{uuid.uuid4().hex}{ext}"
    path = upload_path(name)
    size = 0

    try:
        with path.open("wb") as out:
            while chunk := await upload_file.read(64 * 1024):
                size += len(chunk)
                if size > MAX_UPLOAD_BYTES:
                    out.close()
                    path.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="File too large. Max 500KB.",
                    )
                out.write(chunk)
    except HTTPException:
        raise
    except Exception as exc:
        path.unlink(missing_ok=True)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to save upload") from exc

    return f"/uploads/{name}"


def delete_local_uploads(upload_urls: list[str]) -> None:
    for url in upload_urls:
        if not url:
            continue
        try:
            filename = Path(str(url).strip().lstrip("/")).name
            disk_path = settings.UPLOAD_DIR / filename
            if disk_path.is_file():
                disk_path.unlink(missing_ok=True)
        except Exception:
            pass
