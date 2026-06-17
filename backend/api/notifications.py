from __future__ import annotations

import threading
from collections.abc import Sequence

from django.db import transaction

from .emailer import send_email
from .models import User


def _truncate_notification_message(message: str, limit: int = 255) -> str:
    if len(message) <= limit:
        return message
    return f"{message[: limit - 3].rstrip()}..."


def _build_email_body(recipient_name: str, headline: str, details: Sequence[str] | None = None) -> str:
    safe_name = str(recipient_name or "").strip() or "Applicant"
    lines = [f"Hello {safe_name},", "", headline.strip()]
    if details:
        visible_details = [detail.strip() for detail in details if detail and detail.strip()]
        if visible_details:
            lines.append("")
            lines.extend(f"- {detail}" for detail in visible_details)
    lines.extend(
        [
            "",
            "This is an automated notification from SBJIT NPTEL Reimburse. Please do not reply to this email.",
            "For support, contact npteladmin.sbjit.edu.in.",
            "SBJIT NPTEL Reimburse Team",
        ]
    )
    return "\n".join(lines)


def _send_email_safely(to_email: str, subject: str, text_body: str) -> None:
    try:
        send_email(to_email, subject, text_body)
    except RuntimeError as exc:
        print(f"[notification-email] skipped for {to_email}: {exc}")
    except Exception as exc:
        print(f"[notification-email] failed for {to_email}: {exc}")


def queue_portal_notification(
    recipient: User,
    message: str,
    *,
    background_tasks: object | None = None,
    email_subject: str | None = None,
    email_headline: str | None = None,
    email_details: Sequence[str] | None = None,
    email_to: str | None = None,
    email_recipient_name: str | None = None,
) -> None:
    # Dashboard notifications are intentionally disabled.
    # Keep email delivery support for flows that still require email.

    if not email_subject:
        return

    target_email = str(email_to or recipient.email or "").strip().lower()
    if not target_email:
        return
    target_name = str(email_recipient_name or recipient.name or "").strip() or "Applicant"
    body = _build_email_body(target_name, email_headline or message, email_details)

    def _dispatch() -> None:
        thread = threading.Thread(
            target=_send_email_safely,
            args=(target_email, email_subject, body),
            daemon=True,
        )
        thread.start()

    transaction.on_commit(_dispatch)

