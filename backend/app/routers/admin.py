from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import String, cast, func, or_
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.core.portal_notifications import queue_portal_notification
from app.core.security import hash_password, is_allowed_email, normalize_email
from app.models.application import Application
from app.models.email_otp import EmailOtp
from app.models.feedback import Feedback
from app.models.form_window import FormWindow
from app.models.login_event import LoginEvent
from app.models.notice import Notice
from app.models.notification import Notification
from app.models.password_reset import PasswordResetRequest
from app.models.user import User
from app.routers.profile import get_current_user
from app.schemas.admin import (
    AdminCreateAuthorityUser,
    AdminFeedbackOut,
    AdminFormWindowOut,
    AdminFormWindowUpdate,
    AdminUserOut,
    LoginEventOut,
    PasswordResetOut,
)
from app.schemas.application import ApplicationOut

router = APIRouter(prefix="/admin", tags=["admin"])
DEFAULT_LIMIT = min(200, settings.app_query_default_limit)
MAX_LIMIT = max(200, settings.app_query_max_limit)
AUTHORITY_ROLES = {
    "department_coordinator",
    "department_hod",
    "institution_coordinator",
}
APPLICATION_UPLOAD_FIELDS = (
    "fee_receipt_file",
    "certificate_file",
    "bank_passbook_file",
    "photograph_file",
    "signature_file",
)


def _collect_application_upload_refs(applications: list[Application]) -> list[str]:
    refs: list[str] = []
    for application in applications:
        data = application.data or {}
        for field in APPLICATION_UPLOAD_FIELDS:
            value = data.get(field)
            if isinstance(value, str) and value.strip():
                refs.append(value.strip())
    return refs


def _delete_local_uploads(upload_refs: list[str]) -> None:
    for upload_ref in {ref for ref in upload_refs if ref.startswith("/uploads/")}:
        upload_name = Path(upload_ref).name
        if not upload_name:
            continue
        try:
            (Path("uploads") / upload_name).unlink(missing_ok=True)
        except OSError:
            continue


def _delete_user_with_related_data(db: Session, target: User) -> list[str]:
    user_id = target.id
    notices = db.query(Notice).filter(Notice.created_by == user_id).all()
    applications = db.query(Application).filter(Application.owner_id == user_id).all()
    upload_refs = [notice.file_path for notice in notices if notice.file_path]
    upload_refs.extend(_collect_application_upload_refs(applications))

    db.query(EmailOtp).filter(EmailOtp.user_id == user_id).delete(synchronize_session=False)
    db.query(EmailOtp).filter(EmailOtp.email == target.email).delete(synchronize_session=False)
    db.query(Notification).filter(Notification.user_id == user_id).delete(synchronize_session=False)
    db.query(Feedback).filter(Feedback.user_id == user_id).delete(synchronize_session=False)
    db.query(LoginEvent).filter(LoginEvent.user_id == user_id).delete(synchronize_session=False)
    db.query(PasswordResetRequest).filter(PasswordResetRequest.user_id == user_id).delete(synchronize_session=False)
    db.query(Notice).filter(Notice.created_by == user_id).delete(synchronize_session=False)
    db.query(Application).filter(Application.owner_id == user_id).delete(synchronize_session=False)
    db.delete(target)
    return upload_refs


def require_admin(user: User):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")


def require_admin_or_institution_coordinator(user: User):
    if user.role not in {"admin", "institution_coordinator"}:
        raise HTTPException(status_code=403, detail="Not authorized")


@router.get("/users", response_model=list[AdminUserOut])
def list_users(
    q: str | None = Query(default=None),
    role: str | None = Query(default=None),
    roles: str | None = Query(default=None),
    limit: int = Query(default=DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    require_admin(user)
    query = db.query(User)
    if role:
        query = query.filter(User.role == role)
    elif roles and roles.strip():
        role_values = [item.strip() for item in roles.split(",") if item.strip()]
        if role_values:
            query = query.filter(User.role.in_(role_values))
    if q and q.strip():
        search = f"%{q.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(User.name).like(search),
                func.lower(User.email).like(search),
                func.lower(User.role).like(search),
                func.lower(User.department).like(search),
                cast(User.id, String).ilike(f"%{q.strip()}%"),
            )
        )
    return query.order_by(User.id.desc()).offset(offset).limit(limit).all()


