import os
import smtplib
import ssl
from email.message import EmailMessage

EMAIL_BACKEND = os.getenv("EMAIL_BACKEND", "console")  # "console" (default) or "smtp"
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", "no-reply@fitclash.local")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")


def is_console_backend() -> bool:
    """True when there's no real email transport configured — i.e. local development.
    Callers use this to decide whether it's safe to also hand back a direct link in the
    API response, since otherwise the person has no way to see the email."""
    return EMAIL_BACKEND != "smtp" or not SMTP_HOST


def send_email(to: str, subject: str, body: str) -> None:
    if EMAIL_BACKEND == "smtp" and SMTP_HOST:
        msg = EmailMessage()
        msg["From"] = FROM_EMAIL
        msg["To"] = to
        msg["Subject"] = subject
        msg.set_content(body)
        context = ssl.create_default_context()
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls(context=context)
            if SMTP_USER and SMTP_PASSWORD:
                server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
    else:
        # Console backend: no SMTP configured, so we just log the email. This is the
        # default so the app runs with zero setup. See README for configuring real SMTP.
        print("\n----- EMAIL (console backend — configure SMTP_HOST etc. to send real emails) -----")
        print(f"To: {to}")
        print(f"Subject: {subject}")
        print(body)
        print("-----------------------------------------------------------------------------------\n")


def send_verification_email(to: str, name: str, raw_token: str) -> str:
    url = f"{FRONTEND_URL}/verify-email?token={raw_token}"
    body = (
        f"Hi {name},\n\n"
        f"Welcome to FitClash! Verify your email by visiting:\n{url}\n\n"
        f"This link expires in 24 hours.\n"
    )
    send_email(to, "Verify your FitClash email", body)
    return url


def send_password_reset_email(to: str, name: str, raw_token: str) -> str:
    url = f"{FRONTEND_URL}/reset-password?token={raw_token}"
    body = (
        f"Hi {name},\n\n"
        f"Someone requested a password reset for your FitClash account. Reset it here:\n{url}\n\n"
        f"This link expires in 1 hour. If you didn't request this, you can ignore this email.\n"
    )
    send_email(to, "Reset your FitClash password", body)
    return url
