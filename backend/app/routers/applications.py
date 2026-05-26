from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File, Form, Query
from datetime import datetime, timedelta
from collections.abc import Callable
from sqlalchemy import String, cast, func, or_
from sqlalchemy.orm import Session
import re
from app.core.database import get_db
from app.core.config import settings
from app.core.portal_notifications import queue_portal_notification
from app.models.application import Application
from app.models.form_window import FormWindow
from app.models.notification import Notification
from app.schemas.application import StudentApplicationCreate, FacultyApplicationCreate, ApplicationOut, ApplicationReview
from app.routers.profile import get_current_user
from app.models.user import User
import os
import uuid

router = APIRouter(prefix="/applications", tags=["applications"])
DEFAULT_QUERY_LIMIT = settings.app_query_default_limit
MAX_QUERY_LIMIT = settings.app_query_max_limit
REVIEW_SCAN_BATCH = 250
REVIEW_SCAN_CAP = 10000


def _application_department_expr():
    return func.lower(Application.data["department"].as_string())


def _safe_limit(value: int) -> int:
    return max(1, min(MAX_QUERY_LIMIT, value))


def _safe_offset(value: int) -> int:
    return max(0, value)


def _apply_authority_scope_to_query(query, role: str, user_department: str, requested_department: str | None):
    if role in {"department_coordinator", "department_hod"}:
        target_department = requested_department or user_department
        if _norm(target_department) != _norm(user_department):
            raise HTTPException(status_code=403, detail="Not authorized for this department")
        return query.filter(_application_department_expr() == _norm(target_department))

    if requested_department:
        return query.filter(_application_department_expr() == _norm(requested_department))

    return query


def _apply_application_search(query, q: str | None):
    if not q or not q.strip():
        return query
    term = q.strip()
    like_value = f"%{term.lower()}%"
    return query.filter(
        or_(
            cast(Application.id, String).ilike(f"%{term}%"),
            func.lower(Application.application_type).like(like_value),
            func.lower(Application.status).like(like_value),
            func.lower(Application.data["applicant_name"].as_string()).like(like_value),
            func.lower(Application.data["department"].as_string()).like(like_value),
            func.lower(Application.data["usn"].as_string()).like(like_value),
            func.lower(Application.data["email"].as_string()).like(like_value),
            func.lower(Application.data["course_title"].as_string()).like(like_value),
        )
    )


def _collect_filtered_applications(
    base_query,
    matcher: Callable[[Application], bool],
    *,
    limit: int,
    offset: int,
) -> list[Application]:
    collected: list[Application] = []
    skipped = 0
    scanned = 0
    page_offset = 0

    while scanned < REVIEW_SCAN_CAP and len(collected) < limit:
        batch = base_query.offset(page_offset).limit(REVIEW_SCAN_BATCH).all()
        if not batch:
            break
        batch_size = len(batch)
        scanned += batch_size
        page_offset += batch_size

        for app in batch:
            if not matcher(app):
                continue
            if skipped < offset:
                skipped += 1
                continue
            collected.append(app)
            if len(collected) >= limit:
                break

    return collected


def _filter_apps_by_authority_scope(
    apps: list[Application],
    role: str,
    user_department: str,
    requested_department: str | None
) -> list[Application]:
    def _norm(value: str | None) -> str:
        return (value or "").strip().lower()

    if role in {"department_coordinator", "department_hod"}:
        target_department = requested_department or user_department
        if _norm(target_department) != _norm(user_department):
            raise HTTPException(status_code=403, detail="Not authorized for this department")
        return [
            app
            for app in apps
            if _norm((app.data or {}).get("department")) == _norm(target_department)
        ]

    if requested_department:
        return [
            app
            for app in apps
            if _norm((app.data or {}).get("department")) == _norm(requested_department)
        ]

    return apps


def _norm(value: str | None) -> str:
    return (value or "").strip().lower()


MAX_UPLOAD_BYTES = 150 * 1024
PDF_UPLOAD_EXTENSIONS = {".pdf"}
PDF_UPLOAD_CONTENT_TYPES = {"application/pdf"}
SIGNATURE_UPLOAD_EXTENSIONS = {".jpg", ".jpeg", ".png"}
SIGNATURE_UPLOAD_CONTENT_TYPES = {"image/jpeg", "image/png"}
PHOTO_UPLOAD_EXTENSIONS = {".jpg", ".jpeg"}
PHOTO_UPLOAD_CONTENT_TYPES = {"image/jpeg"}
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
ALLOWED_COURSE_CATEGORIES = {
    "ELITE",
    "ELITE + SILVER",
    "ELITE + GOLD",
    "ELITE + SILVER + TOP 5%",
    "ELITE + SILVER + TOP 2%",
    "ELITE + SILVER + TOP 1%",
    "ELITE + GOLD + TOP 5%",
    "ELITE + GOLD + TOP 2%",
    "ELITE + GOLD + TOP 1%",
}
ALLOWED_ACADEMIC_YEAR_TYPES = {"ODD", "EVEN"}


