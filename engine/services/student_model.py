import json
import os
import logging
import time
from typing import Dict, Any, Optional

import redis

logger = logging.getLogger("engine-student-model")

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

# Simple tuning knobs for concept classification.
STRONG_CONCEPT_MIN_CORRECT = int(os.getenv("STUDENT_STRONG_CONCEPT_MIN_CORRECT", "2"))
ACCURACY_STEP = float(os.getenv("STUDENT_ACCURACY_STEP", "0.05"))

# ── Startup diagnostic: log resolved Redis target ──────────────────────────
_redis_db_index = "unknown"
try:
    from urllib.parse import urlparse
    _parsed = urlparse(REDIS_URL)
    _redis_db_index = _parsed.path.lstrip("/") or "0"
except Exception:
    pass
logger.info(
    "[REDIS_INIT] student_model REDIS_URL=%s db_index=%s",
    REDIS_URL, _redis_db_index,
)


def _get_redis_client() -> redis.Redis:
    return redis.from_url(REDIS_URL, decode_responses=True)


def _state_key(user_id: str) -> str:
    """Canonical single key for global learner state."""
    return f"student:{user_id}:state"

def _subject_state_key(user_id: str, subject_id: str) -> str:
    """Subject-specific learner state key."""
    return f"student:{user_id}:subject:{subject_id}:state"


# ── Legacy key helpers (used only for lazy migration) ──────────────────────

def _legacy_base_key(user_id: str) -> str:
    return f"student:{user_id}"


def _legacy_weak_concepts_key(user_id: str) -> str:
    return f"student:{user_id}:weak_concepts"


def _legacy_strong_concepts_key(user_id: str) -> str:
    return f"student:{user_id}:strong_concepts"


def _legacy_concept_correct_count_key(user_id: str) -> str:
    return f"student:{user_id}:concept_correct_count"


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _parse_json_list(raw: str) -> list:
    """Safely parse a JSON string into a list, returning [] on failure."""
    if not raw:
        return []
    try:
        result = json.loads(raw)
        return result if isinstance(result, list) else []
    except (json.JSONDecodeError, TypeError):
        return []


def _parse_json_dict(raw: str) -> dict:
    """Safely parse a JSON string into a dict, returning {} on failure."""
    if not raw:
        return {}
    try:
        result = json.loads(raw)
        return result if isinstance(result, dict) else {}
    except (json.JSONDecodeError, TypeError):
        return {}


def _migrate_legacy_keys(user_id: str, client: redis.Redis) -> Optional[Dict[str, str]]:
    """Lazy migration: read old scattered keys, write canonical HASH, delete old keys.

    Returns the canonical HASH mapping if migration occurred, None otherwise.
    """
    legacy_base = _legacy_base_key(user_id)
    legacy_weak = _legacy_weak_concepts_key(user_id)
    legacy_strong = _legacy_strong_concepts_key(user_id)
    legacy_counts = _legacy_concept_correct_count_key(user_id)

    # Check if any legacy key exists
    if not client.exists(legacy_base, legacy_weak, legacy_strong, legacy_counts):
        return None

    # Read legacy data
    base_data = client.hgetall(legacy_base)
    weak_concepts = sorted(client.smembers(legacy_weak))
    strong_concepts = sorted(client.smembers(legacy_strong))
    concept_scores = client.hgetall(legacy_counts)

    # Build canonical mapping
    mapping = {
        "accuracy": base_data.get("accuracy", "0.500000"),
        "avg_response_time": base_data.get("avg_response_time", "0.000000"),
        "attempts": base_data.get("attempts", "0"),
        "correct_count": base_data.get("correct_count", "0"),
        "weak_concepts": json.dumps(weak_concepts),
        "strong_concepts": json.dumps(strong_concepts),
        "concept_scores": json.dumps(concept_scores),
        "last_updated": str(time.time()),
    }

    # Write canonical key and delete legacy keys atomically
    pipe = client.pipeline()
    pipe.hset(_state_key(user_id), mapping=mapping)
    pipe.delete(legacy_base, legacy_weak, legacy_strong, legacy_counts)
    pipe.execute()

    logger.info(
        "Migrated legacy Redis keys to canonical state for user_id=%s weak=%d strong=%d",
        user_id, len(weak_concepts), len(strong_concepts),
    )
    return mapping


def _read_state(user_id: str, client: redis.Redis) -> Dict[str, str]:
    """Read canonical HASH, triggering lazy migration if needed."""
    data = client.hgetall(_state_key(user_id))
    if not data:
        migrated = _migrate_legacy_keys(user_id, client)
        if migrated:
            data = migrated
    return data or {}


