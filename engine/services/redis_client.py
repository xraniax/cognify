import json
import logging
import os
from typing import Optional, Dict, Any, Set

import redis

logger = logging.getLogger("engine-redis-client")

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
QUIZ_SESSION_TTL_SECONDS = 3600

_client: Optional[redis.Redis] = None


def _get_client() -> redis.Redis:
    global _client
    if _client is None:
        _client = redis.from_url(REDIS_URL, decode_responses=True)
        logger.info("[REDIS_INIT] redis_client connected via %s", REDIS_URL)
    return _client


def _quiz_session_key(user_id: str, subject_id: str) -> str:
    return f"quiz_session:{user_id}:{subject_id}"


def _exam_session_key(user_id: str, subject_id: str, exam_id: str) -> str:
    return f"exam_session:{user_id}:{subject_id}:{exam_id}"


def _stringify_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (list, dict)):
        return json.dumps(value)
    return str(value)


def _parse_hash_value(value: str) -> Any:
    if value == "":
        return None

    # JSON-encoded lists and dicts (stored by _stringify_value or legacy Python repr guard)
    if value.startswith(("[", "{")):
        try:
            return json.loads(value)
        except (json.JSONDecodeError, ValueError):
            pass

    lowered = value.lower()
    if lowered == "true":
        return True
    if lowered == "false":
        return False

    try:
        if value.isdigit() or (value.startswith("-") and value[1:].isdigit()):
            return int(value)
        return float(value)
    except ValueError:
        return value


def get_quiz_session(user_id: str, subject_id: str) -> Optional[Dict[str, Any]]:
    key = _quiz_session_key(user_id, subject_id)
    try:
        raw = _get_client().hgetall(key)
        if not raw:
            logger.debug("[REDIS_EXAM_READ] MISS key=%s", key)
            return None
        parsed: Dict[str, Any] = {field: _parse_hash_value(value) for field, value in raw.items()}
        logger.debug("[REDIS_EXAM_READ] HIT key=%s fields=%d", key, len(parsed))
        return parsed
    except Exception as exc:
        logger.error("[REDIS_EXAM_READ] FAIL key=%s error=%s — defaulting to fresh session", key, exc)
        return None


def get_exam_session(user_id: str, subject_id: str, exam_id: str) -> Optional[Dict[str, Any]]:
    key = _exam_session_key(user_id, subject_id, exam_id)
    try:
        raw = _get_client().hgetall(key)
        if not raw:
            logger.debug("[REDIS_EXAM_READ] MISS key=%s", key)
            return None
        parsed: Dict[str, Any] = {field: _parse_hash_value(value) for field, value in raw.items()}
        logger.debug("[REDIS_EXAM_READ] HIT key=%s fields=%d", key, len(parsed))
        return parsed
    except Exception as exc:
        logger.error("[REDIS_EXAM_READ] FAIL key=%s error=%s — defaulting to fresh session", key, exc)
        return None


_SESSION_EXCLUDED_FIELDS: frozenset = frozenset({"weak_concepts", "strong_concepts"})


def update_quiz_session(user_id: str, subject_id: str, data: Dict[str, Any]) -> None:
    key = _quiz_session_key(user_id, subject_id)
    payload = {
        field: _stringify_value(value)
        for field, value in data.items()
        if field not in _SESSION_EXCLUDED_FIELDS
    }
    try:
        client = _get_client()
        if payload:
            client.hset(key, mapping=payload)
        client.expire(key, QUIZ_SESSION_TTL_SECONDS)
        logger.debug("[REDIS_EXAM_WRITE] OK key=%s fields=%d", key, len(payload))
    except Exception as exc:
        logger.error("[REDIS_EXAM_WRITE] FAIL key=%s error=%s — session state NOT persisted", key, exc)


EXAM_SESSION_TTL_SECONDS = 7200


def update_exam_session(user_id: str, subject_id: str, exam_id: str, data: Dict[str, Any]) -> None:
    key = _exam_session_key(user_id, subject_id, exam_id)
    payload = {
        field: _stringify_value(value)
        for field, value in data.items()
        if field not in _SESSION_EXCLUDED_FIELDS
    }
    try:
        client = _get_client()
        if payload:
            client.hset(key, mapping=payload)
        client.expire(key, EXAM_SESSION_TTL_SECONDS)
        logger.debug("[REDIS_EXAM_WRITE] OK key=%s fields=%d ttl=%ds", key, len(payload), EXAM_SESSION_TTL_SECONDS)
    except Exception as exc:
        logger.error("[REDIS_EXAM_WRITE] FAIL key=%s error=%s — exam session state NOT persisted", key, exc)


# ── Concept SET helpers ────────────────────────────────────────────────────
# These wrap Redis SET operations (SMEMBERS / SADD / SREM) for concept keys.
# Accepts an optional `client` so callers can pass their own connection.

def get_concepts(key: str, client: Optional[redis.Redis] = None) -> Set[str]:
    """Return the Redis SET at `key` as a Python set of strings, or empty set on error."""
    try:
        return (client or _get_client()).smembers(key)
    except Exception as exc:
        logger.error("[REDIS_EXAM_READ] get_concepts FAIL key=%s error=%s", key, exc)
        return set()


def add_concept(key: str, value: str, client: Optional[redis.Redis] = None) -> None:
    """Add `value` to the Redis SET at `key`."""
    try:
        (client or _get_client()).sadd(key, value)
    except Exception as exc:
        logger.error("[REDIS_EXAM_WRITE] add_concept FAIL key=%s value=%s error=%s", key, value, exc)


def remove_concept(key: str, value: str, client: Optional[redis.Redis] = None) -> None:
    """Remove `value` from the Redis SET at `key`."""
    try:
        (client or _get_client()).srem(key, value)
    except Exception as exc:
        logger.error("[REDIS_EXAM_WRITE] remove_concept FAIL key=%s value=%s error=%s", key, value, exc)