@router.get("/applications", response_model=list[ApplicationOut])
def list_applications(
    q: str | None = Query(default=None),
    status: str | None = Query(default=None),
    department: str | None = Query(default=None),
    application_type: str | None = Query(default=None),
    limit: int = Query(default=DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    require_admin(user)
    query = db.query(Application)
    if status:
        query = query.filter(Application.status == status)
    if application_type:
        query = query.filter(Application.application_type == application_type)
    if department and department.strip():
        query = query.filter(
            func.lower(Application.data["department"].as_string()) == department.strip().lower()
        )
    if q and q.strip():
        search = f"%{q.strip().lower()}%"
        query = query.filter(
            or_(
                cast(Application.id, String).ilike(f"%{q.strip()}%"),
                func.lower(Application.application_type).like(search),
                func.lower(Application.status).like(search),
                func.lower(Application.data["applicant_name"].as_string()).like(search),
                func.lower(Application.data["department"].as_string()).like(search),
                func.lower(Application.data["usn"].as_string()).like(search),
                func.lower(Application.data["email"].as_string()).like(search),
            )
        )
    return query.order_by(Application.created_at.desc()).offset(offset).limit(limit).all()


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
    q: str | None = Query(default=None),
    limit: int = Query(default=DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    require_admin(user)
    query = db.query(LoginEvent)
    if q and q.strip():
        search = f"%{q.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(LoginEvent.email).like(search),
                func.lower(LoginEvent.ip_address).like(search),
                func.lower(LoginEvent.user_agent).like(search),
                cast(LoginEvent.user_id, String).ilike(f"%{q.strip()}%"),
            )
        )
    return query.order_by(LoginEvent.created_at.desc()).offset(offset).limit(limit).all()


@router.get("/feedback", response_model=list[AdminFeedbackOut])
def list_feedback(
    q: str | None = Query(default=None),
    limit: int = Query(default=min(500, MAX_LIMIT), ge=1, le=MAX_LIMIT),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    require_admin(user)
    query = db.query(Feedback)
    if q and q.strip():
        search = f"%{q.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(Feedback.name).like(search),
                func.lower(Feedback.email).like(search),
                func.lower(Feedback.role).like(search),
                func.lower(Feedback.department).like(search),
                func.lower(Feedback.message).like(search),
                cast(Feedback.user_id, String).ilike(f"%{q.strip()}%"),
            )
        )
    return query.order_by(Feedback.created_at.desc()).offset(offset).limit(limit).all()


@router.get("/password-resets", response_model=list[PasswordResetOut])
def list_password_resets(
    q: str | None = Query(default=None),
    limit: int = Query(default=DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    require_admin(user)
    query = db.query(PasswordResetRequest)
    if q and q.strip():
        search = f"%{q.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(PasswordResetRequest.email).like(search),
                func.lower(PasswordResetRequest.request_ip).like(search),
                cast(PasswordResetRequest.user_id, String).ilike(f"%{q.strip()}%"),
            )
        )
    return query.order_by(PasswordResetRequest.created_at.desc()).offset(offset).limit(limit).all()


