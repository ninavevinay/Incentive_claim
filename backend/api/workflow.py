from __future__ import annotations

import re
import secrets
from datetime import datetime, timedelta
from pathlib import Path

from django.conf import settings
from django.db import transaction
from django.db.models import CharField, Q
from django.db.models.functions import Cast
from rest_framework.exceptions import APIException, AuthenticationFailed, NotFound, PermissionDenied, Throttled, ValidationError

from .models import Application, EmailOtp, Feedback, FormWindow, LoginEvent, Notice, Notification, PasswordResetRequest, User
from .notifications import queue_portal_notification
from .routing import dashboard_path_for_user, slugify_department
from .security import (
    create_access_token,
    generate_numeric_otp,
    hash_otp,
    hash_password,
    is_allowed_email,
    normalize_email,
    verify_password,
)
from .storage import (
    PDF_UPLOAD_CONTENT_TYPES,
    PDF_UPLOAD_EXTENSIONS,
    PHOTO_UPLOAD_CONTENT_TYPES,
    PHOTO_UPLOAD_EXTENSIONS,
    SIGNATURE_UPLOAD_CONTENT_TYPES,
    SIGNATURE_UPLOAD_EXTENSIONS,
    save_photograph_upload,
    save_upload,
)
from .timeutils import portal_datetime_iso, portal_now, portal_today


DEFAULT_QUERY_LIMIT = settings.APP_QUERY_DEFAULT_LIMIT
MAX_QUERY_LIMIT = settings.APP_QUERY_MAX_LIMIT
REVIEW_SCAN_BATCH = 250
REVIEW_SCAN_CAP = 10000
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
NPTEL_STAR_CATEGORIES = {
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
}

AUTHORITY_ROLES = {"department_coordinator", "department_hod", "institution_coordinator"}
SELF_REGISTER_ROLES = {"student", "faculty"}
RESET_PASSWORD_PURPOSE = "reset_password"

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
ALLOWED_COURSE_CATEGORIES = set(COURSE_CATEGORY_OPTIONS)
ALLOWED_ACADEMIC_YEAR_TYPES = {"ODD", "EVEN"}
APPLICATION_UPLOAD_FIELDS = (
    "fee_receipt_file",
    "certificate_file",
    "bank_passbook_file",
    "photograph_file",
    "signature_file",
)


def _client_ip(request) -> str:
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded_for:
        ip = forwarded_for.split(",")[0].strip()
        if ip:
            return ip
    return request.META.get("REMOTE_ADDR", "unknown")


def _user_agent(request) -> str:
    return str(request.META.get("HTTP_USER_AGENT", "") or "")[:255]


def _safe_limit(value: int) -> int:
    return max(1, min(MAX_QUERY_LIMIT, value))


def _safe_offset(value: int) -> int:
    return max(0, value)


def _norm(value: str | None) -> str:
    return str(value or "").strip().lower()


def _required_form_value(data: dict, key: str, label: str):
    value = data.get(key)
    if value is None or value == "":
        raise ValidationError(f"{label} is required")
    return value


def _required_upload_file(data: dict, key: str, label: str):
    value = data.get(key)
    if value is None or value == "":
        raise ValidationError(f"{label} is required")
    return value


def _parse_form_bool(value, label: str) -> bool:
    if isinstance(value, bool):
        return value
    text = str(value or "").strip().lower()
    if text in {"1", "true", "yes", "on"}:
        return True
    if text in {"0", "false", "no", "off"}:
        return False
    raise ValidationError(f"{label} must be true or false")


def role_label(role: str) -> str:
    return ROLE_LABELS.get(role, role.replace("_", " ").title())


def status_label(status: str) -> str:
    return STATUS_LABELS.get(status, status.replace("_", " ").title())


def upper_text(value: str | None) -> str:
    return str(value or "").strip().upper()


def required_upper_text(field_label: str, value: str | None) -> str:
    text = upper_text(value)
    if not text:
        raise ValidationError(f"{field_label} is required")
    return text


def required_academic_year(value: str | None) -> str:
    academic_year = re.sub(r"\s+", " ", str(value or "").strip())
    if not academic_year:
        raise ValidationError("Academic year is required")
    match = re.fullmatch(r"(\d{4})\s*[-/\u2013\u2014]\s*(\d{4})", academic_year)
    if not match:
        raise ValidationError("Academic year must be in YYYY - YYYY format")
    return f"{match.group(1)} - {match.group(2)}"


