"""Browser push notifications via Web Push / VAPID (requires pywebpush)"""
import json
import logging

from src.config import settings

logger = logging.getLogger(__name__)


def send_push(subscription_info: dict, title: str, body: str, url: str = "/") -> bool:
    if not settings.VAPID_PRIVATE_KEY or not settings.VAPID_PUBLIC_KEY:
        logger.warning("[PUSH] VAPID keys not configured — run scripts/gen_vapid.py and add to .env")
        return False
    try:
        from pywebpush import webpush
        payload = json.dumps({"title": title, "body": body, "url": url})
        webpush(
            subscription_info=subscription_info,
            data=payload,
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims={"sub": settings.VAPID_CLAIMS_EMAIL},
        )
        logger.info(f"[PUSH] Sent '{title}'")
        return True
    except Exception as e:
        logger.error(f"[PUSH] Failed: {e}")
        return False


def send_checkin_push(subscription_info: dict, username: str) -> bool:
    return send_push(
        subscription_info,
        title="🧘 Daily Check-in",
        body=f"Hi {username}, time to check in with yourself today.",
        url="/",
    )
