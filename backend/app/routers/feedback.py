from __future__ import annotations

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import Feedback, User
from app.routers.deps import get_current_user
from app.schemas.schemas import FeedbackCreateSchema, FeedbackOut
from app.services.cache_service import CacheService

router = APIRouter(prefix="/feedback", tags=["Feedback"])


@router.post("/", response_model=FeedbackOut)
async def submit_feedback(
    payload: FeedbackCreateSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = db.query(Feedback).filter(Feedback.user_id == current_user.id).first()
    if existing:
        existing.benefit_status = payload.benefit_status
        existing.message = payload.message
        existing.rating = payload.rating
        db.commit()
        db.refresh(existing)
        await CacheService.invalidate_feedback_report()
        return FeedbackOut.from_orm_model(existing)

    fb = Feedback(
        user_id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        role=current_user.role,
        department=current_user.department,
        benefit_status=payload.benefit_status,
        message=payload.message,
        rating=payload.rating,
    )
    db.add(fb)
    db.commit()
    db.refresh(fb)
    await CacheService.invalidate_feedback_report()
    return FeedbackOut.from_orm_model(fb)


@router.get("/mine", response_model=Optional[FeedbackOut])
def my_feedback(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    fb = db.query(Feedback).filter(Feedback.user_id == current_user.id).first()
    if not fb:
        return None
    return FeedbackOut.from_orm_model(fb)


@router.get("/report")
async def feedback_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cached = await CacheService.get_feedback_report()
    if cached:
        return cached

    feedbacks = db.query(Feedback).all()
    total = len(feedbacks)
    beneficial_count = sum(1 for f in feedbacks if f.benefit_status == "beneficial")
    partially_count = sum(1 for f in feedbacks if f.benefit_status == "partially_beneficial")
    not_count = sum(1 for f in feedbacks if f.benefit_status == "not_beneficial")

    ratings = [f.rating for f in feedbacks if f.rating is not None]
    avg_rating = round(sum(ratings) / len(ratings), 2) if ratings else 0.0

    data = {
        "total_feedbacks": total,
        "beneficial_count": beneficial_count,
        "partially_beneficial_count": partially_count,
        "not_beneficial_count": not_count,
        "average_rating": avg_rating,
    }
    await CacheService.set_feedback_report(data)
    return data