def required_email(value: str | None) -> str:
    email = normalize_email(value)
    if not email:
        raise ValidationError("Email is required")
    return email


def required_category(value: str | None) -> str:
    category = re.sub(r"\s+", " ", required_upper_text("Course category", value))
    if category not in ALLOWED_COURSE_CATEGORIES:
        raise ValidationError("Invalid course category selected")
    return category


def required_academic_year_type(value: str | None) -> str:
    academic_year_type = required_upper_text("Academic year type", value)
    if academic_year_type not in ALLOWED_ACADEMIC_YEAR_TYPES:
        raise ValidationError("Academic year type must be ODD or EVEN")
    return academic_year_type


def normalize_percentage(value: str | None) -> str:
    text = str(value or "").strip()
    if not text:
        return "-"
    if text.endswith("%"):
        return text
    return f"{text}%"


def application_reference(app: Application) -> str:
    return f"Application ID {app.id}"


def _build_registration_otp_email(email: str, otp: str) -> tuple[str, str]:
    subject = "SBJIT NPTEL Reimburse registration OTP"
    text_body = (
        f"Hello,\n\n"
        f"Your OTP for SBJIT NPTEL Reimburse registration is: {otp}\n\n"
        f"This OTP will expire in {settings.OTP_EXPIRE_MINUTES} minutes.\n"
        f"If you did not request this OTP, you can ignore this email.\n\n"
        f"Email: {email}\n"
        f"SBJIT NPTEL Reimburse Team"
    )
    return subject, text_body


def _build_password_reset_otp_email(email: str, otp: str) -> tuple[str, str]:
    subject = "SBJIT NPTEL Reimburse password reset OTP"
    text_body = (
        f"Hello,\n\n"
        f"Your OTP to reset your SBJIT NPTEL Reimburse password is: {otp}\n\n"
        f"This OTP will expire in {settings.OTP_EXPIRE_MINUTES} minutes.\n"
        f"If you did not request password reset, you can ignore this email.\n\n"
        f"Email: {email}\n"
        f"SBJIT NPTEL Reimburse Team"
    )
    return subject, text_body


def _latest_pending_otp(email: str, purpose: str) -> EmailOtp | None:
    return (
        EmailOtp.objects.filter(email=email, purpose=purpose, used_at__isnull=True)
        .order_by("-created_at")
        .first()
    )


def _latest_unused_password_reset_request(user_id: int, email: str) -> PasswordResetRequest | None:
    return (
        PasswordResetRequest.objects.filter(user_id=user_id, email=email, used_at__isnull=True)
        .order_by("-created_at")
        .first()
    )


def _mark_existing_pending_otps_as_used(email: str, purpose: str, used_at: datetime) -> None:
    EmailOtp.objects.filter(email=email, purpose=purpose, used_at__isnull=True).update(used_at=used_at)


def _validate_registration_request(payload: dict, email: str) -> dict:
    role = str(payload["role"]).strip().lower()
    name = str(payload["name"]).strip()
    department = str(payload["department"]).strip()

    existing_user = User.objects.filter(email=email).first()
    if existing_user:
        if not existing_user.is_active:
            raise PermissionDenied("Account is deactivated. Contact admin.")
        raise ValidationError("Email already registered. Use login.")

    if role in AUTHORITY_ROLES:
        raise PermissionDenied("Authority self-registration is disabled. Contact admin.")
    if role == "admin":
        if email not in settings.ADMIN_EMAIL_ALLOWLIST:
            raise PermissionDenied("Admin registration is restricted to allowlisted emails")
        department = "Administration"
    elif role not in SELF_REGISTER_ROLES:
        raise ValidationError("Invalid role")

    return {
        "name": name,
        "role": role,
        "department": department,
        "password_hash": hash_password(payload["password"]),
    }


def _issue_token_for_user(user: User, request) -> str:
    LoginEvent.objects.create(
        user=user,
        email=user.email,
        ip_address=_client_ip(request),
        user_agent=_user_agent(request),
    )
    return create_access_token(str(user.id))


