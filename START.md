# AnchorAI - Quick Start Guide

## Prerequisites

- Python 3.12 (installed via `uv` or Homebrew)
- Node.js & npm (for frontend)
- PostgreSQL (for Phase 1.5+)
- Neo4j (local or cloud)
- [Ollama](https://ollama.com) — local LLM server

### Required Ollama Models

Pull these once (Ollama must be running):

```bash
ollama pull qwen2.5:7b-instruct    # primary response generator (~4.7 GB)
ollama pull qwen2.5:1.5b-instruct  # intent classifier (~986 MB)
ollama pull mistral-small           # LLM-as-judge for eval metrics (~14 GB)
```

Model roles:
| Model | Role | Why |
|-------|------|-----|
| `qwen2.5:7b-instruct` | Response generation | Good quality, fast on CPU |
| `qwen2.5:1.5b-instruct` | Intent classification | Lightweight, sub-second |
| `mistral-small` | LLM-as-judge (evals) | Different model family — avoids self-grading bias |

## Installation & Setup

### Backend Setup (First Time Only)

From the `backend` directory:

```bash
cd backend

# uv handles Python 3.12 + all dependencies automatically
export PATH="$HOME/.local/bin:$PATH"
uv sync --python 3.12 --all-extras --venv anchorai-pvenv

# Additional packages added over time (run these after uv sync)
uv pip install 'passlib[bcrypt]' 'python-jose[cryptography]' PyJWT email-validator --python anchorai-pvenv/bin/python
uv pip install faster-whisper --python anchorai-pvenv/bin/python   # Phase 4: voice STT
uv pip install python-multipart --python anchorai-pvenv/bin/python  # Phase 4: file upload

# Verify installation
anchorai-pvenv/bin/python -c "from src import agent; print('✓ Backend ready')"
```

### Frontend Setup (First Time Only)

From the `frontend` directory:

```bash
cd frontend

npm install
```

### Environment Configuration

From the `backend` directory, copy `.env.example` to `.env` and update with your config:

```bash
cp .env.example .env
# Edit .env with your actual credentials
```

#### Email Reminders (Gmail SMTP)

Add to `backend/.env` — use a **Gmail App Password**, not your regular password:

```
EMAIL_FROM=your-email@gmail.com
EMAIL_APP_PASSWORD=abcdefghijklmnop   # 16-char app password, no spaces
```

To generate an App Password:
1. Go to myaccount.google.com → Security
2. Enable 2-Step Verification (required)
3. Search "App passwords" → generate one for Mail / Mac
4. Paste the 16 characters (remove spaces) into `.env`

#### Browser Push Notifications (VAPID)

Run once to generate keys — they stay in your `.env` permanently:

```bash
cd backend
./anchorai-pvenv/bin/python scripts/gen_vapid.py
```

Copy the three printed lines into `backend/.env`:
```
VAPID_PUBLIC_KEY=<generated>
VAPID_PRIVATE_KEY=<generated>
VAPID_CLAIMS_EMAIL=mailto:your-email@gmail.com
```

Then in the app: Profile & Settings → **Enable browser push** → grant permission.

## Running the Application

### Terminal 1: Backend Server

```bash
cd backend
./anchorai-pvenv/bin/python -m uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

Backend will start at: **http://localhost:8000**
- API Docs: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### Terminal 2: Frontend Dev Server

```bash
cd frontend
npm run dev
```

Frontend will start at: **http://localhost:5173**
- Auto-opens in browser
- Hot reload enabled

## API Quick Reference

### Start a Session
```bash
curl -X POST http://localhost:8000/start-session \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user123"}'
```

### Send a Message
```bash
curl -X POST http://localhost:8000/message \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "session123",
    "content": "I am feeling anxious today"
  }'
```

### Log Mood
```bash
curl -X POST http://localhost:8000/log-mood \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "session123",
    "scale": 6,
    "emotions": ["anxious", "overwhelmed"]
  }'
```

## Database Setup (If Using Local DBs)

### Neo4j (CBT Framework)

1. Open Neo4j Desktop or neo4j.com/cloud
2. Create a new database
3. Open Neo4j Browser (http://localhost:7687)
4. Copy-paste contents of `neo4j_cbt_load_CORRECTED.cypher`
5. Run the Cypher script

### PostgreSQL (User Data)

```bash
psql postgres
CREATE DATABASE anchorai;
\c anchorai
```

Then update `.env` with:
```
DATABASE_URL=postgresql://user:password@localhost/anchorai
```

## Testing Phase 1 MVP Features

1. **Start Session**: http://localhost:5173 → Click "Start Chat"
2. **Agent Loop**: Type "I'm feeling anxious" → See agent reasoning flow
3. **Mood Logging**: Use mood slider (1-10) → Agent logs mood
4. **Journal Entry**: Type your thoughts → Agent saves to Neo4j
5. **CBT Detection**: Type distorted thoughts → Agent detects cognitive distortions
6. **Guardrails**: Try prompt injection → Blocked by safety checks

## Troubleshooting

### Backend import errors
```bash
# Ensure Python 3.12 is used
anchorai-pvenv/bin/python --version  # Should show 3.12.x

