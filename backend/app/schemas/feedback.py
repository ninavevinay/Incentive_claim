from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field


class FeedbackCreate(BaseModel):
    benefit_status: Literal["beneficial", "partially_beneficial", "not_beneficial"] = "beneficial"
    message: str = Field(min_length=5, max_length=1500)
    rating: int | None = Field(default=None, ge=1, le=5)


class FeedbackOut(BaseModel):
    id: int
    user_id: int
    name: str
    email: str
    role: str
    department: str
    benefit_status: str
    message: str
    rating: int | None
    created_at: datetime

    class Config:
        from_attributes = True
