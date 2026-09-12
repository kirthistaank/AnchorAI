"""FastAPI application for AnchorAI"""
import json
import secrets
import threading
import uuid
import logging
import time
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session as DBSessionType

from src.config import settings
from src.eval_judge import judge_response
from src.database import (
    init_db, get_db, User, Session as DBSession,
    Message, CostTracking, PasswordResetToken, MessageFeedback,
    UserMemory, Habit, HabitLog, Goal, ExerciseSession, PushSubscription,
)
from src.security import (
    hash_password, verify_password, create_access_token, get_current_user_id,
)
from src.schemas import (
    RegisterRequest, LoginRequest, AuthResponse,
    ForgotPasswordRequest, ResetPasswordRequest,
    ProfileResponse, UpdateProfileRequest,
)
from src.agent import AnchorAIAgent, extract_memories_from_turn
from src.guardrails import GuardrailsEngine
from src.tools import ToolExecutor
from src import stt_service, tts_service

logger = logging.getLogger(__name__)
logging.basicConfig(level=settings.LOG_LEVEL)

app = FastAPI(
    title="AnchorAI",
    description="Personal wellness AI agent — Phase 1.5",
    version="1.5.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    init_db()
    from src.scheduler import start_scheduler
    start_scheduler()
    logger.info("Database initialized")


@app.on_event("shutdown")
def shutdown():
    from src.scheduler import stop_scheduler
    stop_scheduler()


# ─────────────────────────────────────────────────────────────────────────────
# Phase 1 request/response models (kept for backward compat)
# ─────────────────────────────────────────────────────────────────────────────

class MessageRequest(BaseModel):
    session_id: str
    user_id: str
    message: str


class MessageResponse(BaseModel):
    message_id: str
    response: str
    intent: Optional[str] = None
    tool_used: Optional[str] = None
    latency_ms: float
    cost_usd: float = 0.0


class MoodLogRequest(BaseModel):
    session_id: str
    scale: int
    emotional_words: Optional[List[str]] = None


class MoodLogResponse(BaseModel):
    mood_id: str
    scale: int
    timestamp: datetime


class BudgetStatus(BaseModel):
    user_id: str
    monthly_budget: float
    current_spend: float
    remaining: float
    percentage_used: float
    can_use_claude: bool


class SessionCloseRequest(BaseModel):
    mood_end: int
    duration_minutes: int


class SessionCloseResponse(BaseModel):
    session_id: str
    summary: str
    affirmation: str
    closed_at: datetime


# ─────────────────────────────────────────────────────────────────────────────
# Background helpers (run in daemon threads — own DB session, no request lifecycle)
# ─────────────────────────────────────────────────────────────────────────────

# Notional local compute cost: $0.0001 per 1K tokens (electricity approximation)
_LOCAL_COST_PER_TOKEN = 0.0001 / 1000

def _run_eval_and_cost(session_id: str, user_id: str, user_msg: str, response: str, latency_ms: float):
    """LLM-as-judge eval + cost tracking in a daemon thread with its own DB session."""
    from src.database import get_db, CostTracking as CT
    db_gen = get_db()
    db = next(db_gen)
    try:
        scores = judge_response(user_msg, response)
        ToolExecutor.store_eval_metrics(
            session_id=session_id,
            coherence_score=scores["coherence"],
            relevance_score=scores["relevance"],
            tone_score=scores["tone"],
            safety_score=scores["safety"],
            latency_ms=latency_ms,
            db=db,
        )
        # Estimate local cost from text length (~4 chars per token)
        prompt_tokens = max(1, len(user_msg) // 4)
        completion_tokens = max(1, len(response) // 4)
        db.add(CT(
            user_id=user_id,
            model=settings.PRIMARY_MODEL,
            provider="ollama-local",
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            cost_usd=(prompt_tokens + completion_tokens) * _LOCAL_COST_PER_TOKEN,
        ))
        db.commit()
    except Exception as exc:
        logger.error(f"Background eval/cost failed: {exc}")
        db.rollback()
    finally:
        db.close()

def _fire_eval(session_id: str, user_id: str, user_msg: str, response: str, latency_ms: float):
    threading.Thread(
        target=_run_eval_and_cost,
        args=(session_id, user_id, user_msg, response, latency_ms),
        daemon=True,
    ).start()

# ─────────────────────────────────────────────────────────────────────────────
# Health
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


# ─────────────────────────────────────────────────────────────────────────────
# Auth endpoints
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/auth/register", response_model=AuthResponse)
def register(req: RegisterRequest, db: DBSessionType = Depends(get_db)):
    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if len(req.password.encode("utf-8")) > 72:
        raise HTTPException(status_code=400, detail="Password is too long (max 72 characters)")
    if db.query(User).filter(User.username == req.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    try:
        password_hash = hash_password(req.password)
    except ValueError:
        raise HTTPException(status_code=400, detail="Password is too long (max 72 characters)")

    user = User(
        username=req.username,
        email=req.email,
        password_hash=password_hash,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id)
    return AuthResponse(user_id=user.id, username=user.username, access_token=token)


@app.post("/auth/login", response_model=AuthResponse)
def login(req: LoginRequest, db: DBSessionType = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    user.last_login = datetime.utcnow()
    db.commit()

    token = create_access_token(user.id)
    return AuthResponse(user_id=user.id, username=user.username, access_token=token)


@app.post("/auth/logout")
def logout(user_id: str = Depends(get_current_user_id)):
    # JWT is stateless — client should discard the token
    return {"message": "Logged out successfully"}


@app.post("/auth/forgot-password")
def forgot_password(req: ForgotPasswordRequest, db: DBSessionType = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user:
        # Don't reveal whether email exists
        return {"message": "If that email exists, a reset token will be printed to the console."}

    reset_token = secrets.token_urlsafe(32)
    reset_obj = PasswordResetToken(
        user_id=user.id,
        token_hash=hash_password(reset_token),
        expires_at=datetime.utcnow() + timedelta(hours=1),
    )
    db.add(reset_obj)
    db.commit()

    # MVP: print to console instead of sending email
    print(f"\n[PASSWORD RESET] user={req.email} token={reset_token}\n")
    logger.info(f"[PASSWORD RESET] Token generated for {req.email} (check console)")

    return {"message": "If that email exists, a reset token will be printed to the console."}


@app.post("/auth/reset-password")
def reset_password(req: ResetPasswordRequest, db: DBSessionType = Depends(get_db)):
    # Find any unexpired, unused tokens
    candidates = db.query(PasswordResetToken).filter(
        PasswordResetToken.used == False,
        PasswordResetToken.expires_at > datetime.utcnow(),
    ).all()

    matched = next(
        (r for r in candidates if verify_password(req.token, r.token_hash)), None
    )
    if not matched:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    matched.user.password_hash = hash_password(req.new_password)
    matched.used = True
    db.commit()

    return {"message": "Password reset successful"}


# ─────────────────────────────────────────────────────────────────────────────
# User profile endpoints
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/users/me", response_model=ProfileResponse)
def get_profile(
    user_id: str = Depends(get_current_user_id),
    db: DBSessionType = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return ProfileResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        health_goals=user.health_goals,
        preferred_strategies=user.preferred_strategies or [],
        timezone=user.timezone,
        created_at=user.created_at,
        last_login=user.last_login,
    )


@app.put("/users/me/profile")
def update_profile(
    req: UpdateProfileRequest,
    user_id: str = Depends(get_current_user_id),
    db: DBSessionType = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if req.health_goals is not None:
        user.health_goals = req.health_goals
    if req.timezone is not None:
        user.timezone = req.timezone

    user.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Profile updated"}


# ─────────────────────────────────────────────────────────────────────────────
# Session & chat  (now JWT-protected)
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/start-session")
def start_session(
    user_id: str = Depends(get_current_user_id),
    db: DBSessionType = Depends(get_db),
):
    session = DBSession(id=str(uuid.uuid4()), user_id=user_id)
    db.add(session)
    db.commit()
    db.refresh(session)

    logger.info(f"Session started: {session.id}")
    return {
        "session_id": session.id,
        "user_id": user_id,
        "created_at": session.started_at,
    }


@app.post("/message", response_model=MessageResponse)
def send_message(
    req: MessageRequest,
    bg_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
    db: DBSessionType = Depends(get_db),
):
    start_time = time.time()

    # Ensure session belongs to this user
    session = db.query(DBSession).filter(
        DBSession.id == req.session_id,
        DBSession.user_id == user_id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    input_check = GuardrailsEngine.inspect_input(req.message)
    if not input_check["safe"]:
        raise HTTPException(status_code=400, detail=f"Input validation failed: {input_check['errors']}")

    if input_check.get("crisis_signals_detected"):
        crisis_response = GuardrailsEngine.format_crisis_response()
        db.add(Message(session_id=req.session_id, role="user", content=req.message))
        db.add(Message(session_id=req.session_id, role="assistant", content=crisis_response))
        db.commit()
        return MessageResponse(
            message_id=str(uuid.uuid4()),
            response=crisis_response,
            intent="crisis_detection",
            latency_ms=(time.time() - start_time) * 1000,
        )

    messages = db.query(Message).filter(Message.session_id == req.session_id).all()
    message_history = [{"role": m.role, "content": m.content} for m in messages[-10:]]
    message_history.append({"role": "user", "content": req.message})

    agent = AnchorAIAgent(db_session=db)
    agent_result = agent.run(req.session_id, user_id, message_history)

    if not agent_result.get("success"):
        raise HTTPException(status_code=500, detail=agent_result.get("error"))

    response_text = agent_result.get("response", "")

    output_check = GuardrailsEngine.inspect_output(response_text)
    if not output_check["safe"]:
        logger.warning(f"Output safety concerns: {output_check['concerns']}")

    db.add(Message(session_id=req.session_id, role="user", content=req.message))
    db.add(Message(session_id=req.session_id, role="assistant", content=response_text))
    db.commit()

    latency_ms = (time.time() - start_time) * 1000

    _fire_eval(req.session_id, user_id, req.message, response_text, latency_ms)
    bg_tasks.add_task(extract_memories_from_turn, user_id, req.message)

    logger.info(f"Message processed in {latency_ms:.0f}ms")
    return MessageResponse(
        message_id=str(uuid.uuid4()),
        response=response_text,
        intent=agent_result.get("intent"),
        tool_used=agent_result.get("tool_used"),
        latency_ms=latency_ms,
    )


@app.post("/log-mood", response_model=MoodLogResponse)
def log_mood(
    req: MoodLogRequest,
    user_id: str = Depends(get_current_user_id),
    db: DBSessionType = Depends(get_db),
):
    # Verify session ownership
    session = db.query(DBSession).filter(
        DBSession.id == req.session_id,
        DBSession.user_id == user_id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    result = ToolExecutor.log_mood(req.session_id, req.scale, req.emotional_words, db=db)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    return MoodLogResponse(
        mood_id=result["mood_id"],
        scale=result["scale"],
        timestamp=datetime.fromisoformat(result["timestamp"]),
    )


@app.get("/session/{session_id}")
def get_session(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
    db: DBSessionType = Depends(get_db),
):
    session = db.query(DBSession).filter(
        DBSession.id == session_id,
        DBSession.user_id == user_id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    messages = db.query(Message).filter(Message.session_id == session_id).all()
    return {
        "session_id": session.id,
        "user_id": session.user_id,
        "started_at": session.started_at.isoformat(),
        "ended_at": session.ended_at.isoformat() if session.ended_at else None,
        "messages": [
            {"role": m.role, "content": m.content, "timestamp": m.timestamp.isoformat()}
            for m in messages
        ],
    }


@app.post("/session/{session_id}/close", response_model=SessionCloseResponse)
def close_session(
    session_id: str,
    req: SessionCloseRequest,
    user_id: str = Depends(get_current_user_id),
    db: DBSessionType = Depends(get_db),
):
    session = db.query(DBSession).filter(
        DBSession.id == session_id,
        DBSession.user_id == user_id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.ended_at = datetime.utcnow()
    db.commit()

    # Generate session summary from recent messages
    messages = db.query(Message).filter(Message.session_id == session_id).all()
    assistant_messages = [m.content for m in messages if m.role == "assistant"][-3:]
    user_messages = [m.content for m in messages if m.role == "user"][-3:]

    # Create summary from last few exchanges
    summary = "You explored your thoughts and feelings with honesty today."
    if user_messages:
        topics = ", ".join([msg[:30] + "..." if len(msg) > 30 else msg for msg in user_messages[:2]])
        summary = f"Topics explored: {topics}"

    # Generate affirmation
    affirmations = [
        "You showed up for yourself today. That takes courage.",
        "Every conversation brings you closer to understanding yourself.",
        "You're building resilience with every session.",
        "Your willingness to reflect is a sign of strength.",
        "You're doing important work for your mental health.",
    ]
    import random
    affirmation = random.choice(affirmations)

    return SessionCloseResponse(
        session_id=session_id,
        summary=summary,
        affirmation=affirmation,
        closed_at=session.ended_at,
    )


@app.get("/budget/me", response_model=BudgetStatus)
def check_budget_me(
    user_id: str = Depends(get_current_user_id),
    db: DBSessionType = Depends(get_db),
):
    return _budget_for_user(user_id, db)


@app.get("/budget/{user_id}", response_model=BudgetStatus)
def check_budget(user_id: str, db: DBSessionType = Depends(get_db)):
    """Legacy endpoint — kept for Phase 1 frontend compat"""
    return _budget_for_user(user_id, db)


def _budget_for_user(user_id: str, db: DBSessionType) -> BudgetStatus:
    from datetime import date
    current_month = date.today().replace(day=1)

    current_spend = db.query(func.sum(CostTracking.cost_usd)).filter(
        CostTracking.user_id == user_id,
        CostTracking.created_at >= current_month,
    ).scalar() or 0.0

    remaining = settings.MONTHLY_BUDGET_USD - current_spend
    percentage_used = (current_spend / settings.MONTHLY_BUDGET_USD) * 100 if settings.MONTHLY_BUDGET_USD > 0 else 0

    return BudgetStatus(
        user_id=user_id,
        monthly_budget=settings.MONTHLY_BUDGET_USD,
        current_spend=current_spend,
        remaining=max(0, remaining),
        percentage_used=percentage_used,
        can_use_claude=remaining > 0.05,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Streaming endpoint (SSE)
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/message/stream")
def stream_message(
    req: MessageRequest,
    user_id: str = Depends(get_current_user_id),
    db: DBSessionType = Depends(get_db),
):
    start_time = time.time()

    session = db.query(DBSession).filter(
        DBSession.id == req.session_id,
        DBSession.user_id == user_id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    input_check = GuardrailsEngine.inspect_input(req.message)
    if not input_check["safe"]:
        raise HTTPException(status_code=400, detail=f"Input validation failed: {input_check['errors']}")

    if input_check.get("crisis_signals_detected"):
        crisis_response = GuardrailsEngine.format_crisis_response()
        db.add(Message(session_id=req.session_id, role="user", content=req.message))
        db.add(Message(session_id=req.session_id, role="assistant", content=crisis_response))
        db.commit()

        def crisis_gen():
            yield f'data: {json.dumps({"type": "token", "content": crisis_response})}\n\n'
            yield f'data: {json.dumps({"type": "done", "full_response": crisis_response, "intent": "crisis_detection", "latency_ms": (time.time() - start_time) * 1000})}\n\n'

        return StreamingResponse(crisis_gen(), media_type="text/event-stream")

    messages = db.query(Message).filter(Message.session_id == req.session_id).all()
    message_history = [{"role": m.role, "content": m.content} for m in messages[-10:]]
    message_history.append({"role": "user", "content": req.message})

    db.add(Message(session_id=req.session_id, role="user", content=req.message))
    db.commit()

    agent = AnchorAIAgent(db_session=db)

    def generate():
        msg_id = str(uuid.uuid4())
        for chunk in agent.run_stream(req.session_id, user_id, message_history):
            if chunk["type"] == "done":
                full_response = chunk.get("full_response", "")
                db.add(Message(id=msg_id, session_id=req.session_id, role="assistant", content=full_response))
                db.commit()
                chunk["message_id"] = msg_id
                _fire_eval(req.session_id, user_id, req.message, full_response, chunk.get("latency_ms", 0))
                extract_memories_from_turn(user_id, req.message)
            yield f"data: {json.dumps(chunk)}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


# ─────────────────────────────────────────────────────────────────────────────
# Analytics endpoints (Phase 2)
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/analytics/mood-trends")
def mood_trends(
    days: int = 30,
    user_id: str = Depends(get_current_user_id),
    db: DBSessionType = Depends(get_db),
):
    from src.analytics import get_mood_trends
    return get_mood_trends(user_id, days, db)


@app.get("/analytics/mood-distribution")
def mood_distribution(
    days: int = 30,
    user_id: str = Depends(get_current_user_id),
    db: DBSessionType = Depends(get_db),
):
    from src.analytics import get_mood_distribution
    return get_mood_distribution(user_id, days, db)


@app.get("/analytics/weekly-summary")
def weekly_summary(
    user_id: str = Depends(get_current_user_id),
    db: DBSessionType = Depends(get_db),
):
    from src.analytics import generate_weekly_summary
    return {"summary": generate_weekly_summary(user_id, db)}


@app.get("/analytics/dashboard")
def analytics_dashboard(
    user_id: str = Depends(get_current_user_id),
    db: DBSessionType = Depends(get_db),
):
    from src.analytics import get_eval_metrics_summary, get_satisfaction_stats
    metrics = get_eval_metrics_summary(db)
    satisfaction = get_satisfaction_stats(user_id, db)
    return {**metrics, **satisfaction}


@app.get("/analytics/emotions")
def emotion_trends(
    period: str = "month",
    user_id: str = Depends(get_current_user_id),
    db: DBSessionType = Depends(get_db),
):
    from src.analytics import get_emotion_trends
    return get_emotion_trends(user_id, period, db)


@app.get("/analytics/patterns")
def trigger_patterns(
    user_id: str = Depends(get_current_user_id),
    db: DBSessionType = Depends(get_db),
):
    from src.analytics import get_trigger_patterns
    return get_trigger_patterns(user_id, db)


# ─────────────────────────────────────────────────────────────────────────────
# Memory endpoints
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/memory")
def list_memories(
    user_id: str = Depends(get_current_user_id),
    db: DBSessionType = Depends(get_db),
):
    from src.database import UserMemory
    memories = (
        db.query(UserMemory)
        .filter(UserMemory.user_id == user_id)
        .order_by(UserMemory.created_at.desc())
        .all()
    )
    return [{"id": m.id, "content": m.content, "category": m.category, "created_at": m.created_at} for m in memories]


@app.delete("/memory/{memory_id}")
def delete_memory(
    memory_id: str,
    user_id: str = Depends(get_current_user_id),
    db: DBSessionType = Depends(get_db),
):
    from src.database import UserMemory
    mem = db.query(UserMemory).filter(
        UserMemory.id == memory_id,
        UserMemory.user_id == user_id,
    ).first()
    if not mem:
        raise HTTPException(status_code=404, detail="Memory not found")
    db.delete(mem)
    db.commit()
    return {"message": "Memory deleted"}


class FeedbackRequest(BaseModel):
    rating: int  # 1 = thumbs up, -1 = thumbs down


@app.post("/feedback/{message_id}")
def submit_feedback(
    message_id: str,
    req: FeedbackRequest,
    user_id: str = Depends(get_current_user_id),
    db: DBSessionType = Depends(get_db),
):
    if req.rating not in (1, -1):
        raise HTTPException(status_code=400, detail="Rating must be 1 or -1")

    msg = db.query(Message).filter(Message.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    existing = db.query(MessageFeedback).filter(
        MessageFeedback.message_id == message_id,
        MessageFeedback.user_id == user_id,
    ).first()

    if existing:
        existing.rating = req.rating
    else:
        db.add(MessageFeedback(message_id=message_id, user_id=user_id, rating=req.rating))

    db.commit()
    return {"message": "Feedback recorded"}


# ─────────────────────────────────────────────────────────────────────────────
# Habits
# ─────────────────────────────────────────────────────────────────────────────

class HabitCreate(BaseModel):
    name: str
    category: str = "custom"
    unit: str = ""
    target_value: Optional[float] = None


class HabitLogCreate(BaseModel):
    value: float
    date: Optional[str] = None  # YYYY-MM-DD; defaults to today UTC


@app.get("/habits")
def list_habits(user_id: str = Depends(get_current_user_id), db: DBSessionType = Depends(get_db)):
    habits = db.query(Habit).filter(Habit.user_id == user_id).order_by(Habit.created_at).all()
    return [{"id": h.id, "name": h.name, "category": h.category, "unit": h.unit, "target_value": h.target_value} for h in habits]


@app.post("/habits", status_code=201)
def create_habit(req: HabitCreate, user_id: str = Depends(get_current_user_id), db: DBSessionType = Depends(get_db)):
    habit = Habit(user_id=user_id, **req.model_dump())
    db.add(habit); db.commit(); db.refresh(habit)
    return {"id": habit.id, "name": habit.name, "category": habit.category, "unit": habit.unit, "target_value": habit.target_value}


@app.delete("/habits/{habit_id}")
def delete_habit(habit_id: str, user_id: str = Depends(get_current_user_id), db: DBSessionType = Depends(get_db)):
    h = db.query(Habit).filter(Habit.id == habit_id, Habit.user_id == user_id).first()
    if not h:
        raise HTTPException(404, "Habit not found")
    db.delete(h); db.commit()
    return {"message": "Deleted"}


@app.post("/habits/{habit_id}/log")
def log_habit(habit_id: str, req: HabitLogCreate, user_id: str = Depends(get_current_user_id), db: DBSessionType = Depends(get_db)):
    from datetime import date as dt_date
    if not db.query(Habit).filter(Habit.id == habit_id, Habit.user_id == user_id).first():
        raise HTTPException(404, "Habit not found")
    log_date = req.date or dt_date.today().isoformat()
    existing = db.query(HabitLog).filter(HabitLog.habit_id == habit_id, HabitLog.date == log_date).first()
    if existing:
        existing.value = existing.value + req.value
    else:
        db.add(HabitLog(habit_id=habit_id, user_id=user_id, value=req.value, date=log_date))
    db.commit()
    return {"message": "Logged"}


@app.get("/habits/logs")
def habit_logs(days: int = 30, user_id: str = Depends(get_current_user_id), db: DBSessionType = Depends(get_db)):
    from datetime import date as dt_date, timedelta
    since = (dt_date.today() - timedelta(days=days)).isoformat()
    logs = db.query(HabitLog).filter(HabitLog.user_id == user_id, HabitLog.date >= since).order_by(HabitLog.date).all()
    habits = {h.id: h for h in db.query(Habit).filter(Habit.user_id == user_id).all()}
    result: dict = {}
    for log in logs:
        h = habits.get(log.habit_id)
        if h:
            result.setdefault(log.habit_id, {
                "habit": {"id": h.id, "name": h.name, "unit": h.unit, "target_value": h.target_value, "category": h.category},
                "logs": [],
            })
            result[log.habit_id]["logs"].append({"date": log.date, "value": log.value})
    return list(result.values())


@app.get("/habits/{habit_id}/logs")
def habit_logs_for_habit(habit_id: str, days: int = 7, user_id: str = Depends(get_current_user_id), db: DBSessionType = Depends(get_db)):
    from datetime import date as dt_date, timedelta
    if not db.query(Habit).filter(Habit.id == habit_id, Habit.user_id == user_id).first():
        raise HTTPException(404, "Habit not found")
    since = (dt_date.today() - timedelta(days=days)).isoformat()
    logs = db.query(HabitLog).filter(HabitLog.habit_id == habit_id, HabitLog.date >= since).order_by(HabitLog.date).all()
    return [{"logged_date": l.date, "value": l.value} for l in logs]


@app.get("/habits/{habit_id}/streak")
def habit_streak(habit_id: str, user_id: str = Depends(get_current_user_id), db: DBSessionType = Depends(get_db)):
    from datetime import date as dt_date, timedelta
    if not db.query(Habit).filter(Habit.id == habit_id, Habit.user_id == user_id).first():
        raise HTTPException(404, "Habit not found")
    logs = db.query(HabitLog).filter(HabitLog.habit_id == habit_id).order_by(HabitLog.date.desc()).limit(400).all()
    logged_dates = {l.date for l in logs}
    streak = 0
    check = dt_date.today()
    while check.isoformat() in logged_dates:
        streak += 1
        check -= timedelta(days=1)
    return {"streak": streak}


# ─────────────────────────────────────────────────────────────────────────────
# Goals
# ─────────────────────────────────────────────────────────────────────────────

class GoalCreate(BaseModel):
    title: str
    description: Optional[str] = None
    target_value: Optional[float] = None
    current_value: Optional[float] = 0.0
    unit: Optional[str] = None
    deadline: Optional[str] = None


class GoalUpdate(BaseModel):
    status: Optional[str] = None   # active | completed | abandoned
    current_value: Optional[float] = None


@app.get("/goals")
def list_goals(user_id: str = Depends(get_current_user_id), db: DBSessionType = Depends(get_db)):
    goals = db.query(Goal).filter(Goal.user_id == user_id).order_by(Goal.created_at.desc()).all()
    return [{"id": g.id, "title": g.title, "description": g.description, "target_value": g.target_value,
             "current_value": g.current_value or 0.0, "unit": g.unit, "deadline": g.deadline,
             "status": g.status, "created_at": g.created_at} for g in goals]


@app.post("/goals", status_code=201)
def create_goal(req: GoalCreate, user_id: str = Depends(get_current_user_id), db: DBSessionType = Depends(get_db)):
    goal = Goal(user_id=user_id, **req.model_dump())
    db.add(goal); db.commit(); db.refresh(goal)
    return {"id": goal.id, "title": goal.title, "status": goal.status, "current_value": goal.current_value, "created_at": goal.created_at}


@app.put("/goals/{goal_id}")
def update_goal(goal_id: str, req: GoalUpdate, user_id: str = Depends(get_current_user_id), db: DBSessionType = Depends(get_db)):
    goal = db.query(Goal).filter(Goal.id == goal_id, Goal.user_id == user_id).first()
    if not goal:
        raise HTTPException(404, "Goal not found")
    if req.status is not None:
        goal.status = req.status
    if req.current_value is not None:
        goal.current_value = req.current_value
    db.commit()
    return {"message": "Updated"}


@app.delete("/goals/{goal_id}")
def delete_goal(goal_id: str, user_id: str = Depends(get_current_user_id), db: DBSessionType = Depends(get_db)):
    goal = db.query(Goal).filter(Goal.id == goal_id, Goal.user_id == user_id).first()
    if not goal:
        raise HTTPException(404, "Goal not found")
    db.delete(goal); db.commit()
    return {"message": "Deleted"}


# ─────────────────────────────────────────────────────────────────────────────
# CBT Exercises
# ─────────────────────────────────────────────────────────────────────────────

class ExerciseSessionCreate(BaseModel):
    exercise_type: str
    responses: Optional[dict] = None


@app.post("/exercises/session", status_code=201)
def save_exercise_session(req: ExerciseSessionCreate, user_id: str = Depends(get_current_user_id), db: DBSessionType = Depends(get_db)):
    s = ExerciseSession(user_id=user_id, exercise_type=req.exercise_type, responses=req.responses)
    db.add(s); db.commit(); db.refresh(s)
    return {"id": s.id, "exercise_type": s.exercise_type, "completed_at": s.completed_at}


@app.get("/exercises/history")
def exercise_history(user_id: str = Depends(get_current_user_id), db: DBSessionType = Depends(get_db)):
    sessions = db.query(ExerciseSession).filter(ExerciseSession.user_id == user_id).order_by(ExerciseSession.completed_at.desc()).limit(50).all()
    return [{"id": s.id, "exercise_type": s.exercise_type, "completed_at": s.completed_at} for s in sessions]


# ─────────────────────────────────────────────────────────────────────────────
# Journal export
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/export/journal")
def export_journal(user_id: str = Depends(get_current_user_id), db: DBSessionType = Depends(get_db)):
    from src.database import JournalEntry
    from fastapi.responses import Response as FResponse
    entries = (
        db.query(JournalEntry)
        .join(DBSession, JournalEntry.session_id == DBSession.id)
        .filter(DBSession.user_id == user_id)
        .order_by(JournalEntry.created_at)
        .all()
    )
    if not entries:
        return FResponse(content="# My Journal\n\nNo entries yet.", media_type="text/markdown",
                         headers={"Content-Disposition": "attachment; filename=my_journal.md"})
    lines = ["# My AnchorAI Journal\n"]
    for e in entries:
        lines.append(f"## {e.created_at.strftime('%Y-%m-%d %H:%M')}\n\n{e.text}\n")
    return FResponse(
        content="\n---\n\n".join(lines),
        media_type="text/markdown",
        headers={"Content-Disposition": "attachment; filename=my_journal.md"},
    )


# ─────────────────────────────────────────────────────────────────────────────
# Notification preferences & push subscriptions
# ─────────────────────────────────────────────────────────────────────────────

class NotificationPrefsRequest(BaseModel):
    reminder_enabled: Optional[bool] = None
    reminder_time: Optional[str] = None   # "HH:MM" UTC
    email_notifications: Optional[bool] = None


class PushSubscribeRequest(BaseModel):
    endpoint: str
    p256dh: str
    auth: str


@app.get("/users/me/notifications")
def get_notification_prefs(user_id: str = Depends(get_current_user_id), db: DBSessionType = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    push_count = db.query(PushSubscription).filter(PushSubscription.user_id == user_id).count()
    return {
        "reminder_enabled": user.reminder_enabled,
        "reminder_time": user.reminder_time,
        "email_notifications": user.email_notifications,
        "push_subscribed": push_count > 0,
    }


@app.put("/users/me/notifications")
def update_notification_prefs(req: NotificationPrefsRequest, user_id: str = Depends(get_current_user_id), db: DBSessionType = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    if req.reminder_enabled is not None:
        user.reminder_enabled = req.reminder_enabled
    if req.reminder_time is not None:
        user.reminder_time = req.reminder_time
    if req.email_notifications is not None:
        user.email_notifications = req.email_notifications
    db.commit()
    return {"message": "Preferences updated"}


@app.get("/notifications/vapid-public-key")
def vapid_public_key():
    return {"vapid_public_key": settings.VAPID_PUBLIC_KEY, "public_key": settings.VAPID_PUBLIC_KEY}


@app.get("/notifications/prefs")
def get_notif_prefs_alias(user_id: str = Depends(get_current_user_id), db: DBSessionType = Depends(get_db)):
    return get_notification_prefs(user_id=user_id, db=db)


@app.put("/notifications/prefs")
def update_notif_prefs_alias(req: NotificationPrefsRequest, user_id: str = Depends(get_current_user_id), db: DBSessionType = Depends(get_db)):
    return update_notification_prefs(req=req, user_id=user_id, db=db)


@app.post("/notifications/push/subscribe", status_code=201)
def push_subscribe_alias(req: PushSubscribeRequest, user_id: str = Depends(get_current_user_id), db: DBSessionType = Depends(get_db)):
    return subscribe_push(req=req, user_id=user_id, db=db)


@app.post("/notifications/push/test")
def push_test_alias(user_id: str = Depends(get_current_user_id), db: DBSessionType = Depends(get_db)):
    return test_notification(user_id=user_id, db=db)


@app.post("/notifications/subscribe")
def subscribe_push(req: PushSubscribeRequest, user_id: str = Depends(get_current_user_id), db: DBSessionType = Depends(get_db)):
    existing = db.query(PushSubscription).filter(
        PushSubscription.user_id == user_id,
        PushSubscription.endpoint == req.endpoint,
    ).first()
    if existing:
        existing.p256dh = req.p256dh
        existing.auth = req.auth
    else:
        db.add(PushSubscription(user_id=user_id, endpoint=req.endpoint, p256dh=req.p256dh, auth=req.auth))
    db.commit()
    return {"message": "Subscribed"}


@app.delete("/notifications/unsubscribe")
def unsubscribe_push(user_id: str = Depends(get_current_user_id), db: DBSessionType = Depends(get_db)):
    db.query(PushSubscription).filter(PushSubscription.user_id == user_id).delete()
    db.commit()
    return {"message": "Unsubscribed"}


@app.post("/notifications/test")
def test_notification(user_id: str = Depends(get_current_user_id), db: DBSessionType = Depends(get_db)):
    from src.email_service import send_checkin_reminder
    from src.push_service import send_checkin_push
    user = db.query(User).filter(User.id == user_id).first()
    results: dict = {}
    if user.email_notifications and user.email:
        results["email"] = send_checkin_reminder(user.email, user.username)
    subs = db.query(PushSubscription).filter(PushSubscription.user_id == user_id).all()
    results["push"] = all(
        send_checkin_push({"endpoint": s.endpoint, "keys": {"p256dh": s.p256dh, "auth": s.auth}}, user.username)
        for s in subs
    ) if subs else False
    return results


class SpeakRequest(BaseModel):
    text: str


@app.get("/voice/status")
async def voice_status():
    tts_ok = await tts_service.is_available()
    return {
        "stt_available": stt_service.is_available(),
        "tts_available": tts_ok,
    }


@app.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    current_user_id: str = Depends(get_current_user_id),
):
    audio_bytes = await file.read()
    if len(audio_bytes) < 100:
        raise HTTPException(status_code=400, detail="Audio too short")
    text = stt_service.transcribe(audio_bytes)
    if text is None:
        raise HTTPException(status_code=503, detail="STT service unavailable — install faster-whisper")
    return {"text": text}


@app.post("/speak")
async def speak_text(
    request: SpeakRequest,
    current_user_id: str = Depends(get_current_user_id),
):
    audio = await tts_service.synthesize(request.text)
    if audio is None:
        raise HTTPException(status_code=503, detail="TTS service unavailable — start Fish Speech server")
    return Response(content=audio, media_type="audio/wav")


@app.get("/admin/metrics")
def admin_metrics(
    _: str = Depends(get_current_user_id),
    db: DBSessionType = Depends(get_db),
):
    from src.database import EvalMetrics, CostTracking, MessageFeedback, User, Session as DBSession, Message
    from sqlalchemy import func as sqlfunc

    # Overview counts
    total_users = db.query(sqlfunc.count(User.id)).scalar() or 0
    total_sessions = db.query(sqlfunc.count(DBSession.id)).scalar() or 0
    total_messages = db.query(sqlfunc.count(Message.id)).scalar() or 0
    total_cost = db.query(sqlfunc.sum(CostTracking.cost_usd)).scalar() or 0.0

    # Latest 500 eval rows
    evals = db.query(EvalMetrics).order_by(EvalMetrics.created_at.desc()).limit(500).all()

    def _avg(vals):
        filtered = [v for v in vals if v is not None]
        return round(sum(filtered) / len(filtered), 2) if filtered else None

    quality = {
        "coherence": _avg([e.coherence_score for e in evals]),
        "relevance": _avg([e.relevance_score for e in evals]),
        "tone": _avg([e.tone_score for e in evals]),
        "safety": _avg([e.safety_score for e in evals]),
        "overall": _avg([e.avg_quality_score for e in evals]),
    }

    guardrails = {
        "injection_attempts": sum(1 for e in evals if e.prompt_injection_detected),
        "pii_detected": sum(1 for e in evals if e.pii_detected),
        "crisis_signals": sum(1 for e in evals if e.crisis_signal_detected),
    }

    # Latency trend (last 30 days, daily buckets)
    daily_lat: dict = {}
    for e in evals:
        if e.created_at and e.total_latency_ms:
            day = str(e.created_at.date())
            daily_lat.setdefault(day, []).append(e.total_latency_ms)
    latency_trend = [
        {"date": d, "avg_ms": round(sum(v) / len(v))}
        for d, v in sorted(daily_lat.items())
    ][-30:]

    # Tool usage
    tool_rows: dict = {}
    for e in evals:
        if e.tool_name:
            t = tool_rows.setdefault(e.tool_name, {"calls": 0, "success": 0, "latencies": []})
            t["calls"] += 1
            if e.tool_success:
                t["success"] += 1
            if e.tool_latency_ms:
                t["latencies"].append(e.tool_latency_ms)
    tools = [
        {
            "name": name,
            "calls": d["calls"],
            "success_rate": round(d["success"] / d["calls"] * 100) if d["calls"] else 0,
            "avg_latency_ms": round(sum(d["latencies"]) / len(d["latencies"])) if d["latencies"] else None,
        }
        for name, d in sorted(tool_rows.items(), key=lambda x: x[1]["calls"], reverse=True)
    ]

    # Cost by model
    cost_rows = (
        db.query(CostTracking.model, sqlfunc.sum(CostTracking.cost_usd).label("total"),
                 sqlfunc.sum(CostTracking.prompt_tokens + CostTracking.completion_tokens).label("tokens"))
        .group_by(CostTracking.model)
        .all()
    )
    cost_by_model = [
        {"model": r.model, "cost_usd": round(float(r.total or 0), 4), "tokens": int(r.tokens or 0)}
        for r in cost_rows
    ]

    # Daily cost trend
    daily_cost_rows = (
        db.query(sqlfunc.date(CostTracking.created_at).label("day"),
                 sqlfunc.sum(CostTracking.cost_usd).label("cost"))
        .group_by(sqlfunc.date(CostTracking.created_at))
        .order_by(sqlfunc.date(CostTracking.created_at))
        .all()
    )
    cost_trend = [
        {"date": str(r.day), "cost_usd": round(float(r.cost or 0), 4)}
        for r in daily_cost_rows
    ][-30:]

    # Feedback
    feedback_rows = db.query(MessageFeedback).all()
    thumbs_up = sum(1 for r in feedback_rows if r.rating == 1)
    thumbs_down = sum(1 for r in feedback_rows if r.rating == -1)
    total_fb = len(feedback_rows)

    return {
        "overview": {
            "total_users": total_users,
            "total_sessions": total_sessions,
            "total_messages": total_messages,
            "total_cost_usd": round(float(total_cost), 4),
            "total_eval_rows": len(evals),
        },
        "quality": quality,
        "guardrails": guardrails,
        "latency_trend": latency_trend,
        "tools": tools,
        "cost_by_model": cost_by_model,
        "cost_trend": cost_trend,
        "feedback": {
            "thumbs_up": thumbs_up,
            "thumbs_down": thumbs_down,
            "total": total_fb,
            "satisfaction_pct": round(thumbs_up / total_fb * 100) if total_fb else None,
        },
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.SERVER_HOST, port=settings.SERVER_PORT)
