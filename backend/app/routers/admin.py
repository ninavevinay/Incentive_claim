from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.routers.profile import get_current_user
from app.models.user import User
from app.models.application import Application
from app.models.form_window import FormWindow
from app.models.login_event import LoginEvent
from app.models.password_reset import PasswordResetRequest
from app.models.notification import Notification
from app.models.feedback import Feedback
from app.schemas.admin import (
    AdminUserOut,
    LoginEventOut,
    PasswordResetOut,
    AdminPasswordUpdate,
    AdminCreateAuthorityUser,
    AdminFormWindowOut,
    AdminFormWindowUpdate,
    AdminFeedbackOut,
)
from app.schemas.application import ApplicationOut
from app.core.security import hash_password

router = APIRouter(prefix="/admin", tags=["admin"])


def require_admin(user: User):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")


@router.get("/users", response_model=list[AdminUserOut])
def list_users(
    limit: int = Query(default=200, ge=1, le=1000),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    require_admin(user)
    return db.query(User).order_by(User.id.desc()).limit(limit).all()


@router.get("/applications", response_model=list[ApplicationOut])
def list_applications(
    limit: int = Query(default=200, ge=1, le=1000),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    require_admin(user)
    return db.query(Application).order_by(Application.created_at.desc()).limit(limit).all()


@router.delete("/applications/{app_id}")
def admin_delete_application(
    app_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    require_admin(user)
    target = db.query(Application).filter(Application.id == app_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Application not found")
    db.delete(target)
    db.commit()
    return {"message": "Application deleted"}


@router.delete("/applications")
def admin_delete_all_applications(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    require_admin(user)
    deleted = db.query(Application).delete()
    db.commit()
    return {"message": "All applications deleted", "deleted": deleted}


@router.get("/login-events", response_model=list[LoginEventOut])
def list_login_events(
    limit: int = Query(default=200, ge=1, le=1000),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    require_admin(user)
    return db.query(LoginEvent).order_by(LoginEvent.created_at.desc()).limit(limit).all()


@router.get("/feedback", response_model=list[AdminFeedbackOut])
def list_feedback(
    limit: int = Query(default=500, ge=1, le=2000),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    require_admin(user)
    return db.query(Feedback).order_by(Feedback.created_at.desc()).limit(limit).all()


@router.get("/password-resets", response_model=list[PasswordResetOut])
def list_password_resets(
    limit: int = Query(default=200, ge=1, le=1000),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    require_admin(user)
    return db.query(PasswordResetRequest).order_by(PasswordResetRequest.created_at.desc()).limit(limit).all()


@router.get("/form-window", response_model=AdminFormWindowOut)
def get_form_window(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    require_admin(user)
    window = db.query(FormWindow).filter(FormWindow.id == 1).first()
    if not window:
        return {"start_date": None, "end_date": None}
    return {"start_date": window.start_date, "end_date": window.end_date}


@router.put("/form-window", response_model=AdminFormWindowOut)
def set_form_window(
    payload: AdminFormWindowUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    require_admin(user)
    if payload.end_date < payload.start_date:
        raise HTTPException(status_code=400, detail="End date must be on or after start date")
    window = db.query(FormWindow).filter(FormWindow.id == 1).first()
    if not window:
        window = FormWindow(id=1)
    window.start_date = payload.start_date
    window.end_date = payload.end_date
    window.updated_at = datetime.utcnow()
    db.add(window)
    applicant_users = (
        db.query(User)
        .filter(User.role.in_(["student", "faculty"]))
        .all()
    )
    start_label = payload.start_date.isoformat()
    end_label = payload.end_date.isoformat()
    for applicant in applicant_users:
        db.add(
            Notification(
                user_id=applicant.id,
                message=f"Form filling window is open from {start_label} to {end_label}",
            )
        )
    db.commit()
    db.refresh(window)
    return {"start_date": window.start_date, "end_date": window.end_date}

@router.post("/users/password")
def admin_set_password(
    payload: AdminPasswordUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    require_admin(user)
    target = db.query(User).filter(User.id == payload.user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    target.password_hash = hash_password(payload.new_password)
    db.add(target)
    db.commit()
    return {"message": "Password updated"}


@router.post("/users/authority", response_model=AdminUserOut)
def admin_create_authority_user(
    payload: AdminCreateAuthorityUser,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    require_admin(user)
    allowed_roles = {
        "department_coordinator",
        "department_hod",
        "institution_coordinator",
    }
    if payload.role not in allowed_roles:
        raise HTTPException(status_code=400, detail="Invalid authority role")

    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        department=payload.department,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.delete("/users/{user_id}")
def admin_delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    require_admin(user)
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.role == "admin" and target.id == user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own admin account")
    db.query(Notification).filter(Notification.user_id == user_id).delete()
    db.query(Feedback).filter(Feedback.user_id == user_id).delete()
    db.query(LoginEvent).filter(LoginEvent.user_id == user_id).delete()
    db.query(PasswordResetRequest).filter(PasswordResetRequest.user_id == user_id).delete()
    db.query(Application).filter(Application.owner_id == user_id).delete()
    db.delete(target)
    db.commit()
    return {"message": "User deleted"}
