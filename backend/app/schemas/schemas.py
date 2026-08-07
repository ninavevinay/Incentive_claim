from __future__ import annotations

from datetime import date, datetime
import re
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


def slugify_department(department: Optional[str]) -> str:
    value = (department or "").strip().lower().replace("&", " and ")
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def dashboard_path_for_user(role: str, department: Optional[str]) -> str:
    if role == "student":
        return "/student"
    if role == "faculty":
        return "/faculty"
    if role == "institution_coordinator":
        return "/authority/institution-coordinator"
    if role == "admin":
        return "/admin"

    department_slug = slugify_department(department)
    if role == "department_coordinator":
        return (
            f"/authority/department-coordinator/{department_slug}"
            if department_slug
            else "/authority/department-coordinator"
        )
    if role == "department_hod":
        return (
            f"/authority/department-hod/{department_slug}"
            if department_slug
            else "/authority/department-hod"
        )
    return "/login"


def portal_datetime_iso(dt: Optional[datetime]) -> Optional[str]:
    if not dt:
        return None
    return dt.isoformat()


# Common
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MessageResponse(BaseModel):
    message: str


class OtpRequestResponse(BaseModel):
    message: str
    expires_in_seconds: int
    resend_after_seconds: int


class RequestOtpSchema(BaseModel):
    email: EmailStr
    purpose: str = "register"
    name: str = Field(..., min_length=2, max_length=120)
    password: str = Field(..., min_length=6, max_length=128)
    role: str = Field(..., max_length=64)
    department: str = Field(..., min_length=1, max_length=120)


class VerifyOtpSchema(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=4, max_length=10)
    purpose: str = "register"


class LoginSchema(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class ForgotPasswordSchema(BaseModel):
    email: EmailStr


class ResetPasswordSchema(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=4, max_length=10)
    new_password: str = Field(..., min_length=6, max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    role: str
    department: str
    department_slug: Optional[str] = None
    dashboard_path: Optional[str] = None

    @classmethod
    def from_orm_model(cls, user: Any) -> UserOut:
        dept = getattr(user, "department", None)
        role = getattr(user, "role", "")
        return cls(
            id=user.id,
            name=user.name,
            email=user.email,
            role=role,
            department=dept or "",
            department_slug=slugify_department(dept),
            dashboard_path=dashboard_path_for_user(role, dept),
        )


class UserUpdateSchema(BaseModel):
    name: Optional[str] = Field(None, max_length=120)
    department: Optional[str] = Field(None, max_length=120)


class ApplicationReviewSchema(BaseModel):
    action: str = Field(..., pattern="^(approve|reject)$")
    remark: Optional[str] = Field(None, max_length=500)
    approved_amount: Optional[float] = None


class ApplicationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    application_type: str
    status: str
    approved_amount: Optional[float] = None
    data: Dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[str] = None

    @classmethod
    def from_orm_model(cls, app: Any) -> ApplicationOut:
        data = dict(app.data or {})
        if not data.get("applicant_photo") and data.get("photograph_file"):
            data["applicant_photo"] = data["photograph_file"]

        created_str = portal_datetime_iso(app.created_at) if hasattr(app, "created_at") else None
        return cls(
            id=app.id,
            application_type=app.application_type,
            status=app.status,
            approved_amount=app.approved_amount,
            data=data,
            created_at=created_str,
        )


class PublicApprovedHighlightOut(BaseModel):
    id: int
    application_type: str
    applicant_name: str
    course_category: str
    percentage: str
    photograph_file: str
    created_at: Optional[str] = None


class AdminUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    role: str
    department: str
    is_active: bool

    @classmethod
    def from_orm_model(cls, user: Any) -> AdminUserOut:
        is_act = getattr(user, "is_active", True)
        return cls(
            id=user.id,
            name=user.name or "",
            email=user.email or "",
            role=user.role or "",
            department=getattr(user, "department", "") or "",
            is_active=True if is_act is None else bool(is_act),
        )


class LoginEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    email: str
    ip_address: str
    user_agent: str
    created_at: Optional[str] = None

    @classmethod
    def from_orm_model(cls, ev: Any) -> LoginEventOut:
        return cls(
            id=ev.id,
            user_id=ev.user_id,
            email=ev.email,
            ip_address=ev.ip_address,
            user_agent=ev.user_agent,
            created_at=portal_datetime_iso(ev.created_at),
        )


class PasswordResetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    email: str
    token: str
    request_ip: str
    created_at: Optional[str] = None
    used_at: Optional[str] = None

    @classmethod
    def from_orm_model(cls, r: Any) -> PasswordResetOut:
        return cls(
            id=r.id,
            user_id=r.user_id,
            email=r.email,
            token=r.token,
            request_ip=r.request_ip,
            created_at=portal_datetime_iso(r.created_at),
            used_at=portal_datetime_iso(r.used_at) if getattr(r, "used_at", None) else None,
        )


class AdminCreateAuthorityUserSchema(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    role: str = Field(..., max_length=64)
    department: str = Field(..., min_length=1, max_length=120)


class AdminFormWindowOut(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class AdminFormWindowUpdateSchema(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class FeedbackCreateSchema(BaseModel):
    benefit_status: str = Field("beneficial", pattern="^(beneficial|partially_beneficial|not_beneficial)$")
    message: str = Field(..., min_length=5, max_length=1500)
    rating: Optional[int] = Field(None, ge=1, le=5)


class FeedbackOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    name: str
    email: str
    role: str
    department: str
    benefit_status: str
    message: str
    rating: Optional[int] = None
    created_at: Optional[str] = None

    @classmethod
    def from_orm_model(cls, fb: Any) -> FeedbackOut:
        return cls(
            id=fb.id,
            user_id=fb.user_id,
            name=fb.name,
            email=fb.email,
            role=fb.role,
            department=fb.department,
            benefit_status=fb.benefit_status,
            message=fb.message,
            rating=fb.rating,
            created_at=portal_datetime_iso(fb.created_at),
        )


class NoticeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    file_path: str
    created_at: Optional[str] = None

    @classmethod
    def from_orm_model(cls, n: Any) -> NoticeOut:
        return cls(
            id=n.id,
            title=n.title,
            file_path=n.file_path,
            created_at=portal_datetime_iso(n.created_at),
        )


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    message: str
    is_read: bool
    created_at: Optional[str] = None

    @classmethod
    def from_orm_model(cls, n: Any) -> NotificationOut:
        return cls(
            id=n.id,
            message=n.message,
            is_read=n.is_read,
            created_at=portal_datetime_iso(n.created_at),
        )
