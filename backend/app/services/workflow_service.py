from __future__ import annotations

import logging
import re
from typing import Any, Callable, Dict, List, Optional, Tuple, Set

from fastapi import HTTPException, status
from sqlalchemy import or_, func, cast, String
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.models import (
    Application,
    EmailOtp,
    Feedback,
    FormWindow,
    LoginEvent,
    Notice,
    Notification,
    PasswordResetRequest,
    User,
    portal_now,
)
from app.services.notification_service import dispatch_portal_notification
from app.services.storage_service import (
    PHOTO_UPLOAD_CONTENT_TYPES,
    PHOTO_UPLOAD_EXTENSIONS,
    SIGNATURE_UPLOAD_CONTENT_TYPES,
    SIGNATURE_UPLOAD_EXTENSIONS,
    delete_local_uploads,
    save_photograph_upload,
    save_upload,
)

logger = logging.getLogger("api.workflow")

AUTHORITY_ROLES = {"department_coordinator", "department_hod", "institution_coordinator"}
SELF_REGISTER_ROLES = {"student", "faculty"}

ROLE_LABELS = {
    "department_coordinator": "Department Coordinator",
    "department_hod": "Department HOD",
    "institution_coordinator": "Institution Coordinator",
}

STATUS_LABELS = {
    "pending_department_coordinator": "Pending Department Coordinator review",
    "pending_department_hod": "Pending Department HOD review",
    "pending_institution_coordinator": "Pending Institution Coordinator review",
    "approved": "Approved",
    "rejected": "Rejected",
}

COURSE_CATEGORY_OPTIONS = (
    "ELITE",
    "ELITE + SILVER",
    "ELITE + GOLD",
    "ELITE + SILVER + TOP 5%",
    "ELITE + SILVER + TOP 2%",
    "ELITE + SILVER + TOP 1%",
    "ELITE + GOLD + TOP 5%",
    "ELITE + GOLD + TOP 2%",
    "ELITE + GOLD + TOP 1%",
    "NPTEL SUPER STAR",
    "NPTEL DISCIPLINE STAR",
    "NPTEL DOMAIN SCHOLAR",
    "NPTEL BELIEVER",
    "NPTEL ENTHUSIAST",
    "NPTEL MOTIVATED LEARNER",
    "NPTEL EVANGELIST",
    "NPTEL MEGASTARS",
    "NPTEL CHAMPIONS",
    "NPTEL TOP PERFORMING MENTOR",
)
NPTEL_STAR_CATEGORIES = set(COURSE_CATEGORY_OPTIONS[9:])
ALLOWED_COURSE_CATEGORIES = set(COURSE_CATEGORY_OPTIONS)
ALLOWED_ACADEMIC_YEAR_TYPES = {"ODD", "EVEN"}
APPLICATION_UPLOAD_FIELDS = (
    "fee_receipt_file",
    "certificate_file",
    "bank_passbook_file",
    "photograph_file",
    "signature_file",
)


def role_label(role: str) -> str:
    return ROLE_LABELS.get(role, role.replace("_", " ").title())


def status_label(status_str: str) -> str:
    return STATUS_LABELS.get(status_str, status_str.replace("_", " ").title())


def norm(value: Optional[str]) -> str:
    return str(value or "").strip().lower()


def upper_text(value: Optional[str]) -> str:
    return str(value or "").strip().upper()


def required_upper_text(field_label: str, value: Optional[str]) -> str:
    text = upper_text(value)
    if not text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{field_label} is required")
    return text


def required_academic_year(value: Optional[str]) -> str:
    academic_year = re.sub(r"\s+", " ", str(value or "").strip())
    if not academic_year:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Academic year is required")
    match = re.fullmatch(r"(\d{4})\s*[-/\u2013\u2014]\s*(\d{4})", academic_year)
    if not match:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Academic year must be in YYYY - YYYY format")
    return f"{match.group(1)} - {match.group(2)}"


def required_category(value: Optional[str]) -> str:
    category = re.sub(r"\s+", " ", required_upper_text("Course category", value))
    if category not in ALLOWED_COURSE_CATEGORIES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid course category selected")
    return category


def required_academic_year_type(value: Optional[str]) -> str:
    academic_year_type = required_upper_text("Academic year type", value)
    if academic_year_type not in ALLOWED_ACADEMIC_YEAR_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Academic year type must be ODD or EVEN")
    return academic_year_type


