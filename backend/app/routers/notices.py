from __future__ import annotations

from typing import List
from fastapi import APIRouter, Depends, Form, File, UploadFile, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import Notice, User
from app.routers.deps import get_current_user
from app.schemas.schemas import NoticeOut
from app.services.cache_service import CacheService
from app.services.storage_service import save_generic_upload

router = APIRouter(prefix="/notices", tags=["Notices"])


@router.get("/public", response_model=List[NoticeOut])
async def public_notices(db: Session = Depends(get_db)):
    cached = await CacheService.get_public_notices()
    if cached:
        return cached

    notices = db.query(Notice).order_by(Notice.created_at.desc()).all()
    res = [NoticeOut.from_orm_model(n).model_dump() for n in notices]
    await CacheService.set_public_notices(res)
    return res


@router.post("/", response_model=NoticeOut)
async def create_notice(
    title: str = Form(...),
    notice_file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin" and current_user.role != "institution_coordinator":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to post notices")

    file_path = await save_generic_upload(notice_file)
    if not file_path:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to upload notice file")

    notice = Notice(
        title=title.strip(),
        file_path=file_path,
        created_by=current_user.id,
    )
    db.add(notice)
    db.commit()
    db.refresh(notice)
    await CacheService.invalidate_notices()
    return NoticeOut.from_orm_model(notice)