@router.get("/form-window", response_model=AdminFormWindowOut)
def get_form_window(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    require_admin_or_institution_coordinator(user)
    window = db.query(FormWindow).filter(FormWindow.id == 1).first()
    if not window:
        return {"start_date": None, "end_date": None}
    return {"start_date": window.start_date, "end_date": window.end_date}


@router.put("/form-window", response_model=AdminFormWindowOut)
def set_form_window(
    payload: AdminFormWindowUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    require_admin_or_institution_coordinator(user)
    if payload.end_date < payload.start_date:
        raise HTTPException(status_code=400, detail="End date must be on or after start date")
    window = db.query(FormWindow).filter(FormWindow.id == 1).first()
    if not window:
        window = FormWindow(id=1)
    window.start_date = payload.start_date
    window.end_date = payload.end_date
    window.updated_at = datetime.utcnow()
    db.add(window)
    applicant_users = db.query(User).filter(User.role.in_(["student", "faculty"])).all()
    start_label = payload.start_date.isoformat()
    end_label = payload.end_date.isoformat()
    for applicant in applicant_users:
        queue_portal_notification(
            db,
            applicant,
            message=f"Form filling window is open from {start_label} to {end_label}",
            background_tasks=background_tasks,
            email_subject="Form filling window is open",
            email_headline="The portal form filling window is now open.",
            email_details=[
                f"Start date: {start_label}",
                f"End date: {end_label}",
                "Please submit your application within the announced window.",
            ],
        )
    db.commit()
    db.refresh(window)
    return {"start_date": window.start_date, "end_date": window.end_date}


@router.post("/users/authority", response_model=AdminUserOut)
def admin_create_authority_user(
    payload: AdminCreateAuthorityUser,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    require_admin(user)
    if payload.role not in AUTHORITY_ROLES:
        raise HTTPException(status_code=400, detail="Invalid authority role")

    email = normalize_email(payload.email)
    if not is_allowed_email(email):
        raise HTTPException(status_code=400, detail="Only @sbjit.edu.in email addresses are allowed")

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = User(
        name=payload.name,
        email=email,
        password_hash=hash_password(payload.password),
        auth_provider="email_password",
        role=payload.role,
        department=payload.department,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.get("/coordinator/authority-users", response_model=list[AdminUserOut])
def list_authority_users_for_institution_coordinator(
    q: str | None = Query(default=None),
    limit: int = Query(default=DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_admin_or_institution_coordinator(user)
    query = (
        db.query(User)
        .filter(User.role.in_(AUTHORITY_ROLES))
        .filter(User.is_active.is_(True))
    )
    if user.role == "institution_coordinator":
        query = query.filter(User.role.in_(["department_coordinator", "department_hod"]))
    if q and q.strip():
        search = f"%{q.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(User.name).like(search),
                func.lower(User.email).like(search),
                func.lower(User.role).like(search),
                func.lower(User.department).like(search),
                cast(User.id, String).ilike(f"%{q.strip()}%"),
            )
        )
    return query.order_by(User.id.desc()).offset(offset).limit(limit).all()


@router.delete("/coordinator/authority-users/{user_id}")
def deactivate_authority_user_for_institution_coordinator(
    user_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_admin_or_institution_coordinator(user)
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.role not in AUTHORITY_ROLES:
        raise HTTPException(status_code=400, detail="Selected user is not an authority user")
    if target.id == user.id:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")
    if user.role == "institution_coordinator" and target.role == "institution_coordinator":
        raise HTTPException(status_code=403, detail="Institution coordinator cannot deactivate another institution coordinator")
    if not target.is_active:
        return {"message": "Authority user already deactivated"}

    target.is_active = False
    target.deleted_at = datetime.utcnow()
    db.add(target)
    db.commit()
    return {"message": "Authority user deactivated. Record retained in database."}


@router.delete("/users/non-admin")
def admin_delete_all_non_admin_users(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    require_admin(user)
    targets = db.query(User).filter(User.role != "admin").all()
    if not targets:
        return {"message": "No non-admin users found", "deleted": 0}

    upload_refs: list[str] = []
    for target in targets:
        upload_refs.extend(_delete_user_with_related_data(db, target))

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    _delete_local_uploads(upload_refs)
    return {"message": "All non-admin users deleted", "deleted": len(targets)}


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

    upload_refs = _delete_user_with_related_data(db, target)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    _delete_local_uploads(upload_refs)
    return {"message": "User deleted"}