def request_registration_otp(payload: dict, request) -> dict:
    email = normalize_email(payload["email"])
    purpose = payload["purpose"]
    if not is_allowed_email(email):
        raise ValidationError(f"Only @{settings.ALLOWED_EMAIL_DOMAIN} email addresses are allowed")

    now = portal_now()
    latest = _latest_pending_otp(email, purpose)
    if latest:
        resend_at = latest.created_at + timedelta(seconds=settings.OTP_RESEND_SECONDS)
        if resend_at > now:
            wait_seconds = max(1, int((resend_at - now).total_seconds()))
            raise Throttled(wait=wait_seconds, detail=f"Please wait {wait_seconds} seconds before requesting another OTP")

    otp_metadata = _validate_registration_request(payload, email)
    otp = generate_numeric_otp()
    expires_at = now + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)
    client_ip = _client_ip(request)

    with transaction.atomic():
        _mark_existing_pending_otps_as_used(email, purpose, now)
        EmailOtp.objects.create(
            email=email,
            purpose=purpose,
            otp_hash=hash_otp(email, purpose, otp),
            password_hash=otp_metadata["password_hash"],
            name=otp_metadata["name"],
            role=otp_metadata["role"],
            department=otp_metadata["department"],
            user=None,
            request_ip=client_ip,
            expires_at=expires_at,
        )

        from .emailer import send_email

        subject, text_body = _build_registration_otp_email(email, otp)
        try:
            send_email(email, subject, text_body)
        except Exception as exc:
            raise APIException(str(exc) or "Failed to send email") from exc

    return {
        "message": "OTP sent to your email",
        "expires_in_seconds": settings.OTP_EXPIRE_MINUTES * 60,
        "resend_after_seconds": settings.OTP_RESEND_SECONDS,
    }


def verify_registration_otp(payload: dict, request) -> str:
    email = normalize_email(payload["email"])
    purpose = payload["purpose"]
    otp = str(payload["otp"]).strip()

    if not is_allowed_email(email):
        raise ValidationError(f"Only @{settings.ALLOWED_EMAIL_DOMAIN} email addresses are allowed")

    record = _latest_pending_otp(email, purpose)
    if not record:
        raise ValidationError("OTP not found. Request a new OTP.")

    now = portal_now()
    if record.expires_at < now:
        record.used_at = now
        record.save(update_fields=["used_at"])
        raise ValidationError("OTP expired. Request a new OTP.")

    if record.otp_hash != hash_otp(email, purpose, otp):
        raise ValidationError("Invalid OTP")

    existing_user = User.objects.filter(email=email).first()
    if existing_user:
        if not existing_user.is_active:
            raise PermissionDenied("Account is deactivated. Contact admin.")
        raise ValidationError("Email already registered. Use login.")

    role = str(record.role or "").strip().lower()
    department = str(record.department or "").strip()
    if role == "admin" and email not in settings.ADMIN_EMAIL_ALLOWLIST:
        raise PermissionDenied("Admin registration is restricted to allowlisted emails")
    if not record.password_hash:
        raise ValidationError("Registration data is incomplete. Request a new OTP.")

    with transaction.atomic():
        user = User.objects.create(
            name=(record.name or email.split("@", 1)[0]).strip(),
            email=email,
            password_hash=record.password_hash,
            auth_provider="email_password",
            role=role,
            department=department,
        )
        record.user = user
        record.used_at = now
        record.save(update_fields=["user", "used_at"])
        token = _issue_token_for_user(user, request)

    return token


def login_with_password(payload: dict, request) -> str:
    email = normalize_email(payload["email"])
    user = User.objects.filter(email=email).first()
    if user and not user.is_active:
        raise PermissionDenied("Account is deactivated. Contact admin.")
    if not user or not verify_password(payload["password"], user.password_hash):
        raise AuthenticationFailed("Invalid credentials")

    with transaction.atomic():
        token = _issue_token_for_user(user, request)
    return token