def get_student(user_id: str) -> Dict[str, Any]:
    """Return student profile from Redis with safe defaults when missing."""
    if not user_id:
        raise ValueError("user_id is required")

    try:
        client = _get_redis_client()
        data = _read_state(user_id, client)
    except Exception as exc:
        logger.error("[STUDENT_MODEL] get_student FAIL user_id=%s error=%s — returning defaults", user_id, exc)
        data = {}

    return {
        "accuracy": float(data.get("accuracy", 0.5)),
        "avg_response_time": float(data.get("avg_response_time", 0.0)),
        "weak_concepts": sorted(_parse_json_list(data.get("weak_concepts", "[]"))),
        "strong_concepts": sorted(_parse_json_list(data.get("strong_concepts", "[]"))),
    }


def get_student_state_with_meta(user_id: str) -> tuple[Dict[str, Any], bool]:
    """Return student state plus a flag indicating whether Redis has a stored profile."""
    if not user_id:
        raise ValueError("user_id is required")

    client = _get_redis_client()

    # Check canonical key first, then legacy keys for potential migration
    exists = bool(client.exists(_state_key(user_id)))
    if not exists:
        exists = bool(client.exists(
            _legacy_base_key(user_id),
            _legacy_weak_concepts_key(user_id),
            _legacy_strong_concepts_key(user_id),
        ))

    return get_student(user_id), exists


def get_subject_student(user_id: str, subject_id: str) -> Dict[str, Any]:
    """Return subject-specific student profile with lazy migration from global."""
    if not user_id or not subject_id:
        raise ValueError("user_id and subject_id are required")

    _redis_fail_defaults = {
        "accuracy": 0.5,
        "avg_response_time": 0.0,
        "weak_concepts": [],
        "strong_concepts": [],
        "concept_scores": {},
    }

    try:
        client = _get_redis_client()
        sub_key = _subject_state_key(user_id, subject_id)
        data = client.hgetall(sub_key)

        if not data:
            # Lazy Migration
            global_data = _read_state(user_id, client)

            from .knowledge_graph_service import get_subject_graph
            graph = get_subject_graph(subject_id)
            domain_concepts = set()
            if graph:
                for cat in ("core_concepts", "supporting_concepts", "minor_concepts"):
                    for c in graph.get(cat) or []:
                        name = c.get("name") if isinstance(c, dict) else None
                        if name:
                            domain_concepts.add(name)

            global_weak = set(_parse_json_list(global_data.get("weak_concepts", "[]")))
            global_strong = set(_parse_json_list(global_data.get("strong_concepts", "[]")))
            global_scores = _parse_json_dict(global_data.get("concept_scores", "{}"))

            if domain_concepts:
                subject_weak = [c for c in global_weak if c in domain_concepts]
                subject_strong = [c for c in global_strong if c in domain_concepts]
                subject_scores = {c: s for c, s in global_scores.items() if c in domain_concepts}
            else:
                subject_weak = []
                subject_strong = []
                subject_scores = {}

            data = {
                "accuracy": global_data.get("accuracy", "0.500000"),
                "avg_response_time": global_data.get("avg_response_time", "0.000000"),
                "attempts": "0",
                "correct_count": "0",
                "weak_concepts": json.dumps(subject_weak),
                "strong_concepts": json.dumps(subject_strong),
                "concept_scores": json.dumps(subject_scores),
                "last_updated": str(time.time()),
            }
            client.hset(sub_key, mapping=data)
            logger.info(
                "Lazy hydrated subject_id=%s for user_id=%s with weak=%d strong=%d",
                subject_id, user_id, len(subject_weak), len(subject_strong)
            )

    except Exception as exc:
        logger.error(
            "[STUDENT_MODEL] get_subject_student FAIL user_id=%s subject_id=%s error=%s — returning defaults",
            user_id, subject_id, exc,
        )
        return _redis_fail_defaults

    # Ensure floats are safely parsed even if Redis returns empty strings/None
    def _safe_float(val, default):
        try:
            if val is None or str(val).strip() == "":
                return default
            return float(val)
        except (ValueError, TypeError):
            return default

    return {
        "accuracy": _safe_float(data.get("accuracy"), 0.5),
        "avg_response_time": _safe_float(data.get("avg_response_time"), 0.0),
        "weak_concepts": sorted(_parse_json_list(data.get("weak_concepts", "[]"))),
        "strong_concepts": sorted(_parse_json_list(data.get("strong_concepts", "[]"))),
        "concept_scores": _parse_json_dict(data.get("concept_scores", "{}")),
    }


