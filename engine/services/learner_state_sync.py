import json
import logging
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from .student_model import (
    get_student,
    get_student_state_with_meta,
    list_student_ids,
    set_student_state,
)

try:
    from database import SessionLocal
except ImportError:
    from ..database import SessionLocal

logger = logging.getLogger("engine-learner-state-sync")

_DEFAULT_SYNC_INTERVAL_SECONDS = int(os.getenv("LEARNER_SYNC_INTERVAL_SECONDS", "300"))
_DEFAULT_SYNC_WORKERS = int(os.getenv("LEARNER_SYNC_WORKERS", "2"))


class LearnerStateSyncService:
    """Persist Redis learner state to PostgreSQL without blocking runtime paths."""

    _executor = ThreadPoolExecutor(max_workers=_DEFAULT_SYNC_WORKERS)
    _snapshot_lock = threading.Lock()
    _snapshot_thread_started = False
    _snapshot_stop_event = threading.Event()

    @classmethod
    def schedule_sync(cls, user_id: str, reason: str = "learning_event") -> None:
        """Fire-and-forget sync from Redis to DB."""
        if not user_id:
            return
        try:
            cls._executor.submit(cls.sync_from_redis, user_id, reason)
        except Exception as exc:
            logger.warning("[LEARNER_SYNC] schedule failed user_id=%s reason=%s error=%s", user_id, reason, exc)

    @classmethod
    def sync_from_redis(cls, user_id: str, reason: str = "learning_event") -> None:
        """Persist current Redis learner state into PostgreSQL."""
        if not user_id:
            return

        state = get_student(user_id)
        weak_concepts = state.get("weak_concepts") or []
        strong_concepts = state.get("strong_concepts") or []
        accuracy = float(state.get("accuracy", 0.5))
        avg_response_time = float(state.get("avg_response_time", 0.0))

        db: Optional[Session] = None
        try:
            db = SessionLocal()

            # Aggregate durability-only signals from the mastery snapshot.
            agg_row = db.execute(
                text(
                    """
                    SELECT
                        AVG(mastery_score)       AS mastery_avg,
                        AVG(flashcard_retention) AS retention_avg
                    FROM user_concept_mastery
                    WHERE user_id = :user_id
                    """
                ),
                {"user_id": user_id},
            ).fetchone()

            mastery_score = None
            retention_score = None
            if agg_row is not None:
                if agg_row.mastery_avg is not None:
                    mastery_score = float(agg_row.mastery_avg) / 100.0
                if agg_row.retention_avg is not None:
                    retention_score = float(agg_row.retention_avg) / 100.0

            db.execute(
                text(
                    """
                    INSERT INTO learner_state (
                        user_id,
                        accuracy,
                        avg_response_time,
                        weak_concepts,
                        strong_concepts,
                        mastery_score,
                        retention_score,
                        last_sync_at,
                        version,
                        created_at,
                        updated_at
                    )
                    VALUES (
                        :user_id,
                        :accuracy,
                        :avg_response_time,
                        :weak_concepts,
                        :strong_concepts,
                        :mastery_score,
                        :retention_score,
                        NOW(),
                        1,
                        NOW(),
                        NOW()
                    )
                    ON CONFLICT (user_id) DO UPDATE SET
                        accuracy          = EXCLUDED.accuracy,
                        avg_response_time = EXCLUDED.avg_response_time,
                        weak_concepts     = EXCLUDED.weak_concepts,
                        strong_concepts   = EXCLUDED.strong_concepts,
                        mastery_score     = EXCLUDED.mastery_score,
                        retention_score   = EXCLUDED.retention_score,
                        last_sync_at      = NOW(),
                        updated_at        = NOW(),
                        version           = learner_state.version + 1
                    """
                ),
                {
                    "user_id": user_id,
                    "accuracy": accuracy,
                    "avg_response_time": avg_response_time,
                    "weak_concepts": json.dumps(weak_concepts),
                    "strong_concepts": json.dumps(strong_concepts),
                    "mastery_score": mastery_score,
                    "retention_score": retention_score,
                },
            )
            db.commit()
            logger.debug(
                "[LEARNER_SYNC] synced user_id=%s reason=%s weak=%d strong=%d",
                user_id,
                reason,
                len(weak_concepts),
                len(strong_concepts),
            )
        except Exception as exc:
            if db is not None:
                db.rollback()
            logger.warning("[LEARNER_SYNC] failed user_id=%s reason=%s error=%s", user_id, reason, exc)
        finally:
            if db is not None:
                db.close()

    @classmethod
    def hydrate_redis_from_db(cls, user_id: str, db: Session) -> bool:
        """Hydrate Redis from durable learner_state when Redis state is missing."""
        row = db.execute(
            text(
                """
                SELECT accuracy, avg_response_time, weak_concepts, strong_concepts
                FROM learner_state
                WHERE user_id = :user_id
                """
            ),
            {"user_id": user_id},
        ).fetchone()
        if not row:
            return False

        weak = row.weak_concepts or []
        strong = row.strong_concepts or []
        set_student_state(
            user_id,
            accuracy=float(row.accuracy or 0.5),
            avg_response_time=float(row.avg_response_time or 0.0),
            weak_concepts=list(weak),
            strong_concepts=list(strong),
        )
        logger.info("[LEARNER_SYNC] hydrated Redis from DB user_id=%s", user_id)
        return True

    @classmethod
    def get_canonical_state(cls, user_id: str, db: Session) -> Dict[str, Any]:
        """Return learner state, preferring Redis and falling back to DB hydration."""
        state, exists = get_student_state_with_meta(user_id)
        if exists:
            return state

        if cls.hydrate_redis_from_db(user_id, db):
            state, _ = get_student_state_with_meta(user_id)
            return state

        return state

    @classmethod
    def start_periodic_snapshot_refresh(
        cls,
        interval_seconds: int = _DEFAULT_SYNC_INTERVAL_SECONDS,
    ) -> None:
        """Background thread: periodically sync Redis learner state to DB."""
        with cls._snapshot_lock:
            if cls._snapshot_thread_started:
                return
            cls._snapshot_thread_started = True

        def _loop() -> None:
            logger.info("[LEARNER_SYNC] periodic refresh started interval=%ds", interval_seconds)
            while not cls._snapshot_stop_event.is_set():
                try:
                    user_ids = list_student_ids()
                    for user_id in user_ids:
                        cls.sync_from_redis(user_id, reason="periodic_snapshot")
                except Exception as exc:
                    logger.warning("[LEARNER_SYNC] periodic refresh failed: %s", exc)
                cls._snapshot_stop_event.wait(interval_seconds)

        t = threading.Thread(target=_loop, name="learner-sync", daemon=True)
        t.start()

    @classmethod
    def stop_periodic_snapshot_refresh(cls) -> None:
        cls._snapshot_stop_event.set()