def _role_label(role: str) -> str:
    return ROLE_LABELS.get(role, role.replace("_", " ").title())



def _status_label(status: str) -> str:
    return STATUS_LABELS.get(status, status.replace("_", " ").title())


def _upper_text(value: str | None) -> str:
    return str(value or "").strip().upper()


def _normalize_email(value: str | None) -> str:
    return str(value or "").strip().lower()


def _required_upper_text(field_label: str, value: str | None) -> str:
    text = _upper_text(value)
    if not text:
        raise HTTPException(status_code=400, detail=f"{field_label} is required")
    return text


def _required_email(value: str | None) -> str:
    email = _normalize_email(value)
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    return email


def _required_category(value: str | None) -> str:
    category = _required_upper_text("Course category", value)
    if category not in ALLOWED_COURSE_CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid course category selected")
    return category


def _required_academic_year_type(value: str | None) -> str:
    academic_year_type = _required_upper_text("Academic year type", value)
    if academic_year_type not in ALLOWED_ACADEMIC_YEAR_TYPES:
        raise HTTPException(status_code=400, detail="Academic year type must be ODD or EVEN")
    return academic_year_type



def _application_reference(app: Application) -> str:
    return f"Application ID {app.id}"



def _reviewers_for_stage(db: Session, role: str, department: str | None) -> list[User]:
    query = db.query(User).filter(User.role == role)
    if role in {"department_coordinator", "department_hod"}:
        query = query.filter(User.department == (department or ""))
    return query.order_by(User.id.asc()).all()



def _queue_review_alerts(
    db: Session,
    background_tasks: BackgroundTasks,
    reviewers: list[User],
    app: Application,
    applicant_name: str,
    department: str | None,
    stage_role: str,
) -> None:
    for reviewer in reviewers:
        queue_portal_notification(
            db,
            reviewer,
            message=f"{_application_reference(app)} awaits your review",
            # Authority users should receive only in-app notifications, not email alerts.
        )


def _safe_filename_token(value: str | None, fallback: str) -> str:
    raw = str(value or "").strip().lower()
    token = re.sub(r"[^a-z0-9]+", "_", raw).strip("_")
    return token or fallback


def _preferred_extension_for_content_type(content_type: str) -> str | None:
    if content_type == "application/pdf":
        return ".pdf"
    if content_type == "image/png":
        return ".png"
    if content_type == "image/jpeg":
        return ".jpg"
    return None


def _save_upload(
    file: UploadFile | None,
    applicant_name: str,
    field_name: str,
    *,
    allowed_extensions: set[str] | None = None,
    allowed_content_types: set[str] | None = None,
    invalid_type_detail: str = "Only PDF files are allowed for uploads",
) -> str | None:
    if not file:
        return None
    allowed_extensions = allowed_extensions or PDF_UPLOAD_EXTENSIONS
    allowed_content_types = allowed_content_types or PDF_UPLOAD_CONTENT_TYPES
    ext = os.path.splitext(file.filename or "")[1].lower()
    content_type = str(file.content_type or "").strip().lower()
    ext_allowed = ext in allowed_extensions
    content_type_allowed = content_type in allowed_content_types
    if not ext_allowed and not content_type_allowed:
        raise HTTPException(status_code=400, detail=invalid_type_detail)

    final_extension = ext if ext_allowed else (_preferred_extension_for_content_type(content_type) or sorted(allowed_extensions)[0])

    applicant_token = _safe_filename_token(applicant_name, "applicant")
    field_token = _safe_filename_token(field_name, "document")
    stamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    unique_suffix = uuid.uuid4().hex[:8]
    name = f"{applicant_token}_{field_token}_{stamp}_{unique_suffix}{final_extension}"

    os.makedirs("uploads", exist_ok=True)
    path = os.path.join("uploads", name)
    size = 0
    with open(path, "wb") as out:
        while True:
            chunk = file.file.read(64 * 1024)
            if not chunk:
                break
            size += len(chunk)
            if size > MAX_UPLOAD_BYTES:
                out.close()
                os.remove(path)
                raise HTTPException(status_code=413, detail="File too large. Max 150KB.")
            out.write(chunk)
    return f"/uploads/{name}"


def _enforce_form_window_open(db: Session) -> None:
    window = db.query(FormWindow).filter(FormWindow.id == 1).first()
    if not window or window.start_date is None or window.end_date is None:
        return
    today = datetime.utcnow().date()
    if today < window.start_date or today > window.end_date:
        raise HTTPException(
            status_code=403,
            detail=f"Form filling is open only from {window.start_date.isoformat()} to {window.end_date.isoformat()}",
        )