def forgot_password_otp(payload: dict, request) -> dict:
    email = normalize_email(payload["email"])
    if not is_allowed_email(email):
        raise ValidationError(f"Only @{settings.ALLOWED_EMAIL_DOMAIN} email addresses are allowed")

    user = User.objects.filter(email=email, is_active=True).first()
    if not user:
        return {
            "message": "If the account exists, a password reset OTP has been sent.",
            "expires_in_seconds": settings.OTP_EXPIRE_MINUTES * 60,
            "resend_after_seconds": settings.OTP_RESEND_SECONDS,
        }

    now = portal_now()
    latest = _latest_pending_otp(email, RESET_PASSWORD_PURPOSE)
    if latest:
        resend_at = latest.created_at + timedelta(seconds=settings.OTP_RESEND_SECONDS)
        if resend_at > now:
            wait_seconds = max(1, int((resend_at - now).total_seconds()))
            raise Throttled(wait=wait_seconds, detail=f"Please wait {wait_seconds} seconds before requesting another OTP")

    otp = generate_numeric_otp()
    expires_at = now + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)
    client_ip = _client_ip(request)

    with transaction.atomic():
        _mark_existing_pending_otps_as_used(email, RESET_PASSWORD_PURPOSE, now)
        EmailOtp.objects.create(
            email=email,
            purpose=RESET_PASSWORD_PURPOSE,
            otp_hash=hash_otp(email, RESET_PASSWORD_PURPOSE, otp),
            password_hash=None,
            name=None,
            role=None,
            department=None,
            user=user,
            request_ip=client_ip,
            expires_at=expires_at,
        )
        PasswordResetRequest.objects.create(
            user=user,
            email=email,
            token=secrets.token_urlsafe(24),
            request_ip=client_ip,
        )

        from .emailer import send_email

        subject, text_body = _build_password_reset_otp_email(email, otp)
        try:
            send_email(email, subject, text_body)
        except Exception as exc:
            raise APIException(str(exc) or "Failed to send email") from exc

    return {
        "message": "Password reset OTP sent to your email",
        "expires_in_seconds": settings.OTP_EXPIRE_MINUTES * 60,
        "resend_after_seconds": settings.OTP_RESEND_SECONDS,
    }


def reset_password_with_otp(payload: dict) -> dict:
    email = normalize_email(payload["email"])
    otp = str(payload["otp"]).strip()
    new_password = payload["new_password"]

    if not is_allowed_email(email):
        raise ValidationError(f"Only @{settings.ALLOWED_EMAIL_DOMAIN} email addresses are allowed")

    user = User.objects.filter(email=email).first()
    if not user:
        raise ValidationError("Account not found. Register first.")

    record = _latest_pending_otp(email, RESET_PASSWORD_PURPOSE)
    if not record:
        raise ValidationError("OTP not found. Request a new reset OTP.")

    now = portal_now()
    if record.expires_at < now:
        record.used_at = now
        record.save(update_fields=["used_at"])
        raise ValidationError("OTP expired. Request a new reset OTP.")

    if record.otp_hash != hash_otp(email, RESET_PASSWORD_PURPOSE, otp):
        raise ValidationError("Invalid OTP")

    if verify_password(new_password, user.password_hash):
        raise ValidationError("New password must be different from current password")

    with transaction.atomic():
        user.password_hash = hash_password(new_password)
        user.auth_provider = "email_password"
        user.save(update_fields=["password_hash", "auth_provider"])

        record.user = user
        record.used_at = now
        record.save(update_fields=["user", "used_at"])

        latest_request = _latest_unused_password_reset_request(user.id, email)
        if latest_request:
            latest_request.used_at = now
            latest_request.save(update_fields=["used_at"])

    return {"message": "Password reset successful. Please login with your new password."}


def apply_authority_scope_to_query(queryset, role: str, user_department: str, requested_department: str | None):
    if role in {"department_coordinator", "department_hod"}:
        target_department = requested_department or user_department
        if _norm(target_department) != _norm(user_department):
            raise PermissionDenied("Not authorized for this department")
        return queryset.filter(data__department__iexact=target_department)

    if requested_department:
        return queryset.filter(data__department__iexact=requested_department)

    return queryset


def apply_application_search(queryset, q: str | None):
    if not q or not q.strip():
        return queryset

    term = q.strip()
    queryset = queryset.annotate(id_text=Cast("id", output_field=CharField()))
    return queryset.filter(
        Q(id_text__icontains=term)
        | Q(application_type__icontains=term)
        | Q(status__icontains=term)
        | Q(data__applicant_name__icontains=term)
        | Q(data__department__icontains=term)
        | Q(data__usn__icontains=term)
        | Q(data__email__icontains=term)
        | Q(data__course_title__icontains=term)
    )


def _collect_filtered_applications(base_query, matcher, *, limit: int, offset: int):
    collected: list[Application] = []
    skipped = 0
    scanned = 0
    page_offset = 0

    while scanned < REVIEW_SCAN_CAP and len(collected) < limit:
        batch = list(base_query[page_offset : page_offset + REVIEW_SCAN_BATCH])
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


def reviewers_for_stage(role: str, department: str | None):
    queryset = User.objects.filter(role=role)
    if role in {"department_coordinator", "department_hod"}:
        queryset = queryset.filter(department=(department or ""))
    return list(queryset.order_by("id").all())


