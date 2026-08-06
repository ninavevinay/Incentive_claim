from __future__ import annotations

from typing import List, Optional
from fastapi import APIRouter, Depends, Form, HTTPException, File, UploadFile, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from app.core.database import get_db
from app.models.models import Application, User
from app.routers.deps import get_current_user
from app.schemas.schemas import (
    ApplicationOut,
    ApplicationReviewSchema,
    PublicApprovedHighlightOut,
)
from app.services.cache_service import CacheService
from app.services.workflow_service import (
    AUTHORITY_ROLES,
    create_faculty_application_service,
    create_student_application_service,
    norm,
    public_approved_highlights_service,
    review_application_submission_service,
)

router = APIRouter(prefix="/applications", tags=["Applications"])


@router.post("/student", response_model=ApplicationOut)
async def submit_student_application(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    form_data = dict(await request.form())
    files_data = {k: v for k, v in form_data.items() if hasattr(v, "filename")}
    clean_form_data = {k: v for k, v in form_data.items() if not hasattr(v, "filename")}

    app = await create_student_application_service(db, current_user, clean_form_data, files_data)
    await CacheService.invalidate_highlights()
    return ApplicationOut.from_orm_model(app)


@router.post("/faculty", response_model=ApplicationOut)
async def submit_faculty_application(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    form_data = dict(await request.form())
    files_data = {k: v for k, v in form_data.items() if hasattr(v, "filename")}
    clean_form_data = {k: v for k, v in form_data.items() if not hasattr(v, "filename")}

    app = await create_faculty_application_service(db, current_user, clean_form_data, files_data)
    await CacheService.invalidate_highlights()
    return ApplicationOut.from_orm_model(app)


@router.get("/public-approved-highlights", response_model=List[PublicApprovedHighlightOut])
async def public_approved_highlights(limit: int = 10, db: Session = Depends(get_db)):
    cached = await CacheService.get_public_highlights()
    if cached:
        return cached

    res = public_approved_highlights_service(db, limit=limit)
    await CacheService.set_public_highlights(res)
    return res


@router.get("/mine", response_model=List[ApplicationOut])
def my_applications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    apps = (
        db.query(Application)
        .filter(Application.owner_id == current_user.id)
        .order_by(Application.created_at.desc())
        .all()
    )
    return [ApplicationOut.from_orm_model(app) for app in apps]


@router.get("/track/{application_id}", response_model=ApplicationOut)
def track_application(
    application_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    if current_user.role not in AUTHORITY_ROLES and current_user.role != "admin" and app.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to track this application")

    return ApplicationOut.from_orm_model(app)


@router.get("/pending", response_model=List[ApplicationOut])
def pending_applications(
    department: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    role = current_user.role
    if role not in AUTHORITY_ROLES and role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    expected_status = {
        "department_coordinator": "pending_department_coordinator",
        "department_hod": "pending_department_hod",
        "institution_coordinator": "pending_institution_coordinator",
        "admin": None,
    }.get(role)

    query = db.query(Application)
    if expected_status:
        query = query.filter(Application.status == expected_status)

    target_dept = department or current_user.department
    if role in {"department_coordinator", "department_hod"}:
        if norm(target_dept) != norm(current_user.department):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this department")

    apps = query.order_by(Application.created_at.desc()).all()
    if target_dept and role in {"department_coordinator", "department_hod"}:
        apps = [a for a in apps if norm((a.data or {}).get("department")) == norm(target_dept)]

    return [ApplicationOut.from_orm_model(app) for app in apps]


@router.get("/all", response_model=List[ApplicationOut])
def all_applications(
    department: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    role = current_user.role
    if role not in AUTHORITY_ROLES and role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    target_dept = department or (current_user.department if role in {"department_coordinator", "department_hod"} else None)
    apps = db.query(Application).order_by(Application.created_at.desc()).all()

    if target_dept:
        apps = [a for a in apps if norm((a.data or {}).get("department")) == norm(target_dept)]

    return [ApplicationOut.from_orm_model(app) for app in apps]


@router.get("/my-reviewed", response_model=List[ApplicationOut])
def my_reviewed_applications(
    action: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in AUTHORITY_ROLES and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    apps = db.query(Application).order_by(Application.created_at.desc()).all()
    reviewed = []
    for app in apps:
        reviews = (app.data or {}).get("reviews") or []
        for r in reviews:
            if r.get("reviewer_id") == current_user.id:
                if not action or r.get("action") == action:
                    reviewed.append(app)
                    break
    return [ApplicationOut.from_orm_model(app) for app in reviewed]


@router.get("/role-reviewed", response_model=List[ApplicationOut])
def role_reviewed_applications(
    action: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in AUTHORITY_ROLES and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    apps = db.query(Application).order_by(Application.created_at.desc()).all()
    reviewed = []
    for app in apps:
        reviews = (app.data or {}).get("reviews") or []
        for r in reviews:
            if r.get("role") == current_user.role:
                if not action or r.get("action") == action:
                    reviewed.append(app)
                    break
    return [ApplicationOut.from_orm_model(app) for app in reviewed]


@router.post("/{application_id}/review", response_model=ApplicationOut)
async def review_application(
    application_id: int,
    payload: ApplicationReviewSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    app = review_application_submission_service(
        db,
        application_id,
        current_user,
        payload.action,
        payload.remark,
        payload.approved_amount,
    )
    await CacheService.invalidate_highlights()
    return ApplicationOut.from_orm_model(app)