def _backfill_approved_amount_for_apps(db: Session, apps: list[Application]) -> int:
    approved_apps = [app for app in apps if app.status == "approved"]
    if not approved_apps:
        return 0

    approved_amount_pattern = re.compile(
        r"Application ID\s+(?P<app_id>\d+)\s+is approved with amount Rs\.\s*(?P<amount>\d+(?:\.\d+)?)",
        re.IGNORECASE,
    )
    app_ids = [app.id for app in approved_apps]
    owner_ids = list({app.owner_id for app in approved_apps})

    notes = (
        db.query(Notification)
        .filter(Notification.user_id.in_(owner_ids))
        .filter(Notification.message.ilike("%is approved with amount Rs.%"))
        .order_by(Notification.created_at.desc())
        .all()
    )
    amount_by_app_owner: dict[tuple[int, int], float] = {}
    amount_by_app_id: dict[int, float] = {}
    for note in notes:
        match = approved_amount_pattern.search(note.message or "")
        if not match:
            continue
        app_id = int(match.group("app_id"))
        if app_id not in app_ids:
            continue
        amount = float(match.group("amount"))
        amount_by_app_id.setdefault(app_id, amount)
        amount_by_app_owner.setdefault((app_id, note.user_id), amount)

    changed = 0
    for app in approved_apps:
        data = app.data or {}
        canonical_amount = app.approved_amount
        if canonical_amount in {None, ""}:
            data_amount = data.get("approved_amount")
            if data_amount not in {None, ""}:
                canonical_amount = float(data_amount)
                app.approved_amount = canonical_amount
                data["notification_approved_amount"] = canonical_amount
                app.data = data
                db.add(app)
                changed += 1
                continue

        reviews = data.get("reviews") or []
        institution_review = next(
            (
                review
                for review in reversed(reviews)
                if str(review.get("role", "")).strip().lower() == "institution_coordinator"
                and review.get("action") == "approve"
                and review.get("approved_amount") not in {None, ""}
            ),
            None,
        )
        if institution_review is not None:
            amount_value = institution_review.get("approved_amount")
            canonical_amount = float(amount_value)
        else:
            amount = amount_by_app_owner.get((app.id, app.owner_id))
            if amount is None:
                amount = amount_by_app_id.get(app.id)
            if amount is None:
                continue
            canonical_amount = float(amount)

        app.approved_amount = canonical_amount
        data["approved_amount"] = canonical_amount
        data["notification_approved_amount"] = canonical_amount
        app.data = data
        db.add(app)
        changed += 1

    if changed:
        db.commit()
        for app in approved_apps:
            db.refresh(app)
    return changed


def repair_legacy_review_history(db: Session) -> int:
    """
    Backfill missing review history for legacy applications so strict
    reviewer_id-based "my approved/rejected" filters work reliably.
    """
    authority_roles = {"department_coordinator", "department_hod", "institution_coordinator"}
    users = db.query(User).filter(User.role.in_(authority_roles)).all()

    reviewers_by_role_department: dict[tuple[str, str], list[int]] = {}
    reviewers_by_role: dict[str, list[int]] = {}
    for authority_user in users:
        reviewers_by_role_department.setdefault((authority_user.role, authority_user.department), []).append(authority_user.id)
        reviewers_by_role.setdefault(authority_user.role, []).append(authority_user.id)

    def pick_reviewer_id(role: str, department: str | None) -> int | None:
        if role == "institution_coordinator":
            reviewer_ids = reviewers_by_role.get(role, [])
        else:
            reviewer_ids = reviewers_by_role_department.get((role, department or ""), [])
        return reviewer_ids[0] if len(reviewer_ids) == 1 else None

    approved_amount_pattern = re.compile(
        r"Application ID\s+(?P<app_id>\d+)\s+is approved with amount Rs\.\s*(?P<amount>\d+(?:\.\d+)?)",
        re.IGNORECASE,
    )
    notification_amount_by_app: dict[tuple[int, int], float] = {}
    notification_amount_by_id: dict[int, float] = {}
    approval_notifications = (
        db.query(Notification)
        .filter(Notification.message.ilike("%is approved with amount Rs.%"))
        .order_by(Notification.created_at.desc())
        .all()
    )
    for note in approval_notifications:
        match = approved_amount_pattern.search(note.message or "")
        if not match:
            continue
        app_id = int(match.group("app_id"))
        amount = float(match.group("amount"))
        notification_amount_by_id.setdefault(app_id, amount)
        notification_amount_by_app.setdefault((app_id, note.user_id), amount)

    updated_count = 0
    apps = db.query(Application).order_by(Application.id.asc()).all()
    for app in apps:
        data = app.data or {}
        reviews = data.get("reviews") or []
        if not isinstance(reviews, list):
            reviews = []

        existing_keys: set[tuple[str, str, int]] = set()
        for review in reviews:
            reviewer_id = review.get("reviewer_id")
            if reviewer_id is None:
                continue
            existing_keys.add((str(review.get("role")), str(review.get("action")), int(reviewer_id)))

        status = app.status
        department = data.get("department")
        reviewed_at = app.created_at.isoformat() if app.created_at else datetime.utcnow().isoformat()
        changed = False

        def ensure_review(role: str, action: str, remark: str | None = None) -> None:
            nonlocal changed
            reviewer_id = pick_reviewer_id(role, department)
            if reviewer_id is None:
                return
            key = (role, action, reviewer_id)
            if key in existing_keys:
                return
            reviews.append({
                "role": role,
                "action": action,
                "reviewer_id": reviewer_id,
                "remark": remark,
                "reviewed_at": reviewed_at,
            })
            existing_keys.add(key)
            changed = True

        if status in {"pending_department_hod", "pending_institution_coordinator", "approved"}:
            ensure_review("department_coordinator", "approve")
        if status in {"pending_institution_coordinator", "approved"}:
            ensure_review("department_hod", "approve")
        if status == "approved":
            ensure_review("institution_coordinator", "approve")

            # Backfill missing approved amount for legacy rows.
            approved_amount = app.approved_amount if app.approved_amount not in {None, ""} else data.get("approved_amount")
            if approved_amount in {None, ""}:
                institution_review = next(
                    (
                        review
                        for review in reversed(reviews)
                        if str(review.get("role", "")).strip().lower() == "institution_coordinator"
                        and review.get("action") == "approve"
                        and review.get("approved_amount") not in {None, ""}
                    ),
                    None,
                )
                if institution_review is not None:
                    amount_value = institution_review.get("approved_amount")
                    app.approved_amount = float(amount_value)
                    data["approved_amount"] = amount_value
                    data["notification_approved_amount"] = amount_value
                    changed = True
                else:
                    amount_from_notification = notification_amount_by_app.get((app.id, app.owner_id))
                    if amount_from_notification is None:
                        amount_from_notification = notification_amount_by_id.get(app.id)
                    if amount_from_notification is not None:
                        app.approved_amount = float(amount_from_notification)
                        data["approved_amount"] = amount_from_notification
                        data["notification_approved_amount"] = amount_from_notification
                        changed = True
            else:
                app.approved_amount = float(approved_amount)
            if data.get("notification_approved_amount") in {None, ""} and data.get("approved_amount") not in {None, ""}:
                data["notification_approved_amount"] = data.get("approved_amount")
                changed = True

        if status == "rejected":
            last_reject_role = data.get("last_reject_role")
            if last_reject_role in authority_roles:
                ensure_review(last_reject_role, "reject", data.get("last_reject_remark"))

        if changed:
            data["reviews"] = reviews
            app.data = data
            db.add(app)
            updated_count += 1

    if updated_count:
        db.commit()
    return updated_count

