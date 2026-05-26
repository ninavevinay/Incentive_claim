from datetime import datetime, timedelta
import secrets
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.core.email import send_email
from app.core.security import (
    create_access_token,
    generate_numeric_otp,
    hash_otp,
    hash_password,
    is_allowed_email,
    normalize_email,
    verify_password,
)
from app.models.email_otp import EmailOtp
from app.models.login_event import LoginEvent
from app.models.password_reset import PasswordResetRequest
from app.models.user import User
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    OtpRequestResponse,
    RequestOtpRequest,
    ResetPasswordRequest,
    TokenResponse,
    VerifyOtpRequest,
)

router = APIRouter(prefix="/auth", tags=["auth"])
AUTHORITY_ROLES = {"department_coordinator", "department_hod", "institution_coordinator"}
SELF_REGISTER_ROLES = {"student", "faculty"}
RESET_PASSWORD_PURPOSE = "reset_password"


def _issue_token_for_user(db: Session, user: User, request: Request) -> TokenResponse:
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "")[:255]
    db.add(
        LoginEvent(
            user_id=user.id,
            email=user.email,
            ip_address=client_ip,
            user_agent=user_agent,
        )
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token)


def _build_registration_otp_email(email: str, otp: str) -> tuple[str, str]:
    subject = "SBJIT NPTEL Reimburse registration OTP"
    text_body = (
        f"Hello,\n\n"
        f"Your OTP for SBJIT NPTEL Reimburse registration is: {otp}\n\n"
        f"This OTP will expire in {settings.otp_expire_minutes} minutes.\n"
        f"If you did not request this OTP, you can ignore this email.\n\n"
        f"Email: {email}\n"
        f"SBJIT NPTEL Reimburse Team"
    )
    return subject, text_body


def _build_password_reset_otp_email(email: str, otp: str) -> tuple[str, str]:
    subject = "SBJIT NPTEL Reimburse password reset OTP"
    text_body = (
        f"Hello,\n\n"
        f"Your OTP to reset your SBJIT NPTEL Reimburse password is: {otp}\n\n"
        f"This OTP will expire in {settings.otp_expire_minutes} minutes.\n"
        f"If you did not request password reset, you can ignore this email.\n\n"
        f"Email: {email}\n"
        f"SBJIT NPTEL Reimburse Team"
    )
    return subject, text_body


def _latest_pending_otp(db: Session, email: str, purpose: str) -> EmailOtp | None:
    return (
        db.query(EmailOtp)
        .filter(
            EmailOtp.email == email,
            EmailOtp.purpose == purpose,
            EmailOtp.used_at.is_(None),
        )
        .order_by(EmailOtp.created_at.desc())
        .first()
    )


def _latest_unused_password_reset_request(
    db: Session, user_id: int, email: str
) -> PasswordResetRequest | None:
    return (
        db.query(PasswordResetRequest)
        .filter(
            PasswordResetRequest.user_id == user_id,
            PasswordResetRequest.email == email,
            PasswordResetRequest.used_at.is_(None),
        )
        .order_by(PasswordResetRequest.created_at.desc())
        .first()
    )


def _mark_existing_pending_otps_as_used(
    db: Session, email: str, purpose: str, used_at: datetime
) -> None:
    db.query(EmailOtp).filter(
        EmailOtp.email == email,
        EmailOtp.purpose == purpose,
        EmailOtp.used_at.is_(None),
    ).update({EmailOtp.used_at: used_at}, synchronize_session=False)


def _validate_registration_request(payload: RequestOtpRequest, email: str, db: Session) -> dict:
    role = payload.role.strip().lower()
    name = payload.name.strip()
    department = payload.department.strip()

    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        if not existing_user.is_active:
            raise HTTPException(status_code=403, detail="Account is deactivated. Contact admin.")
        raise HTTPException(status_code=400, detail="Email already registered. Use login.")
    if role in AUTHORITY_ROLES:
        raise HTTPException(status_code=403, detail="Authority self-registration is disabled. Contact admin.")
    if role == "admin":
        if email not in settings.admin_email_allowlist:
            raise HTTPException(status_code=403, detail="Admin registration is restricted to allowlisted emails")
        department = "Administration"
    elif role not in SELF_REGISTER_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")

    return {
        "name": name,
        "role": role,
        "department": department,
        "password_hash": hash_password(payload.password),
    }


