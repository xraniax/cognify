"""
Centralised chunk processing module to handle Map and Reduce operations.
"""
import asyncio
import concurrent.futures
import logging
import time
from typing import List, Optional, Callable, Tuple

logger = logging.getLogger("engine-chunk-processing")

_MIN_CHUNK_CHARS = 100

def _prepare_eligible_chunks(chunks: List[str], max_chunks: int) -> List[str]:
    """Filter and cap chunks for MAP processing."""
    eligible = [c for c in chunks if len(c.strip()) >= _MIN_CHUNK_CHARS]
    if len(eligible) > max_chunks:
        logger.warning(
            "[CHUNK_PROCESSING][MAP] capping %d eligible chunks to %d", len(eligible), max_chunks,
        )
        eligible = eligible[:max_chunks]
    return eligible

def process_chunk(
    idx: int,
    chunk: str,
    total: int,
    process_fn: Callable[[str], str]
) -> Tuple[int, str, int]:
    """
    Process a single chunk using the provided function and return timing.
    """
    chunk_start = time.perf_counter()
    logger.info("[CHUNK_PROCESSING][MAP] chunk %d/%d chars=%d", idx + 1, total, len(chunk))
    
    result = process_fn(chunk)
    
    chunk_ms = int((time.perf_counter() - chunk_start) * 1000)
    if result:
        logger.info("[CHUNK_PROCESSING][MAP] chunk %d/%d DONE duration_ms=%d out_chars=%d", 
                    idx + 1, total, chunk_ms, len(result))
    else:
        logger.warning("[CHUNK_PROCESSING][MAP] chunk %d/%d EMPTY duration_ms=%d", 
                       idx + 1, total, chunk_ms)
        
    return idx, result or "", chunk_ms

def map_chunks_sync(
    chunks: List[str],
    process_fn: Callable[[str], str],
    concurrency: int,
    max_chunks: int,
) -> List[str]:
    """
    Synchronous MAP stage: process chunks with bounded concurrency.
    """
    stage_start = time.perf_counter()
    eligible = _prepare_eligible_chunks(chunks, max_chunks)
    if not eligible:
        return []

    concurrency = min(len(eligible), concurrency) if eligible else 1
    logger.info(
        "[CHUNK_PROCESSING][SYNC_START] eligible=%d concurrency=%d",
        len(eligible), concurrency,
    )

    results = [None] * len(eligible)
    chunk_timings = [0] * len(eligible)

    def _run_chunk(idx_chunk: Tuple[int, str]) -> Tuple[int, str, int]:
        idx, chunk = idx_chunk
        return process_chunk(idx, chunk, len(eligible), process_fn)

    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as pool:
        futures = pool.map(_run_chunk, enumerate(eligible))
        for idx, summary, chunk_ms in futures:
            results[idx] = summary
            chunk_timings[idx] = chunk_ms

    mapped = [s for s in results if s]
    total_ms = int((time.perf_counter() - stage_start) * 1000)
    valid_timings = [t for t in chunk_timings if t > 0]
    avg_ms = int(sum(valid_timings) / len(valid_timings)) if valid_timings else 0

    logger.info(
        "[CHUNK_PROCESSING][SYNC_END] processed=%d total_ms=%d avg_ms=%d output=%d",
        len(eligible), total_ms, avg_ms, len(mapped),
    )
    return mapped

async def async_map_chunks(
    chunks: List[str],
    process_fn: Callable[[str], str],
    concurrency: int,
    max_chunks: int,
    progress_queue: Optional[asyncio.Queue] = None,
) -> List[str]:
    """
    Async MAP stage with bounded concurrency for streaming paths.
    """
    eligible = _prepare_eligible_chunks(chunks, max_chunks)
    if not eligible:
        return []

    stage_start = time.perf_counter()
    concurrency = min(len(eligible), concurrency)
    sem = asyncio.Semaphore(concurrency)
    loop = asyncio.get_running_loop()
    completed_count = 0

    logger.info(
        "[CHUNK_PROCESSING][ASYNC_START] eligible=%d concurrency=%d",
        len(eligible), concurrency,
    )

    async def _map_one(idx: int, chunk: str) -> Tuple[int, str]:
        nonlocal completed_count
        async with sem:
            _, result, _ = await loop.run_in_executor(
                None, process_chunk, idx, chunk, len(eligible), process_fn
            )
            completed_count += 1
            if progress_queue is not None:
                await progress_queue.put(f"map {completed_count}/{len(eligible)}")
            return idx, result

    tasks = [_map_one(i, c) for i, c in enumerate(eligible)]
    gathered = await asyncio.gather(*tasks, return_exceptions=True)

    ordered = [None] * len(eligible)
    for item in gathered:
        if isinstance(item, Exception):
            logger.warning("[CHUNK_PROCESSING][ASYNC] chunk failed: %s", item)
            continue
        idx, summary = item
        ordered[idx] = summary

    mapped = [s for s in ordered if s]
    total_ms = int((time.perf_counter() - stage_start) * 1000)
    logger.info(
        "[CHUNK_PROCESSING][ASYNC_END] total_ms=%d input=%d output=%d concurrency=%d",
        total_ms, len(eligible), len(mapped), concurrency,
    )

    if progress_queue is not None:
        await progress_queue.put(None)

    return mapped

def reduce_results(chunks: List[str], max_chars: int, truncation_message: str = "\n...[Context truncated]") -> str:
    """
    Combine chunks into a single context string with a max-length cap.
    """
    context = "\n\n".join(chunks)
    if len(context) > max_chars:
        logger.warning(
            "[CHUNK_PROCESSING][REDUCE] context truncated from %d to %d chars", 
            len(context), max_chars
        )
        context = context[:max_chars] + truncation_message
    return context
