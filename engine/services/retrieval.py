from typing import List, Optional
from sqlalchemy.orm import Session
from uuid import UUID
from sqlalchemy import select
import time
from utils.logging import get_job_logger
try:
    from models import Chunk, Document
except ImportError:
    from ..models import Chunk, Document

from .embeddings import embed_step  #Ollama embedding function

class EmbeddingFailedError(Exception):
    """Raised when text embedding generation gracefully fails and returns None."""
    pass

def retrieve_chunks_by_topic(
    session: Session,
    subject_id: UUID,
    topic: Optional[str] = None,
    top_k: int = 5,
    job_id: Optional[str] = None,
) -> List[Chunk]:
    """
    Retrieve the top_k most relevant chunks for a given topic within a subject.
    If topic is None, returns all chunks for the subject.
    """
    log = get_job_logger(job_id, "engine-retrieval")
    log.info(f"STEP: RETRIEVAL STARTED for subject {subject_id}, topic='{topic}'")
    start_time = time.perf_counter()

    # if no topic, just return all chunks for the subject
    if not topic:
        chunks = session.query(Chunk).join(Document)\
            .filter(Document.subject_id == subject_id)\
            .all()
        duration = time.perf_counter() - start_time
        log.info(f"STEP: RETRIEVAL SUCCESS (duration: {duration:.2f}s, retrieved: {len(chunks)})")
        return chunks

    # 1️⃣ embed the topic
    topic_embedding = embed_step([topic], job_id=job_id)[0]  # returns list of floats or None

    if topic_embedding is None:
        log.error(f"STEP: RETRIEVAL FAILED - Embedding failed for topic: '{topic}'")
        raise EmbeddingFailedError(f"Failed to generate embedding for topic: '{topic}'")

    # 2️⃣ query chunks with similarity ordering (filter out NULL embeddings to avoid crash)
    chunks = session.query(Chunk).join(Document)\
        .filter(Document.subject_id == subject_id)\
        .filter(Chunk.embedding != None)\
        .order_by(Chunk.embedding.cosine_distance(topic_embedding))\
        .limit(top_k)\
        .all()

    duration = time.perf_counter() - start_time
    log.info(f"STEP: RETRIEVAL SUCCESS (duration: {duration:.2f}s, retrieved: {len(chunks)})")
    return chunks