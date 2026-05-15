import os
import logging
import asyncio
import threading
import time
from typing import Any, Dict, List, Optional

import requests
import httpx

from .ollama_config import get_ollama_base_url

logger = logging.getLogger("engine-embeddings")

# Use the same base URL resolution as the generation pipeline to keep
# Docker/local behaviour consistent.
OLLAMA_BASE_URL = get_ollama_base_url()
OLLAMA_EMBEDDINGS_URL = os.getenv("OLLAMA_EMBEDDINGS_URL") or f"{OLLAMA_BASE_URL}/api/embeddings"
OLLAMA_EMBEDDING_MODEL = os.getenv("OLLAMA_EMBEDDING_MODEL", "nomic-embed-text")

# Control how many requests hit Ollama concurrently
MAX_CONCURRENT_REQUESTS = int(os.getenv("OLLAMA_MAX_CONCURRENT", "10"))

# NEW: Logical batch size for embedding work. This controls how many
# chunks we schedule at once to the embedding layer so that very large
# documents do not create unbounded asyncio task lists.
EMBEDDING_BATCH_SIZE = int(os.getenv("OLLAMA_EMBEDDING_BATCH_SIZE", "128"))

def ollama_tags_url() -> str:
    return f"{OLLAMA_BASE_URL}/api/tags"

async def _generate_embedding_async(
    client: httpx.AsyncClient,
    text: str,
    timeout: int,
    retries: int,
    *,
    request_id: Optional[str] = None,
) -> Optional[List[float]]:
    if not text or not text.strip():
        return None

    payload: Dict[str, Any] = {"model": OLLAMA_EMBEDDING_MODEL, "prompt": text}

    rid = f"request_id={request_id} " if request_id else ""

    for attempt in range(retries):
        try:
            response = await client.post(OLLAMA_EMBEDDINGS_URL, json=payload, timeout=timeout)
            response.raise_for_status()
            
            data = response.json()
            embedding = data.get("embedding") or data.get("embeddings")
            
            if embedding and isinstance(embedding, list):
                return [float(x) for x in embedding]
            return None
            
        except httpx.TimeoutException:
            logger.warning("%sEmbedding timeout (attempt %d/%d)", rid, attempt + 1, retries)
        except httpx.RequestError as err:
            logger.warning("%sEmbedding request failed (attempt %d/%d): %s", rid, attempt + 1, retries, err)
            
    return None

async def _generate_embeddings_batch(
    texts: List[str], timeout: int, retries: int, *, request_id: Optional[str] = None
) -> List[Optional[List[float]]]:
    """Generate embeddings for a list of texts.

    ORIGINAL behaviour: fire off one async HTTP request per text and gather
    them all at once.

    NEW behaviour: keep that per-text request model (to stay compatible with
    Ollama's embeddings API) but schedule work in bounded batches so we never
    create an unbounded list of asyncio tasks for huge documents. This is a
    logical "batch embedding" that keeps memory under control while still
    utilising concurrency via MAX_CONCURRENT_REQUESTS.
    """

    if not texts:
        return []

    semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)

    async def bound_fetch(client: httpx.AsyncClient, text: str):
        async with semaphore:
            return await _generate_embedding_async(client, text, timeout, retries, request_id=request_id)

    limits = httpx.Limits(
        max_keepalive_connections=MAX_CONCURRENT_REQUESTS,
        max_connections=MAX_CONCURRENT_REQUESTS,
    )

    results: List[Optional[List[float]]] = []
    async with httpx.AsyncClient(limits=limits) as client:
        # Process texts in logical batches so that we do not accumulate
        # a huge in-memory list of asyncio Tasks for very long documents.
        for i in range(0, len(texts), EMBEDDING_BATCH_SIZE):
            batch = texts[i : i + EMBEDDING_BATCH_SIZE]
            tasks = [bound_fetch(client, text) for text in batch]
            batch_results = await asyncio.gather(*tasks)
            results.extend(batch_results)

    return results

async def embed_step_async(
    texts: List[str], *, timeout: int = 120, retries: int = 3, request_id: Optional[str] = None
) -> List[Optional[List[float]]]:
    """Async embeddings for Celery tasks. Recommended for large batches (non-blocking).
    
    Usage in Celery tasks:
        result = await embed_step_async(chunks)
    """
    if not texts:
        return []
    started_at = time.time()
    logger.info(
        "[PIPELINE] embeddings_start request_id=%s mode=async count=%d model=%s max_concurrent=%d timeout=%ds retries=%d",
        request_id,
        len(texts),
        OLLAMA_EMBEDDING_MODEL,
        MAX_CONCURRENT_REQUESTS,
        timeout,
        retries,
    )
    result = await _generate_embeddings_batch(texts, timeout, retries, request_id=request_id)
    failed = sum(1 for e in result if e is None)
    logger.info(
        "[PIPELINE] embeddings_end request_id=%s mode=async count=%d failed=%d elapsed_ms=%d",
        request_id,
        len(texts),
        failed,
        int((time.time() - started_at) * 1000),
    )
    return result


def embed_step(
    texts: List[str], *, timeout: int = 120, retries: int = 3, request_id: Optional[str] = None
) -> List[Optional[List[float]]]:
    """Synchronous wrapper for FastAPI routes. Uses asyncio.run() in non-loop contexts.
    
    For Celery tasks, prefer embed_step_async() to avoid asyncio.run() overhead.
    For FastAPI routes, this automatically detects running loops and uses threads if needed.
    """
    if not texts:
        return []

    started_at = time.time()
    logger.info(
        "[PIPELINE] embeddings_start request_id=%s mode=sync count=%d model=%s max_concurrent=%d timeout=%ds retries=%d",
        request_id,
        len(texts),
        OLLAMA_EMBEDDING_MODEL,
        MAX_CONCURRENT_REQUESTS,
        timeout,
        retries,
    )
    
    try:
        # Check if event loop already running (e.g., async FastAPI route)
        asyncio.get_running_loop()
        logger.debug("Event loop detected; using thread wrapper for embed_step")
        
        # Use thread wrapper to avoid "RuntimeError: This event loop is already running"
        result_container = []
        def _run_in_thread():
            new_loop = asyncio.new_event_loop()
            asyncio.set_event_loop(new_loop)
            try:
                res = new_loop.run_until_complete(
                    _generate_embeddings_batch(texts, timeout, retries, request_id=request_id)
                )
                result_container.append(res)
            finally:
                new_loop.close()
        
        thread = threading.Thread(target=_run_in_thread, daemon=False)
        thread.start()
        thread.join()
        result = result_container[0]
        failed = sum(1 for e in result if e is None)
        logger.info(
            "[PIPELINE] embeddings_end request_id=%s mode=sync-thread count=%d failed=%d elapsed_ms=%d",
            request_id,
            len(texts),
            failed,
            int((time.time() - started_at) * 1000),
        )
        return result
    
    except RuntimeError:
        # No event loop running (e.g., sync context, Celery worker)
        logger.debug("No event loop detected; using asyncio.run() for embed_step")
        result = asyncio.run(_generate_embeddings_batch(texts, timeout, retries, request_id=request_id))
        failed = sum(1 for e in result if e is None)
        logger.info(
            "[PIPELINE] embeddings_end request_id=%s mode=sync count=%d failed=%d elapsed_ms=%d",
            request_id,
            len(texts),
            failed,
            int((time.time() - started_at) * 1000),
        )
        return result
