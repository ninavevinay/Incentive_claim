from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.notice import Notice
from app.models.user import User
from app.routers.profile import get_current_user
from app.schemas.notice import NoticeOut
import os
import uuid

router = APIRouter(prefix="/notices", tags=["notices"])


MAX_UPLOAD_BYTES = 150 * 1024


def _save_upload(file: UploadFile) -> str:
    ext = os.path.splitext(file.filename or "")[1]
    name = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join("uploads", name)
    size = 0
    with open(path, "wb") as out:
        while True:
            chunk = file.file.read(64 * 1024)
            if not chunk:
                break
            size += len(chunk)
            if size > MAX_UPLOAD_BYTES:
                out.close()
                os.remove(path)
                raise HTTPException(status_code=413, detail="File too large. Max 150KB.")
            out.write(chunk)
    return f"/uploads/{name}"


@router.get("/public", response_model=list[NoticeOut])
def list_public_notices(db: Session = Depends(get_db)):
    return db.query(Notice).order_by(Notice.created_at.desc()).all()


@router.post("/", response_model=NoticeOut)
def create_notice(
    title: str = Form(...),
    notice_file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role != "institution_coordinator":
        raise HTTPException(status_code=403, detail="Only institution coordinator can upload notices")

    clean_title = title.strip()
    if not clean_title:
        raise HTTPException(status_code=400, detail="Title is required")

    notice = Notice(
        title=clean_title,
        file_path=_save_upload(notice_file),
        created_by=user.id,
    )
    db.add(notice)
    db.commit()
    db.refresh(notice)
    return notice
