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
