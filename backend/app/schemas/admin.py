from datetime import datetime, date
from pydantic import BaseModel, EmailStr, Field


class AdminUserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str
    department: str

    class Config:
        from_attributes = True

class LoginEventOut(BaseModel):
    id: int
    user_id: int
    email: EmailStr
    ip_address: str
    user_agent: str
    created_at: datetime

    class Config:
        from_attributes = True

class PasswordResetOut(BaseModel):
    id: int
    user_id: int
    email: EmailStr
    token: str
    request_ip: str
    created_at: datetime
    used_at: datetime | None = None

    class Config:
        from_attributes = True

class AdminPasswordUpdate(BaseModel):
    user_id: int
    new_password: str


class AdminCreateAuthorityUser(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    role: str = Field(max_length=64)
    department: str = Field(min_length=1, max_length=120)


class AdminFormWindowOut(BaseModel):
    start_date: date | None
    end_date: date | None


class AdminFormWindowUpdate(BaseModel):
    start_date: date
    end_date: date


class AdminFeedbackOut(BaseModel):
    id: int
    user_id: int
    name: str
    email: EmailStr
    role: str
    department: str
    benefit_status: str
    message: str
    rating: int | None
    created_at: datetime

    class Config:
        from_attributes = True
