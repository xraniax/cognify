"""Canonical input normalization helpers for engine endpoints."""

from typing import Optional
from uuid import UUID


MATERIAL_TYPE_ALIASES = {
    "note": "summary",
    "notes": "summary",
    "flashcard": "flashcards",
}

SUPPORTED_MATERIAL_TYPES = frozenset({"summary", "quiz", "flashcards", "exam"})


def normalize_material_type(value: Optional[str]) -> str:
    """Normalize material type with alias mapping and case/whitespace cleanup."""
    requested_type = str(value or "").strip().lower()
    return MATERIAL_TYPE_ALIASES.get(requested_type, requested_type)


def parse_optional_uuid(value: Optional[str], field_name: str) -> Optional[str]:
    """Parse a UUID-like field, preserving previous API validation behavior."""
    normalized = normalize_text(value)
    if normalized is None:
        return None
    try:
        return str(UUID(normalized))
    except (TypeError, ValueError) as e:
        raise ValueError(f"Invalid {field_name}: must be a UUID") from e


def normalize_text(value: Optional[str]) -> Optional[str]:
    """Trim and coerce text; return None for empty input."""
    if value is None:
        return None
    stripped = str(value).strip()
    return stripped if stripped else None


def coalesce_text(content: Optional[str], text: Optional[str]) -> Optional[str]:
    """Select the first available text source and normalize it."""
    candidate = content if content is not None else text
    return normalize_text(candidate)
