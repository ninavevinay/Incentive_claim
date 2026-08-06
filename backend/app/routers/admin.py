from __future__ import annotations

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import hash_password, is_allowed_email, normalize_email
from app.models.models import (
    Application,
    Feedback,
    FormWindow,
    LoginEvent,
    PasswordResetRequest,
    User,
    portal_now,
)
from app.routers.deps import get_current_active_admin, get_current_user
from app.schemas.schemas import (
    AdminCreateAuthorityUserSchema,
    AdminFormWindowOut,
    AdminFormWindowUpdateSchema,
    AdminUserOut,
    ApplicationOut,
    FeedbackOut,
    LoginEventOut,
    MessageResponse,
    PasswordResetOut,
)
from app.services.cache_service import CacheService
from app.services.storage_service import delete_local_uploads

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/users", response_model=List[AdminUserOut])
def admin_users(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    users = db.query(User).order_by(User.id.asc()).all()
    return [AdminUserOut.from_orm_model(u) for u in users]


@router.get("/applications", response_model=List[ApplicationOut])
def admin_applications(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    apps = db.query(Application).order_by(Application.created_at.desc()).all()
    return [ApplicationOut.from_orm_model(a) for a in apps]


@router.delete("/applications/{app_id}", response_model=MessageResponse)
async def admin_delete_application(
    app_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    app = db.query(Application).filter(Application.id == app_id).first()
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    data = app.data or {}
    files_to_delete = []
    if isinstance(data, dict):
        for field in ("fee_receipt_file", "certificate_file", "bank_passbook_file", "photograph_file", "signature_file"):
            val = data.get(field)
            if isinstance(val, str) and val.startswith("/uploads/"):
                files_to_delete.append(val)

    db.delete(app)
    db.commit()
    delete_local_uploads(files_to_delete)
    await CacheService.invalidate_highlights()
    return {"message": f"Application {app_id} deleted."}


@router.delete("/applications", response_model=MessageResponse)
async def admin_delete_all_applications(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    apps = db.query(Application).all()
    files_to_delete = []
    for app in apps:
        data = app.data or {}
        if isinstance(data, dict):
            for field in ("fee_receipt_file", "certificate_file", "bank_passbook_file", "photograph_file", "signature_file"):
                val = data.get(field)
                if isinstance(val, str) and val.startswith("/uploads/"):
                    files_to_delete.append(val)
        db.delete(app)

    db.commit()
    delete_local_uploads(files_to_delete)
    await CacheService.invalidate_highlights()
    return {"message": "All applications deleted."}


@router.get("/login-events", response_model=List[LoginEventOut])
def admin_login_events(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    events = db.query(LoginEvent).order_by(LoginEvent.created_at.desc()).all()
    return [LoginEventOut.from_orm_model(e) for e in events]


@router.get("/feedback", response_model=List[FeedbackOut])
def admin_feedback(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    fbs = db.query(Feedback).order_by(Feedback.created_at.desc()).all()
    return [FeedbackOut.from_orm_model(f) for f in fbs]


@router.get("/password-resets", response_model=List[PasswordResetOut])
def admin_password_resets(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    resets = db.query(PasswordResetRequest).order_by(PasswordResetRequest.created_at.desc()).all()
    return [PasswordResetOut.from_orm_model(r) for r in resets]


@router.get("/form-window", response_model=AdminFormWindowOut)
async def admin_get_form_window(db: Session = Depends(get_db)):
    cached = await CacheService.get_form_window()
    if cached:
        return cached

    window = db.query(FormWindow).filter(FormWindow.id == 1).first()
    data = {
        "start_date": window.start_date.isoformat() if window and window.start_date else None,
        "end_date": window.end_date.isoformat() if window and window.end_date else None,
    }
    await CacheService.set_form_window(data)
    return data


@router.put("/form-window", response_model=AdminFormWindowOut)
async def admin_set_form_window(
    payload: AdminFormWindowUpdateSchema,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    window = db.query(FormWindow).filter(FormWindow.id == 1).first()
    if not window:
        window = FormWindow(id=1, start_date=payload.start_date, end_date=payload.end_date, updated_at=portal_now())
        db.add(window)
    else:
        window.start_date = payload.start_date
        window.end_date = payload.end_date
        window.updated_at = portal_now()

    db.commit()
    await CacheService.invalidate_form_window()
    return {
        "start_date": window.start_date,
        "end_date": window.end_date,
    }


@router.post("/users/authority", response_model=AdminUserOut)
def admin_create_authority_user(
    payload: AdminCreateAuthorityUserSchema,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    email = normalize_email(payload.email)
    role = payload.role.strip().lower()
    department = payload.department.strip()

    if role not in {"department_coordinator", "department_hod", "institution_coordinator"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid authority role")

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already exists with this email")

    user = User(
        name=payload.name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        role=role,
        department=department,
        auth_provider="local",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return AdminUserOut.from_orm_model(user)


@router.get("/coordinator/authority-users", response_model=List[AdminUserOut])
def coordinator_authority_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in {"institution_coordinator", "admin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    users = db.query(User).filter(User.role.in_(["department_coordinator", "department_hod"])).all()
    return [AdminUserOut.from_orm_model(u) for u in users]


@router.put("/coordinator/authority-users/{user_id}/status", response_model=AdminUserOut)
def coordinator_set_authority_user_status(
    user_id: int,
    is_active: bool = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in {"institution_coordinator", "admin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.is_active = is_active
    db.commit()
    db.refresh(user)
    return AdminUserOut.from_orm_model(user)


@router.delete("/coordinator/authority-users/{user_id}", response_model=MessageResponse)
def coordinator_delete_authority_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in {"institution_coordinator", "admin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    db.delete(user)
    db.commit()
    return {"message": f"Authority user {user_id} deleted."}


@router.delete("/users/non-admin", response_model=MessageResponse)
def admin_delete_all_non_admin_users(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    users = db.query(User).filter(User.role != "admin").all()
    for u in users:
        db.delete(u)
    db.commit()
    return {"message": "All non-admin users deleted."}


@router.delete("/users/{user_id}", response_model=MessageResponse)
def admin_delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    if user_id == admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete current admin account")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    db.delete(user)
    db.commit()
    return {"message": f"User {user_id} deleted."}
