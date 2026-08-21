from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import User
from app.routers.admin import safe_delete_user
from app.routers.deps import get_current_user
from app.schemas.schemas import MessageResponse, UserOut, UserUpdateSchema
from app.services.cache_service import CacheService

router = APIRouter(prefix="/profile", tags=["Profile"])


@router.get("/me", response_model=UserOut)
def get_my_profile(current_user: User = Depends(get_current_user)):
    return UserOut.from_orm_model(current_user)


@router.put("/me", response_model=UserOut)
def update_my_profile(
    payload: UserUpdateSchema,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.name is not None and payload.name.strip():
        current_user.name = payload.name.strip()
    if payload.department is not None and payload.department.strip():
        current_user.department = payload.department.strip()

    db.commit()
    db.refresh(current_user)
    return UserOut.from_orm_model(current_user)


@router.delete("/me", response_model=MessageResponse)
async def delete_my_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role == "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin account deletion is restricted",
        )

    safe_delete_user(db, current_user)
    db.commit()
    await CacheService.invalidate_highlights()
    return {"message": "Account deleted successfully."}

