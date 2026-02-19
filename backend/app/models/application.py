from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, JSON, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

class Application(Base):
    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    application_type: Mapped[str] = mapped_column(String(20))
    # Keep this wide enough for workflow statuses like pending_institution_coordinator.
    status: Mapped[str] = mapped_column(String(64), default="submitted")
    approved_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    data: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="applications")
