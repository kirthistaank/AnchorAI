"""APScheduler — daily reminder + weekly summary jobs"""
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

_scheduler = None


def _send_reminders() -> None:
    """Runs every minute — sends reminders to users whose reminder_time matches now (UTC HH:MM)."""
    from src.database import SessionLocal, User, PushSubscription
    from src.email_service import send_checkin_reminder
    from src.push_service import send_checkin_push

    now_hhmm = datetime.now(timezone.utc).strftime("%H:%M")
    db = SessionLocal()
    try:
        users = db.query(User).filter(
            User.reminder_enabled == True,
            User.reminder_time == now_hhmm,
            User.is_active == True,
        ).all()
        for user in users:
            logger.info(f"[SCHEDULER] Reminding {user.username}")
            if user.email_notifications and user.email:
                send_checkin_reminder(user.email, user.username)
            for sub in db.query(PushSubscription).filter(PushSubscription.user_id == user.id).all():
                send_checkin_push(
                    {"endpoint": sub.endpoint, "keys": {"p256dh": sub.p256dh, "auth": sub.auth}},
                    user.username,
                )
    except Exception as e:
        logger.error(f"[SCHEDULER] Reminder job error: {e}")
    finally:
        db.close()


def _send_weekly_summaries() -> None:
    """Runs every Monday 09:00 UTC — emails weekly summary to opted-in users."""
    from src.database import SessionLocal, User
    from src.email_service import send_weekly_summary_email
    from src.analytics import generate_weekly_summary

    db = SessionLocal()
    try:
        users = db.query(User).filter(
            User.email_notifications == True,
            User.is_active == True,
        ).all()
        for user in users:
            summary = generate_weekly_summary(user.id, db)
            send_weekly_summary_email(user.email, user.username, summary)
            logger.info(f"[SCHEDULER] Weekly summary sent to {user.username}")
    except Exception as e:
        logger.error(f"[SCHEDULER] Weekly summary job error: {e}")
    finally:
        db.close()


def start_scheduler() -> None:
    global _scheduler
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        _scheduler = BackgroundScheduler()
        _scheduler.add_job(_send_reminders, "cron", minute="*")
        _scheduler.add_job(_send_weekly_summaries, "cron", day_of_week="mon", hour=9, minute=0)
        _scheduler.start()
        logger.info("[SCHEDULER] Started")
    except ImportError:
        logger.warning("[SCHEDULER] apscheduler not installed — reminders disabled. Run: uv pip install apscheduler")
    except Exception as e:
        logger.warning(f"[SCHEDULER] Could not start: {e}")


def stop_scheduler() -> None:
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("[SCHEDULER] Stopped")