# Verify all modules import
anchorai-pvenv/bin/python -c "from src import config, database, agent, guardrails, tools, main; print('✓ OK')"
```

### Frontend connection issues
```bash
# Check vite.config.js has correct API proxy
# Should point to http://localhost:8000

# Clear node_modules if having issues
rm -rf node_modules package-lock.json
npm install
```

### LangGraph/Pydantic compatibility
- Sitecustomize patch is auto-loaded from `anchorai-pvenv/lib/python3.12/site-packages/sitecustomize.py`
- If you get ForwardRef errors, the patch didn't load - run uv sync again

## Architecture Overview

```
┌─────────────────────────────────────────┐
│         React Frontend (Port 5173)      │
│  - Chat interface                       │
│  - Mood slider                          │
│  - Budget widget                        │
│  - Real-time updates                    │
└────────────┬────────────────────────────┘
             │ HTTP/WebSocket
┌────────────▼────────────────────────────┐
│      FastAPI Backend (Port 8000)        │
│  - 6-node agent loop (LangGraph)        │
│  - Guardrails (PII, injection, crisis)  │
│  - Tool executor (mood, journal, eval)  │
│  - JWT auth (Phase 1.5)                 │
│  - Cost tracking & budget mgmt          │
└────────────┬─────────────┬──────────────┘
             │             │
    ┌────────▼──┐   ┌──────▼──────┐
    │ PostgreSQL│   │ Neo4j (CBT) │
    │ - Sessions│   │ - Distortions
    │ - Messages│   │ - Strategies
    │ - Moods   │   │ - Beliefs
    │ - Auth    │   │ - Patterns
    └───────────┘   └─────────────┘
             ▲
    ┌────────┴─────────────┐
    │ ChromaDB (Phase 2)   │
    │ Vector embeddings    │
    │ Semantic search      │
    └─────────────────────┘
```

## Database Migrations

SQLAlchemy models don't auto-migrate existing tables. After pulling new code, run:

```bash
psql postgresql://anchorai:anchorai_local@localhost:5432/anchorai -c "
ALTER TABLE users ADD COLUMN IF NOT EXISTS reminder_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reminder_time VARCHAR(5) DEFAULT '09:00';
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT FALSE;
"
```

Phase 3 tables (habits, habit_logs, goals, exercise_sessions, push_subscriptions, emotion_logs,
user_memories, message_feedback) are created automatically on first backend start via `create_all()`.

## Phase 4: Voice + UI (Optional)

### Voice Input — faster-whisper (STT)

Already installed. No extra setup needed. The mic button appears automatically in the chat once the backend detects faster-whisper.

The base model (~140 MB) is downloaded on first use to `~/.cache/huggingface/hub/`.

### Voice Output — TTS

**On macOS (M1/M2/M5):** No setup needed. The app uses the built-in `say` command automatically. The 🔊 speaker button will appear on all chat messages as soon as the backend starts.

**Optional — Fish Speech HTTP server (better voice quality):**

If you want higher quality voices, run a Fish Speech-compatible HTTP server on port 8080. The backend will prefer it over `say` when available. See the [Fish Speech GitHub](https://github.com/fishaudio/fish-speech) for setup instructions.

The speaker 🔊 button appears on chat messages once TTS is available.

### Theme Picker

Click the color circle in the top-right corner of the app to switch between 6 accent color themes: Violet (default), Blue, Emerald, Rose, Amber, Teal. Theme is saved in browser localStorage.

### Collapsible Sidebar

The left sidebar can be collapsed to icon-only mode using the ← button at the bottom. State is saved in localStorage.

## Running the Application (Full Phase 4)

| Terminal | Command | URL |
|----------|---------|-----|
| 1 | `./anchorai-pvenv/bin/python -m uvicorn src.main:app --reload --host 0.0.0.0 --port 8000` | http://localhost:8000 |
| 2 | `cd ../frontend && npm run dev` | http://localhost:5173 |
| 3 (optional) | `fish-speech serve --host 0.0.0.0 --port 8080` | TTS server |

## Phase Status

- **Phase 1**: Core MVP ✓
- **Phase 1.5**: Auth (JWT, forgot password, health goals) ✓
- **Phase 2**: Emotion tracking, AI memory, pattern detection, satisfaction metrics ✓
- **Phase 3**: Habit tracker, goals, CBT exercises, reminders, journal export ✓
  - Requires: Gmail App Password + VAPID keys in `.env` for notifications to send
- **Phase 4**: Voice (STT + TTS), collapsible sidebar, theme picker, chat UI polish ✓
  - STT: faster-whisper (auto, no setup)
  - TTS: Fish Speech server (optional, start separately on port 8080)

See `FEATURES.md` for a full feature reference.
