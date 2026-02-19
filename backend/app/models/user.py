from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(64))
    department: Mapped[str] = mapped_column(String(120))

    applications = relationship("Application", back_populates="owner")
    notifications = relationship("Notification", back_populates="user")
    login_events = relationship("LoginEvent")
    password_reset_requests = relationship("PasswordResetRequest")