@router.post("/request-otp", response_model=OtpRequestResponse)
def request_otp(payload: RequestOtpRequest, request: Request, db: Session = Depends(get_db)):
    email = normalize_email(payload.email)
    purpose = payload.purpose
    if not is_allowed_email(email):
        raise HTTPException(status_code=400, detail=f"Only @{settings.allowed_email_domain} email addresses are allowed")

    now = datetime.utcnow()
    latest = _latest_pending_otp(db, email, purpose)
    if latest:
        resend_at = latest.created_at + timedelta(seconds=settings.otp_resend_seconds)
        if resend_at > now:
            wait_seconds = max(1, int((resend_at - now).total_seconds()))
            raise HTTPException(status_code=429, detail=f"Please wait {wait_seconds} seconds before requesting another OTP")

    otp_metadata = _validate_registration_request(payload, email, db)
    otp = generate_numeric_otp()
    expires_at = now + timedelta(minutes=settings.otp_expire_minutes)
    client_ip = request.client.host if request.client else "unknown"

    _mark_existing_pending_otps_as_used(db, email, purpose, now)

    record = EmailOtp(
        email=email,
        purpose=purpose,
        otp_hash=hash_otp(email, purpose, otp),
        password_hash=otp_metadata["password_hash"],
        name=otp_metadata["name"],
        role=otp_metadata["role"],
        department=otp_metadata["department"],
        user_id=None,
        request_ip=client_ip,
        expires_at=expires_at,
    )
    db.add(record)

    subject, text_body = _build_registration_otp_email(email, otp)
    try:
        send_email(email, subject, text_body)
    except RuntimeError as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to send OTP email") from exc

    db.commit()
    return OtpRequestResponse(
        message="OTP sent to your email",
        expires_in_seconds=settings.otp_expire_minutes * 60,
        resend_after_seconds=settings.otp_resend_seconds,
    )


@router.post("/verify-otp", response_model=TokenResponse)
def verify_otp(payload: VerifyOtpRequest, request: Request, db: Session = Depends(get_db)):
    email = normalize_email(payload.email)
    purpose = payload.purpose
    otp = payload.otp.strip()

    if not is_allowed_email(email):
        raise HTTPException(status_code=400, detail=f"Only @{settings.allowed_email_domain} email addresses are allowed")

    record = _latest_pending_otp(db, email, purpose)
    if not record:
        raise HTTPException(status_code=400, detail="OTP not found. Request a new OTP.")

    now = datetime.utcnow()
    if record.expires_at < now:
        record.used_at = now
        db.add(record)
        db.commit()
        raise HTTPException(status_code=400, detail="OTP expired. Request a new OTP.")

    if record.otp_hash != hash_otp(email, purpose, otp):
        raise HTTPException(status_code=400, detail="Invalid OTP")

    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        if not existing_user.is_active:
            raise HTTPException(status_code=403, detail="Account is deactivated. Contact admin.")
        raise HTTPException(status_code=400, detail="Email already registered. Use login.")

    role = (record.role or "").strip().lower()
    department = (record.department or "").strip()
    if role == "admin" and email not in settings.admin_email_allowlist:
        raise HTTPException(status_code=403, detail="Admin registration is restricted to allowlisted emails")
    if not record.password_hash:
        raise HTTPException(status_code=400, detail="Registration data is incomplete. Request a new OTP.")

    user = User(
        name=(record.name or email.split("@", 1)[0]).strip(),
        email=email,
        password_hash=record.password_hash,
        auth_provider="email_password",
        role=role,
        department=department,
    )
    db.add(user)
    db.flush()
    record.user_id = user.id
    record.used_at = now
    db.add(record)
    return _issue_token_for_user(db, user, request)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    email = normalize_email(payload.email)
    user = db.query(User).filter(User.email == email).first()
    if user and not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated. Contact admin.")
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return _issue_token_for_user(db, user, request)


