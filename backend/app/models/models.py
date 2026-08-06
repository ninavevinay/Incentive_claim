from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional, Dict

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


def portal_now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(120), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    google_sub = Column(String(255), unique=True, nullable=True)
    auth_provider = Column(String(32), default="local", nullable=False)
    role = Column(String(64), nullable=False)
    department = Column(String(120), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    deleted_at = Column(DateTime, nullable=True)

    applications = relationship("Application", back_populates="owner", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    notices = relationship("Notice", back_populates="creator", cascade="all, delete-orphan")
    login_events = relationship("LoginEvent", back_populates="user", cascade="all, delete-orphan")
    feedback = relationship("Feedback", back_populates="user", uselist=False, cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_users_role_dept", "role", "department"),
    )


class Application(Base):
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    application_type = Column(String(64), nullable=False)
    status = Column(String(64), default="submitted", nullable=False)
    approved_amount = Column(Float, nullable=True)
    data = Column(JSON, default=dict, nullable=False)
    created_at = Column(DateTime, default=portal_now, nullable=False)

    owner = relationship("User", back_populates="applications")

    __table_args__ = (
        Index("ix_app_owner_created", "owner_id", created_at.desc()),
        Index("ix_app_status_created", "status", created_at.desc()),
        Index("ix_app_type_created", "application_type", created_at.desc()),
        Index("ix_app_created_at", created_at.desc()),
    )


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    message = Column(String(255), nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=portal_now, nullable=False)

    user = relationship("User", back_populates="notifications")

    __table_args__ = (
        Index("ix_notif_user_created", "user_id", created_at.desc()),
    )


class Notice(Base):
    __tablename__ = "notices"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=portal_now, nullable=False)

    creator = relationship("User", back_populates="notices")


class LoginEvent(Base):
    __tablename__ = "login_events"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    email = Column(String(255), nullable=False)
    ip_address = Column(String(64), nullable=False)
    user_agent = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=portal_now, nullable=False)

    user = relationship("User", back_populates="login_events")

    __table_args__ = (
        Index("ix_login_user_created", "user_id", created_at.desc()),
    )


class EmailOtp(Base):
    __tablename__ = "email_otps"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String(255), nullable=False)
    purpose = Column(String(32), nullable=False)
    otp_hash = Column(String(128), nullable=False)
    password_hash = Column(String(255), nullable=True)
    name = Column(String(120), nullable=True)
    role = Column(String(64), nullable=True)
    department = Column(String(120), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    request_ip = Column(String(64), nullable=False)
    created_at = Column(DateTime, default=portal_now, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)

    __table_args__ = (
        Index("ix_otp_email", "email"),
        Index("ix_otp_email_purpose_crt", "email", "purpose", created_at.desc()),
    )


class PasswordResetRequest(Base):
    __tablename__ = "password_reset_requests"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    email = Column(String(255), nullable=False)
    token = Column(String(128), unique=True, nullable=False)
    request_ip = Column(String(64), nullable=False)
    created_at = Column(DateTime, default=portal_now, nullable=False)
    used_at = Column(DateTime, nullable=True)

    __table_args__ = (
        Index("ix_pr_email", "email"),
        Index("ix_pr_user_created", "user_id", created_at.desc()),
    )


class FormWindow(Base):
    __tablename__ = "form_windows"

    id = Column(Integer, primary_key=True, default=1)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    updated_at = Column(DateTime, default=portal_now, nullable=False)


class Feedback(Base):
    __tablename__ = "feedbacks"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    name = Column(String(120), nullable=False)
    email = Column(String(255), nullable=False)
    role = Column(String(64), nullable=False)
    department = Column(String(120), nullable=False)
    benefit_status = Column(String(32), default="beneficial", nullable=False)
    message = Column(String(1500), nullable=False)
    rating = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=portal_now, nullable=False)

    user = relationship("User", back_populates="feedback")

    __table_args__ = (
        Index("ix_fb_created_at", created_at.desc()),
    )
