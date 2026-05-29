import json
import logging
import os
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from .learner_state_sync import LearnerStateSyncService

logger = logging.getLogger("engine-adaptive-profile")

_ADAPTIVE_PROFILE_TTL_SECONDS = int(os.getenv("ADAPTIVE_PROFILE_CACHE_TTL", "300"))


def _adaptive_profile_key(user_id: str, subject_id: str) -> str:
    return f"adaptive_profile:{user_id}:{subject_id}"


def _get_redis():
    from .redis_client import _get_client
    return _get_client()


def _get_cached_profile(user_id: str, subject_id: str) -> Optional[Dict[str, Any]]:
    key = _adaptive_profile_key(user_id, subject_id)
    try:
        raw = _get_redis().get(key)
        if raw:
            logger.debug("[REDIS_PROFILE_READ] HIT key=%s", key)
            return json.loads(raw)
        logger.debug("[REDIS_PROFILE_READ] MISS key=%s", key)
    except Exception as exc:
        # Surface the failure instead of silently swallowing it — a cache read
        # error must not be invisible. Caller falls back to recomputing the profile.
        logger.warning("[REDIS_PROFILE_READ] FAIL key=%s error=%s — will recompute", key, exc)
    return None


def _set_cached_profile(user_id: str, subject_id: str, profile: Dict[str, Any]) -> None:
    key = _adaptive_profile_key(user_id, subject_id)
    try:
        _get_redis().setex(
            key,
            _ADAPTIVE_PROFILE_TTL_SECONDS,
            json.dumps(profile, default=str),
        )
        logger.debug("[REDIS_PROFILE_WRITE] OK key=%s ttl=%ds", key, _ADAPTIVE_PROFILE_TTL_SECONDS)
    except Exception as exc:
        logger.warning("[REDIS_PROFILE_WRITE] FAIL key=%s error=%s — profile NOT cached", key, exc)


def invalidate_adaptive_profile_cache(user_id: str, subject_id: str) -> None:
    """Call after a learning event so the next profile read reflects updated state."""
    key = _adaptive_profile_key(user_id, subject_id)
    try:
        _get_redis().delete(key)
        logger.debug("[REDIS_PROFILE_DELETE] OK key=%s", key)
    except Exception as exc:
        logger.warning("[REDIS_PROFILE_DELETE] FAIL key=%s error=%s", key, exc)

# ─── Tuning constants ─────────────────────────────────────────────────────────

_DIFFICULTY_BEGINNER      = 0.45
_DIFFICULTY_INTERMEDIATE  = 0.75

_RISK_WEAK_DENSITY_HIGH    = 0.50
_RISK_WEAK_DENSITY_MEDIUM  = 0.25
_RISK_INCORRECT_RATE_HIGH  = 0.60
_RISK_INCORRECT_RATE_MEDIUM = 0.40

_RECENT_WINDOW_DAYS = 7


# ─── Internal helpers ─────────────────────────────────────────────────────────

def _recommended_difficulty(accuracy: float) -> str:
    if accuracy < _DIFFICULTY_BEGINNER:
        return "beginner"
    if accuracy < _DIFFICULTY_INTERMEDIATE:
        return "intermediate"
    return "advanced"


def _retention_risk(
    weak_concepts: List[str],
    strong_concepts: List[str],
    recent_incorrect_rate: float,
) -> str:
    total = len(weak_concepts) + len(strong_concepts)
    # +1 keeps density in (0, 1) even when total == 0.
    weak_density = len(weak_concepts) / (total + 1)

    if (
        weak_density > _RISK_WEAK_DENSITY_HIGH
        or recent_incorrect_rate > _RISK_INCORRECT_RATE_HIGH
    ):
        return "high"
    if (
        weak_density > _RISK_WEAK_DENSITY_MEDIUM
        or recent_incorrect_rate > _RISK_INCORRECT_RATE_MEDIUM
    ):
        return "medium"
    return "low"


# ─── Public API ───────────────────────────────────────────────────────────────

