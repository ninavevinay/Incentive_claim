from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.redis import RedisManager
from app.core.security import (
    create_access_token,
    generate_numeric_otp,
    hash_otp,
    hash_password,
    is_allowed_email,
    normalize_email,
    verify_password,
)
from app.models.models import EmailOtp, LoginEvent, PasswordResetRequest, User, is_expired, portal_now
from app.schemas.schemas import RequestOtpSchema, VerifyOtpSchema
from app.services.notification_service import send_email_sync

AUTHORITY_ROLES = {"department_coordinator", "department_hod", "institution_coordinator"}
SELF_REGISTER_ROLES = {"student", "faculty"}


def get_client_ip(request) -> str:
    if hasattr(request, "headers"):
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
    if hasattr(request, "client") and request.client:
        return request.client.host
    return "unknown"


def get_user_agent(request) -> str:
    if hasattr(request, "headers"):
        return str(request.headers.get("user-agent") or "")[:255]
    return ""


async def request_registration_otp_service(db: Session, payload: RequestOtpSchema, request) -> dict:
    email = normalize_email(payload.email)
    if not is_allowed_email(email):
        domain = str(settings.ALLOWED_EMAIL_DOMAIN or "").strip()
        detail_msg = f"Registration is allowed only for @{domain} emails" if domain and domain != "*" else "Please provide a valid email address"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail_msg,
        )

    if await RedisManager.has_otp_cooldown(email, "register"):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="OTP recently requested. Please wait before requesting again.",
        )

    role = payload.role.strip().lower()
    name = payload.name.strip()
    department = payload.department.strip()

    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        if not existing_user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is deactivated. Contact admin.",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered. Use login.",
        )

    if role in AUTHORITY_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Authority self-registration is disabled. Contact admin.",
        )
    if role == "admin":
        if email not in settings.admin_allowlist:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin registration is restricted to allowlisted emails",
            )
        department = "Administration"
    elif role not in SELF_REGISTER_ROLES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role")

    otp = generate_numeric_otp()
    otp_h = hash_otp(email, "register", otp)
    now = portal_now()
    expires_at = now + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)

    # Invalidate older pending OTPs
    db.query(EmailOtp).filter(
        EmailOtp.email == email,
        EmailOtp.purpose == "register",
        EmailOtp.used_at == None,
    ).update({"used_at": now})

    new_otp_record = EmailOtp(
        email=email,
        purpose="register",
        otp_hash=otp_h,
        password_hash=hash_password(payload.password),
        name=name,
        role=role,
        department=department,
        request_ip=get_client_ip(request),
        created_at=now,
        expires_at=expires_at,
    )
    db.add(new_otp_record)
    db.commit()

    await RedisManager.set_otp_cooldown(email, "register", settings.OTP_RESEND_SECONDS)

    # Send email
    subject = "SBJIT NPTEL Reimburse registration OTP"
    body = (
        f"Hello,\n\n"
        f"Your OTP for SBJIT NPTEL Reimburse registration is: {otp}\n\n"
        f"This OTP will expire in {settings.OTP_EXPIRE_MINUTES} minutes.\n"
        f"If you did not request this OTP, you can ignore this email.\n\n"
        f"Email: {email}\n"
        f"SBJIT NPTEL Reimburse Team"
    )
    send_email_sync(email, subject, body)

    return {
        "message": f"OTP sent to {email}",
        "expires_in_seconds": settings.OTP_EXPIRE_MINUTES * 60,
        "resend_after_seconds": settings.OTP_RESEND_SECONDS,
    }


async def verify_registration_otp_service(db: Session, payload: VerifyOtpSchema, request) -> dict:
    email = normalize_email(payload.email)
    otp = str(payload.otp).strip()

    otp_record = (
        db.query(EmailOtp)
        .filter(
            EmailOtp.email == email,
            EmailOtp.purpose == "register",
            EmailOtp.used_at == None,
        )
        .order_by(EmailOtp.created_at.desc())
        .first()
    )

    if not otp_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP expired or invalid. Request a new OTP.",
        )

    now = portal_now()
    if is_expired(otp_record.expires_at, now):
        otp_record.used_at = now
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP expired. Request a new OTP.",
        )

    expected_hash = hash_otp(email, "register", otp)
    if otp_record.otp_hash != expected_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP",
        )

    otp_record.used_at = now

    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        db.commit()
        token = issue_token_for_user(db, existing_user, request)
        return {"access_token": token, "token_type": "bearer"}

    new_user = User(
        name=otp_record.name,
        email=email,
        password_hash=otp_record.password_hash,
        auth_provider="local",
        role=otp_record.role,
        department=otp_record.department,
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = issue_token_for_user(db, new_user, request)
    return {"access_token": token, "token_type": "bearer"}


def login_service(db: Session, email_raw: str, password_raw: str, request) -> dict:
    email = normalize_email(email_raw)
    user = db.query(User).filter(User.email == email).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Contact admin.",
        )

    if not verify_password(password_raw, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = issue_token_for_user(db, user, request)
    return {"access_token": token, "token_type": "bearer"}


def issue_token_for_user(db: Session, user: User, request) -> str:
    ev = LoginEvent(
        user_id=user.id,
        email=user.email,
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
        created_at=portal_now(),
    )
    db.add(ev)
    db.commit()
    return create_access_token(str(user.id))
