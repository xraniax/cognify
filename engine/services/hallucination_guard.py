"""
Lightweight, non-intrusive hallucination safety checks for the LLM generation
pipeline.

Design constraints (intentional):
  * No additional LLM calls — every check is pure Python string processing.
  * No measurable latency — keyword overlap runs in microseconds-to-low-ms even
    for the maximum 15 KB context.
  * No changes to RAG retrieval — this module only inspects values that callers
    already hold (retrieved context, prompt, output).
  * Advisory by default — the grounding check logs a warning and NEVER blocks
    or rewrites output. The only hard gate is the pre-generation context guard,
    which mirrors checks the callers already perform (`if not chunks`).

Public API:
  * is_context_sufficient(context)  -> (bool, reason)
  * grounding_overlap(output, context) -> float in [0, 1]
  * check_grounding(output, context, *, material_type, request_id) -> float
        (computes overlap and logs a warning when below threshold; never raises)
  * NOT_FOUND_MESSAGE — canonical fallback string for free-text answers
  * log_generation_trace(...) — structured debug logging of context/prompt/output
"""
import logging
import os
import re
from typing import Optional, Tuple

logger = logging.getLogger("engine-hallucination-guard")

# ── Tunables (env-overridable, safe defaults) ────────────────────────────────
# Minimum non-whitespace characters of retrieved context required before a
# generation call is considered grounded enough to proceed.
MIN_CONTEXT_CHARS = int(os.getenv("HALLUCINATION_MIN_CONTEXT_CHARS", "40"))
# Minimum distinct content tokens (after stopword removal) in the context.
MIN_CONTEXT_TOKENS = int(os.getenv("HALLUCINATION_MIN_CONTEXT_TOKENS", "5"))
# Below this overlap ratio the output is flagged as potentially ungrounded.
# Advisory only — logged, never enforced.
GROUNDING_WARN_THRESHOLD = float(os.getenv("HALLUCINATION_GROUNDING_THRESHOLD", "0.30"))
# Cap tokens scanned so pathological inputs cannot add latency.
_MAX_TOKENS_SCANNED = 20000

# Canonical fallback returned by free-text paths (chat) when grounding is
# impossible because no usable context was retrieved.
NOT_FOUND_MESSAGE = "Not found in provided material."

# Minimal stopword set — kept small and deterministic. Removing these prevents
# trivially-high overlap from function words inflating the grounding ratio.
_STOPWORDS = frozenset({
    "the", "a", "an", "and", "or", "but", "if", "then", "else", "of", "to", "in",
    "on", "at", "by", "for", "with", "as", "is", "are", "was", "were", "be", "been",
    "being", "it", "its", "this", "that", "these", "those", "from", "into", "than",
    "so", "such", "not", "no", "can", "will", "would", "should", "could", "may",
    "might", "must", "do", "does", "did", "has", "have", "had", "you", "your",
    "we", "our", "they", "their", "he", "she", "his", "her", "i", "me", "my",
    "what", "which", "who", "whom", "when", "where", "why", "how", "all", "any",
    "each", "more", "most", "other", "some", "only", "own", "same", "also", "about",
})

_TOKEN_RE = re.compile(r"[a-z0-9]+")


def _tokenize(text: str) -> list:
    """Lowercase alphanumeric tokenization with a hard scan cap."""
    if not text:
        return []
    return _TOKEN_RE.findall(text.lower())[:_MAX_TOKENS_SCANNED]


def _content_token_set(text: str) -> set:
    """Distinct content tokens (>=3 chars, non-stopword) from text."""
    return {
        t for t in _tokenize(text)
        if len(t) >= 3 and t not in _STOPWORDS
    }


def is_context_sufficient(context: Optional[str]) -> Tuple[bool, str]:
    """Pre-generation guard.

    Returns (ok, reason). ok=False means the retrieved context is empty or too
    thin to ground a generation, and the caller should skip the LLM call.

    This does NOT touch retrieval — it only inspects the context the caller has
    already assembled.
    """
    if not context or not context.strip():
        return False, "empty_context"
    stripped = context.strip()
    if len(stripped) < MIN_CONTEXT_CHARS:
        return False, f"context_too_short(chars={len(stripped)}<{MIN_CONTEXT_CHARS})"
    tokens = _content_token_set(stripped)
    if len(tokens) < MIN_CONTEXT_TOKENS:
        return False, f"context_too_sparse(tokens={len(tokens)}<{MIN_CONTEXT_TOKENS})"
    return True, "ok"


def grounding_overlap(output: Optional[str], context: Optional[str]) -> float:
    """Fraction of the output's content tokens that also appear in the context.

    1.0 = every content word in the answer is present in the retrieved context.
    0.0 = none are (strong hallucination signal). Pure set arithmetic; no model.
    """
    out_tokens = _content_token_set(output or "")
    if not out_tokens:
        return 1.0  # no content tokens to ground (empty or pure-stopword output)
    ctx_tokens = _content_token_set(context or "")
    if not ctx_tokens:
        return 0.0
    overlap = len(out_tokens & ctx_tokens)
    return overlap / len(out_tokens)


def check_grounding(
    output: Optional[str],
    context: Optional[str],
    *,
    material_type: str = "unknown",
    request_id: Optional[str] = None,
) -> float:
    """Post-generation grounding check. Logs a warning when overlap is below
    GROUNDING_WARN_THRESHOLD. Never blocks, never raises — advisory only.

    Returns the overlap ratio for optional caller use / telemetry.
    """
    try:
        ratio = grounding_overlap(output, context)
        if ratio < GROUNDING_WARN_THRESHOLD:
            logger.warning(
                "[GROUNDING][LOW] material_type=%s request_id=%s overlap=%.3f "
                "threshold=%.2f output_chars=%d context_chars=%d — output may contain "
                "ungrounded content",
                material_type, request_id, ratio, GROUNDING_WARN_THRESHOLD,
                len(output or ""), len(context or ""),
            )
        else:
            logger.debug(
                "[GROUNDING][OK] material_type=%s request_id=%s overlap=%.3f",
                material_type, request_id, ratio,
            )
        return ratio
    except Exception as e:  # defensive: a guard must never break generation
        logger.debug("[GROUNDING] check skipped due to error: %s", e)
        return 1.0


def log_generation_trace(
    *,
    material_type: str,
    context: Optional[str],
    prompt: Optional[str],
    output: Optional[str],
    request_id: Optional[str] = None,
    extra: Optional[str] = None,
) -> None:
    """Structured debug logging of the retrieved context, prompt, and output.

    Emitted at DEBUG so it is silent in production unless explicitly enabled.
    Bodies are length-capped to keep log volume bounded.
    """
    try:
        logger.debug(
            "[GEN_TRACE] material_type=%s request_id=%s context_chars=%d prompt_chars=%d "
            "output_chars=%d%s\n"
            "  context_head=%r\n"
            "  prompt_head=%r\n"
            "  output_head=%r",
            material_type, request_id,
            len(context or ""), len(prompt or ""), len(output or ""),
            f" {extra}" if extra else "",
            (context or "")[:500],
            (prompt or "")[:500],
            (output or "")[:500],
        )
    except Exception as e:
        logger.debug("[GEN_TRACE] logging skipped due to error: %s", e)
