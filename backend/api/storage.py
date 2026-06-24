from __future__ import annotations

import os
import re
import uuid
from datetime import datetime
from pathlib import Path

from django.conf import settings
from PIL import Image, ImageOps, UnidentifiedImageError
from rest_framework.exceptions import APIException, ValidationError


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


class FileTooLarge(APIException):
    status_code = 413
    default_detail = "File too large. Max 150KB."
    default_code = "file_too_large"


def _safe_filename_token(value: str | None, fallback: str) -> str:
    raw = str(value or "").strip().lower()
    token = re.sub(r"[^a-z0-9]+", "_", raw).strip("_")
    return token or fallback


def _preferred_extension_for_content_type(content_type: str) -> str | None:
    if content_type == "application/pdf":
        return ".pdf"
    if content_type == "image/png":
        return ".png"
    if content_type == "image/jpeg":
        return ".jpg"
    return None


def _upload_path(name: str) -> Path:
    root = Path(settings.MEDIA_ROOT)
    root.mkdir(parents=True, exist_ok=True)
    return root / name


def save_upload(
    file_obj,
    applicant_name: str,
    field_name: str,
    *,
    allowed_extensions: set[str] | None = None,
    allowed_content_types: set[str] | None = None,
    invalid_type_detail: str = "Only PDF files are allowed for uploads",
) -> str | None:
    if not file_obj:
        return None

    allowed_extensions = allowed_extensions or PDF_UPLOAD_EXTENSIONS
    allowed_content_types = allowed_content_types or PDF_UPLOAD_CONTENT_TYPES
    filename = getattr(file_obj, "name", "") or ""
    ext = os.path.splitext(filename)[1].lower()
    content_type = str(getattr(file_obj, "content_type", "") or "").strip().lower()
    ext_allowed = ext in allowed_extensions
    content_type_allowed = content_type in allowed_content_types
    if not ext_allowed and not content_type_allowed:
        raise ValidationError(invalid_type_detail)

    final_extension = ext if ext_allowed else (_preferred_extension_for_content_type(content_type) or sorted(allowed_extensions)[0])

    applicant_token = _safe_filename_token(applicant_name, "applicant")
    field_token = _safe_filename_token(field_name, "document")
    stamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    unique_suffix = uuid.uuid4().hex[:8]
    name = f"{applicant_token}_{field_token}_{stamp}_{unique_suffix}{final_extension}"

    path = _upload_path(name)
    size = 0
    try:
        with path.open("wb") as out:
            chunks = getattr(file_obj, "chunks", None)
            if callable(chunks):
                iterator = file_obj.chunks()
            else:
                iterator = iter(lambda: file_obj.read(64 * 1024), b"")
            for chunk in iterator:
                if not chunk:
                    continue
                size += len(chunk)
                if size > MAX_UPLOAD_BYTES:
                    out.close()
                    path.unlink(missing_ok=True)
                    raise FileTooLarge()
                out.write(chunk)
    except ValidationError:
        raise
    except Exception as exc:
        path.unlink(missing_ok=True)
        raise ValidationError("Failed to save upload") from exc

    return f"/uploads/{name}"


def _upload_url_to_disk_path(upload_url: str) -> Path:
    filename = Path(str(upload_url or "").strip().lstrip("/")).name
    return Path(settings.MEDIA_ROOT) / filename


def _lanczos_filter():
    try:
        return Image.Resampling.LANCZOS
    except AttributeError:
        return Image.LANCZOS


def _standardize_photograph(upload_url: str) -> None:
    disk_path = _upload_url_to_disk_path(upload_url)
    if not disk_path.is_file():
        raise ValidationError("Photograph upload failed")

    try:
        with Image.open(disk_path) as image:
            standardized = ImageOps.fit(
                image.convert("RGB"),
                PHOTO_TARGET_SIZE_PX,
                method=_lanczos_filter(),
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
        raise ValidationError("Invalid photograph file")

    if disk_path.stat().st_size > MAX_UPLOAD_BYTES:
        disk_path.unlink(missing_ok=True)
        raise FileTooLarge("Photograph too large after resizing. Max 150KB.")


def save_photograph_upload(file_obj, applicant_name: str) -> str | None:
    upload_url = save_upload(
        file_obj,
        applicant_name,
        "photograph",
        allowed_extensions=PHOTO_UPLOAD_EXTENSIONS,
        allowed_content_types=PHOTO_UPLOAD_CONTENT_TYPES,
        invalid_type_detail="Only JPG files are allowed for photograph upload",
    )
    if upload_url:
        _standardize_photograph(upload_url)
    return upload_url


def save_generic_upload(file_obj) -> str | None:
    if not file_obj:
        return None

    filename = getattr(file_obj, "name", "") or ""
    ext = os.path.splitext(filename)[1].lower()
    name = f"{uuid.uuid4().hex}{ext}"
    path = _upload_path(name)
    size = 0

    try:
        with path.open("wb") as out:
            chunks = getattr(file_obj, "chunks", None)
            if callable(chunks):
                iterator = file_obj.chunks()
            else:
                iterator = iter(lambda: file_obj.read(64 * 1024), b"")
            for chunk in iterator:
                if not chunk:
                    continue
                size += len(chunk)
                if size > MAX_UPLOAD_BYTES:
                    out.close()
                    path.unlink(missing_ok=True)
                    raise FileTooLarge()
                out.write(chunk)
    except ValidationError:
        raise
    except Exception as exc:
        path.unlink(missing_ok=True)
        raise ValidationError("Failed to save upload") from exc

    return f"/uploads/{name}"
