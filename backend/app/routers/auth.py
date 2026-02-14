from fastapi import APIRouter, Depends, HTTPException, Request
from datetime import datetime, timedelta
import uuid
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.models.user import User
from app.models.login_event import LoginEvent
from app.models.password_reset import PasswordResetRequest
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    MessageResponse
)

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=TokenResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    allowed_roles = {
        "student",
        "faculty",
        "admin",
    }
    if payload.role not in allowed_roles:
        raise HTTPException(status_code=400, detail="Invalid role")
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        department=payload.department,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token)

@router.post("/register-authority", response_model=TokenResponse)
def register_authority(payload: RegisterRequest, db: Session = Depends(get_db)):
    allowed_roles = {
        "department_coordinator",
        "department_hod",
        "institution_coordinator"
    }
    if payload.role not in allowed_roles:
        raise HTTPException(status_code=400, detail="Invalid authority role")
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        department=payload.department,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token)

@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    client_ip = request.client.host if request.client else ""
    user_agent = request.headers.get("user-agent", "")
    db.add(LoginEvent(
        user_id=user.id,
        email=user.email,
        ip_address=client_ip,
        user_agent=user_agent[:255]
    ))
    db.commit()
    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token)

@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password(payload: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        return MessageResponse(message="If the account exists, a reset was requested.")
    token = uuid.uuid4().hex
    client_ip = request.client.host if request.client else ""
    db.add(PasswordResetRequest(
        user_id=user.id,
        email=user.email,
        token=token,
        request_ip=client_ip
    ))
    db.commit()
    return MessageResponse(message="If the account exists, a reset was requested.")

@router.post("/reset-password", response_model=MessageResponse)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    record = db.query(PasswordResetRequest).filter(PasswordResetRequest.token == payload.token).first()
    if not record:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    if record.used_at is not None:
        raise HTTPException(status_code=400, detail="Token already used")
    if datetime.utcnow() - record.created_at > timedelta(hours=2):
        raise HTTPException(status_code=400, detail="Token expired")
    user = db.query(User).filter(User.id == record.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.password_hash = hash_password(payload.new_password)
    record.used_at = datetime.utcnow()
    db.add(user)
    db.add(record)
    db.commit()
    return MessageResponse(message="Password updated")