def get_adaptive_profile(user_id: str, subject_id: str, db: Session) -> Dict[str, Any]:
    """Build unified adaptive learner profile for (user_id, subject_id).

    Sources:
    - Redis student model  — real-time concept strength/weakness + accuracy
    - user_concept_mastery — per-topic mastery snapshots (PostgreSQL)
    - quiz_attempts        — attempt counts + recent accuracy
    - flashcard_reviews    — recent retention signal
    - exam_concept_scores  — recent exam performance per topic
    """
    logger.info(
        "[ADAPTIVE_PROFILE] building profile user_id=%s subject_id=%s",
        user_id, subject_id,
    )

    cached = _get_cached_profile(user_id, subject_id)
    if cached is not None:
        logger.info("[ADAPTIVE_PROFILE] cache hit user_id=%s subject_id=%s", user_id, subject_id)
        return cached

    # ── 1. Redis: real-time concept tracking (with DB fallback) ───────────────
    redis_state     = LearnerStateSyncService.get_canonical_state(user_id, db)
    weak_concepts   = redis_state["weak_concepts"]    # already sorted list[str]
    strong_concepts = redis_state["strong_concepts"]
    redis_accuracy  = redis_state["accuracy"]         # float 0–1

    # ── 2. PostgreSQL: per-topic mastery snapshot → mastery_map ──────────────
    mastery_rows = db.execute(
        text("""
            SELECT topic_name,
                   mastery_score,
                   response_count
            FROM   user_concept_mastery
            WHERE  user_id    = :user_id
              AND  subject_id = :subject_id
        """),
        {"user_id": user_id, "subject_id": subject_id},
    ).fetchall()

    mastery_map: Dict[str, float] = {}
    pg_scores: List[float] = []
    for row in mastery_rows:
        if row.mastery_score is not None:
            # mastery_score is stored 0–100; normalize to 0–1 for consistency.
            normalized = float(row.mastery_score) / 100.0
            mastery_map[row.topic_name] = round(normalized, 4)
            pg_scores.append(normalized)

    # Blend Redis real-time accuracy with PostgreSQL mastery average so that
    # the profile reflects both immediate quiz state and longitudinal mastery.
    pg_accuracy = sum(pg_scores) / len(pg_scores) if pg_scores else None
    if pg_accuracy is not None:
        blended_accuracy = round((redis_accuracy + pg_accuracy) / 2.0, 4)
    else:
        blended_accuracy = round(redis_accuracy, 4)

    # ── 3. PostgreSQL: recent incorrect rate (retention_risk signal) ──────────
    cutoff = datetime.now(timezone.utc) - timedelta(days=_RECENT_WINDOW_DAYS)

    recent_row = db.execute(
        text("""
            WITH quiz_recent AS (
                SELECT COALESCE(SUM(score),     0) AS correct,
                       COALESCE(SUM(max_score), 0) AS total
                FROM   quiz_attempts
                WHERE  user_id      = :user_id
                  AND  subject_id   = :subject_id
                  AND  completed_at >= :cutoff
            ),
            flash_recent AS (
                SELECT COUNT(*) FILTER (WHERE fr.outcome IN ('easy', 'good')) AS correct,
                       COUNT(*)                                                AS total
                FROM   flashcard_reviews fr
                JOIN   materials m ON fr.material_id = m.id
                WHERE  fr.user_id     = :user_id
                  AND  m.subject_id   = :subject_id
                  AND  fr.reviewed_at >= :cutoff
            ),
            exam_recent AS (
                SELECT COALESCE(SUM(ecs.score),     0) AS correct,
                       COALESCE(SUM(ecs.max_score), 0) AS total
                FROM   exam_concept_scores ecs
                JOIN   mock_exam_attempts mea ON ecs.attempt_id = mea.id
                WHERE  mea.user_id      = :user_id
                  AND  mea.subject_id   = :subject_id
                  AND  mea.completed_at >= :cutoff
            )
            SELECT
                (SELECT correct FROM quiz_recent)  +
                (SELECT correct FROM flash_recent) +
                (SELECT correct FROM exam_recent)  AS total_correct,

                (SELECT total   FROM quiz_recent)  +
                (SELECT total   FROM flash_recent) +
                (SELECT total   FROM exam_recent)  AS total_interactions
        """),
        {"user_id": user_id, "subject_id": subject_id, "cutoff": cutoff},
    ).fetchone()

    total_interactions = int(recent_row.total_interactions or 0)
    total_correct      = int(recent_row.total_correct      or 0)
    recent_incorrect_rate = (
        (total_interactions - total_correct) / total_interactions
        if total_interactions > 0
        else 0.0
    )

    # ── 4. PostgreSQL: total_attempts across all sources ──────────────────────
    counts_row = db.execute(
        text("""
            SELECT
                (SELECT COUNT(*) FROM quiz_attempts
                 WHERE  user_id = :user_id AND subject_id = :subject_id)

              + (SELECT COUNT(*) FROM mock_exam_attempts
                 WHERE  user_id = :user_id AND subject_id = :subject_id)

              + (SELECT COUNT(*) FROM flashcard_reviews fr
                 JOIN   materials m ON fr.material_id = m.id
                 WHERE  fr.user_id = :user_id AND m.subject_id = :subject_id)

              AS total_attempts
        """),
        {"user_id": user_id, "subject_id": subject_id},
    ).fetchone()

    total_attempts = int(counts_row.total_attempts or 0)

    # ── 5. Derived signals ────────────────────────────────────────────────────
    recommended_difficulty = _recommended_difficulty(blended_accuracy)
    retention_risk         = _retention_risk(weak_concepts, strong_concepts, recent_incorrect_rate)

    profile: Dict[str, Any] = {
        "accuracy":               blended_accuracy,
        "weak_concepts":          weak_concepts,
        "strong_concepts":        strong_concepts,
        "mastery_map":            mastery_map,
        "recommended_difficulty": recommended_difficulty,
        "retention_risk":         retention_risk,
        "total_attempts":         total_attempts,
    }

    _set_cached_profile(user_id, subject_id, profile)

    logger.info(
        "[ADAPTIVE_PROFILE] done user_id=%s subject_id=%s "
        "accuracy=%.4f difficulty=%s risk=%s total_attempts=%d",
        user_id, subject_id,
        blended_accuracy, recommended_difficulty, retention_risk, total_attempts,
    )

    return profile
