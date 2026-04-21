from typing import List, Optional
from sqlalchemy.orm import Session
from uuid import UUID
from sqlalchemy import select
import time
from utils.logging import get_job_logger
import os

# CONFIGURATION FLAGS
QUIZ_TOP_K = int(os.getenv("QUIZ_TOP_K", "10"))
ENABLE_RERANKING_PER_TASK = os.getenv("ENABLE_RERANKING_PER_TASK", "true").lower() == "true"
try:
    from models import Chunk, Document
except ImportError:
    from ..models import Chunk, Document

from .embeddings import embed_step  #Ollama embedding function
from .reranker import reranker

class EmbeddingFailedError(Exception):
    """Raised when text embedding generation gracefully fails and returns None."""
    pass

def retrieve_chunks_by_topic(
    session: Session,
    subject_id: UUID,
    topic: Optional[str] = None,
    top_k: int = 5,
    job_id: Optional[str] = None,
    rerank: bool = True,
    task_type: Optional[str] = None
) -> List[Chunk]:
    """
    Retrieve the top_k most relevant chunks for a given topic within a subject.
    If topic is None, returns all chunks for the subject.
    
    Two-stage retrieval:
    1. Bi-Encoder (Vector search) for high recall.
    2. Cross-Encoder (Reranker) for high precision.
    """
    # OPTIMIZATION: Disable reranking for quiz generation to save CPU/Latency
    effective_rerank = rerank
    if task_type == "quiz" or not ENABLE_RERANKING_PER_TASK:
        effective_rerank = False
        top_k = QUIZ_TOP_K if task_type == "quiz" else top_k
        
    log = get_job_logger(job_id, "engine-retrieval")
    log.info(f"STEP: RETRIEVAL STARTED for subject {subject_id}, topic='{topic}', rerank={effective_rerank} task={task_type}")
    start_time = time.perf_counter()

    # if no topic, just return all chunks for the subject
    if not topic:
        chunks = session.query(Chunk).join(Document)\
            .filter(Document.subject_id == subject_id)\
            .all()
        duration = time.perf_counter() - start_time
        log.info(f"STEP: RETRIEVAL SUCCESS (duration: {duration:.2f}s, retrieved: {len(chunks)})")
        return chunks

    # --- Stage 1: Vector Search (Recall) ---
    # Retrieve more candidates than top_k if we are going to rerank
    recall_k = top_k * 3 if effective_rerank else top_k
    
    # 1️⃣ embed the topic
    topic_embedding = embed_step([topic], job_id=job_id)[0]

    if topic_embedding is None:
        log.error(f"STEP: RETRIEVAL FAILED - Embedding failed for topic: '{topic}'")
        raise EmbeddingFailedError(f"Failed to generate embedding for topic: '{topic}'")

    # 2️⃣ query chunks with similarity ordering
    query = session.query(Chunk).join(Document)\
        .filter(Document.subject_id == subject_id)\
        .filter(Chunk.embedding != None)\
        .order_by(Chunk.embedding.cosine_distance(topic_embedding))\
        .limit(recall_k)

    candidates = query.all()
    
    if not candidates:
        log.info(f"STEP: RETRIEVAL SUCCESS (0 candidates found)")
        return []

    # --- Stage 2: Reranking (Precision) ---
    if effective_rerank and len(candidates) > 1:
        log.info(f"STEP: RERANKING {len(candidates)} candidates for query: '{topic}'")
        contents = [c.content for c in candidates if c.content]
        
        # Get scores from Cross-Encoder
        scores = reranker.rank(topic, contents)
        
        # Sort candidates by rerank score (descending)
        # Note: wezip scores and candidates. Ensure they align.
        scored_candidates = sorted(zip(scores, candidates), key=lambda x: x[0], reverse=True)
        
        # Take the top_k
        final_chunks = [c for score, c in scored_candidates[:top_k]]
        log.info(f"STEP: RERANKING SUCCESS. Top score: {scored_candidates[0][0]:.4f}")
        return final_chunks

    log.info(f"STEP: RETRIEVAL SUCCESS for subject {subject_id} (duration: {time.perf_counter() - start_time:.2f}s, retrieved: {len(candidates)})")
    return candidates