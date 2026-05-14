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


def _stringify_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (list, dict)):
        return json.dumps(value)
    return str(value)


def _parse_hash_value(value: str) -> Any:
    if value == "":
        return ""

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
    raw = _get_client().hgetall(key)
    if not raw:
        return None

    parsed: Dict[str, Any] = {}
    for field, value in raw.items():
        parsed[field] = _parse_hash_value(value)
    return parsed


_SESSION_EXCLUDED_FIELDS: frozenset = frozenset({"weak_concepts", "strong_concepts"})


def update_quiz_session(user_id: str, subject_id: str, data: Dict[str, Any]) -> None:
    key = _quiz_session_key(user_id, subject_id)
    payload = {
        field: _stringify_value(value)
        for field, value in data.items()
        if field not in _SESSION_EXCLUDED_FIELDS
    }
    client = _get_client()
    if payload:
        client.hset(key, mapping=payload)
    client.expire(key, QUIZ_SESSION_TTL_SECONDS)


# ── Concept SET helpers ────────────────────────────────────────────────────
# These wrap Redis SET operations (SMEMBERS / SADD / SREM) for concept keys.
# Accepts an optional `client` so callers can pass their own connection.

def get_concepts(key: str, client: Optional[redis.Redis] = None) -> Set[str]:
    """Return the Redis SET at `key` as a Python set of strings."""
    return (client or _get_client()).smembers(key)


def add_concept(key: str, value: str, client: Optional[redis.Redis] = None) -> None:
    """Add `value` to the Redis SET at `key`."""
    (client or _get_client()).sadd(key, value)


def remove_concept(key: str, value: str, client: Optional[redis.Redis] = None) -> None:
    """Remove `value` from the Redis SET at `key`."""
    (client or _get_client()).srem(key, value)
