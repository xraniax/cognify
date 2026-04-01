import os
import logging
from typing import Any, Dict, List, Optional

import requests
from requests.exceptions import RequestException, Timeout

import logging
import time
from utils.logging import get_job_logger

logger = logging.getLogger("engine-embeddings")

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama_gpu:11434").rstrip("/")
# Full URL override keeps Docker/local setups working when only the base host changes.
OLLAMA_EMBEDDINGS_URL = os.getenv("OLLAMA_EMBEDDINGS_URL") or f"{OLLAMA_BASE_URL}/api/embeddings"
OLLAMA_EMBEDDING_MODEL = os.getenv("OLLAMA_EMBEDDING_MODEL", "nomic-embed-text")


def ollama_tags_url() -> str:
    return f"{OLLAMA_BASE_URL}/api/tags"


def generate_embedding(text: str, timeout: int = 60, retries: int = 3) -> List[float]:
    """Generate an embedding for a single text chunk using Ollama"""
    if not text or not text.strip():
        return []

    payload: Dict[str, Any] = {
        "model": OLLAMA_EMBEDDING_MODEL,
        "prompt": text,
    }

    last_err = None
    for attempt in range(retries):
        try:
            logger.debug(f"Requesting embedding for chunk (attempt {attempt + 1}/{retries})")
            response = requests.post(OLLAMA_EMBEDDINGS_URL, json=payload, timeout=timeout)
            response.raise_for_status()

            response_data = response.json()
            embedding = response_data.get("embedding") or response_data.get("embeddings")

            if embedding is None:
                logger.warning("Ollama embeddings response missing embedding field for text length %d", len(text))
                raise ValueError("No embedding returned by Ollama")

            # Ollama may return one of these shapes; normalize to list of float.
            if isinstance(embedding, list):
                return [float(x) for x in embedding]

            raise ValueError("Unexpected embedding format returned by Ollama")

        except (Timeout, RequestException, ValueError) as err:
            logger.warning("Ollama embedding request failed (attempt %d/%d): %s", attempt + 1, retries, err)
            last_err = err

    raise RuntimeError(f"All retry attempts failed. Last error: {last_err}") from last_err


def generate_embeddings(
    texts: List[str], 
    timeout: int = 60, 
    retries: int = 3,
    job_id: Optional[str] = None,
) -> List[Optional[List[float]]]:
    """Generate embeddings for a list of text chunks, with graceful handling."""
    log = get_job_logger(job_id, "engine-embeddings")
    log.info(f"STEP: EMBEDDING STARTED for {len(texts)} chunks")
    start_time = time.perf_counter()
    
    embeddings: List[Optional[List[float]]] = []
    vector_size = 0

    for idx, chunk in enumerate(texts):
        try:
            emb = generate_embedding(chunk, timeout=timeout, retries=retries)
            # Stability: avoid persisting empty vectors into pgvector.
            embeddings.append(emb if emb else None)
            if emb and not vector_size:
                vector_size = len(emb)
        except Exception as err:
            log.warning("Embedding for chunk %d failed after retries: %s", idx, err)
            embeddings.append(None)

    duration = time.perf_counter() - start_time
    success_count = sum(1 for e in embeddings if e is not None)
    
    if success_count == 0 and len(texts) > 0:
        log.error(f"STEP: EMBEDDING FAILED (duration: {duration:.2f}s, chunks: {len(texts)})")
    elif success_count < len(texts):
        log.warning(f"STEP: EMBEDDING PARTIAL SUCCESS (duration: {duration:.2f}s, {success_count}/{len(texts)} chunks succeeded)")
    else:
        log.info(f"STEP: EMBEDDING SUCCESS (duration: {duration:.2f}s, chunks: {len(texts)}, vector_size: {vector_size})")
    
    return embeddings


def embed_step(
    texts: List[str],
    *,
    timeout: int = 60,
    retries: int = 3,
    job_id: Optional[str] = None,
) -> List[Optional[List[float]]]:
    """Pipeline entry point: same behavior as generate_embeddings (batch, per-chunk errors as null)."""
    return generate_embeddings(texts, timeout=timeout, retries=retries, job_id=job_id)
