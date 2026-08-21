from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import hash_password, is_allowed_email, normalize_email
from app.models.models import EmailOtp, PasswordResetRequest, User, is_expired, portal_now
from app.schemas.schemas import (
    ForgotPasswordSchema,
    LoginSchema,
    MessageResponse,
    OtpRequestResponse,
    RequestOtpSchema,
    ResetPasswordSchema,
    TokenResponse,
    VerifyOtpSchema,
)
from app.services.auth_service import (
    login_service,
    request_registration_otp_service,
    verify_registration_otp_service,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/request-otp", response_model=OtpRequestResponse)
async def request_otp(payload: RequestOtpSchema, request: Request, db: Session = Depends(get_db)):
    res = await request_registration_otp_service(db, payload, request)
    return res


@router.post("/verify-otp", response_model=TokenResponse)
async def verify_otp(payload: VerifyOtpSchema, request: Request, db: Session = Depends(get_db)):
    res = await verify_registration_otp_service(db, payload, request)
    return res


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginSchema, request: Request, db: Session = Depends(get_db)):
    return login_service(db, payload.email, payload.password, request)


@router.post("/register", response_model=OtpRequestResponse)
async def register(payload: RequestOtpSchema, request: Request, db: Session = Depends(get_db)):
    res = await request_registration_otp_service(db, payload, request)
    return res


@router.post("/register-authority", response_model=MessageResponse)
def register_authority():
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Authority self-registration is disabled. Contact admin.",
    )


@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password(payload: ForgotPasswordSchema, request: Request, db: Session = Depends(get_db)):
    email = normalize_email(payload.email)
    user = db.query(User).filter(User.email == email, User.is_active == True).first()
    if not user:
        return {"message": "If the account exists, a password reset OTP has been sent."}

    # Generate reset OTP
    from app.core.security import generate_numeric_otp, hash_otp
    from app.core.config import settings
    from datetime import timedelta
    from app.services.notification_service import send_email_sync

    otp = generate_numeric_otp()
    now = portal_now()
    expires_at = now + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)
    otp_h = hash_otp(email, "reset_password", otp)

    db.query(EmailOtp).filter(
        EmailOtp.email == email,
        EmailOtp.purpose == "reset_password",
        EmailOtp.used_at == None,
    ).update({"used_at": now})

    new_otp = EmailOtp(
        email=email,
        purpose="reset_password",
        otp_hash=otp_h,
        user_id=user.id,
        request_ip=request.client.host if request.client else "unknown",
        created_at=now,
        expires_at=expires_at,
    )
    db.add(new_otp)
    db.commit()

    subject = "SBJIT NPTEL Reimburse password reset OTP"
    body = (
        f"Hello,\n\n"
        f"Your OTP to reset your SBJIT NPTEL Reimburse password is: {otp}\n\n"
        f"This OTP will expire in {settings.OTP_EXPIRE_MINUTES} minutes.\n"
        f"Email: {email}\n"
        f"SBJIT NPTEL Reimburse Team"
    )
    send_email_sync(email, subject, body)

    return {"message": "Password reset OTP sent to your email."}


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(payload: ResetPasswordSchema, db: Session = Depends(get_db)):
    email = normalize_email(payload.email)
    otp = str(payload.otp).strip()

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Account not found.")

    otp_record = (
        db.query(EmailOtp)
        .filter(EmailOtp.email == email, EmailOtp.purpose == "reset_password", EmailOtp.used_at == None)
        .order_by(EmailOtp.created_at.desc())
        .first()
    )

    if not otp_record:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OTP not found or expired.")

    now = portal_now()
    if is_expired(otp_record.expires_at, now):
        otp_record.used_at = now
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OTP expired.")

    from app.core.security import hash_otp
    if otp_record.otp_hash != hash_otp(email, "reset_password", otp):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OTP.")

    user.password_hash = hash_password(payload.new_password)
    user.auth_provider = "email_password"
    otp_record.used_at = now
    db.commit()

    return {"message": "Password reset successful. Please login with your new password."}
