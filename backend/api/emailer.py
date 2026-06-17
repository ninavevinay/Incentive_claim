from __future__ import annotations

import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr

from django.conf import settings


def send_email(to_email: str, subject: str, text_body: str) -> None:
    if not settings.SMTP_USERNAME or not settings.SMTP_PASSWORD or not settings.SMTP_FROM_ADDRESS:
        raise RuntimeError("SMTP is not configured in backend/.env")

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = formataddr((settings.SMTP_FROM_NAME, settings.SMTP_FROM_ADDRESS))
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

