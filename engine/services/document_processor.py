"""Document pipeline: preprocess → chunk → embed (reused by FastAPI routes).

Performance Notes:
- embed_step() automatically detects execution context:
  * Async FastAPI routes: Uses thread wrapper to avoid "loop already running" errors
  * Celery tasks: Uses asyncio.run() for non-blocking async execution
  * This eliminates redundant thread overhead in Celery context
"""
import logging
import time
from typing import Any, Dict, List, Optional

from .embeddings import embed_step, embed_step_async
from .preprocessing import chunk_step, clean_text_step, preprocess_step

logger = logging.getLogger("engine-document-processor")


def process_document(
    file_path: str,
    *,
    max_chunk_chars: int = 1500,
    chunk_overlap: int = 200,
    include_embeddings: bool = True,
    request_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Full file pipeline: extract, clean, chunk, optionally embed.
    Backward compatible fields: type, raw_text, cleaned_text, chunks, num_chunks.
    When include_embeddings is True, adds `embeddings` (same length as chunks).
    """
    started_at = time.time()
    logger.info(
        "[PIPELINE] process_document_start request_id=%s file_path=%s include_embeddings=%s max_chunk_chars=%d overlap=%d",
        request_id,
        file_path,
        include_embeddings,
        max_chunk_chars,
        chunk_overlap,
    )

    pre_started = time.time()
    pre = preprocess_step(file_path, request_id=request_id)
    logger.info(
        "[PIPELINE] preprocess_done request_id=%s type=%s raw_chars=%d cleaned_chars=%d elapsed_ms=%d",
        request_id,
        pre.get("type"),
        len(pre.get("raw_text") or ""),
        len(pre.get("cleaned_text") or ""),
        int((time.time() - pre_started) * 1000),
    )

    chunk_started = time.time()
    chunks = chunk_step(
        pre["cleaned_text"],
        max_chunk_chars=max_chunk_chars,
        chunk_overlap=chunk_overlap,
        request_id=request_id,
    )
    logger.info(
        "[PIPELINE] chunking_done request_id=%s chunks=%d elapsed_ms=%d",
        request_id,
        len(chunks),
        int((time.time() - chunk_started) * 1000),
    )
    out: Dict[str, Any] = {
        "type": pre["type"],
        "raw_text": pre["raw_text"],
        "cleaned_text": pre["cleaned_text"],
        "chunks": chunks,
        "num_chunks": len(chunks),
    }
    if include_embeddings:
        embed_started = time.time()
        out["embeddings"] = embed_step(chunks, request_id=request_id)
        embeddings = out.get("embeddings") or []
        failed = sum(1 for e in embeddings if e is None)
        logger.info(
            "[PIPELINE] embedding_done request_id=%s chunks=%d failed=%d elapsed_ms=%d",
            request_id,
            len(chunks),
            failed,
            int((time.time() - embed_started) * 1000),
        )

    logger.info(
        "[PIPELINE] process_document_end request_id=%s type=%s chunks=%d total_elapsed_ms=%d",
        request_id,
        out.get("type"),
        len(chunks),
        int((time.time() - started_at) * 1000),
    )
    return out


def process_text_pipeline(
    raw_text: str,
    *,
    max_chunk_chars: int = 1500,
    chunk_overlap: int = 200,
    include_embeddings: bool = True,
    request_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Full pipeline from raw text (no file): clean → chunk → optional embed."""
    cleaned_text = clean_text_step(raw_text)
    chunks = chunk_step(
        cleaned_text,
        max_chunk_chars=max_chunk_chars,
        chunk_overlap=chunk_overlap,
    )
    out: Dict[str, Any] = {
        "type": "Text",
        "raw_text": raw_text,
        "cleaned_text": cleaned_text,
        "chunks": chunks,
        "num_chunks": len(chunks),
    }
    if include_embeddings:
        out["embeddings"] = embed_step(chunks, request_id=request_id)
    return out
