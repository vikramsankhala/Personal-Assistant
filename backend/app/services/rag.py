"""RAG / Vector store for semantic search over transcripts."""

import logging
from pathlib import Path
from typing import Optional

from app.config import get_settings

logger = logging.getLogger(__name__)


class RAGService:
    """Vector store for transcript Q&A and semantic search."""

    def __init__(self):
        self._client = None
        self._settings = get_settings()

    def _ensure_client(self):
        if self._client is None:
            try:
                import chromadb
                from chromadb.config import Settings as ChromaSettings

                persist_dir = Path(self._settings.chroma_persist_dir)
                persist_dir.mkdir(parents=True, exist_ok=True)

                self._client = chromadb.PersistentClient(
                    path=str(persist_dir),
                    settings=ChromaSettings(anonymized_telemetry=False),
                )
                logger.info("Chroma client initialized")
            except Exception as e:
                logger.warning("Chroma not available: %s", e)
                self._client = "stub"

    def add_transcript(self, transcript_id: str, text: str, metadata: Optional[dict] = None):
        """Index transcript for semantic search."""
        self._ensure_client()
        if self._client == "stub":
            return

        # Chunk and embed (simplified - use sentence-transformers for embeddings)
        # In production: chunk by paragraphs, embed with BGE-M3
        collection = self._client.get_or_create_collection("transcripts")
        collection.add(
            ids=[transcript_id],
            documents=[text[:10000]],  # Truncate for demo
            metadatas=[metadata or {}],
        )

    def search(self, query: str, top_k: int = 5) -> list[dict]:
        """Semantic search over transcripts."""
        self._ensure_client()
        if self._client == "stub":
            return []

        collection = self._client.get_or_create_collection("transcripts")
        results = collection.query(query_texts=[query], n_results=top_k)
        return [
            {"id": id, "document": doc, "metadata": meta}
            for id, doc, meta in zip(
                results["ids"][0],
                results["documents"][0],
                results["metadatas"][0],
            )
        ]


_rag_service: Optional[RAGService] = None


def get_rag_service() -> RAGService:
    global _rag_service
    if _rag_service is None:
        _rag_service = RAGService()
    return _rag_service
