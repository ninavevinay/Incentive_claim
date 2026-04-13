from typing import Literal
from pydantic import BaseModel, EmailStr, Field


class RequestOtpRequest(BaseModel):
    email: EmailStr
    purpose: Literal["register"]
    name: str = Field(min_length=2, max_length=120)
    password: str = Field(min_length=6, max_length=128)
    role: str = Field(max_length=64)
    department: str = Field(min_length=1, max_length=120)


class VerifyOtpRequest(BaseModel):
    email: EmailStr
    otp: str = Field(min_length=4, max_length=10)
    purpose: Literal["register"]


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str = Field(min_length=4, max_length=10)
    new_password: str = Field(min_length=6, max_length=128)


class OtpRequestResponse(BaseModel):
    message: str
    expires_in_seconds: int
    resend_after_seconds: int


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MessageResponse(BaseModel):
    message: str