def queue_review_alerts(reviewers, app: Application, applicant_name: str, department: str | None, stage_role: str) -> None:
    for reviewer in reviewers:
        queue_portal_notification(
            reviewer,
            message=f"{application_reference(app)} awaits your review",
        )


def enforce_form_window_open() -> None:
    window = FormWindow.objects.filter(id=1).first()
    if not window or window.start_date is None or window.end_date is None:
        return
    today = portal_today()
    if today < window.start_date or today > window.end_date:
        raise PermissionDenied(
            f"Form filling is open only from {window.start_date.isoformat()} to {window.end_date.isoformat()}"
        )


def _normalize_upload_payload(applicant_name: str, data: dict, *, include_bank_passbook: bool, include_designation: bool) -> dict:
    department = required_upper_text("Department", _required_form_value(data, "department", "Department"))
    applicant_name = required_upper_text("Applicant name", _required_form_value(data, "applicant_name", "Applicant name"))
    mobile_number = required_upper_text("Mobile number", _required_form_value(data, "mobile_number", "Mobile number"))
    academic_year = required_academic_year(_required_form_value(data, "academic_year", "Academic year"))
    academic_year_type = required_academic_year_type(_required_form_value(data, "academic_year_type", "Academic year type"))
    email = required_email(_required_form_value(data, "email", "Email"))
    course_category = required_category(_required_form_value(data, "course_category", "Course category"))
    requires_course_details = course_category not in NPTEL_STAR_CATEGORIES
    requires_registration_details = requires_course_details

    if requires_course_details:
        course_platform = required_upper_text("Course platform", _required_form_value(data, "course_platform", "Course platform"))
        course_title = required_upper_text("Course title", _required_form_value(data, "course_title", "Course title"))
        nptel_application_number = required_upper_text(
            "NPTEL application number",
            _required_form_value(data, "nptel_application_number", "NPTEL application number"),
        )
        course_session = required_upper_text("Course session", _required_form_value(data, "course_session", "Course session"))
        course_score = required_upper_text("Course score", _required_form_value(data, "course_score", "Course score"))
        course_weeks = _required_form_value(data, "course_weeks", "Course weeks")
        course_credits = _required_form_value(data, "course_credits", "Course credits")
    else:
        course_platform = None
        course_title = None
        nptel_application_number = None
        course_session = None
        course_score = None
        course_weeks = None
        course_credits = None

    if requires_registration_details:
        registration_fee_paid = _required_form_value(data, "registration_fee_paid", "Registration fee paid")
        permissible_claim = _required_form_value(data, "permissible_claim", "Permissible claim")
    else:
        registration_fee_paid = None
        permissible_claim = None
    fee_receipt_file = _required_upload_file(data, "fee_receipt_file", "Fee receipt file") if requires_course_details else None
    certificate_file = _required_upload_file(data, "certificate_file", "Certificate file")
    photograph_file = _required_upload_file(data, "photograph_file", "Photograph file")

    payload = {
        "department": department,
        "applicant_name": applicant_name,
        "mobile_number": mobile_number,
        "academic_year": academic_year,
        "academic_year_type": academic_year_type,
        "email": email,
        "incentive_claim_count": _required_form_value(data, "incentive_claim_count", "Incentive claim count"),
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
        "fee_receipt_file": save_upload(fee_receipt_file, applicant_name, "fee_receipt"),
        "certificate_file": save_upload(certificate_file, applicant_name, "certificate"),
        "photograph_file": save_photograph_upload(photograph_file, applicant_name),
        "signature_file": save_upload(
            data.get("signature_file"),
            applicant_name,
            "signature",
            allowed_extensions=SIGNATURE_UPLOAD_EXTENSIONS,
            allowed_content_types=SIGNATURE_UPLOAD_CONTENT_TYPES,
            invalid_type_detail="Only JPG or PNG files are allowed for signature upload",
        ),
        "declaration_accepted": _parse_form_bool(
            _required_form_value(data, "declaration_accepted", "Declaration acceptance"),
            "Declaration acceptance",
        ),
    }

    if include_bank_passbook:
        payload.update(
            {
                "usn": required_upper_text("USN", _required_form_value(data, "usn", "USN")),
                "semester": required_upper_text("Semester", _required_form_value(data, "semester", "Semester")),
                "bank_account_number": required_upper_text(
                    "Bank account number",
                    _required_form_value(data, "bank_account_number", "Bank account number"),
                ),
                "bank_ifsc": required_upper_text("Bank IFSC", _required_form_value(data, "bank_ifsc", "Bank IFSC")),
                "bank_branch": required_upper_text(
                    "Bank branch",
                    _required_form_value(data, "bank_branch", "Bank branch"),
                ),
                "bank_name": required_upper_text("Bank name", _required_form_value(data, "bank_name", "Bank name")),
                "bank_passbook_file": save_upload(
                    _required_upload_file(data, "bank_passbook_file", "Bank passbook file"),
                    applicant_name,
                    "bank_passbook",
                ),
            }
        )

    if include_designation:
        payload["designation"] = required_upper_text("Designation", _required_form_value(data, "designation", "Designation"))

    return payload


