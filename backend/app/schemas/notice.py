from datetime import datetime
from pydantic import BaseModel


class NoticeOut(BaseModel):
    id: int
    title: str
    file_path: str
    created_at: datetime

    class Config:
        from_attributes = True
