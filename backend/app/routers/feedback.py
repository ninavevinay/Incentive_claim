from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.feedback import Feedback
from app.models.user import User
from app.routers.profile import get_current_user
from app.schemas.feedback import FeedbackCreate, FeedbackOut

router = APIRouter(prefix="/feedback", tags=["feedback"])


@router.post("/", response_model=FeedbackOut)
def create_feedback(
    payload: FeedbackCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if user.role == "admin":
        raise HTTPException(status_code=403, detail="Admins cannot submit feedback from this endpoint")

    existing = db.query(Feedback).filter(Feedback.user_id == user.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Feedback can only be submitted once")

    feedback = Feedback(
        user_id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        department=user.department,
        benefit_status=payload.benefit_status,
        message=payload.message.strip(),
        rating=payload.rating,
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return feedback


@router.get("/mine", response_model=list[FeedbackOut])
def my_feedback(
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    return (
        db.query(Feedback)
        .filter(Feedback.user_id == user.id)
        .order_by(Feedback.created_at.desc())
        .limit(limit)
        .all()
    )