def create_student_application(owner: User, data: dict) -> Application:
    enforce_form_window_open()
    if owner.role != "student":
        raise PermissionDenied("Only students can submit this form")

    payload = _normalize_upload_payload(owner.name, data, include_bank_passbook=True, include_designation=False)

    with transaction.atomic():
        app = Application.objects.create(
            owner=owner,
            application_type="student",
            status="pending_department_coordinator",
            data=payload,
        )

        queue_portal_notification(
            owner,
            message=f"{application_reference(app)} received and sent for review.",
            email_subject="Application Received - SBJIT NPTEL Reimburse",
            email_headline="Your student application was submitted successfully and is now under review.",
            email_details=[
                f"Application ID: {app.id}",
                f"Department: {payload['department']}",
                f"Current status: {status_label(app.status)}",
                "You will receive an email whenever the status changes.",
            ],
        )
        queue_review_alerts(
            reviewers_for_stage("department_coordinator", payload["department"]),
            app,
            payload["applicant_name"],
            payload["department"],
            "department_coordinator",
        )

    return app


def create_faculty_application(owner: User, data: dict) -> Application:
    enforce_form_window_open()
    if owner.role != "faculty" and owner.role not in AUTHORITY_ROLES:
        raise PermissionDenied("Only faculty and authority users can submit this form")

    payload = _normalize_upload_payload(owner.name, data, include_bank_passbook=False, include_designation=True)

    with transaction.atomic():
        app = Application.objects.create(
            owner=owner,
            application_type="faculty",
            status="pending_department_coordinator",
            data=payload,
        )

        queue_portal_notification(
            owner,
            message=f"{application_reference(app)} received and sent for review.",
            email_subject="Application Received - SBJIT NPTEL Reimburse",
            email_headline="Your application was submitted successfully and is now under review.",
            email_details=[
                f"Application ID: {app.id}",
                f"Department: {payload['department']}",
                f"Current status: {status_label(app.status)}",
                "You will receive an email whenever the status changes.",
            ],
        )
        queue_review_alerts(
            reviewers_for_stage("department_coordinator", payload["department"]),
            app,
            payload["applicant_name"],
            payload["department"],
            "department_coordinator",
        )

    return app


def _backfill_approved_amount_for_apps(apps: list[Application]) -> int:
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
        Notification.objects.filter(user_id__in=owner_ids, message__icontains="is approved with amount Rs.")
        .order_by("-created_at")
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
        if not isinstance(data, dict):
            data = {}
        canonical_amount = app.approved_amount
        if canonical_amount in {None, ""}:
            data_amount = data.get("approved_amount")
            if data_amount not in {None, ""}:
                canonical_amount = float(data_amount)
                app.approved_amount = canonical_amount
                data["notification_approved_amount"] = canonical_amount
                app.data = data
                app.save(update_fields=["approved_amount", "data"])
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
        app.save(update_fields=["approved_amount", "data"])
        changed += 1

    return changed


