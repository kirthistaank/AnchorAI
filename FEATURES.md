# AnchorAI — Feature Reference

Complete guide to every feature built across Phase 1, Phase 1.5, and Phase 2.

---

## Table of Contents

1. [Authentication & Accounts](#1-authentication--accounts)
2. [Chat & Journaling](#2-chat--journaling)
3. [Mood Tracking](#3-mood-tracking)
4. [Emotion Tracking](#4-emotion-tracking)
5. [AI Memory](#5-ai-memory)
6. [Mood Trends & Analytics](#6-mood-trends--analytics)
7. [Patterns & Trigger Detection](#7-patterns--trigger-detection)
8. [Monitoring Dashboard](#8-monitoring-dashboard)
9. [Streaming Responses](#9-streaming-responses)
10. [User Satisfaction Ratings](#10-user-satisfaction-ratings)
11. [CBT Framework & Guardrails](#11-cbt-framework--guardrails)
12. [Budget Tracking](#12-budget-tracking)
13. [Navigation & Pages](#13-navigation--pages)
14. [Data Persistence](#14-data-persistence)
15. [API Reference](#15-api-reference)

---

## 1. Authentication & Accounts

**Phase: 1.5**

### Registration
- Sign up with **username**, **email**, and **password**
- Password must be 8–72 characters
- Duplicate usernames and emails are rejected with a clear error message
- Passwords are hashed with `bcrypt 4.x` directly (passlib bypassed due to incompatibility)

### Login
- Login with **email + password**
- Returns a **JWT token** valid for 7 days
- Token is stored in `localStorage` — survives frontend restarts
- Axios interceptors auto-attach the token to every API request

### Session Management
- Logout is client-side (token discarded from localStorage)
- Any 401 response automatically redirects to `/login`

### Forgot Password
- Request a reset token by email
- Token is printed to the **backend console** (MVP — no email sending)
- Token expires in 1 hour and can only be used once

### Pages
- `/login` — email + password login form
- `/register` — registration form with validation errors shown inline
- `/forgot-password` — request reset token form

---

## 2. Chat & Journaling

**Phase: 1, 2**

### How It Works
Every message you send goes through a 5-node LangGraph agent loop:

```
User Message
    ↓
[1] OBSERVE    → Load context: recent moods, past journal entries (semantic search), AI memories
    ↓
[2] CLASSIFY   → LLM detects intent (journal / mood_check / emotional_support / advice_seeking / crisis)
                  and cognitive distortions (catastrophizing, all-or-nothing, etc.)
    ↓
[3] TOOL_SELECT → Choose tool based on intent
    ↓
[4] EXECUTE    → Run tool (log mood / log journal entry / get context)
                  + detect & store emotion words
                  + index journal entry in ChromaDB
    ↓
[5] RESPOND    → LLM generates empathetic response using:
                  - detected distortions
                  - coping strategies from Neo4j
                  - stored AI memories about you
                  - semantically similar past journal entries
```

### What Gets Stored
- Every user message and AI response → `messages` table (PostgreSQL)
- Journal-type messages → `journal_entries` table + ChromaDB vector embedding
- Mood-type messages → `moods` table
- Detected emotions → `emotion_logs` table (automatic, no action needed)
- Key personal facts → `user_memories` table (background LLM extraction)

### Within-Session Memory
The agent loads the last 10 messages of the current session on every turn, so it tracks what you said earlier in the same conversation.

### Cross-Session Memory
Three layers of cross-session recall:
1. **Semantic search** — ChromaDB finds past journal entries similar to your current message
2. **AI Memories** — specific facts extracted from past conversations (see [AI Memory](#5-ai-memory))
3. **Mood/entry context** — recent mood history and journal summaries loaded in OBSERVE

---

## 3. Mood Tracking

**Phase: 1**

### Mood Slider
- Located in the chat window below the message input
- Scale of **1–10** with emoji feedback (`😔` → `😄`)
- Click **Log Mood** to save — triggers a friendly confirmation message in chat

### What Triggers Mood Logging
- The mood slider in the UI (manual)
- The agent auto-classifies certain messages as `mood_check` and logs mood from the text (e.g., "I feel about a 7 today")

### Storage
- Stored in the `moods` table with `session_id`, `scale`, `emotional_words`, and `created_at`
- Used by the Trends page and the Patterns & Triggers engine

---

## 4. Emotion Tracking

**Phase: 2 (bonus)**

### How It Works
Every chat message is scanned by a **keyword detector** (no extra LLM call) that maps 80+ words and phrases to 19 canonical emotions:

| Emotion | Example words detected |
|---|---|
| angry | angry, furious, rage, mad, livid |
| frustrated | frustrated, annoyed, irritated |
| shame | ashamed, embarrassed, humiliated |
| happy | happy, cheerful, glad, delighted |
| sad | sad, depressed, heartbroken, gloomy |
| disappointed | disappointed, let down, deflated |
| joy | joyful, elated, ecstatic, thrilled |
| calm | calm, peaceful, relaxed, serene |
| anxious | anxious, worried, nervous, on edge |
| scared | scared, afraid, terrified, panicked |
| stressed | stressed, overwhelmed, burnt out |
| grateful | grateful, thankful, blessed |
| lonely | lonely, isolated, disconnected |
| hopeful | hopeful, optimistic, encouraged |
| guilty | guilty, remorse, regret |
| excited | excited, enthusiastic, eager |
| content | content, satisfied, fulfilled |
| proud | proud, accomplished |
| loved | loved, supported, cared for |

Detection is **automatic** — just chat naturally. "I'm feeling anxious about my presentation" logs `anxious` without any extra steps.

### Emotions Page (`/emotions`)
- **Frequency cards** — each emotion with a color dot, occurrence count badge, and a relative bar
- **Stacked bar chart** — emotions over time (recharts), one color per emotion
- **Period selector** — Week (last 12 weeks) / Month (last 12 months) / Year (all time)

---

## 5. AI Memory

**Phase: 2**

### What It Does
After every message, a background LLM task reads what you wrote and extracts specific, personal facts worth remembering — things like:
- "Works at a startup and feels overwhelmed by deadlines"
- "Has a presentation next week"
- "Struggles with perfectionism"
- "Feels pressure from their manager"

These facts are stored in the `user_memories` table and **injected into every future response**, even in new sessions. This is how the agent knows to say "given that you mentioned you work long hours..." rather than treating you as a stranger every time.

### Deduplication
Before storing, the extraction prompt includes all existing memories so the LLM only writes truly new facts (not duplicates).

### Profile Page — Memory Section
`/profile` shows a **"What the AI Remembers About You"** section:
- Lists all stored memories
- Each entry has an **×** button to delete it permanently
- Empty state explains how memories are built up

### Privacy Control
You can delete any memory at any time from the Profile page. Memories are scoped to your user ID — no other user can see them.

---

## 6. Mood Trends & Analytics

**Phase: 2**

### Trends Page (`/trends`)

**Stats row**
- Average mood for the selected period
- Total mood log entries
- Number of days tracked

**Daily Average Mood (line chart)**
- X axis: date, Y axis: mood score 1–10
- Shows trend over time — are things getting better or worse?

**Mood Distribution (bar chart)**
- How often each mood level (1–10) was logged
- Helps identify your most common emotional "home base"

**Weekly Summary**
- LLM-generated paragraph that:
  - Acknowledges your mood pattern honestly
  - Highlights positive moments or growth
  - Identifies one theme from your journal entries
  - Offers one specific encouragement for next week

**Period selector**
- Last 7 days / 30 days / 90 days

### API Endpoints
- `GET /analytics/mood-trends?days=30` — daily avg mood array
- `GET /analytics/mood-distribution?days=30` — distribution + stats
- `GET /analytics/weekly-summary` — LLM-generated summary

---

## 7. Patterns & Trigger Detection

**Phase: 2**

### What It Does
Analyses the last **90 days** of your mood logs and journal entries to surface:
- **What tends to lower your mood** — specific topics or circumstances from your low-mood journal days
- **What tends to help** — themes from your high-mood days
- **One key insight** — a concrete pattern the LLM noticed about you specifically

### How It Works
1. Query all mood logs in the last 90 days
2. Split journal entries into two groups: low-mood days (≤4/10) and high-mood days (≥7/10)
3. Include top emotions detected in the period
4. Send to LLM with a focused prompt: "What triggers low mood? What helps?"
5. LLM returns structured JSON: `{triggers, helpers, insight}`

### Where It Appears
At the bottom of the **Trends page** (`/trends`) as a "Triggers & Patterns" card:
- Key Insight box (accent-colored)
- Red `↓` list for triggers
- Green `↑` list for helpers
- Data point count ("Based on 47 data points from the last 90 days")

### Graceful Fallback
If there isn't enough data yet, shows a friendly message explaining how many days of journaling are needed.

---

## 8. Monitoring Dashboard

**Phase: 2**

### Dashboard Page (`/dashboard`)

**Key Metrics (4 cards)**
- Total Requests processed
- Average Latency (ms)
- Average Quality Score (0–10)
- Crisis Signals Detected

**Safety Section**
- Injection attempts blocked by guardrails
- Crisis signals routed to support resources

**Latency Trend (line chart)**
- Daily average response time over time
- Helps identify performance regressions

**Quality Scores**
- Coherence, relevance, tone, and safety scores averaged across last 200 requests

**User Satisfaction**
- Satisfaction percentage (thumbs up / total rated)
- Total thumbs up and thumbs down counts
- Links to the per-message feedback buttons in chat

---

## 9. Streaming Responses

**Phase: 2**

### How It Works
Messages use **Server-Sent Events (SSE)** streaming via `POST /message/stream`:
1. Agent runs OBSERVE → CLASSIFY → TOOL_SELECT → EXECUTE synchronously
2. The RESPOND step calls litellm with `stream=True`
3. Tokens are yielded to the browser as they arrive
4. The chat UI appends each token to the assistant message in real time

### SSE Event Format
```
data: {"type": "token", "content": "I"}
data: {"type": "token", "content": " understand"}
data: {"type": "done", "full_response": "...", "intent": "...", "message_id": "...", "latency_ms": 2300}
```

### Frontend
Uses the `fetch` API with `ReadableStream` (not `EventSource`, since SSE requires GET but this is a POST). An empty assistant message bubble appears immediately and fills in token by token.

---

## 10. User Satisfaction Ratings

**Phase: 2**

### How It Works
- Each assistant response shows **👍 / 👎 buttons** underneath the message
- Buttons are dimmed by default; clicking one highlights it and persists your rating
- Rating is sent to `POST /feedback/{message_id}` with `{rating: 1}` or `{rating: -1}`
- You can change your rating by clicking the other button (upserts in DB)

### Where Ratings Appear
- The **Dashboard** (`/dashboard`) shows your aggregate satisfaction %
- Individual ratings are stored in the `message_feedback` table

### Message ID Tracking
The streaming `done` event includes a pre-assigned `message_id` which the frontend stores per message, making it possible to rate a specific response even in a streaming context.

---

## 11. CBT Framework & Guardrails

**Phase: 1**

### Cognitive Distortion Detection
The CLASSIFY node uses an LLM to detect distortions in user messages:
- Catastrophizing, all-or-nothing thinking, mind reading
- Overgeneralization, personalization, should statements
- Filtering, disqualifying the positive, emotional reasoning, labeling

### Coping Strategies (Neo4j)
When distortions are detected, the agent queries a **Neo4j knowledge graph** for coping strategies linked to those distortions via `COUNTERED_BY` relationships. Strategies are included in the response prompt.

### Input Guardrails
- **Prompt injection detection** — blocks attempts like "ignore previous instructions"
- **PII masking** — masks email addresses, phone numbers in logs
- If triggered: returns a guardrail error, does not call the LLM

### Crisis Detection
- Scans for keywords indicating self-harm or crisis
- If detected: immediately returns a crisis support message with hotline resources, skips the agent loop entirely
- Logged in eval metrics (`crisis_signal_detected = True`)

### Output Guardrails
- Checks agent response for harmful content before returning
- Logs a safety score with each eval metric entry

---

## 12. Budget Tracking

**Phase: 1**

### What It Tracks
Monthly LLM API spending per user stored in the `cost_tracking` table.

### Budget Widget (Chat Page)
- Shows `$X.XX / $10.00` with a progress bar
- Refreshes every 30 seconds automatically
- Shows "Claude available" or "Using local AI" based on remaining budget

### Budget Gate
If remaining budget drops below $0.05, the agent automatically falls back to the local Ollama model instead of calling cloud APIs (controlled by `settings.MONTHLY_BUDGET_USD`).

---

## 13. Navigation & Pages

**Phase: 1.5, 2**

### Navigation Bar
Appears on all protected pages. Contains:
- **Logo** → links to `/` (chat)
- **Emotions** → `/emotions`
- **Trends** → `/trends`
- **Dashboard** → `/dashboard`
- **Profile** → `/profile`
- **Logout** button

### Page Map

| Path | Page | Description |
|---|---|---|
| `/` | Chat | Main chat + mood slider + budget widget |
| `/login` | Login | Email + password login |
| `/register` | Register | New account creation |
| `/forgot-password` | Forgot Password | Request password reset token |
| `/profile` | Profile | User info, health goals, AI memories |
| `/emotions` | Emotions | Emotion frequency + stacked bar chart |
| `/trends` | Trends | Mood charts + weekly summary + patterns |
| `/dashboard` | Dashboard | System metrics + latency + satisfaction |

All routes except `/login`, `/register`, `/forgot-password` are protected — unauthenticated users are redirected to `/login`.

Every page after login has a **← Back to Chat** link.

---

## 14. Data Persistence

**What survives a restart:**

| Data | Storage | Survives Backend Restart | Survives Frontend Restart |
|---|---|---|---|
| User accounts | PostgreSQL | ✅ | ✅ |
| Chat messages | PostgreSQL | ✅ | ✅ |
| Journal entries | PostgreSQL + ChromaDB | ✅ | ✅ |
| Mood logs | PostgreSQL | ✅ | ✅ |
| Emotion logs | PostgreSQL | ✅ | ✅ |
| AI memories | PostgreSQL | ✅ | ✅ |
| Message feedback | PostgreSQL | ✅ | ✅ |
| Eval metrics | PostgreSQL | ✅ | ✅ |
| JWT token | localStorage | N/A | ✅ (7-day expiry) |
| Active session ID | React state | N/A | ❌ (new session on page reload) |

**Note on sessions:** Reloading the frontend starts a new chat session. Previous sessions remain in the DB and their journal entries/moods still feed into analytics, memories, and semantic search.

---

## 15. API Reference

### Auth (no token required)
| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Login, receive JWT |
| POST | `/auth/forgot-password` | Request reset token (printed to console) |
| POST | `/auth/reset-password` | Reset password with token |
| POST | `/auth/logout` | Logout (client discards token) |

### Profile (JWT required)
| Method | Path | Description |
|---|---|---|
| GET | `/users/me` | Get profile |
| PUT | `/users/me/profile` | Update health goals + timezone |

### Chat (JWT required)
| Method | Path | Description |
|---|---|---|
| POST | `/start-session` | Create new session |
| POST | `/message` | Send message (non-streaming) |
| POST | `/message/stream` | Send message (SSE streaming) |
| POST | `/log-mood` | Log mood 1–10 |
| GET | `/session/{session_id}` | Get session history |

### Analytics (JWT required)
| Method | Path | Description |
|---|---|---|
| GET | `/analytics/mood-trends?days=30` | Daily avg mood |
| GET | `/analytics/mood-distribution?days=30` | Mood distribution + stats |
| GET | `/analytics/weekly-summary` | LLM weekly summary |
| GET | `/analytics/dashboard` | Eval metrics + satisfaction |
| GET | `/analytics/emotions?period=month` | Emotion counts by period |
| GET | `/analytics/patterns` | LLM trigger/pattern analysis |

### Memory (JWT required)
| Method | Path | Description |
|---|---|---|
| GET | `/memory` | List all AI memories |
| DELETE | `/memory/{id}` | Delete a specific memory |

### Feedback (JWT required)
| Method | Path | Description |
|---|---|---|
| POST | `/feedback/{message_id}` | Rate a response (1 = 👍, -1 = 👎) |

### Other
| Method | Path | Description |
|---|---|---|
| GET | `/health` | Server health check |
| GET | `/budget/me` | Budget status |

---

## Stack Summary

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS + React Router v6 |
| Charts | Recharts |
| HTTP client | Axios (with JWT interceptors) + Fetch API (streaming) |
| Backend | FastAPI + LangGraph |
| Agent loop | 5-node state machine (OBSERVE → CLASSIFY → TOOL_SELECT → EXECUTE → RESPOND) |
| LLM routing | LiteLLM → Ollama (local, qwen2.5:7b-instruct) |
| Auth | JWT (python-jose) + bcrypt 4.x |
| Structured DB | PostgreSQL via SQLAlchemy ORM |
| Vector DB | ChromaDB (persistent) + SentenceTransformer (all-MiniLM-L6-v2) |
| Knowledge graph | Neo4j (CBT framework: distortions, coping strategies, beliefs) |
| Guardrails | Custom regex-based (prompt injection, PII, crisis) |