def update_student_performance(
    user_id: str,
    is_correct: bool,
    response_time: float,
    concept: str = None,
    topic: str = None,
    subject_id: str = None,
) -> Dict[str, Any]:
    """Update student metrics globally and per-subject."""
    if not user_id:
        raise ValueError("user_id is required")
    if response_time < 0:
        raise ValueError("response_time must be >= 0")

    from .concept_resolver import ConceptResolver
    resolved_concept = ConceptResolver.resolve(concept, topic)

    try:
        client = _get_redis_client()

        # 1. Global Update
        global_data = _read_state(user_id, client)
        g_attempts = int(global_data.get("attempts", 0)) + 1
        g_correct = int(global_data.get("correct_count", 0)) + (1 if is_correct else 0)
        g_avg_rt = float(global_data.get("avg_response_time", 0.0))
        g_new_avg_rt = float(response_time) if g_attempts == 1 else ((g_avg_rt * (g_attempts - 1)) + float(response_time)) / g_attempts

        g_acc = float(global_data.get("accuracy", 0.5))
        g_emp = g_correct / g_attempts
        g_step = ACCURACY_STEP if is_correct else -ACCURACY_STEP
        g_new_acc = (g_emp + _clamp(g_acc + g_step, 0.0, 1.0)) / 2.0

        global_mapping = {
            "attempts": g_attempts,
            "correct_count": g_correct,
            "accuracy": f"{g_new_acc:.6f}",
            "avg_response_time": f"{g_new_avg_rt:.6f}",
            "last_updated": str(time.time()),
        }

        # Temporarily preserve global concepts for backward compatibility
        if "weak_concepts" in global_data:
            global_mapping["weak_concepts"] = global_data["weak_concepts"]
            global_mapping["strong_concepts"] = global_data["strong_concepts"]
            global_mapping["concept_scores"] = global_data["concept_scores"]

        client.hset(_state_key(user_id), mapping=global_mapping)

        # 2. Subject Update
        if subject_id:
            get_subject_student(user_id, subject_id)  # ensure lazy hydrate (has its own try/except)
            sub_key = _subject_state_key(user_id, subject_id)
            sub_data = client.hgetall(sub_key)

            s_attempts = int(sub_data.get("attempts", 0)) + 1
            s_correct = int(sub_data.get("correct_count", 0)) + (1 if is_correct else 0)
            s_avg_rt = float(sub_data.get("avg_response_time", 0.0))
            s_new_avg_rt = float(response_time) if s_attempts == 1 else ((s_avg_rt * (s_attempts - 1)) + float(response_time)) / s_attempts

            s_acc = float(sub_data.get("accuracy", 0.5))
            s_emp = s_correct / s_attempts
            s_new_acc = (s_emp + _clamp(s_acc + g_step, 0.0, 1.0)) / 2.0

            weak_concepts = set(_parse_json_list(sub_data.get("weak_concepts", "[]")))
            strong_concepts = set(_parse_json_list(sub_data.get("strong_concepts", "[]")))
            concept_scores = _parse_json_dict(sub_data.get("concept_scores", "{}"))

            if resolved_concept:
                if is_correct:
                    current_count = int(concept_scores.get(resolved_concept, 0)) + 1
                    concept_scores[resolved_concept] = current_count
                    if current_count >= STRONG_CONCEPT_MIN_CORRECT:
                        strong_concepts.add(resolved_concept)
                        weak_concepts.discard(resolved_concept)
                else:
                    weak_concepts.add(resolved_concept)
                    strong_concepts.discard(resolved_concept)

            client.hset(sub_key, mapping={
                "attempts": s_attempts,
                "correct_count": s_correct,
                "accuracy": f"{s_new_acc:.6f}",
                "avg_response_time": f"{s_new_avg_rt:.6f}",
                "weak_concepts": json.dumps(sorted(weak_concepts)),
                "strong_concepts": json.dumps(sorted(strong_concepts)),
                "concept_scores": json.dumps(concept_scores),
                "last_updated": str(time.time()),
            })

    except Exception as exc:
        logger.error(
            "[STUDENT_MODEL] update_student_performance FAIL user_id=%s error=%s — Redis state may not be fully persisted",
            user_id, exc,
        )

    return get_student(user_id)