@router.post("/student", response_model=ApplicationOut)
def create_student_application(
    background_tasks: BackgroundTasks,
    department: str = Form(...),
    applicant_name: str = Form(...),
    usn: str = Form(...),
    mobile_number: str = Form(...),
    academic_year: str = Form(...),
    academic_year_type: str = Form(...),
    semester: str = Form(...),
    email: str = Form(...),
    incentive_claim_count: int = Form(...),
    course_platform: str = Form(...),
    course_title: str = Form(...),
    nptel_application_number: str = Form(...),
    course_session: str = Form(...),
    course_weeks: int = Form(...),
    course_score: str = Form(...),
    course_category: str = Form(...),
    course_credits: int = Form(...),
    registration_fee_paid: float = Form(...),
    permissible_claim: float = Form(...),
    bank_account_number: str = Form(...),
    bank_ifsc: str = Form(...),
    bank_branch: str = Form(...),
    bank_name: str = Form(...),
    fee_receipt_file: UploadFile = File(...),
    certificate_file: UploadFile = File(...),
    bank_passbook_file: UploadFile = File(...),
    photograph_file: UploadFile = File(...),
    signature_file: UploadFile | None = File(None),
    declaration_accepted: bool = Form(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    _enforce_form_window_open(db)
    if user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can submit this form")
    six_months_ago = datetime.utcnow() - timedelta(days=180)
    recent_count = (
        db.query(func.count(Application.id))
        .filter(
            Application.owner_id == user.id,
            Application.application_type == "student",
            Application.created_at >= six_months_ago,
        )
        .scalar()
        or 0
    )
    if recent_count >= 2:
        raise HTTPException(status_code=400, detail="Only two student applications are allowed in six months")
    department = _required_upper_text("Department", department)
    applicant_name = _required_upper_text("Applicant name", applicant_name)
    usn = _required_upper_text("USN", usn)
    mobile_number = _required_upper_text("Mobile number", mobile_number)
    academic_year = _required_upper_text("Academic year", academic_year)
    academic_year_type = _required_academic_year_type(academic_year_type)
    semester = _required_upper_text("Semester", semester)
    email = _required_email(email)
    course_platform = _required_upper_text("Course platform", course_platform)
    course_title = _required_upper_text("Course title", course_title)
    nptel_application_number = _required_upper_text("NPTEL application number", nptel_application_number)
    course_session = _required_upper_text("Course session", course_session)
    course_score = _required_upper_text("Course score", course_score)
    course_category = _required_category(course_category)
    bank_account_number = _required_upper_text("Bank account number", bank_account_number)
    bank_ifsc = _required_upper_text("Bank IFSC", bank_ifsc)
    bank_branch = _required_upper_text("Bank branch", bank_branch)
    bank_name = _required_upper_text("Bank name", bank_name)
    payload = {
        "department": department,
        "applicant_name": applicant_name,
        "usn": usn,
        "mobile_number": mobile_number,
        "academic_year": academic_year,
        "academic_year_type": academic_year_type,
        "semester": semester,
        "email": email,
        "incentive_claim_count": incentive_claim_count,
        "course_platform": course_platform,
        "course_title": course_title,
        "nptel_application_number": nptel_application_number,
        "course_session": course_session,
        "course_weeks": course_weeks,
        "course_score": course_score,
        "course_category": course_category,
        "course_credits": course_credits,
        "registration_fee_paid": registration_fee_paid,
        "permissible_claim": permissible_claim,
        "bank_account_number": bank_account_number,
        "bank_ifsc": bank_ifsc,
        "bank_branch": bank_branch,
        "bank_name": bank_name,
        "fee_receipt_file": _save_upload(fee_receipt_file, applicant_name, "fee_receipt"),
        "certificate_file": _save_upload(certificate_file, applicant_name, "certificate"),
        "bank_passbook_file": _save_upload(bank_passbook_file, applicant_name, "bank_passbook"),
        "photograph_file": _save_upload(
            photograph_file,
            applicant_name,
            "photograph",
            allowed_extensions=PHOTO_UPLOAD_EXTENSIONS,
            allowed_content_types=PHOTO_UPLOAD_CONTENT_TYPES,
            invalid_type_detail="Only JPG files are allowed for photograph upload",
        ),
        "signature_file": _save_upload(
            signature_file,
            applicant_name,
            "signature",
            allowed_extensions=SIGNATURE_UPLOAD_EXTENSIONS,
            allowed_content_types=SIGNATURE_UPLOAD_CONTENT_TYPES,
            invalid_type_detail="Only JPG or PNG files are allowed for signature upload",
        ),
        "declaration_accepted": declaration_accepted
    }
    app = Application(owner_id=user.id, application_type="student", status="pending_department_coordinator", data=payload)
    db.add(app)
    db.flush()

    queue_portal_notification(
        db,
        user,
        message=f"{_application_reference(app)} received and sent for review.",
        background_tasks=background_tasks,
        email_subject="Application Received - SBJIT Incentive Portal",
        email_headline="Your student application was submitted successfully and is now under review.",
        email_details=[
            f"Application ID: {app.id}",
            f"Department: {department}",
            f"Current status: {_status_label(app.status)}",
            "You will receive an email whenever the status changes.",
        ],
    )
    _queue_review_alerts(
        db,
        background_tasks,
        _reviewers_for_stage(db, "department_coordinator", department),
        app,
        applicant_name,
        department,
        "department_coordinator",
    )

    db.commit()
    db.refresh(app)
    return app
@router.post("/faculty", response_model=ApplicationOut)
def create_faculty_application(
    background_tasks: BackgroundTasks,
    department: str = Form(...),
    applicant_name: str = Form(...),
    mobile_number: str = Form(...),
    academic_year: str = Form(...),
    academic_year_type: str = Form(...),
    email: str = Form(...),
    designation: str = Form(...),
    incentive_claim_count: int = Form(...),
    course_platform: str = Form(...),
    course_title: str = Form(...),
    nptel_application_number: str = Form(...),
    course_session: str = Form(...),
    course_weeks: int = Form(...),
    course_score: str = Form(...),
    course_category: str = Form(...),
    course_credits: int = Form(...),
    registration_fee_paid: float = Form(...),
    permissible_claim: float = Form(...),
    fee_receipt_file: UploadFile = File(...),
    certificate_file: UploadFile = File(...),
    photograph_file: UploadFile = File(...),
    signature_file: UploadFile | None = File(None),
    declaration_accepted: bool = Form(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    _enforce_form_window_open(db)
    if user.role != "faculty":
        raise HTTPException(status_code=403, detail="Only faculty can submit this form")
    six_months_ago = datetime.utcnow() - timedelta(days=180)
    recent_count = (
        db.query(func.count(Application.id))
        .filter(
            Application.owner_id == user.id,
            Application.application_type == "faculty",
            Application.created_at >= six_months_ago,
        )
        .scalar()
        or 0
    )
    if recent_count >= 2:
        raise HTTPException(status_code=400, detail="Only two faculty applications are allowed in six months")
    department = _required_upper_text("Department", department)
    applicant_name = _required_upper_text("Applicant name", applicant_name)
    mobile_number = _required_upper_text("Mobile number", mobile_number)
    academic_year = _required_upper_text("Academic year", academic_year)
    academic_year_type = _required_academic_year_type(academic_year_type)
    email = _required_email(email)
    designation = _required_upper_text("Designation", designation)
    course_platform = _required_upper_text("Course platform", course_platform)
    course_title = _required_upper_text("Course title", course_title)
    nptel_application_number = _required_upper_text("NPTEL application number", nptel_application_number)
    course_session = _required_upper_text("Course session", course_session)
    course_score = _required_upper_text("Course score", course_score)
    course_category = _required_category(course_category)
    payload = {
        "department": department,
        "applicant_name": applicant_name,
        "mobile_number": mobile_number,
        "academic_year": academic_year,
        "academic_year_type": academic_year_type,
        "email": email,
        "designation": designation,
        "incentive_claim_count": incentive_claim_count,
        "course_platform": course_platform,
        "course_title": course_title,
        "nptel_application_number": nptel_application_number,
        "course_session": course_session,
        "course_weeks": course_weeks,
        "course_score": course_score,
        "course_category": course_category,
        "course_credits": course_credits,
        "registration_fee_paid": registration_fee_paid,
        "permissible_claim": permissible_claim,
        "fee_receipt_file": _save_upload(fee_receipt_file, applicant_name, "fee_receipt"),
        "certificate_file": _save_upload(certificate_file, applicant_name, "certificate"),
        "photograph_file": _save_upload(
            photograph_file,
            applicant_name,
            "photograph",
            allowed_extensions=PHOTO_UPLOAD_EXTENSIONS,
            allowed_content_types=PHOTO_UPLOAD_CONTENT_TYPES,
            invalid_type_detail="Only JPG files are allowed for photograph upload",
        ),
        "signature_file": _save_upload(
            signature_file,
            applicant_name,
            "signature",
            allowed_extensions=SIGNATURE_UPLOAD_EXTENSIONS,
            allowed_content_types=SIGNATURE_UPLOAD_CONTENT_TYPES,
            invalid_type_detail="Only JPG or PNG files are allowed for signature upload",
        ),
        "declaration_accepted": declaration_accepted
    }
    app = Application(owner_id=user.id, application_type="faculty", status="pending_department_coordinator", data=payload)
    db.add(app)
    db.flush()

    queue_portal_notification(
        db,
        user,
        message=f"{_application_reference(app)} received and sent for review.",
        background_tasks=background_tasks,
        email_subject="Application Received - SBJIT Incentive Portal",
        email_headline="Your faculty application was submitted successfully and is now under review.",
        email_details=[
            f"Application ID: {app.id}",
            f"Department: {department}",
            f"Current status: {_status_label(app.status)}",
            "You will receive an email whenever the status changes.",
        ],
    )
    _queue_review_alerts(
        db,
        background_tasks,
        _reviewers_for_stage(db, "department_coordinator", department),
        app,
        applicant_name,
        department,
        "department_coordinator",
    )

    db.commit()
    db.refresh(app)
    return app
@router.get("/mine", response_model=list[ApplicationOut])
def my_applications(
    status: str | None = Query(default=None),
    limit: int = Query(default=DEFAULT_QUERY_LIMIT, ge=1, le=MAX_QUERY_LIMIT),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(Application).filter(Application.owner_id == user.id)
    if status:
        query = query.filter(Application.status == status)
    apps = (
        query.order_by(Application.created_at.desc())
        .offset(_safe_offset(offset))
        .limit(_safe_limit(limit))
        .all()
    )
    _backfill_approved_amount_for_apps(db, apps)
    return apps

@router.get("/track/{application_id}", response_model=ApplicationOut)
def track(application_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    app = db.query(Application).filter(Application.id == application_id, Application.owner_id == user.id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    _backfill_approved_amount_for_apps(db, [app])
    return app

@router.get("/pending", response_model=list[ApplicationOut])
def pending_applications(
    department: str | None = Query(default=None),
    q: str | None = Query(default=None),
    limit: int = Query(default=DEFAULT_QUERY_LIMIT, ge=1, le=MAX_QUERY_LIMIT),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    role = user.role
    if role not in {"department_coordinator", "department_hod", "institution_coordinator"}:
        raise HTTPException(status_code=403, detail="Not authorized")
    status_map = {
        "department_coordinator": "pending_department_coordinator",
        "department_hod": "pending_department_hod",
        "institution_coordinator": "pending_institution_coordinator"
    }
    target_status = status_map[role]
    query = db.query(Application).filter(Application.status == target_status)
    query = _apply_authority_scope_to_query(query, role, user.department, department)
    query = _apply_application_search(query, q)
    apps = (
        query.order_by(Application.created_at.desc())
        .offset(_safe_offset(offset))
        .limit(_safe_limit(limit))
        .all()
    )
    _backfill_approved_amount_for_apps(db, apps)
    return apps

@router.get("/all", response_model=list[ApplicationOut])
def all_applications(
    department: str | None = Query(default=None),
    status: str | None = Query(default=None),
    q: str | None = Query(default=None),
    limit: int = Query(default=DEFAULT_QUERY_LIMIT, ge=1, le=MAX_QUERY_LIMIT),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    role = user.role
    if role not in {"department_coordinator", "department_hod", "institution_coordinator"}:
        raise HTTPException(status_code=403, detail="Not authorized")
    query = db.query(Application)
    query = _apply_authority_scope_to_query(query, role, user.department, department)
    if status:
        query = query.filter(Application.status == status)
    query = _apply_application_search(query, q)
    apps = (
        query.order_by(Application.created_at.desc())
        .offset(_safe_offset(offset))
        .limit(_safe_limit(limit))
        .all()
    )
    _backfill_approved_amount_for_apps(db, apps)
    return apps

@router.get("/my-reviewed", response_model=list[ApplicationOut])
def my_reviewed_applications(
    action: str | None = Query(default=None),
    q: str | None = Query(default=None),
    limit: int = Query(default=DEFAULT_QUERY_LIMIT, ge=1, le=MAX_QUERY_LIMIT),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    role = user.role
    if role not in {"department_coordinator", "department_hod", "institution_coordinator"}:
        raise HTTPException(status_code=403, detail="Not authorized")
    if action not in {None, "approve", "reject"}:
        raise HTTPException(status_code=400, detail="Invalid action")

    query = db.query(Application)
    if role in {"department_coordinator", "department_hod"}:
        query = query.filter(_application_department_expr() == _norm(user.department))
    if action == "reject":
        query = query.filter(Application.status == "rejected")
    elif action == "approve":
        if role == "department_coordinator":
            query = query.filter(
                Application.status.in_(
                    [
                        "pending_department_hod",
                        "pending_institution_coordinator",
                        "approved",
                        "rejected",
                    ]
                )
            )
        elif role == "department_hod":
            query = query.filter(
                Application.status.in_(
                    ["pending_institution_coordinator", "approved", "rejected"]
                )
            )
        else:
            query = query.filter(Application.status == "approved")
    query = _apply_application_search(query, q)
    ordered_query = query.order_by(Application.created_at.desc())

    def in_user_scope(app: Application) -> bool:
        if role == "institution_coordinator":
            return True
        return _norm((app.data or {}).get("department")) == _norm(user.department)

    def infer_approved_by_role(app: Application) -> bool:
        # Fallback for legacy rows where explicit review history is missing.
        if role == "department_coordinator":
            return app.status in {
                "pending_department_hod",
                "pending_institution_coordinator",
                "approved",
            }
        if role == "department_hod":
            return app.status in {
                "pending_institution_coordinator",
                "approved",
            }
        if role == "institution_coordinator":
            return app.status == "approved"
        return False

    def infer_rejected_by_role(app: Application) -> bool:
        data = app.data or {}
        return app.status == "rejected" and data.get("last_reject_role") == role

    def is_my_review(app: Application) -> bool:
        if not in_user_scope(app):
            return False
        reviews = (app.data or {}).get("reviews") or []
        has_my_review = any(
            (review.get("reviewer_id") is not None and str(review.get("reviewer_id")) == str(user.id))
            and (action is None or review.get("action") == action)
            for review in reviews
        )
        if not has_my_review:
            has_my_review = any(
                review.get("reviewer_id") is None
                and review.get("role") == user.role
                and (action is None or review.get("action") == action)
                for review in reviews
            )

        if not has_my_review:
            if action == "approve":
                has_my_review = infer_approved_by_role(app)
            elif action == "reject":
                has_my_review = infer_rejected_by_role(app)

        return has_my_review

    filtered = _collect_filtered_applications(
        ordered_query,
        is_my_review,
        limit=_safe_limit(limit),
        offset=_safe_offset(offset),
    )
    _backfill_approved_amount_for_apps(db, filtered)
    return filtered

@router.get("/role-reviewed", response_model=list[ApplicationOut])
def role_reviewed_applications(
    action: str | None = Query(default=None),
    q: str | None = Query(default=None),
    limit: int = Query(default=DEFAULT_QUERY_LIMIT, ge=1, le=MAX_QUERY_LIMIT),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    role = user.role
    if role not in {"department_coordinator", "department_hod", "institution_coordinator"}:
        raise HTTPException(status_code=403, detail="Not authorized")
    if action not in {None, "approve", "reject"}:
        raise HTTPException(status_code=400, detail="Invalid action")

    query = db.query(Application)
    if role in {"department_coordinator", "department_hod"}:
        query = query.filter(_application_department_expr() == _norm(user.department))
    if action == "reject":
        query = query.filter(Application.status == "rejected")
    elif action == "approve" and role == "institution_coordinator":
        query = query.filter(Application.status == "approved")
    query = _apply_application_search(query, q)
    ordered_query = query.order_by(Application.created_at.desc())

    def has_role_review(app: Application) -> bool:
        reviews = (app.data or {}).get("reviews") or []
        return any(
            review.get("role") == role and (action is None or review.get("action") == action)
            for review in reviews
        )

    filtered = _collect_filtered_applications(
        ordered_query,
        has_role_review,
        limit=_safe_limit(limit),
        offset=_safe_offset(offset),
    )
    _backfill_approved_amount_for_apps(db, filtered)
    return filtered

@router.post("/{application_id}/review", response_model=ApplicationOut)
def review_application(application_id: int, payload: ApplicationReview, background_tasks: BackgroundTasks, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    role = user.role
    if role not in {"department_coordinator", "department_hod", "institution_coordinator"}:
        raise HTTPException(status_code=403, detail="Not authorized")
    if payload.action not in {"approve", "reject"}:
        raise HTTPException(status_code=400, detail="Invalid action")
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    if role in {"department_coordinator", "department_hod"} and _norm((app.data or {}).get("department")) != _norm(user.department):
        raise HTTPException(status_code=403, detail="Not authorized for this department")
    expected_status = {
        "department_coordinator": "pending_department_coordinator",
        "department_hod": "pending_department_hod",
        "institution_coordinator": "pending_institution_coordinator"
    }[role]
    if app.status != expected_status:
        raise HTTPException(status_code=400, detail="Application is not at your approval stage")

    applicant = db.query(User).filter(User.id == app.owner_id).first()
    if not applicant:
        raise HTTPException(status_code=404, detail="Application owner not found")

    data = app.data or {}
    applicant_name = (data.get("applicant_name") or applicant.name).strip()
    application_department = data.get("department") or applicant.department
    application_ref = _application_reference(app)
    applicant_email = _normalize_email(data.get("email")) or _normalize_email(applicant.email)

    if payload.action == "reject":
        if not payload.remark:
            raise HTTPException(status_code=400, detail="Remark is required for rejection")
        role_label = _role_label(role)
        app.status = "rejected"
        queue_portal_notification(
            db,
            applicant,
            message=f"{application_ref} was not approved by {role_label}. Remark: {payload.remark}",
            background_tasks=background_tasks,
            email_subject="Application Update - Not Approved",
            email_headline=f"{application_ref} was reviewed and marked as not approved by {role_label}.",
            email_details=[
                f"Application type: {app.application_type.title()}",
                f"Department: {application_department or '-'}",
                f"Remark: {payload.remark}",
                "Please update your application details and submit again if eligible.",
            ],
            email_to=applicant_email,
            email_recipient_name=applicant_name,
        )
    else:
        if role == "institution_coordinator":
            if payload.approved_amount is None:
                raise HTTPException(status_code=400, detail="Approved amount is required")
            if payload.approved_amount < 0:
                raise HTTPException(status_code=400, detail="Approved amount must be non-negative")
        next_status = {
            "department_coordinator": "pending_department_hod",
            "department_hod": "pending_institution_coordinator",
            "institution_coordinator": "approved"
        }[role]
        app.status = next_status
        if role == "institution_coordinator":
            queue_portal_notification(
                db,
                applicant,
                message=f"{application_ref} approved. Amount: Rs. {payload.approved_amount:.2f}",
                background_tasks=background_tasks,
                email_subject="Application Approved - SBJIT Incentive Portal",
                email_headline=f"Good news. {application_ref} has been approved.",
                email_details=[
                    f"Application type: {app.application_type.title()}",
                    f"Approved amount: Rs. {payload.approved_amount:.2f}",
                    "Please keep this email for your records.",
                ],
                email_to=applicant_email,
                email_recipient_name=applicant_name,
            )
        else:
            queue_portal_notification(
                db,
                applicant,
                message=f"{application_ref} moved to {_status_label(next_status)}.",
                background_tasks=background_tasks,
                email_subject="Application Update - Moved to Next Stage",
                email_headline=f"{application_ref} has moved to the next review stage.",
                email_details=[
                    f"Application type: {app.application_type.title()}",
                    f"New status: {_status_label(next_status)}",
                    "No action is required from your side at this stage.",
                ],
                email_to=applicant_email,
                email_recipient_name=applicant_name,
            )
            next_role = {
                "department_coordinator": "department_hod",
                "department_hod": "institution_coordinator",
            }[role]
            _queue_review_alerts(
                db,
                background_tasks,
                _reviewers_for_stage(db, next_role, application_department),
                app,
                applicant_name,
                application_department,
                next_role,
            )

    if payload.action == "reject":
        data["last_reject_remark"] = payload.remark
        data["last_reject_role"] = role
        if role == "institution_coordinator":
            app.approved_amount = None
    if payload.action == "approve" and role == "institution_coordinator":
        app.approved_amount = payload.approved_amount
        data["approved_amount"] = payload.approved_amount
        data["notification_approved_amount"] = payload.approved_amount
        data["approved_by_role"] = role
        data["approved_by_user_id"] = user.id
        data["approved_at"] = datetime.utcnow().isoformat()
    reviews = data.get("reviews") or []
    reviews.append({
        "role": role,
        "action": payload.action,
        "reviewer_id": user.id,
        "remark": payload.remark,
        "approved_amount": payload.approved_amount if (payload.action == "approve" and role == "institution_coordinator") else None,
        "reviewed_at": datetime.utcnow().isoformat()
    })
    data["reviews"] = reviews
    app.data = data
    db.add(app)
    db.commit()
    db.refresh(app)
    return app


