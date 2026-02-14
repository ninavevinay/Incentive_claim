from datetime import datetime
from pydantic import BaseModel, EmailStr

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
