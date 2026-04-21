from typing import List, Optional
from sqlalchemy.orm import Session
from uuid import UUID
from sqlalchemy import select
try:
    from models import Chunk, Document
except ImportError:
    from ..models import Chunk, Document

from .embeddings import embed_step  # Ollama embedding function
from .embedding_cache import get_cache  # Embedding cache


def retrieve_chunks_by_topic(
    session: Session,
    subject_id: UUID,
    topic: Optional[str] = None,
    top_k: int = 5
) -> List[Chunk]:
    """
    Retrieve the top_k most relevant chunks for a given topic within a subject.
    If topic is None, returns all chunks for the subject.
    
    Performance optimization: Topic embeddings are cached to avoid redundant HTTP calls.
    """
    # Normalize subject_id to UUID when provided as string.
    normalized_subject_id = subject_id
    if isinstance(subject_id, str):
        try:
            normalized_subject_id = UUID(subject_id)
        except ValueError:
            # Invalid UUID: return no rows rather than raising in query layer.
            return []

    # Always enforce bounded retrieval size.
    safe_top_k = top_k if isinstance(top_k, int) and top_k > 0 else 5

    # If no topic, return a bounded, deterministic sample (most recent chunks first).
    if not topic:
        return session.query(Chunk).join(Document)\
            .filter(Document.subject_id == normalized_subject_id)\
            .order_by(Chunk.created_at.desc(), Chunk.id.desc())\
            .limit(safe_top_k)\
            .all()

    # 1️⃣ Get topic embedding (cached)
    cache = get_cache()
    topic_embedding = cache.get(topic)
    
    if topic_embedding is None:
        # Cache miss: generate embedding
        topic_embedding = embed_step([topic])[0]  # returns list of floats
        if topic_embedding:
            # Cache the result for future queries
            cache.set(topic, topic_embedding)
    else:
        # Cache hit: use cached embedding
        pass

    # 2️⃣ If embedding exists, use vector similarity; otherwise safe bounded fallback.
    if topic_embedding:
        chunks = session.query(Chunk).join(Document)\
            .filter(Document.subject_id == normalized_subject_id)\
            .order_by(Chunk.embedding.cosine_distance(topic_embedding))\
            .limit(safe_top_k)\
            .all()
    else:
        chunks = session.query(Chunk).join(Document)\
            .filter(Document.subject_id == normalized_subject_id)\
            .order_by(Chunk.created_at.desc(), Chunk.id.desc())\
            .limit(safe_top_k)\
            .all()

    return chunks