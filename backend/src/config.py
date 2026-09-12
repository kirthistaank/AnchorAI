"""Configuration for AnchorAI"""
import os
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings from environment variables"""

    # Server
    SERVER_HOST: str = "0.0.0.0"
    SERVER_PORT: int = 8000
    DEBUG: bool = os.getenv("DEBUG", "true").lower() == "true"

    # Database
    DATABASE_URL: str = "postgresql://user:password@localhost:5432/wellness"

    # Neo4j
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "your_password"

    # ChromaDB
    CHROMADB_PATH: str = "./data/chromadb"

    # LLM Configuration
    ANTHROPIC_API_KEY: Optional[str] = None
    OLLAMA_BASE_URL: str = "http://localhost:11434"

    # Models
    # Phase 1: Local models only (Ollama)
    # Phase 1.5+: Can switch to Claude by setting ANTHROPIC_API_KEY
    PRIMARY_MODEL: str = "ollama/qwen2.5:7b-instruct"  # Local for Phase 1
    CLASSIFICATION_MODEL: str = "ollama/qwen2.5:1.5b-instruct"  # Local — fast for classification
    FALLBACK_MODEL: str = "ollama/qwen2.5:7b-instruct"  # Always local
    JUDGE_MODEL: str = "ollama/mistral-small"  # LLM-as-judge (different family from generator = no self-grading bias)
    EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"

    # Budget
    MONTHLY_BUDGET_USD: float = 10.00
    BUDGET_WARNING_THRESHOLD_PCT: float = 0.80  # Warn at 80%
    BUDGET_CRITICAL_THRESHOLD_PCT: float = 0.95  # Critical at 95%

    # Guardrails
    GUARDRAILS_ENABLED: bool = True
    PII_DETECTION_ENABLED: bool = True
    PROMPT_INJECTION_DETECTION_ENABLED: bool = True
    CRISIS_DETECTION_ENABLED: bool = True

    # Auth / JWT
    JWT_SECRET_KEY: str = "change-this-in-production-to-a-long-random-secret"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_DAYS: int = 7

    # Email (Gmail SMTP — no extra server needed)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    EMAIL_FROM: str = ""
    EMAIL_APP_PASSWORD: str = ""

    # Web Push (VAPID keys — generate once with: python scripts/gen_vapid.py)
    VAPID_PRIVATE_KEY: str = ""
    VAPID_PUBLIC_KEY: str = ""
    VAPID_CLAIMS_EMAIL: str = "mailto:admin@anchorai.local"

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"

    # Agent Configuration
    MAX_AGENT_ITERATIONS: int = 5
    AGENT_TIMEOUT_SECONDS: int = 30
    RATE_LIMIT_RPM: int = 10  # 10 requests per minute per session

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()