def repair_legacy_review_history() -> int:
    """
    Backfill missing review history for legacy applications so strict
    reviewer_id-based "my approved/rejected" filters work reliably.
    """
    users = User.objects.filter(role__in=AUTHORITY_ROLES).all()

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
        Notification.objects.filter(message__icontains="is approved with amount Rs.")
        .order_by("-created_at")
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
    apps = Application.objects.order_by("id").all()
    for app in apps:
        data = app.data or {}
        if not isinstance(data, dict):
            data = {}
        reviews = data.get("reviews") or []
        if not isinstance(reviews, list):
            reviews = []

        existing_keys: set[tuple[str, str, int]] = set()
        for review in reviews:
            reviewer_id = review.get("reviewer_id")
            if reviewer_id is None:
                continue
            try:
                reviewer_int = int(reviewer_id)
            except (TypeError, ValueError):
                continue
            existing_keys.add((str(review.get("role")), str(review.get("action")), reviewer_int))

        status = app.status
        department = data.get("department")
        reviewed_at = portal_datetime_iso(app.created_at) if app.created_at else portal_datetime_iso(portal_now())
        changed = False

        def ensure_review(role: str, action: str, remark: str | None = None) -> None:
            nonlocal changed
            reviewer_id = pick_reviewer_id(role, department)
            if reviewer_id is None:
                return
            key = (role, action, reviewer_id)
            if key in existing_keys:
                return
            reviews.append(
                {
                    "role": role,
                    "action": action,
                    "reviewer_id": reviewer_id,
                    "remark": remark,
                    "reviewed_at": reviewed_at,
                }
            )
            existing_keys.add(key)
            changed = True

        if status in {"pending_department_hod", "pending_institution_coordinator", "approved"}:
            ensure_review("department_coordinator", "approve")
        if status in {"pending_institution_coordinator", "approved"}:
            ensure_review("department_hod", "approve")
        if status == "approved":
            ensure_review("institution_coordinator", "approve")

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
            if last_reject_role in AUTHORITY_ROLES:
                ensure_review(last_reject_role, "reject", data.get("last_reject_remark"))

        if changed:
            data["reviews"] = reviews
            app.data = data
            app.save()
            updated_count += 1

    return updated_count


def review_application_submission(application_id: int, reviewer: User, payload: dict) -> Application:
    role = reviewer.role
    if role not in AUTHORITY_ROLES:
        raise PermissionDenied("Not authorized")
    if payload["action"] not in {"approve", "reject"}:
        raise ValidationError("Invalid action")

    app = Application.objects.filter(id=application_id).first()
    if not app:
        raise NotFound("Application not found")
    data = app.data or {}
    if not isinstance(data, dict):
        data = {}

    if role in {"department_coordinator", "department_hod"} and _norm(data.get("department")) != _norm(reviewer.department):
        raise PermissionDenied("Not authorized for this department")

    expected_status = {
        "department_coordinator": "pending_department_coordinator",
        "department_hod": "pending_department_hod",
        "institution_coordinator": "pending_institution_coordinator",
    }[role]
    if app.status != expected_status:
        raise ValidationError("Application is not at your approval stage")

    applicant = User.objects.filter(id=app.owner_id).first()
    if not applicant:
        raise NotFound("Application owner not found")

    applicant_name = str(data.get("applicant_name") or applicant.name).strip()
    application_department = data.get("department") or applicant.department
    application_ref = application_reference(app)
    applicant_email = normalize_email(data.get("email")) or normalize_email(applicant.email)

    action = payload["action"]
    remark = payload.get("remark")
    approved_amount = payload.get("approved_amount")

    with transaction.atomic():
        if action == "reject":
            if not remark:
                raise ValidationError("Remark is required for rejection")
            role_label_value = role_label(role)
            app.status = "rejected"
            queue_portal_notification(
                applicant,
                message=f"{application_ref} was not approved by {role_label_value}. Remark: {remark}",
                email_subject="Application Update - Not Approved",
                email_headline=f"{application_ref} was reviewed and marked as not approved by {role_label_value}.",
                email_details=[
                    f"Application type: {app.application_type.title()}",
                    f"Department: {application_department or '-'}",
                    f"Remark: {remark}",
                    "Please update your application details and submit again if eligible.",
                ],
                email_to=applicant_email,
                email_recipient_name=applicant_name,
            )
        else:
            if role == "institution_coordinator":
                if approved_amount is None:
                    raise ValidationError("Approved amount is required")
                if approved_amount < 0:
                    raise ValidationError("Approved amount must be non-negative")
            next_status = {
                "department_coordinator": "pending_department_hod",
                "department_hod": "pending_institution_coordinator",
                "institution_coordinator": "approved",
            }[role]
            app.status = next_status
            if role == "institution_coordinator":
                queue_portal_notification(
                    applicant,
                    message=f"{application_ref} approved. Amount: Rs. {approved_amount:.2f}",
                    email_subject="Application Approved - SBJIT NPTEL Reimburse",
                    email_headline=f"Good news. {application_ref} has been approved.",
                    email_details=[
                        f"Application type: {app.application_type.title()}",
                        f"Approved amount: Rs. {approved_amount:.2f}",
                        "Please keep this email for your records.",
                    ],
                    email_to=applicant_email,
                    email_recipient_name=applicant_name,
                )
            else:
                queue_portal_notification(
                    applicant,
                    message=f"{application_ref} moved to {status_label(next_status)}.",
                    email_subject="Application Update - Moved to Next Stage",
                    email_headline=f"{application_ref} has moved to the next review stage.",
                    email_details=[
                        f"Application type: {app.application_type.title()}",
                        f"New status: {status_label(next_status)}",
                        "No action is required from your side at this stage.",
                    ],
                    email_to=applicant_email,
                    email_recipient_name=applicant_name,
                )
                next_role = {
                    "department_coordinator": "department_hod",
                    "department_hod": "institution_coordinator",
                }[role]
                queue_review_alerts(
                    reviewers_for_stage(next_role, application_department),
                    app,
                    applicant_name,
                    application_department,
                    next_role,
                )

        if action == "reject":
            data["last_reject_remark"] = remark
            data["last_reject_role"] = role
            if role == "institution_coordinator":
                app.approved_amount = None
        if action == "approve" and role == "institution_coordinator":
            app.approved_amount = approved_amount
            data["approved_amount"] = approved_amount
            data["notification_approved_amount"] = approved_amount
            data["approved_by_role"] = role
            data["approved_by_user_id"] = reviewer.id
            data["approved_at"] = portal_datetime_iso(portal_now())

        reviews = data.get("reviews") or []
        if not isinstance(reviews, list):
            reviews = []
        reviews.append(
            {
                "role": role,
                "action": action,
                "reviewer_id": reviewer.id,
                "remark": remark,
                "approved_amount": approved_amount if (action == "approve" and role == "institution_coordinator") else None,
                "reviewed_at": portal_datetime_iso(portal_now()),
            }
        )
        data["reviews"] = reviews
        app.data = data
        app.save(update_fields=["status", "approved_amount", "data"])

    return app


