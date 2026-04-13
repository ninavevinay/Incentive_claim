from collections.abc import Sequence
from fastapi import BackgroundTasks
from sqlalchemy.orm import Session
from app.core.email import send_email
from app.models.notification import Notification
from app.models.user import User


def _truncate_notification_message(message: str, limit: int = 255) -> str:
    if len(message) <= limit:
        return message
    return f"{message[: limit - 3].rstrip()}..."


def _build_email_body(recipient: User, headline: str, details: Sequence[str] | None = None) -> str:
    lines = [f"Hello {recipient.name},", "", headline.strip()]
    if details:
        visible_details = [detail.strip() for detail in details if detail and detail.strip()]
        if visible_details:
            lines.append("")
            lines.extend(f"- {detail}" for detail in visible_details)
    lines.extend([
        "",
        "This is an automated update from the SBJIT Incentive Portal.",
        "Portal Team",
    ])
    return "\n".join(lines)


def _send_email_safely(to_email: str, subject: str, text_body: str) -> None:
    try:
        send_email(to_email, subject, text_body)
    except RuntimeError as exc:
        print(f"[notification-email] skipped for {to_email}: {exc}")
    except Exception as exc:
        print(f"[notification-email] failed for {to_email}: {exc}")


def queue_portal_notification(
    db: Session,
    recipient: User,
    message: str,
    *,
    background_tasks: BackgroundTasks | None = None,
    email_subject: str | None = None,
    email_headline: str | None = None,
    email_details: Sequence[str] | None = None,
) -> None:
    db.add(Notification(user_id=recipient.id, message=_truncate_notification_message(message)))

    if background_tasks is None or not email_subject:
        return

    background_tasks.add_task(
        _send_email_safely,
        recipient.email,
        email_subject,
        _build_email_body(recipient, email_headline or message, email_details),
    )
