"""Tool implementations for the agent"""
from typing import Dict, Any, List, Optional
from datetime import datetime
import json
import logging
from sqlalchemy.orm import Session as DBSession

from src.database import JournalEntry, Mood, EvalMetrics

logger = logging.getLogger(__name__)


class ToolExecutor:
    """Executes tools for the agent"""

    @staticmethod
    def log_mood(
        session_id: str,
        scale: int,
        emotional_words: Optional[List[str]] = None,
        notes: Optional[str] = None,
        db: Optional[DBSession] = None,
    ) -> Dict[str, Any]:
        """Log mood entry"""
        if not db:
            return {"success": False, "error": "Database session required"}

        try:
            if not 1 <= scale <= 10:
                return {"success": False, "error": "Scale must be between 1-10"}

            mood = Mood(
                session_id=session_id,
                scale=scale,
                emotional_words=emotional_words or [],
                notes=notes,
            )
            db.add(mood)
            db.commit()
            db.refresh(mood)

            logger.info(f"Mood logged: scale={scale}, words={emotional_words}")
            return {
                "success": True,
                "mood_id": mood.id,
                "scale": scale,
                "emotional_words": emotional_words,
                "timestamp": mood.created_at.isoformat(),
            }
        except Exception as e:
            db.rollback()
            logger.error(f"Error logging mood: {str(e)}")
            return {"success": False, "error": str(e)}

    @staticmethod
    def log_journal_entry(
        session_id: str,
        text: str,
        db: Optional[DBSession] = None,
        embedding_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Log journal entry"""
        if not db:
            return {"success": False, "error": "Database session required"}

        try:
            if not text or len(text.strip()) < 5:
                return {"success": False, "error": "Journal entry must be at least 5 characters"}

            entry = JournalEntry(
                session_id=session_id,
                text=text,
                embedding_id=embedding_id,
            )
            db.add(entry)
            db.commit()
            db.refresh(entry)

            logger.info(f"Journal entry created: {entry.id}")
            return {
                "success": True,
                "entry_id": entry.id,
                "text_preview": text[:100] + "..." if len(text) > 100 else text,
                "timestamp": entry.created_at.isoformat(),
            }
        except Exception as e:
            db.rollback()
            logger.error(f"Error logging journal entry: {str(e)}")
            return {"success": False, "error": str(e)}

    @staticmethod
    def get_session_mood_history(
        session_id: str,
        limit: int = 10,
        db: Optional[DBSession] = None,
    ) -> Dict[str, Any]:
        """Get mood history for session"""
        if not db:
            return {"success": False, "error": "Database session required"}

        try:
            moods = db.query(Mood).filter(Mood.session_id == session_id).order_by(Mood.created_at.desc()).limit(limit).all()

            return {
                "success": True,
                "count": len(moods),
                "moods": [
                    {
                        "id": m.id,
                        "scale": m.scale,
                        "emotional_words": m.emotional_words,
                        "timestamp": m.created_at.isoformat(),
                    }
                    for m in moods
                ],
            }
        except Exception as e:
            logger.error(f"Error fetching mood history: {str(e)}")
            return {"success": False, "error": str(e)}

    @staticmethod
    def get_session_context(session_id: str, db: Optional[DBSession] = None) -> Dict[str, Any]:
        """Get relevant context for current session"""
        if not db:
            return {"success": False, "error": "Database session required"}

        try:
            # Get recent moods
            recent_moods = (
                db.query(Mood)
                .filter(Mood.session_id == session_id)
                .order_by(Mood.created_at.desc())
                .limit(5)
                .all()
            )

            # Get recent journal entries
            recent_entries = (
                db.query(JournalEntry)
                .filter(JournalEntry.session_id == session_id)
                .order_by(JournalEntry.created_at.desc())
                .limit(3)
                .all()
            )

            return {
                "success": True,
                "recent_moods": [
                    {"scale": m.scale, "words": m.emotional_words, "timestamp": m.created_at.isoformat()}
                    for m in recent_moods
                ],
                "recent_entries": [
                    {"text": e.text[:100], "timestamp": e.created_at.isoformat()}
                    for e in recent_entries
                ],
                "context_size": len(recent_moods) + len(recent_entries),
            }
        except Exception as e:
            logger.error(f"Error fetching session context: {str(e)}")
            return {"success": False, "error": str(e)}

    @staticmethod
    def store_eval_metrics(
        session_id: Optional[str],
        coherence_score: Optional[float] = None,
        relevance_score: Optional[float] = None,
        tone_score: Optional[float] = None,
        safety_score: Optional[float] = None,
        latency_ms: Optional[float] = None,
        db: Optional[DBSession] = None,
    ) -> Dict[str, Any]:
        """Store evaluation metrics"""
        if not db:
            return {"success": False, "error": "Database session required"}

        try:
            # Calculate average quality score
            scores = [s for s in [coherence_score, relevance_score, tone_score, safety_score] if s is not None]
            avg_score = sum(scores) / len(scores) if scores else None

            metrics = EvalMetrics(
                session_id=session_id,
                coherence_score=coherence_score,
                relevance_score=relevance_score,
                tone_score=tone_score,
                safety_score=safety_score,
                avg_quality_score=avg_score,
                total_latency_ms=latency_ms,
            )
            db.add(metrics)
            db.commit()

            logger.info(f"Eval metrics stored: avg_score={avg_score}")
            return {
                "success": True,
                "metrics_id": metrics.id,
                "avg_quality_score": avg_score,
            }
        except Exception as e:
            db.rollback()
            logger.error(f"Error storing eval metrics: {str(e)}")
            return {"success": False, "error": str(e)}


# Tool registry for LangGraph
AVAILABLE_TOOLS = {
    "log_mood": {
        "name": "log_mood",
        "description": "Log a mood entry (scale 1-10 + emotional words)",
        "parameters": {
            "type": "object",
            "properties": {
                "scale": {
                    "type": "integer",
                    "description": "Mood scale from 1-10",
                    "minimum": 1,
                    "maximum": 10,
                },
                "emotional_words": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of emotional words (e.g., ['anxious', 'grateful'])",
                },
            },
            "required": ["scale"],
        },
    },
    "log_journal_entry": {
        "name": "log_journal_entry",
        "description": "Log a journal entry",
        "parameters": {
            "type": "object",
            "properties": {
                "text": {
                    "type": "string",
                    "description": "Journal entry text",
                },
            },
            "required": ["text"],
        },
    },
    "get_session_context": {
        "name": "get_session_context",
        "description": "Get recent moods and journal entries for context",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
}