def public_approved_highlights(limit: int) -> list[dict]:
    apps = (
        Application.objects.filter(status="approved", application_type__in=["student", "faculty"])
        .order_by("-created_at")
        .all()[: _safe_limit(limit * 5)]
    )
    highlights: list[dict] = []
    for app in apps:
        data = app.data or {}
        if not isinstance(data, dict):
            continue
        photo = str(data.get("photograph_file") or "").strip()
        if not photo:
            continue

        highlights.append(
            {
                "id": app.id,
                "application_type": str(app.application_type or "").strip().lower(),
                "applicant_name": str(data.get("applicant_name") or data.get("application_name") or "Applicant").strip(),
                "course_category": str(data.get("course_category") or "Not Provided").strip(),
                "percentage": normalize_percentage(data.get("course_score")),
                "photograph_file": photo,
                "created_at": app.created_at,
            }
        )
        if len(highlights) >= limit:
            break
    return highlights


def collect_application_upload_refs(applications: list[Application]) -> list[str]:
    refs: list[str] = []
    for application in applications:
        data = application.data or {}
        if not isinstance(data, dict):
            continue
        for field in APPLICATION_UPLOAD_FIELDS:
            value = data.get(field)
            if isinstance(value, str) and value.strip():
                refs.append(value.strip())
    return refs


def delete_local_uploads(upload_refs: list[str]) -> None:
    for upload_ref in {ref for ref in upload_refs if ref.startswith("/uploads/")}:
        upload_name = Path(upload_ref).name
        if not upload_name:
            continue
        try:
            (Path(settings.MEDIA_ROOT) / upload_name).unlink(missing_ok=True)
        except OSError:
            continue


def delete_user_with_related_data(target: User) -> list[str]:
    user_id = target.id
    notices = Notice.objects.filter(created_by=user_id).all()
    applications = Application.objects.filter(owner_id=user_id).all()
    upload_refs = [notice.file_path for notice in notices if notice.file_path]
    upload_refs.extend(collect_application_upload_refs(list(applications)))

    EmailOtp.objects.filter(user_id=user_id).delete()
    EmailOtp.objects.filter(email=target.email).delete()
    Notification.objects.filter(user_id=user_id).delete()
    Feedback.objects.filter(user_id=user_id).delete()
    LoginEvent.objects.filter(user_id=user_id).delete()
    PasswordResetRequest.objects.filter(user_id=user_id).delete()
    Notice.objects.filter(created_by=user_id).delete()
    Application.objects.filter(owner_id=user_id).delete()
    target.delete()
    return upload_refs
