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
    """
    (Deprecated) Dual-write synchronization is disabled in Option A architecture.
    PostgreSQL is the single source of truth via Node.js analytics ingestion.
    Redis acts strictly as an ephemeral cache for the fast adaptive runtime.
    """

    @classmethod
    def schedule_sync(cls, user_id: str, reason: str = "learning_event") -> None:
        """No-op: Redis no longer writes back to PostgreSQL."""
        pass

    @classmethod
    def sync_from_redis(cls, user_id: str, reason: str = "learning_event") -> None:
        """No-op: Redis no longer writes back to PostgreSQL."""
        pass

    @classmethod
    def hydrate_redis_from_db(cls, user_id: str, db: Session) -> bool:
        """
        No-op for global hydration.
        Subject-specific hydration is handled lazily in student_model.py.
        """
        return False

    @classmethod
    def get_canonical_state(cls, user_id: str, db: Session) -> Dict[str, Any]:
        """Return the current Redis state. Fallback handles empty states safely."""
        state, exists = get_student_state_with_meta(user_id)
        return state

    @classmethod
    def start_periodic_snapshot_refresh(
        cls,
        interval_seconds: int = 300,
    ) -> None:
        """No-op: Periodic Redis-to-PG sync is disabled."""
        pass

    @classmethod
    def stop_periodic_snapshot_refresh(cls) -> None:
        pass

