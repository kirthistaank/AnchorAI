"""Analytics: mood trends, emotion tracking, pattern detection, weekly summaries"""
import json
import logging
from datetime import datetime, timedelta, date
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func

import litellm
from src.config import settings

logger = logging.getLogger(__name__)


def get_mood_trends(user_id: str, days: int, db: Session) -> List[Dict[str, Any]]:
    """Return daily average mood for the past N days"""
    from src.database import Mood, Session as DBSession

    since = datetime.utcnow() - timedelta(days=days)

    rows = (
        db.query(
            func.date(Mood.created_at).label("day"),
            func.avg(Mood.scale).label("avg_mood"),
            func.count(Mood.id).label("count"),
        )
        .join(DBSession, Mood.session_id == DBSession.id)
        .filter(DBSession.user_id == user_id, Mood.created_at >= since)
        .group_by(func.date(Mood.created_at))
        .order_by(func.date(Mood.created_at))
        .all()
    )

    return [
        {"date": str(row.day), "avg_mood": round(float(row.avg_mood), 1), "count": row.count}
        for row in rows
    ]


def get_mood_distribution(user_id: str, days: int, db: Session) -> Dict[str, Any]:
    """Return mood scale distribution + overall stats"""
    from src.database import Mood, Session as DBSession

    since = datetime.utcnow() - timedelta(days=days)

    rows = (
        db.query(Mood.scale, func.count(Mood.id).label("count"))
        .join(DBSession, Mood.session_id == DBSession.id)
        .filter(DBSession.user_id == user_id, Mood.created_at >= since)
        .group_by(Mood.scale)
        .order_by(Mood.scale)
        .all()
    )

    distribution = {str(row.scale): row.count for row in rows}
    total = sum(r.count for r in rows)
    avg = sum(r.scale * r.count for r in rows) / total if total > 0 else 0

    return {
        "distribution": distribution,
        "total_entries": total,
        "average": round(avg, 1),
    }


def get_eval_metrics_summary(db: Session) -> Dict[str, Any]:
    """Return aggregated eval metrics for the monitoring dashboard"""
    from src.database import EvalMetrics

    rows = db.query(EvalMetrics).order_by(EvalMetrics.created_at.desc()).limit(200).all()

    if not rows:
        return {"message": "No eval metrics yet"}

    avg_latency = sum(r.total_latency_ms for r in rows if r.total_latency_ms) / len(rows)
    avg_quality = sum(r.avg_quality_score for r in rows if r.avg_quality_score) / len(rows)
    crisis_count = sum(1 for r in rows if r.crisis_signal_detected)
    injection_count = sum(1 for r in rows if r.prompt_injection_detected)

    # Daily latency for trend chart
    daily: Dict[str, list] = {}
    for r in rows:
        if r.created_at and r.total_latency_ms:
            day = str(r.created_at.date())
            daily.setdefault(day, []).append(r.total_latency_ms)

    latency_trend = [
        {"date": d, "avg_latency_ms": round(sum(v) / len(v))}
        for d, v in sorted(daily.items())
    ]

    return {
        "total_requests": len(rows),
        "avg_latency_ms": round(avg_latency),
        "avg_quality_score": round(avg_quality, 1),
        "crisis_signals": crisis_count,
        "injection_attempts": injection_count,
        "latency_trend": latency_trend,
    }