def normalize_percentage(value: Optional[str]) -> str:
    text = str(value or "").strip()
    if not text:
        return "-"
    if text.endswith("%"):
        return text
    return f"{text}%"


def enforce_form_window_open(db: Session) -> None:
    window = db.query(FormWindow).filter(FormWindow.id == 1).first()
    if not window or window.start_date is None or window.end_date is None:
        return
    today = portal_now().date()
    if today < window.start_date or today > window.end_date:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Form filling is open only from {window.start_date.isoformat()} to {window.end_date.isoformat()}",
        )


def reviewers_for_stage(db: Session, role: str, department: Optional[str]) -> List[User]:
    query = db.query(User).filter(User.role == role, User.is_active == True)
    if role in {"department_coordinator", "department_hod"}:
        query = query.filter(func.lower(User.department) == func.lower(department or ""))
    return query.order_by(User.id).all()


def queue_review_alerts(db: Session, reviewers: List[User], app: Application) -> None:
    for reviewer in reviewers:
        dispatch_portal_notification(
            db,
            user_id=reviewer.id,
            message=f"Application ID {app.id} awaits your review",
        )


async def normalize_upload_payload(
    applicant_name: str,
    form_data: dict,
    files_data: dict,
    *,
    include_bank_passbook: bool,
    include_designation: bool,
) -> dict:
    department = required_upper_text("Department", form_data.get("department"))
    applicant_name = required_upper_text("Applicant name", form_data.get("applicant_name") or applicant_name)
    mobile_number = required_upper_text("Mobile number", form_data.get("mobile_number"))
    academic_year = required_academic_year(form_data.get("academic_year"))
    academic_year_type = required_academic_year_type(form_data.get("academic_year_type"))
    email = str(form_data.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email is required")

    course_category = required_category(form_data.get("course_category"))
    requires_course_details = course_category not in NPTEL_STAR_CATEGORIES
    requires_registration_details = requires_course_details

    if requires_course_details:
        course_platform = required_upper_text("Course platform", form_data.get("course_platform"))
        course_title = required_upper_text("Course title", form_data.get("course_title"))
        nptel_app_num = required_upper_text("NPTEL application number", form_data.get("nptel_application_number"))
        course_session = required_upper_text("Course session", form_data.get("course_session"))
        course_score = required_upper_text("Course score", form_data.get("course_score"))
        course_weeks = form_data.get("course_weeks")
        course_credits = form_data.get("course_credits")
    else:
        course_platform = None
        course_title = None
        nptel_app_num = None
        course_session = None
        course_score = None
        course_weeks = None
        course_credits = None

    if requires_registration_details:
        reg_fee = form_data.get("registration_fee_paid")
        perm_claim = form_data.get("permissible_claim")
    else:
        reg_fee = None
        perm_claim = None

    fee_receipt_file = files_data.get("fee_receipt_file") if requires_course_details else None
    certificate_file = files_data.get("certificate_file")
    photograph_file = files_data.get("photograph_file")

    if not certificate_file:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Certificate file is required")
    if not photograph_file:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Photograph file is required")

    applicant_photo = await save_photograph_upload(photograph_file, applicant_name)
    fee_receipt_saved = await save_upload(fee_receipt_file, applicant_name, "fee_receipt") if fee_receipt_file else None
    certificate_saved = await save_upload(certificate_file, applicant_name, "certificate")

    sig_file = files_data.get("signature_file")
    signature_saved = (
        await save_upload(
            sig_file,
            applicant_name,
            "signature",
            allowed_extensions=SIGNATURE_UPLOAD_EXTENSIONS,
            allowed_content_types=SIGNATURE_UPLOAD_CONTENT_TYPES,
            invalid_type_detail="Only JPG or PNG files are allowed for signature upload",
        )
        if sig_file
        else None
    )

    decl_accepted = str(form_data.get("declaration_accepted") or "").strip().lower() in {"1", "true", "yes", "on"}
    if not decl_accepted:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Declaration acceptance is required")

    payload = {
        "department": department,
        "applicant_name": applicant_name,
        "mobile_number": mobile_number,
        "academic_year": academic_year,
        "academic_year_type": academic_year_type,
        "email": email,
        "incentive_claim_count": form_data.get("incentive_claim_count", 1),
        "course_platform": course_platform,
        "course_title": course_title,
        "nptel_application_number": nptel_app_num,
        "course_session": course_session,
        "course_weeks": course_weeks,
        "course_score": course_score,
        "course_category": course_category,
        "course_credits": course_credits,
        "registration_fee_paid": reg_fee,
        "permissible_claim": perm_claim,
        "fee_receipt_file": fee_receipt_saved,
        "certificate_file": certificate_saved,
        "photograph_file": applicant_photo,
        "applicant_photo": applicant_photo,
        "signature_file": signature_saved,
        "declaration_accepted": decl_accepted,
    }

    if include_bank_passbook:
        passbook_file = files_data.get("bank_passbook_file")
        if not passbook_file:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bank passbook file is required")
        passbook_saved = await save_upload(passbook_file, applicant_name, "bank_passbook")

        payload.update({
            "usn": required_upper_text("USN", form_data.get("usn")),
            "semester": required_upper_text("Semester", form_data.get("semester")),
            "bank_account_number": required_upper_text("Bank account number", form_data.get("bank_account_number")),
            "bank_ifsc": required_upper_text("Bank IFSC", form_data.get("bank_ifsc")),
            "bank_branch": required_upper_text("Bank branch", form_data.get("bank_branch")),
            "bank_name": required_upper_text("Bank name", form_data.get("bank_name")),
            "bank_passbook_file": passbook_saved,
        })

    if include_designation:
        payload["designation"] = required_upper_text("Designation", form_data.get("designation"))

    return payload


async def create_student_application_service(db: Session, owner: User, form_data: dict, files_data: dict) -> Application:
    enforce_form_window_open(db)
    if owner.role != "student":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only students can submit this form")

    payload = await normalize_upload_payload(
        owner.name,
        form_data,
        files_data,
        include_bank_passbook=True,
        include_designation=False,
    )

    app = Application(
        owner_id=owner.id,
        application_type="student",
        status="pending_department_coordinator",
        data=payload,
        created_at=portal_now(),
    )
    db.add(app)
    db.commit()
    db.refresh(app)

    dispatch_portal_notification(
        db,
        user_id=owner.id,
        message=f"Application ID {app.id} received and sent for review.",
        email_subject="Application Received - SBJIT NPTEL Reimburse",
        email_text=(
            f"Hello {payload['applicant_name']},\n\n"
            f"Your student application ID {app.id} was submitted successfully and is now under review.\n"
            f"Department: {payload['department']}\n"
            f"Status: {status_label(app.status)}\n\n"
            f"SBJIT NPTEL Reimburse Team"
        ),
    )

    reviewers = reviewers_for_stage(db, "department_coordinator", payload["department"])
    queue_review_alerts(db, reviewers, app)

    return app


async def create_faculty_application_service(db: Session, owner: User, form_data: dict, files_data: dict) -> Application:
    enforce_form_window_open(db)
    if owner.role != "faculty" and owner.role not in AUTHORITY_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only faculty and authority users can submit this form")

    payload = await normalize_upload_payload(
        owner.name,
        form_data,
        files_data,
        include_bank_passbook=False,
        include_designation=True,
    )

    app = Application(
        owner_id=owner.id,
        application_type="faculty",
        status="pending_department_coordinator",
        data=payload,
        created_at=portal_now(),
    )
    db.add(app)
    db.commit()
    db.refresh(app)

    dispatch_portal_notification(
        db,
        user_id=owner.id,
        message=f"Application ID {app.id} received and sent for review.",
        email_subject="Application Received - SBJIT NPTEL Reimburse",
        email_text=(
            f"Hello {payload['applicant_name']},\n\n"
            f"Your faculty application ID {app.id} was submitted successfully and is now under review.\n"
            f"Department: {payload['department']}\n"
            f"Status: {status_label(app.status)}\n\n"
            f"SBJIT NPTEL Reimburse Team"
        ),
    )

    reviewers = reviewers_for_stage(db, "department_coordinator", payload["department"])
    queue_review_alerts(db, reviewers, app)

    return app


def review_application_submission_service(
    db: Session,
    application_id: int,
    reviewer: User,
    action: str,
    remark: Optional[str] = None,
    approved_amount: Optional[float] = None,
) -> Application:
    role = reviewer.role
    if role not in AUTHORITY_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    if action not in {"approve", "reject"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid action")

    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    data = dict(app.data or {})

    if role in {"department_coordinator", "department_hod"} and norm(data.get("department")) != norm(reviewer.department):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this department")

    expected_status = {
        "department_coordinator": "pending_department_coordinator",
        "department_hod": "pending_department_hod",
        "institution_coordinator": "pending_institution_coordinator",
    }[role]

    if app.status != expected_status:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Application is not at your approval stage")

    applicant = db.query(User).filter(User.id == app.owner_id).first()
    if not applicant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application owner not found")

    applicant_name = str(data.get("applicant_name") or applicant.name).strip()
    application_department = data.get("department") or applicant.department

    if action == "reject":
        if not remark or not str(remark).strip():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Remark is required for rejection")
        app.status = "rejected"
        data["last_reject_remark"] = remark
        data["last_reject_role"] = role
        if role == "institution_coordinator":
            app.approved_amount = None

        dispatch_portal_notification(
            db,
            user_id=applicant.id,
            message=f"Application ID {app.id} was not approved by {role_label(role)}. Remark: {remark}",
            email_subject="Application Update - Not Approved",
            email_text=(
                f"Hello {applicant_name},\n\n"
                f"Your application ID {app.id} was reviewed and marked as not approved by {role_label(role)}.\n"
                f"Remark: {remark}\n\n"
                f"SBJIT NPTEL Reimburse Team"
            ),
        )
    else:
        if approved_amount is not None and approved_amount < 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Approved amount must be non-negative")
        if role == "institution_coordinator" and approved_amount is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Approved amount is required")

        next_status = {
            "department_coordinator": "pending_department_hod",
            "department_hod": "pending_institution_coordinator",
            "institution_coordinator": "approved",
        }[role]
        app.status = next_status

        if role == "institution_coordinator":
            app.approved_amount = approved_amount
            data["approved_amount"] = approved_amount
            data["notification_approved_amount"] = approved_amount
            data["approved_by_role"] = role
            data["approved_by_user_id"] = reviewer.id
            data["approved_at"] = portal_now().isoformat()

            dispatch_portal_notification(
                db,
                user_id=applicant.id,
                message=f"Application ID {app.id} approved. Amount: Rs. {approved_amount:.2f}",
                email_subject="Application Approved - SBJIT NPTEL Reimburse",
                email_text=(
                    f"Hello {applicant_name},\n\n"
                    f"Application ID {app.id} has been approved.\n"
                    f"Approved amount: Rs. {approved_amount:.2f}\n\n"
                    f"SBJIT NPTEL Reimburse Team"
                ),
            )
        else:
            dispatch_portal_notification(
                db,
                user_id=applicant.id,
                message=f"Application ID {app.id} moved to {status_label(next_status)}.",
                email_subject="Application Update - Moved to Next Stage",
                email_text=(
                    f"Hello {applicant_name},\n\n"
                    f"Application ID {app.id} has moved to {status_label(next_status)}.\n\n"
                    f"SBJIT NPTEL Reimburse Team"
                ),
            )
            next_role = {
                "department_coordinator": "department_hod",
                "department_hod": "institution_coordinator",
            }[role]
            reviewers = reviewers_for_stage(db, next_role, application_department)
            queue_review_alerts(db, reviewers, app)

    reviews = data.get("reviews") or []
    if not isinstance(reviews, list):
        reviews = []
    reviews.append({
        "role": role,
        "action": action,
        "reviewer_id": reviewer.id,
        "remark": remark,
        "approved_amount": approved_amount if action == "approve" else None,
        "reviewed_at": portal_now().isoformat(),
    })
    data["reviews"] = reviews
    app.data = data
    db.commit()
    db.refresh(app)

    return app


def public_approved_highlights_service(db: Session, limit: int = 50) -> List[dict]:
    apps = (
        db.query(Application)
        .filter(Application.status == "approved", Application.application_type.in_(["student", "faculty"]))
        .order_by(Application.created_at.desc())
        .limit(limit * 5)
        .all()
    )

    highlights = []
    for app in apps:
        data = dict(app.data or {})
        photo = str(data.get("photograph_file") or "").strip()
        if not photo:
            continue

        highlights.append({
            "id": app.id,
            "application_type": str(app.application_type or "").strip().lower(),
            "applicant_name": str(data.get("applicant_name") or data.get("application_name") or "Applicant").strip(),
            "course_category": str(data.get("course_category") or "Not Provided").strip(),
            "percentage": normalize_percentage(data.get("course_score")),
            "photograph_file": photo,
            "created_at": app.created_at.isoformat() if app.created_at else None,
        })
        if len(highlights) >= limit:
            break
    return highlights
