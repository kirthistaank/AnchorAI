"""Database models and setup"""
from sqlalchemy import create_engine, Column, String, DateTime, Float, Integer, Text, Boolean, JSON, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import uuid

from src.config import settings

Base = declarative_base()
engine = create_engine(settings.DATABASE_URL, echo=settings.DEBUG)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class User(Base):
    """User profile"""
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String(255), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)

    # Profile
    health_goals = Column(Text, nullable=True)
    preferred_strategies = Column(JSON, nullable=True)
    timezone = Column(String(50), default="UTC")

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)

    # Phase 3 — notifications
    reminder_enabled = Column(Boolean, default=False)
    reminder_time = Column(String(5), default="09:00")   # "HH:MM" UTC
    email_notifications = Column(Boolean, default=False)

    sessions = relationship("Session", back_populates="user")
    cost_tracking = relationship("CostTracking", back_populates="user")
    reset_tokens = relationship("PasswordResetToken", back_populates="user")


class PasswordResetToken(Base):
    """Password reset tokens"""
    __tablename__ = "password_reset_tokens"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    token_hash = Column(String(255), nullable=False, unique=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    used = Column(Boolean, default=False)

    user = relationship("User", back_populates="reset_tokens")


class Session(Base):
    """Conversation session"""
    __tablename__ = "sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    context = Column(JSON, nullable=True)  # Store session context

    user = relationship("User", back_populates="sessions")
    journal_entries = relationship("JournalEntry", back_populates="session")
    moods = relationship("Mood", back_populates="session")
    messages = relationship("Message", back_populates="session")


class Message(Base):
    """Chat message (user + bot)"""
    __tablename__ = "messages"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("sessions.id"), nullable=False)
    role = Column(String(50), nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)

    session = relationship("Session", back_populates="messages")


class JournalEntry(Base):
    """Journal entry"""
    __tablename__ = "journal_entries"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("sessions.id"), nullable=False)
    text = Column(Text, nullable=False)
    embedding_id = Column(String(36), nullable=True)  # ChromaDB ID
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("Session", back_populates="journal_entries")


class Mood(Base):
    """Mood log entry"""
    __tablename__ = "moods"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("sessions.id"), nullable=False)
    scale = Column(Integer, nullable=False)  # 1-10
    emotional_words = Column(JSON, nullable=True)  # ["anxious", "sad", "grateful"]
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("Session", back_populates="moods")


class CostTracking(Base):
    """Track API costs for budget management"""
    __tablename__ = "cost_tracking"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    model = Column(String(255), nullable=False)
    provider = Column(String(50), nullable=False)  # "anthropic", "ollama", etc.
    prompt_tokens = Column(Integer, nullable=False)
    completion_tokens = Column(Integer, nullable=False)
    cost_usd = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User", back_populates="cost_tracking")


class EvalMetrics(Base):
    """Evaluation metrics for model quality & safety"""
    __tablename__ = "eval_metrics"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("sessions.id"), nullable=True)

    # Response Quality (0-10 scale)
    coherence_score = Column(Float, nullable=True)
    relevance_score = Column(Float, nullable=True)
    tone_score = Column(Float, nullable=True)
    safety_score = Column(Float, nullable=True)
    avg_quality_score = Column(Float, nullable=True)

    # Tool Performance
    tool_name = Column(String(255), nullable=True)
    tool_success = Column(Boolean, nullable=True)
    tool_latency_ms = Column(Float, nullable=True)

    # Safety/Guardrails
    prompt_injection_detected = Column(Boolean, default=False)
    pii_detected = Column(Boolean, default=False)
    crisis_signal_detected = Column(Boolean, default=False)

    # Latency & Performance
    total_latency_ms = Column(Float, nullable=True)
    llm_latency_ms = Column(Float, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class UserMemory(Base):
    """Facts the agent has learned about a user across sessions"""
    __tablename__ = "user_memories"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    category = Column(String(50), default="general")  # personal_fact | challenge | goal | relationship
    created_at = Column(DateTime, default=datetime.utcnow)


class MessageFeedback(Base):
    """Thumbs up / down on assistant responses"""
    __tablename__ = "message_feedback"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    message_id = Column(String(36), ForeignKey("messages.id"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    rating = Column(Integer, nullable=False)  # 1 = thumbs up, -1 = thumbs down
    created_at = Column(DateTime, default=datetime.utcnow)


class EmotionLog(Base):
    """One row per detected emotion per user message"""
    __tablename__ = "emotion_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("sessions.id"), nullable=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    emotion = Column(String(50), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class BudgetAlert(Base):
    """Budget threshold alerts"""
    __tablename__ = "budget_alerts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    alert_level = Column(String(50), nullable=False)  # "warning", "critical"
    current_spend_usd = Column(Float, nullable=False)
    budget_limit_usd = Column(Float, nullable=False)
    percentage_used = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Habit(Base):
    __tablename__ = "habits"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    category = Column(String(50), default="custom")  # sleep|exercise|meditation|water|custom
    unit = Column(String(50), default="")
    target_value = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class HabitLog(Base):
    __tablename__ = "habit_logs"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    habit_id = Column(String(36), ForeignKey("habits.id"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    value = Column(Float, nullable=False)
    date = Column(String(10), nullable=False)    # "YYYY-MM-DD"
    created_at = Column(DateTime, default=datetime.utcnow)


class Goal(Base):
    __tablename__ = "goals"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    target_value = Column(Float, nullable=True)
    current_value = Column(Float, default=0.0)
    unit = Column(String(50), nullable=True)
    deadline = Column(String(10), nullable=True)    # "YYYY-MM-DD"
    status = Column(String(20), default="active")   # active|completed|abandoned
    created_at = Column(DateTime, default=datetime.utcnow)


class ExerciseSession(Base):
    __tablename__ = "exercise_sessions"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    exercise_type = Column(String(50), nullable=False)  # thought_record|breathing|grounding
    responses = Column(JSON, nullable=True)
    completed_at = Column(DateTime, default=datetime.utcnow)


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    endpoint = Column(Text, nullable=False)
    p256dh = Column(Text, nullable=False)
    auth = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


def init_db():
    """Initialize database tables"""
    Base.metadata.create_all(bind=engine)


def get_db():
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
