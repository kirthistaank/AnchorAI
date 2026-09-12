"""ChromaDB vector store for semantic journal search"""
import logging
from typing import List, Dict, Any, Optional
import chromadb
from chromadb.utils import embedding_functions

from src.config import settings

logger = logging.getLogger(__name__)

_client: Optional[chromadb.PersistentClient] = None
_collection = None


def _get_client():
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(path=settings.CHROMADB_PATH)
    return _client


def _get_collection():
    global _collection
    if _collection is None:
        ef = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name="all-MiniLM-L6-v2"
        )
        _collection = _get_client().get_or_create_collection(
            name="journal_entries",
            embedding_function=ef,
            metadata={"hnsw:space": "cosine"},
        )
    return _collection


def add_journal_entry(entry_id: str, text: str, user_id: str, session_id: str, created_at: str):
    """Store a journal entry embedding"""
    try:
        col = _get_collection()
        col.upsert(
            ids=[entry_id],
            documents=[text],
            metadatas=[{
                "user_id": user_id,
                "session_id": session_id,
                "created_at": created_at,
            }],
        )
        logger.info(f"[VECTOR] Stored entry {entry_id}")
    except Exception as e:
        logger.warning(f"[VECTOR] Failed to store entry: {e}")


def search_similar_entries(query: str, user_id: str, n_results: int = 3) -> List[Dict[str, Any]]:
    """Find semantically similar past journal entries for this user"""
    try:
        col = _get_collection()
        results = col.query(
            query_texts=[query],
            n_results=n_results,
            where={"user_id": user_id},
        )

        entries = []
        if results["documents"] and results["documents"][0]:
            for doc, meta, dist in zip(
                results["documents"][0],
                results["metadatas"][0],
                results["distances"][0],
            ):
                entries.append({
                    "text": doc,
                    "created_at": meta.get("created_at", ""),
                    "similarity": round(1 - dist, 3),
                })
        return entries

    except Exception as e:
        logger.warning(f"[VECTOR] Search failed: {e}")
        return []


def get_entry_count(user_id: str) -> int:
    """Return how many journal entries a user has in vector store"""
    try:
        col = _get_collection()
        return col.count()
    except Exception:
        return 0
