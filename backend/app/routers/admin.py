from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.routers.profile import get_current_user
from app.models.user import User
from app.models.application import Application
from app.models.login_event import LoginEvent
from app.models.password_reset import PasswordResetRequest
from app.models.notification import Notification
from app.schemas.admin import AdminUserOut, LoginEventOut, PasswordResetOut, AdminPasswordUpdate
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


@router.get("/login-events", response_model=list[LoginEventOut])
def list_login_events(
    limit: int = Query(default=200, ge=1, le=1000),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    require_admin(user)
    return db.query(LoginEvent).order_by(LoginEvent.created_at.desc()).limit(limit).all()


@router.get("/password-resets", response_model=list[PasswordResetOut])
def list_password_resets(
    limit: int = Query(default=200, ge=1, le=1000),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    require_admin(user)
    return db.query(PasswordResetRequest).order_by(PasswordResetRequest.created_at.desc()).limit(limit).all()

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
    db.query(LoginEvent).filter(LoginEvent.user_id == user_id).delete()
    db.query(PasswordResetRequest).filter(PasswordResetRequest.user_id == user_id).delete()
    db.query(Application).filter(Application.owner_id == user_id).delete()
    db.delete(target)
    db.commit()
    return {"message": "User deleted"}
