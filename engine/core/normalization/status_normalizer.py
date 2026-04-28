"""Canonical status normalization for engine-side workflows."""

from typing import Any


_STATUS_ALIASES = {
    "": "",
    "PENDING": "PENDING",
    "PENDING_JOB": "PENDING_JOB",
    "RECEIVED": "RECEIVED",
    "STARTED": "STARTED",
    "PROCESSING": "PROCESSING",
    "SUCCESS": "SUCCESS",
    "COMPLETED": "COMPLETED",
    "FAILURE": "FAILURE",
    "FAILED": "FAILED",
    "REVOKED": "REVOKED",
    "UNKNOWN": "UNKNOWN",
    "HEALTHY": "HEALTHY",
    "DEGRADED": "DEGRADED",
    "OK": "OK",
}

_TERMINAL_STATUSES = frozenset({"SUCCESS", "FAILURE", "REVOKED", "COMPLETED", "FAILED"})


def normalize_status(value: Any) -> str:
    """Normalize status values to canonical uppercase aliases."""
    normalized = str(value or "").strip().upper()
    return _STATUS_ALIASES.get(normalized, normalized)


def is_terminal_status(value: Any) -> bool:
    """Return True if value is a terminal lifecycle status."""
    return normalize_status(value) in _TERMINAL_STATUSES
