from datetime import date, datetime
from sqlalchemy import Date, DateTime, Integer
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class FormWindow(Base):
    __tablename__ = "form_windows"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
