import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr
from app.core.config import settings


def send_email(to_email: str, subject: str, text_body: str) -> None:
    if not settings.smtp_username or not settings.smtp_password or not settings.smtp_from_address:
        raise RuntimeError("SMTP is not configured in backend/.env")

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = formataddr((settings.smtp_from_name, settings.smtp_from_address))
    message["To"] = to_email
    message.set_content(text_body)

    if settings.smtp_use_ssl:
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, context=ssl.create_default_context()) as server:
            server.login(settings.smtp_username, settings.smtp_password)
            server.send_message(message)
        return

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
        server.ehlo()
        if settings.smtp_use_tls:
            server.starttls(context=ssl.create_default_context())
            server.ehlo()
        server.login(settings.smtp_username, settings.smtp_password)
        server.send_message(message)