def update_student_performance_from_learning_event(
    user_id: str,
    concept: str,
    is_correct: bool,
    source: str,
    subject_id: str = None,
) -> None:
    """Update concept-level Redis state from non-quiz learning events (flashcards, exams)."""
    if not user_id:
        raise ValueError("user_id is required")
    if not concept:
        raise ValueError("concept is required")

    from .concept_resolver import ConceptResolver
    resolved_concept = ConceptResolver.resolve(concept)
    if not resolved_concept:
        logger.debug("Skipping student performance update for invalid concept=%s", concept)
        return

    try:
        client = _get_redis_client()

        if subject_id:
            get_subject_student(user_id, subject_id)  # ensure lazy hydrate (has its own try/except)
            sub_key = _subject_state_key(user_id, subject_id)
            data = client.hgetall(sub_key)

            weak_concepts = set(_parse_json_list(data.get("weak_concepts", "[]")))
            strong_concepts = set(_parse_json_list(data.get("strong_concepts", "[]")))
            concept_scores = _parse_json_dict(data.get("concept_scores", "{}"))

            if is_correct:
                current_count = int(concept_scores.get(resolved_concept, 0)) + 1
                concept_scores[resolved_concept] = current_count
                if current_count >= STRONG_CONCEPT_MIN_CORRECT:
                    strong_concepts.add(resolved_concept)
                    weak_concepts.discard(resolved_concept)
            else:
                weak_concepts.add(resolved_concept)
                strong_concepts.discard(resolved_concept)

            client.hset(
                sub_key,
                mapping={
                    "weak_concepts": json.dumps(sorted(weak_concepts)),
                    "strong_concepts": json.dumps(sorted(strong_concepts)),
                    "concept_scores": json.dumps(concept_scores),
                    "last_updated": str(time.time()),
                },
            )
        else:
            # Legacy global fallback if no subject provided
            data = _read_state(user_id, client)
            weak_concepts = set(_parse_json_list(data.get("weak_concepts", "[]")))
            strong_concepts = set(_parse_json_list(data.get("strong_concepts", "[]")))
            concept_scores = _parse_json_dict(data.get("concept_scores", "{}"))

            if is_correct:
                current_count = int(concept_scores.get(resolved_concept, 0)) + 1
                concept_scores[resolved_concept] = current_count
                if current_count >= STRONG_CONCEPT_MIN_CORRECT:
                    strong_concepts.add(resolved_concept)
                    weak_concepts.discard(resolved_concept)
            else:
                weak_concepts.add(resolved_concept)
                strong_concepts.discard(resolved_concept)

            client.hset(
                _state_key(user_id),
                mapping={
                    "weak_concepts": json.dumps(sorted(weak_concepts)),
                    "strong_concepts": json.dumps(sorted(strong_concepts)),
                    "concept_scores": json.dumps(concept_scores),
                    "last_updated": str(time.time()),
                },
            )

    except Exception as exc:
        logger.error(
            "[STUDENT_MODEL] update_student_performance_from_learning_event FAIL user_id=%s concept=%s error=%s — state NOT persisted",
            user_id, concept, exc,
        )

    logger.debug(
        "Learning event student model update user_id=%s concept=%s is_correct=%s source=%s",
        user_id,
        resolved_concept,
        is_correct,
        source,
    )


def set_student_state(
    user_id: str,
    *,
    accuracy: float,
    avg_response_time: float,
    weak_concepts: list[str],
    strong_concepts: list[str],
) -> None:
    """Hydrate Redis with a durable learner snapshot."""
    if not user_id:
        raise ValueError("user_id is required")

    client = _get_redis_client()
    state_key = _state_key(user_id)

    # Preserve existing concept_scores and counters during hydration.
    existing = client.hgetall(state_key)

    client.hset(
        state_key,
        mapping={
            "accuracy": f"{_clamp(float(accuracy), 0.0, 1.0):.6f}",
            "avg_response_time": f"{max(float(avg_response_time), 0.0):.6f}",
            "weak_concepts": json.dumps(sorted(str(c) for c in weak_concepts if c)),
            "strong_concepts": json.dumps(sorted(str(c) for c in strong_concepts if c)),
            "concept_scores": existing.get("concept_scores", "{}"),
            "attempts": existing.get("attempts", "0"),
            "correct_count": existing.get("correct_count", "0"),
            "last_updated": str(time.time()),
        },
    )

    # Clean up any legacy keys that might still exist.
    pipe = client.pipeline()
    pipe.delete(_legacy_base_key(user_id))
    pipe.delete(_legacy_weak_concepts_key(user_id))
    pipe.delete(_legacy_strong_concepts_key(user_id))
    pipe.delete(_legacy_concept_correct_count_key(user_id))
    pipe.execute()


def list_student_ids() -> list[str]:
    """Return user_id values for student profiles stored in Redis."""
    client = _get_redis_client()
    user_ids: set[str] = set()

    # Scan for canonical keys: student:<id>:state
    for key in client.scan_iter(match="student:*:state"):
        if not isinstance(key, str):
            continue
        parts = key.split(":", 2)
        if len(parts) == 3 and parts[2] == "state":
            if parts[1]:
                user_ids.add(parts[1])

    # Also scan for legacy keys that haven't been migrated yet (student:<id>)
    for key in client.scan_iter(match="student:*"):
        if not isinstance(key, str):
            continue
        # Only match student:<id> (exactly one colon — the old base key)
        if key.count(":") == 1:
            _, user_id = key.split(":", 1)
            if user_id:
                user_ids.add(user_id)

    return sorted(user_ids)
