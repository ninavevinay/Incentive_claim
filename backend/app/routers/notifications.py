from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.notification import Notification
from app.schemas.notification import NotificationOut
from app.routers.profile import get_current_user
from app.models.user import User

router = APIRouter(prefix="/notifications", tags=["notifications"])

@router.get("/", response_model=list[NotificationOut])
def list_notifications(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(Notification).filter(Notification.user_id == user.id).order_by(Notification.created_at.desc()).all()

@router.post("/{notification_id}/read")
def mark_read(notification_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    n = db.query(Notification).filter(Notification.id == notification_id, Notification.user_id == user.id).first()
    if not n:
        return {"ok": False}
    n.is_read = True
    db.commit()
    return {"ok": True}