def generate_weekly_summary(user_id: str, db: Session) -> str:
    """Generate an LLM-powered weekly wellness summary"""
    from src.database import Mood, JournalEntry, Session as DBSession, User

    since = datetime.utcnow() - timedelta(days=7)

    user = db.query(User).filter(User.id == user_id).first()
    username = user.username if user else "there"

    moods = (
        db.query(Mood)
        .join(DBSession, Mood.session_id == DBSession.id)
        .filter(DBSession.user_id == user_id, Mood.created_at >= since)
        .order_by(Mood.created_at)
        .all()
    )

    entries = (
        db.query(JournalEntry)
        .join(DBSession, JournalEntry.session_id == DBSession.id)
        .filter(DBSession.user_id == user_id, JournalEntry.created_at >= since)
        .order_by(JournalEntry.created_at)
        .limit(20)
        .all()
    )

    if not moods and not entries:
        return f"Hi {username}! No data recorded this week yet. Start chatting and logging your mood to get weekly insights."

    mood_values = [m.scale for m in moods]
    avg_mood = round(sum(mood_values) / len(mood_values), 1) if mood_values else None

    # Summarise themes rather than dumping raw text
    themes = list({e.text[:120] for e in entries[:8]})
    themes_text = "\n- ".join(themes) if themes else "No journal entries this week."

    prompt = f"""Weekly wellness data for {username}:
- Mood scores: {mood_values} → average {avg_mood}/10
- Journal themes: {themes_text}

Write a focused 2-paragraph wellness summary for {username}:
- Paragraph 1: Mood pattern this week — what the numbers show, any notable shifts
- Paragraph 2: Key theme from their journal + one specific encouragement for next week

Rules:
- Start directly with the insight — no "I hope this finds you well" or any filler opener
- Address {username} by name at least once — never use [Name] or placeholders
- No sign-off, closing line, or "warm wishes" at the end
- Complete every sentence — do not trail off"""

    try:
        response = litellm.completion(
            model=settings.PRIMARY_MODEL,
            messages=[
                {"role": "system", "content": f"You are a concise wellness coach. Write focused summaries for {username}. No filler phrases, no sign-offs. Always complete your sentences."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.7,
            max_tokens=400,
            timeout=30,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"Weekly summary generation failed: {e}")
        avg_str = f"{avg_mood}/10" if avg_mood else "not recorded"
        return f"Hi {username}! This week you logged {len(moods)} mood check-ins (average: {avg_str}) and {len(entries)} journal entries. Consistency like this is the foundation of real growth — keep it up!"


def get_emotion_trends(user_id: str, period: str, db: Session) -> Dict[str, Any]:
    """Return emotion counts grouped by week / month / year"""
    from src.database import EmotionLog

    if period == "week":
        since = datetime.utcnow() - timedelta(weeks=12)
    elif period == "year":
        since = datetime(2020, 1, 1)
    else:  # month (default)
        since = datetime.utcnow() - timedelta(days=365)

    rows = (
        db.query(EmotionLog)
        .filter(EmotionLog.user_id == user_id, EmotionLog.created_at >= since)
        .order_by(EmotionLog.created_at)
        .all()
    )

    if not rows:
        return {"period": period, "data": [], "top_emotions": [], "emotion_totals": {}}

    def label(dt: datetime) -> str:
        if period == "week":
            return dt.strftime("%Y-W%V")
        if period == "year":
            return dt.strftime("%Y")
        return dt.strftime("%Y-%m")

    timeline: Dict[str, Dict[str, int]] = {}
    emotion_totals: Dict[str, int] = {}

    for row in rows:
        lbl = label(row.created_at)
        timeline.setdefault(lbl, {})
        timeline[lbl][row.emotion] = timeline[lbl].get(row.emotion, 0) + 1
        emotion_totals[row.emotion] = emotion_totals.get(row.emotion, 0) + 1

    top_emotions = sorted(emotion_totals, key=lambda e: emotion_totals[e], reverse=True)[:10]

    data = []
    for lbl in sorted(timeline.keys()):
        entry: Dict[str, Any] = {"label": lbl}
        for emotion in top_emotions:
            entry[emotion] = timeline[lbl].get(emotion, 0)
        data.append(entry)

    return {
        "period": period,
        "data": data,
        "top_emotions": top_emotions,
        "emotion_totals": emotion_totals,
    }


def get_satisfaction_stats(user_id: str, db: Session) -> Dict[str, Any]:
    """Return thumbs up/down counts and satisfaction percentage for a user"""
    from src.database import MessageFeedback

    rows = db.query(MessageFeedback).filter(MessageFeedback.user_id == user_id).all()
    thumbs_up = sum(1 for r in rows if r.rating == 1)
    thumbs_down = sum(1 for r in rows if r.rating == -1)
    total = len(rows)
    return {
        "thumbs_up": thumbs_up,
        "thumbs_down": thumbs_down,
        "satisfaction_pct": round((thumbs_up / total) * 100) if total > 0 else None,
    }


_NEGATIVE_EMOTIONS = {"anxious", "angry", "sad", "stressed", "frustrated", "scared", "shame", "guilty", "lonely", "disappointed"}
_POSITIVE_EMOTIONS = {"happy", "joy", "calm", "grateful", "content", "excited", "proud", "loved", "hopeful"}


def get_trigger_patterns(user_id: str, db: Session) -> Dict[str, Any]:
    """Use LLM to identify emotional triggers and what helps from last 90 days of data"""
    from src.database import Mood, JournalEntry, Session as DBSession, EmotionLog

    since = datetime.utcnow() - timedelta(days=90)

    moods = (
        db.query(Mood)
        .join(DBSession, Mood.session_id == DBSession.id)
        .filter(DBSession.user_id == user_id, Mood.created_at >= since)
        .order_by(Mood.created_at)
        .all()
    )

    entries = (
        db.query(JournalEntry)
        .join(DBSession, JournalEntry.session_id == DBSession.id)
        .filter(DBSession.user_id == user_id, JournalEntry.created_at >= since)
        .order_by(JournalEntry.created_at)
        .all()
    )

    emotion_rows = (
        db.query(EmotionLog.emotion, func.count(EmotionLog.id).label("cnt"))
        .filter(EmotionLog.user_id == user_id, EmotionLog.created_at >= since)
        .group_by(EmotionLog.emotion)
        .order_by(func.count(EmotionLog.id).desc())
        .limit(10)
        .all()
    )

    if len(moods) < 2 and len(entries) < 2:
        return {
            "patterns": None,
            "message": "Not enough data yet. Keep journaling for a week or two to see your patterns.",
        }

    # Map date → journal texts
    entry_by_date: Dict[date, List[str]] = {}
    for e in entries:
        entry_by_date.setdefault(e.created_at.date(), []).append(e.text[:250])

    low_texts: List[str] = []
    high_texts: List[str] = []
    for m in moods:
        texts = entry_by_date.get(m.created_at.date(), [])
        if m.scale <= 4:
            low_texts.extend(texts)
        elif m.scale >= 7:
            high_texts.extend(texts)

    all_emotion_names = [r.emotion for r in emotion_rows]
    negative = [e for e in all_emotion_names if e in _NEGATIVE_EMOTIONS][:5]
    positive = [e for e in all_emotion_names if e in _POSITIVE_EMOTIONS][:5]

    # Fall back to all entries if no mood-matched journal entries
    if not low_texts and not high_texts:
        low_texts = [e.text[:250] for e in entries[:8]]

    low_section = "\n- ".join(low_texts[:8]) if low_texts else "none recorded"
    high_section = "\n- ".join(high_texts[:8]) if high_texts else "none recorded"

    prompt = f"""Analyze this user's wellness journal data from the past 90 days.

LOW MOOD entries (mood ≤ 4/10):
- {low_section}

HIGH MOOD entries (mood ≥ 7/10):
- {high_section}

Frequent emotions overall: {", ".join(all_emotion_names) or "none"}
Negative emotions: {", ".join(negative) or "none"}
Positive emotions: {", ".join(positive) or "none"}

Identify specific patterns in this person's data. Be concrete — reference actual topics mentioned.
Reply with JSON only:
{{"triggers": ["trigger 1", "trigger 2", "trigger 3"], "helpers": ["helper 1", "helper 2"], "insight": "one key pattern insight about this person"}}"""

    try:
        response = litellm.completion(
            model=settings.PRIMARY_MODEL,
            messages=[
                {"role": "system", "content": "You are a wellness pattern analyst. Be specific, not generic. Reference the actual content. Return only valid JSON."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=250,
            timeout=30,
        )
        content = response.choices[0].message.content.strip()
        if "```" in content:
            content = content.split("```")[1].replace("json", "").strip()
        patterns = json.loads(content)
        return {"patterns": patterns, "data_points": len(moods) + len(entries)}
    except Exception as e:
        logger.error(f"Pattern detection failed: {e}")
        return {"patterns": None, "message": "Pattern analysis unavailable right now. Try again later."}
