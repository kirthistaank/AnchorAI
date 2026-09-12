"""LangGraph Agent Loop for AnchorAI with LLM Reasoning"""
from typing import Dict, Any, List, Optional, Union
from langgraph.graph import StateGraph, START, END
from pydantic import BaseModel, field_validator
import json
import logging
import re
from datetime import datetime
import time
import asyncio
import litellm
from neo4j import GraphDatabase

from src.config import settings
from src.guardrails import GuardrailsEngine
from src.tools import ToolExecutor

logger = logging.getLogger(__name__)
litellm.set_verbose = False

# Maps keyword/phrase → canonical emotion label
EMOTION_MAP: Dict[str, str] = {
    # angry
    "angry": "angry", "anger": "angry", "furious": "angry", "rage": "angry",
    "mad": "angry", "irate": "angry", "enraged": "angry", "livid": "angry",
    # frustrated
    "frustrated": "frustrated", "frustration": "frustrated",
    "annoyed": "frustrated", "irritated": "frustrated", "irritating": "frustrated",
    # shame
    "shame": "shame", "ashamed": "shame", "shameful": "shame",
    "embarrassed": "shame", "humiliated": "shame", "humiliation": "shame",
    # happy
    "happy": "happy", "happiness": "happy", "cheerful": "happy",
    "glad": "happy", "pleased": "happy", "delighted": "happy",
    # sad
    "sad": "sad", "sadness": "sad", "unhappy": "sad", "depressed": "sad",
    "heartbroken": "sad", "miserable": "sad", "gloomy": "sad", "sorrowful": "sad",
    # disappointed
    "disappointed": "disappointed", "disappointment": "disappointed",
    "let down": "disappointed", "letdown": "disappointed", "deflated": "disappointed",
    # joy
    "joy": "joy", "joyful": "joy", "joyous": "joy", "elated": "joy",
    "ecstatic": "joy", "thrilled": "joy", "blissful": "joy",
    # calm
    "calm": "calm", "peaceful": "calm", "relaxed": "calm", "serene": "calm",
    "tranquil": "calm", "at ease": "calm", "composed": "calm",
    # anxious
    "anxious": "anxious", "anxiety": "anxious", "worried": "anxious",
    "nervous": "anxious", "uneasy": "anxious", "apprehensive": "anxious",
    "on edge": "anxious", "tense": "anxious",
    # scared
    "scared": "scared", "afraid": "scared", "fearful": "scared", "fear": "scared",
    "terrified": "scared", "frightened": "scared", "panicked": "scared", "panic": "scared",
    # stressed
    "stressed": "stressed", "stress": "stressed", "overwhelmed": "stressed",
    "overloaded": "stressed", "burnt out": "stressed", "burned out": "stressed",
    # grateful
    "grateful": "grateful", "gratitude": "grateful", "thankful": "grateful",
    "appreciative": "grateful", "blessed": "grateful",
    # lonely
    "lonely": "lonely", "loneliness": "lonely", "isolated": "lonely",
    "disconnected": "lonely",
    # hopeful
    "hopeful": "hopeful", "hope": "hopeful", "optimistic": "hopeful",
    "encouraged": "hopeful",
    # guilty
    "guilty": "guilty", "guilt": "guilty", "remorse": "guilty",
    "regret": "guilty", "remorseful": "guilty",
    # excited
    "excited": "excited", "excitement": "excited", "enthusiastic": "excited",
    "eager": "excited", "energized": "excited",
    # content
    "content": "content", "satisfied": "content", "fulfilled": "content",
    "comfortable": "content",
    # proud
    "proud": "proud", "pride": "proud", "accomplished": "proud",
    # loved
    "loved": "loved", "love": "loved", "loving": "loved",
    "supported": "loved", "cared for": "loved",
}


