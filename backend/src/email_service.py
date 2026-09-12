"""Email notifications via Gmail SMTP (stdlib smtplib — no extra packages needed)"""
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from src.config import settings

logger = logging.getLogger(__name__)

_CARD_STYLE = "font-family:sans-serif;max-width:480px;margin:auto;background:#0f172a;color:#e2e8f0;padding:32px;border-radius:16px;"
_BTN_STYLE = "display:inline-block;margin-top:16px;background:#6366f1;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;"
_FOOTER_STYLE = "margin-top:24px;font-size:12px;color:#64748b;"


def send_email(to: str, subject: str, html_body: str) -> bool:
    if not settings.EMAIL_FROM or not settings.EMAIL_APP_PASSWORD:
        logger.warning("[EMAIL] Not configured — set EMAIL_FROM + EMAIL_APP_PASSWORD in .env")
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.EMAIL_FROM
        msg["To"] = to
        msg.attach(MIMEText(html_body, "html"))
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.login(settings.EMAIL_FROM, settings.EMAIL_APP_PASSWORD)
            smtp.sendmail(settings.EMAIL_FROM, to, msg.as_string())
        logger.info(f"[EMAIL] Sent '{subject}' to {to}")
        return True
    except Exception as e:
        logger.error(f"[EMAIL] Failed: {e}")
        return False


def send_checkin_reminder(to: str, username: str) -> bool:
    html = f"""
    <div style="{_CARD_STYLE}">
      <h2 style="color:#818cf8;">🧘 Time for your daily check-in</h2>
      <p>Hi {username},</p>
      <p>Just a gentle reminder to take a moment for yourself today. How are you feeling?</p>
      <a href="http://localhost:5173" style="{_BTN_STYLE}">Open AnchorAI</a>
      <p style="{_FOOTER_STYLE}">You can turn off email reminders in Profile → Notifications.</p>
    </div>"""
    return send_email(to, "🧘 Daily Check-in Reminder", html)


def send_weekly_summary_email(to: str, username: str, summary: str) -> bool:
    html = f"""
    <div style="{_CARD_STYLE}">
      <h2 style="color:#818cf8;">📊 Your Weekly Wellness Summary</h2>
      <p>Hi {username},</p>
      <div style="background:#1e293b;padding:20px;border-radius:12px;border-left:4px solid #6366f1;margin:16px 0;">
        <p style="margin:0;line-height:1.6;">{summary}</p>
      </div>
      <a href="http://localhost:5173/trends" style="{_BTN_STYLE}">View Full Trends</a>
      <p style="{_FOOTER_STYLE}">You can turn off email notifications in Profile → Notifications.</p>
    </div>"""
    return send_email(to, "📊 Your Weekly Wellness Summary", html)
