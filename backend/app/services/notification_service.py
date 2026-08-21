from __future__ import annotations

import logging
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr
from typing import Optional

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.models import Notification, User

logger = logging.getLogger("api.notification")


def send_email_sync(to_email: str, subject: str, text_body: str) -> None:
    if not settings.SMTP_USERNAME or not settings.SMTP_PASSWORD or not settings.smtp_from_address:
        logger.warning(f"SMTP not configured. Skipping email to {to_email}")
        return

    try:
        message = EmailMessage()
        message["Subject"] = subject
        message["From"] = formataddr((settings.SMTP_FROM_NAME, settings.smtp_from_address))
        message["To"] = to_email
        message.set_content(text_body)

        if settings.SMTP_USE_SSL:
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, context=ssl.create_default_context()) as server:
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                server.send_message(message)
            return

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.ehlo()
            if settings.SMTP_USE_TLS:
                server.starttls(context=ssl.create_default_context())
                server.ehlo()
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.send_message(message)
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")


def dispatch_portal_notification(
    db: Session,
    user_id: int,
    message: str,
    email_subject: Optional[str] = None,
    email_text: Optional[str] = None,
) -> Notification:
    notif = Notification(
        user_id=user_id,
        message=message[:255],
        is_read=False,
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)

    if email_subject and email_text:
        user = db.query(User).filter(User.id == user_id).first()
        if user and user.email:
            send_email_sync(user.email, email_subject, email_text)

    return notif


def build_dept_coordinator_completed_email(
    department: str,
    coordinator_name: str,
    ready_count: int,
    ready_apps: Optional[list] = None,
    hod_name: Optional[str] = None,
) -> tuple[str, str]:
    subject = f"[SBJIT NPTEL Reimbursement] Review Notice: All Coordinator Reviews Completed for {department} ({ready_count} Application{'s' if ready_count != 1 else ''} Ready)"
    recipient_greeting = f"Dear Head of Department ({department})" if not hod_name else f"Dear Dr./Prof. {hod_name} (HOD, {department})"
    
    app_list_text = ""
    if ready_apps:
        app_list_text = "\nApplications Approved by Department Coordinator:\n"
        for idx, app in enumerate(ready_apps, 1):
            data = getattr(app, "data", {}) or {}
            applicant = data.get("applicant_name") or data.get("application_name") or "Applicant"
            course = data.get("course_title") or data.get("course_category") or "-"
            sem = data.get("semester") or "-"
            claim = data.get("incentive_claim_count") or "1"
            app_list_text += f"{idx}. Application #{app.id}: {applicant} | Sem: {sem} | Claim: {claim} | Course: {course}\n"
        app_list_text += "\n"

    body = (
        f"{recipient_greeting},\n\n"
        f"This is a formal notification to inform you that the Department Coordinator ({coordinator_name}) "
        f"has completed the initial review and verification of all submitted NPTEL incentive claim applications for the Department of {department}.\n\n"
        f"There are currently 0 remaining pending applications at the Department Coordinator stage. All approved applications have been forwarded to your stage and are now ready for your review and endorsement.\n\n"
        f"{app_list_text}"
        f"Summary of Department Status:\n"
        f"• Department: {department}\n"
        f"• Reviewing Coordinator: {coordinator_name}\n"
        f"• Total Applications Ready for HOD Review: {ready_count}\n\n"
        f"Action Required:\n"
        f"Please log in to the SBJIT NPTEL Reimbursement Portal at your earliest convenience to review, verify, and endorse the applications for institutional sanction.\n\n"
        f"Portal URL: http://localhost:5173\n\n"
        f"Best regards,\n"
        f"SBJIT NPTEL Reimbursement Portal\n"
        f"S. B. Jain Institute of Technology, Management & Research, Nagpur"
    )
    return subject, body


def build_hod_completed_email(
    hod_name: str,
    hod_department: str,
    ready_count: int,
    departments_list: list[str],
    ready_apps: Optional[list] = None,
    coordinator_name: Optional[str] = None,
) -> tuple[str, str]:
    subject = f"[SBJIT NPTEL Reimbursement] Final Review Notice: All Department HOD Reviews Completed ({ready_count} Application{'s' if ready_count != 1 else ''} Ready)"
    recipient_greeting = "Dear Institution Coordinator" if not coordinator_name else f"Dear {coordinator_name} (Institution Coordinator)"
    depts_str = ", ".join(departments_list) if departments_list else hod_department

    app_list_text = ""
    if ready_apps:
        app_list_text = "\nApplications Endorsed by Department HOD:\n"
        for idx, app in enumerate(ready_apps, 1):
            data = getattr(app, "data", {}) or {}
            applicant = data.get("applicant_name") or data.get("application_name") or "Applicant"
            dept = data.get("department") or "-"
            course = data.get("course_title") or data.get("course_category") or "-"
            sem = data.get("semester") or "-"
            claim = data.get("incentive_claim_count") or "1"
            app_list_text += f"{idx}. Application #{app.id}: {applicant} ({dept}) | Sem: {sem} | Claim: {claim} | Course: {course}\n"
        app_list_text += "\n"

    body = (
        f"{recipient_greeting},\n\n"
        f"This is a formal notification to inform you that Department Heads of Department (HODs) have completed the review and endorsement of all NPTEL incentive claim applications. There are currently 0 remaining applications pending at the Department HOD stage.\n\n"
        f"The applications have been forwarded to the Institutional stage and are now ready for your final review, sanctioning, and fund disbursement approval.\n\n"
        f"{app_list_text}"
        f"Summary of Institutional Status:\n"
        f"• Total Applications Ready for Final Review: {ready_count}\n"
        f"• Department(s) Included: {depts_str}\n"
        f"• Last Endorsement Completed By: {hod_name} ({hod_department})\n\n"
        f"Action Required:\n"
        f"Please log in to the SBJIT NPTEL Reimbursement Portal to conduct the final institutional review, assign approved reimbursement amounts, and grant final sanction for processing.\n\n"
        f"Portal URL: http://localhost:5173\n\n"
        f"Best regards,\n"
        f"SBJIT NPTEL Reimbursement Portal\n"
        f"S. B. Jain Institute of Technology, Management & Research, Nagpur"
    )
    return subject, body