class AgentState(BaseModel):
    """State passed through the agent loop"""
    messages: List[Union[Dict[str, str], Any]]
    session_id: str
    user_id: str
    context: Optional[Dict[str, Any]] = None
    intent: Optional[str] = None
    distortions_detected: Optional[List[str]] = None
    coping_strategies: Optional[List[str]] = None
    tool_to_call: Optional[str] = None
    tool_result: Optional[Dict[str, Any]] = None
    final_response: Optional[str] = None
    eval_metrics: Optional[Dict[str, float]] = None
    start_time: float = None
    suggested_exercise: Optional[str] = None

    @field_validator('messages', mode='before')
    @classmethod
    def normalize_messages(cls, v):
        """Convert Message objects to dicts if needed"""
        if not isinstance(v, list):
            return v

        result = []
        for msg in v:
            if isinstance(msg, dict):
                result.append(msg)
            elif hasattr(msg, 'content') and hasattr(msg, 'type'):
                result.append({
                    "role": msg.type if hasattr(msg, 'type') else "unknown",
                    "content": str(msg.content)
                })
            elif hasattr(msg, 'content'):
                msg_type = type(msg).__name__
                role = "assistant" if "AI" in msg_type else "user"
                result.append({
                    "role": role,
                    "content": str(msg.content)
                })
            else:
                result.append({"role": "unknown", "content": str(msg)})

        return result

    class Config:
        arbitrary_types_allowed = True


def extract_memories_from_turn(user_id: str, user_message: str) -> None:
    """Background task: extract memorable facts from a user message and persist them.
    Creates its own DB session so it can run safely after the request session closes."""
    from src.database import SessionLocal, UserMemory

    db = SessionLocal()
    try:
        existing = (
            db.query(UserMemory)
            .filter(UserMemory.user_id == user_id)
            .order_by(UserMemory.created_at.desc())
            .limit(20)
            .all()
        )
        existing_text = "\n".join(f"- {m.content}" for m in existing) or "none"

        response = litellm.completion(
            model=settings.PRIMARY_MODEL,
            messages=[{
                "role": "system",
                "content": "Extract memorable personal facts. Be specific. Return JSON only.",
            }, {
                "role": "user",
                "content": (
                    f"Extract NEW facts worth remembering about this person from their message.\n"
                    f"Target: personal circumstances, recurring challenges, goals, relationships, upcoming events.\n"
                    f"Skip generic emotions. Only extract specific, concrete facts.\n\n"
                    f'User message: "{user_message}"\n\n'
                    f"Already remembered:\n{existing_text}\n\n"
                    'Reply with JSON only: {"facts": ["fact"]} or {"facts": []} if nothing new.'
                ),
            }],
            temperature=0.1,
            max_tokens=120,
            timeout=15,
        )

        content = response.choices[0].message.content.strip()
        if "```" in content:
            content = content.split("```")[1].replace("json", "").strip()
        data = json.loads(content)
        facts = [f for f in data.get("facts", []) if f and len(f) > 10]

        for fact in facts[:3]:
            db.add(UserMemory(user_id=user_id, content=fact))
        if facts:
            db.commit()
            logger.info(f"[MEMORY] Stored {len(facts)} new memories for user {user_id}: {facts}")

    except Exception as e:
        logger.warning(f"[MEMORY] Extraction failed: {e}")
    finally:
        db.close()