@router.post("/register-authority", response_model=MessageResponse)
def register_authority():
    raise HTTPException(
        status_code=403,
        detail="Authority self-registration is disabled. Contact admin.",
    )


@router.post("/register", response_model=MessageResponse)
def register():
    raise HTTPException(status_code=410, detail="Direct registration is disabled. Request registration OTP first.")


@router.post("/forgot-password", response_model=OtpRequestResponse)
def forgot_password(payload: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)):
    email = normalize_email(payload.email)
    if not is_allowed_email(email):
        raise HTTPException(status_code=400, detail=f"Only @{settings.allowed_email_domain} email addresses are allowed")

    user = db.query(User).filter(User.email == email, User.is_active.is_(True)).first()
    if not user:
        return OtpRequestResponse(
            message="If the account exists, a password reset OTP has been sent.",
            expires_in_seconds=settings.otp_expire_minutes * 60,
            resend_after_seconds=settings.otp_resend_seconds,
        )

    now = datetime.utcnow()
    latest = _latest_pending_otp(db, email, RESET_PASSWORD_PURPOSE)
    if latest:
        resend_at = latest.created_at + timedelta(seconds=settings.otp_resend_seconds)
        if resend_at > now:
            wait_seconds = max(1, int((resend_at - now).total_seconds()))
            raise HTTPException(status_code=429, detail=f"Please wait {wait_seconds} seconds before requesting another OTP")

    otp = generate_numeric_otp()
    expires_at = now + timedelta(minutes=settings.otp_expire_minutes)
    client_ip = request.client.host if request.client else "unknown"

    _mark_existing_pending_otps_as_used(db, email, RESET_PASSWORD_PURPOSE, now)

    db.add(
        EmailOtp(
            email=email,
            purpose=RESET_PASSWORD_PURPOSE,
            otp_hash=hash_otp(email, RESET_PASSWORD_PURPOSE, otp),
            password_hash=None,
            name=None,
            role=None,
            department=None,
            user_id=user.id,
            request_ip=client_ip,
            expires_at=expires_at,
        )
    )
    db.add(
        PasswordResetRequest(
            user_id=user.id,
            email=email,
            token=secrets.token_urlsafe(24),
            request_ip=client_ip,
        )
    )

    subject, text_body = _build_password_reset_otp_email(email, otp)
    try:
        send_email(email, subject, text_body)
    except RuntimeError as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to send OTP email") from exc

    db.commit()
    return OtpRequestResponse(
        message="Password reset OTP sent to your email",
        expires_in_seconds=settings.otp_expire_minutes * 60,
        resend_after_seconds=settings.otp_resend_seconds,
    )


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    email = normalize_email(payload.email)
    otp = payload.otp.strip()
    new_password = payload.new_password

    if not is_allowed_email(email):
        raise HTTPException(status_code=400, detail=f"Only @{settings.allowed_email_domain} email addresses are allowed")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=400, detail="Account not found. Register first.")

    record = _latest_pending_otp(db, email, RESET_PASSWORD_PURPOSE)
    if not record:
        raise HTTPException(status_code=400, detail="OTP not found. Request a new reset OTP.")

    now = datetime.utcnow()
    if record.expires_at < now:
        record.used_at = now
        db.add(record)
        db.commit()
        raise HTTPException(status_code=400, detail="OTP expired. Request a new reset OTP.")

    if record.otp_hash != hash_otp(email, RESET_PASSWORD_PURPOSE, otp):
        raise HTTPException(status_code=400, detail="Invalid OTP")

    if verify_password(new_password, user.password_hash):
        raise HTTPException(status_code=400, detail="New password must be different from current password")

    user.password_hash = hash_password(new_password)
    user.auth_provider = "email_password"
    record.user_id = user.id
    record.used_at = now
    db.add(user)
    db.add(record)

    latest_request = _latest_unused_password_reset_request(db, user.id, email)
    if latest_request:
        latest_request.used_at = now
        db.add(latest_request)

    db.commit()
    return MessageResponse(message="Password reset successful. Please login with your new password.")