class AnchorAIAgent:
    """LLM-powered agent for wellness conversations with CBT framework"""

    def __init__(self, db_session=None):
        self.db = db_session
        self.graph = self._build_graph()
        self.start_time = None
        self.neo4j_driver = None

    def _get_neo4j_driver(self):
        """Get or create Neo4j driver"""
        if not self.neo4j_driver:
            try:
                self.neo4j_driver = GraphDatabase.driver(
                    settings.NEO4J_URI,
                    auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD)
                )
            except Exception as e:
                logger.warning(f"Could not connect to Neo4j: {e}")
        return self.neo4j_driver

    def _build_graph(self) -> StateGraph:
        """Build the LangGraph state machine"""
        graph = StateGraph(AgentState)

        # Add nodes
        graph.add_node("observe", self.node_observe)
        graph.add_node("classify", self.node_classify)
        graph.add_node("tool_select", self.node_tool_select)
        graph.add_node("execute", self.node_execute)
        graph.add_node("respond", self.node_respond)

        # Add edges
        graph.add_edge(START, "observe")
        graph.add_edge("observe", "classify")
        graph.add_edge("classify", "tool_select")
        graph.add_edge("tool_select", "execute")
        graph.add_edge("execute", "respond")
        graph.add_edge("respond", END)

        return graph.compile()

    def node_observe(self, state: AgentState) -> AgentState:
        """Node 1: Observe - Fetch structured context + semantic memory"""
        logger.info(f"[OBSERVE] Fetching context for session {state.session_id}")

        if not self.db:
            state.context = {"recent_moods": [], "recent_entries": [], "summary": "", "similar_past_entries": []}
            return state

        try:
            context_result = ToolExecutor.get_session_context(state.session_id, self.db)
            state.context = context_result if context_result.get("success") else {"recent_moods": [], "recent_entries": [], "summary": ""}
        except Exception as e:
            logger.warning(f"Failed to fetch context: {e}")
            state.context = {"recent_moods": [], "recent_entries": [], "summary": ""}

        # Semantic search: find similar past journal entries
        try:
            from src.vector_store import search_similar_entries
            last_message = state.messages[-1]["content"] if state.messages else ""
            similar = search_similar_entries(last_message, state.user_id, n_results=2)
            state.context["similar_past_entries"] = similar
            if similar:
                logger.info(f"[OBSERVE] Found {len(similar)} semantically similar past entries")
        except Exception as e:
            logger.warning(f"[OBSERVE] Semantic search failed: {e}")
            state.context["similar_past_entries"] = []

        # Fetch stored user memories (facts learned across sessions)
        try:
            from src.database import UserMemory
            memories = (
                self.db.query(UserMemory)
                .filter(UserMemory.user_id == state.user_id)
                .order_by(UserMemory.created_at.desc())
                .limit(10)
                .all()
            )
            state.context["user_memories"] = [m.content for m in memories]
            if memories:
                logger.info(f"[OBSERVE] Loaded {len(memories)} user memories")
        except Exception as e:
            logger.warning(f"[OBSERVE] Failed to load memories: {e}")
            state.context["user_memories"] = []

        return state

    def node_classify(self, state: AgentState) -> AgentState:
        """Node 2: Classify - Use LLM to detect user intent and emotional state"""
        logger.info("[CLASSIFY] Using LLM to classify intent and emotions")

        user_messages = [m for m in state.messages if m.get("role") == "user"]
        if not user_messages:
            state.intent = "unknown"
            return state

        last_message = user_messages[-1]["content"]
        conversation = "\n".join([
            f"{m['role'].upper()}: {m['content']}"
            for m in state.messages[-5:]  # Last 5 messages for context
        ])

        # Use LLM to classify intent
        try:
            response = litellm.completion(
                model=settings.PRIMARY_MODEL,
                messages=[{
                    "role": "system",
                    "content": """Classify this wellness message. Reply with JSON only, no explanation:
{"intent": "emotional_support|mood_check|advice_seeking|journal|crisis", "distortions": ["name", ...]}
Distortions: catastrophizing, all_or_nothing, mind_reading, overgeneralization, personalization, should_statements, filtering, disqualifying_positive, emotional_reasoning, labeling"""
                }, {
                    "role": "user",
                    "content": f"Message: {last_message}"
                }],
                temperature=0.1,
                max_tokens=80,
                timeout=15
            )

            analysis = json.loads(response.choices[0].message.content)
            state.intent = analysis.get("intent", "journal")
            state.distortions_detected = analysis.get("distortions", [])

            logger.info(f"[CLASSIFY] Intent: {state.intent}, Distortions: {state.distortions_detected}")

            # Suggest a CBT exercise based on distortions / intent
            _thought_record_triggers = {"catastrophizing", "all_or_nothing", "mind_reading", "overgeneralization", "personalization", "should_statements", "labeling"}
            state.suggested_exercise = None
            for d in (state.distortions_detected or []):
                if d in _thought_record_triggers:
                    state.suggested_exercise = "thought_record"
                    break
            if not state.suggested_exercise and state.intent == "emotional_support":
                state.suggested_exercise = "breathing"
            if not state.suggested_exercise and state.intent == "crisis":
                state.suggested_exercise = "grounding"

        except Exception as e:
            logger.warning(f"LLM classification failed: {e}, falling back to heuristics")
            # Fallback to keyword-based classification
            last_message_lower = last_message.lower()
            if any(word in last_message_lower for word in ["help", "suggest", "advice", "what should"]):
                state.intent = "advice_seeking"
            elif any(word in last_message_lower for word in ["mood", "feeling", "rate"]):
                state.intent = "mood_check"
            elif any(word in last_message_lower for word in ["sad", "anxious", "stressed", "overwhelmed"]):
                state.intent = "emotional_support"
            else:
                state.intent = "journal"

        return state

    def node_tool_select(self, state: AgentState) -> AgentState:
        """Node 4: Tool Select - Choose which tool to call"""
        logger.info("[TOOL_SELECT] Selecting appropriate tool")

        # Route based on intent
        if state.intent == "mood_check":
            state.tool_to_call = "log_mood"
        elif state.intent in ["emotional_support", "journal", "advice_seeking"]:
            state.tool_to_call = "log_journal_entry"
        else:
            state.tool_to_call = "get_session_context"

        logger.info(f"[TOOL_SELECT] Tool selected: {state.tool_to_call}")
        return state

    def node_execute(self, state: AgentState) -> AgentState:
        """Node 5: Execute - Run the selected tool"""
        logger.info(f"[EXECUTE] Running tool: {state.tool_to_call}")

        if not self.db:
            state.tool_result = {"success": False, "error": "No database session"}
            return state

        user_message = state.messages[-1]["content"] if state.messages else ""

        try:
            if state.tool_to_call == "log_mood":
                scale = self._extract_mood_scale(user_message)
                words = state.distortions_detected or []
                state.tool_result = ToolExecutor.log_mood(
                    state.session_id, scale, words, db=self.db
                )

            elif state.tool_to_call == "log_journal_entry":
                state.tool_result = ToolExecutor.log_journal_entry(
                    state.session_id, user_message, db=self.db
                )
                # Index in ChromaDB for semantic search
                if state.tool_result.get("success"):
                    try:
                        from src.vector_store import add_journal_entry
                        add_journal_entry(
                            entry_id=state.tool_result.get("entry_id", str(time.time())),
                            text=user_message,
                            user_id=state.user_id,
                            session_id=state.session_id,
                            created_at=datetime.now().isoformat(),
                        )
                    except Exception as e:
                        logger.warning(f"[EXECUTE] Failed to index in ChromaDB: {e}")

            elif state.tool_to_call == "get_session_context":
                state.tool_result = ToolExecutor.get_session_context(state.session_id, db=self.db)

            logger.info(f"[EXECUTE] Tool result: success={state.tool_result.get('success')}")
        except Exception as e:
            logger.error(f"[EXECUTE] Tool execution failed: {str(e)}")
            state.tool_result = {"success": False, "error": str(e)}

        # Detect and log emotions from user message
        emotions = self._detect_emotions(user_message)
        if emotions:
            self._log_emotions(emotions, state.session_id, state.user_id)

        return state

    def node_respond(self, state: AgentState) -> AgentState:
        """Node 5: Respond - Generate contextual response with inline reasoning"""
        logger.info("[RESPOND] Generating empathetic response with LLM")

        last_message = state.messages[-1]["content"] if state.messages else ""

        # Fetch relevant coping strategies
        strategies = self._get_coping_strategies(state.distortions_detected)
        state.coping_strategies = strategies

        try:
            response = self._generate_response_with_llm(state, last_message)
            state.final_response = response
        except Exception as e:
            logger.error(f"LLM response generation failed: {e}")
            state.final_response = "I'm here to listen and support you. Please tell me more about what you're experiencing."

        logger.info(f"[RESPOND] Response generated ({len(state.final_response)} chars)")
        return state

    def _generate_response_with_llm(self, state: AgentState, user_message: str) -> str:
        """Generate a contextual, empathetic response with inline reasoning"""

        strategies_text = ""
        if state.coping_strategies:
            strategies_text = f"\nRelevant coping strategies: {', '.join(state.coping_strategies[:3])}"

        similar = state.context.get("similar_past_entries", [])
        semantic_memory_text = ""
        if similar:
            semantic_memory_text = "\nRelevant past journal entries:\n" + "\n".join(
                f'- "{e["text"][:150]}"'
                for e in similar
            )

        stored_memories = state.context.get("user_memories", [])
        facts_text = ""
        if stored_memories:
            facts_text = "\nWhat I know about you: " + "; ".join(stored_memories[:5])

        prompt = f"""User said: "{user_message}"
Distortions: {', '.join(state.distortions_detected or ['none'])}{strategies_text}{facts_text}{semantic_memory_text}

Reply in 2-3 sentences: validate their feelings, gently address any distortion, suggest one coping strategy, ask one follow-up question. Use what you know about them to be specific, not generic."""

        response = litellm.completion(
            model=settings.PRIMARY_MODEL,
            messages=[{
                "role": "system",
                "content": "You are a warm CBT-trained wellness counselor. Be specific, not generic. Keep responses short."
            }, {
                "role": "user",
                "content": prompt
            }],
            temperature=0.7,
            max_tokens=150,
            timeout=30
        )

        return response.choices[0].message.content

    def run_stream(self, session_id: str, user_id: str, messages: List[Dict[str, str]]):
        """Run agent and yield SSE-style dicts for streaming the final response"""
        self.start_time = time.time()

        state = AgentState(
            messages=messages,
            session_id=session_id,
            user_id=user_id,
            start_time=self.start_time,
        )

        try:
            state = self.node_observe(state)
            state = self.node_classify(state)
            state = self.node_tool_select(state)
            state = self.node_execute(state)

            strategies = self._get_coping_strategies(state.distortions_detected)
            last_message = state.messages[-1]["content"] if state.messages else ""

            strategies_text = (
                f"\nRelevant coping strategies: {', '.join(strategies[:3])}" if strategies else ""
            )

            ctx = state.context or {}
            similar = ctx.get("similar_past_entries", [])
            semantic_text = ""
            if similar:
                semantic_text = "\nRelevant past journal entries:\n" + "\n".join(
                    f'- "{e["text"][:150]}"' for e in similar
                )

            stored_memories = ctx.get("user_memories", [])
            facts_text = ""
            if stored_memories:
                facts_text = "\nWhat I know about you: " + "; ".join(stored_memories[:5])

            prompt = (
                f'User said: "{last_message}"\n'
                f'Distortions: {", ".join(state.distortions_detected or ["none"])}'
                f"{strategies_text}{facts_text}{semantic_text}\n\n"
                "Reply in 2-3 sentences: validate their feelings, gently address any distortion, "
                "suggest one coping strategy, ask one follow-up question. "
                "Use what you know about them to be specific, not generic."
            )

            full_response = ""
            stream = litellm.completion(
                model=settings.PRIMARY_MODEL,
                messages=[
                    {"role": "system", "content": "You are a warm CBT-trained wellness counselor. Be specific, not generic. Keep responses short."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.7,
                max_tokens=150,
                timeout=30,
                stream=True,
            )

            for chunk in stream:
                delta = chunk.choices[0].delta.content
                if delta:
                    full_response += delta
                    yield {"type": "token", "content": delta}

            latency_ms = (time.time() - self.start_time) * 1000
            yield {
                "type": "done",
                "full_response": full_response,
                "intent": state.intent,
                "tool_used": state.tool_to_call,
                "distortions_detected": state.distortions_detected,
                "suggested_exercise": state.suggested_exercise,
                "latency_ms": latency_ms,
            }

        except Exception as e:
            logger.error(f"[AGENT] Stream error: {e}")
            fallback = "I'm here to support you. Could you tell me more about what's on your mind?"
            yield {"type": "token", "content": fallback}
            yield {
                "type": "done",
                "full_response": fallback,
                "latency_ms": (time.time() - self.start_time) * 1000,
            }

    def run(self, session_id: str, user_id: str, messages: List[Dict[str, str]]) -> Dict[str, Any]:
        """Run the agent loop"""
        logger.info(f"[AGENT] Starting agent loop for session {session_id}")
        self.start_time = time.time()

        state = AgentState(
            messages=messages,
            session_id=session_id,
            user_id=user_id,
            start_time=self.start_time,
        )

        try:
            graph_start = time.time()
            result = self.graph.invoke(state)
            graph_time = (time.time() - graph_start) * 1000

            latency_ms = (time.time() - self.start_time) * 1000

            logger.info(f"[TIMING] Graph execution: {graph_time:.0f}ms | Total: {latency_ms:.0f}ms")

            return {
                "success": True,
                "response": result.get("final_response", ""),
                "intent": result.get("intent"),
                "tool_used": result.get("tool_to_call"),
                "distortions_detected": result.get("distortions_detected"),
                "latency_ms": latency_ms,
            }

        except Exception as e:
            logger.error(f"[AGENT] Error running agent: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "response": "I'm here to support you. Could you tell me more about what's on your mind?",
            }

    # Helper methods

    def _get_coping_strategies(self, distortions: List[str]) -> List[str]:
        """Query Neo4j for relevant coping strategies"""
        if not distortions:
            return []

        try:
            driver = self._get_neo4j_driver()
            if not driver:
                return []

            with driver.session() as session:
                strategies = set()
                for distortion in distortions[:3]:  # Limit to top 3 distortions
                    query = f"""
                    MATCH (d:CognitiveDistortion {{name: "{distortion}"}})-[r:COUNTERED_BY]-(s:CopingStrategy)
                    RETURN s.name as strategy, r.strength as strength
                    ORDER BY r.strength DESC LIMIT 2
                    """
                    try:
                        result = session.run(query)
                        for record in result:
                            strategies.add(record["strategy"])
                    except Exception as e:
                        logger.debug(f"Neo4j query failed for {distortion}: {e}")

                return list(strategies)[:5]

        except Exception as e:
            logger.warning(f"Failed to fetch strategies from Neo4j: {e}")
            return []

    def _extract_mood_scale(self, text: str) -> int:
        """Extract mood scale (1-10) from text"""
        for i in range(1, 11):
            if str(i) in text:
                return i
        return 5

    @staticmethod
    def _detect_emotions(text: str) -> List[str]:
        """Return list of canonical emotion labels found in text"""
        text_lower = text.lower()
        found: set = set()
        for phrase, canonical in EMOTION_MAP.items():
            if ' ' in phrase:
                if phrase in text_lower:
                    found.add(canonical)
            else:
                if re.search(r'\b' + re.escape(phrase) + r'\b', text_lower):
                    found.add(canonical)
        return list(found)

    def _log_emotions(self, emotions: List[str], session_id: str, user_id: str) -> None:
        """Persist detected emotions to EmotionLog table"""
        from src.database import EmotionLog
        try:
            for emotion in emotions:
                self.db.add(EmotionLog(
                    session_id=session_id,
                    user_id=user_id,
                    emotion=emotion,
                ))
            self.db.commit()
            logger.info(f"[EMOTIONS] Logged: {emotions}")
        except Exception as e:
            logger.warning(f"[EMOTIONS] Failed to log: {e}")

    def _close(self):
        """Close Neo4j connection"""
        if self.neo4j_driver:
            self.neo4j_driver.close()
