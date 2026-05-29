import re
import logging
from typing import Optional

logger = logging.getLogger("engine-concept-resolver")

# A set of known garbage strings or stop words that should not be valid standalone concepts
_GARBAGE_BLACKLIST = {"nthe", "none", "null", "undefined", "n/a", "unknown", "test", "xxx"}

def _has_vowels(s: str) -> bool:
    return bool(re.search(r'[aeiouy]', s))

def normalize_concept(raw_concept: str, db=None) -> Optional[str]:
    """
    Normalizes a concept string according to specific rules.
    Returns None if the concept is considered invalid.
    """
    if not raw_concept or not isinstance(raw_concept, str):
        return None
        
    cleaned = raw_concept.strip().lower()
    # Collapse internal whitespace (tabs, newlines, runs of spaces) to a single
    # space so "photo  synthesis" and "photo synthesis" map to the same canonical
    # form.  _clean_term_name already does this for knowledge-graph storage; this
    # step makes normalize_concept consistent with that invariant so set-
    # intersection comparisons (weak_pool, last_concept rotation) never silently
    # miss due to differing internal spacing.
    cleaned = re.sub(r'\s+', ' ', cleaned)

    if len(cleaned) < 2:
        logger.debug(f'[CONCEPT_NORMALIZER] rejected="{raw_concept}" reason="invalid_token"')
        return None
        
    # Check for repeated words (e.g., "figure figure figure")
    words = cleaned.split()
    if len(words) > 1 and len(set(words)) == 1:
        logger.debug(f'[CONCEPT_NORMALIZER] rejected="{raw_concept}" reason="repeated_words"')
        return None
        
    if cleaned in _GARBAGE_BLACKLIST:
        logger.debug(f'[CONCEPT_NORMALIZER] rejected="{raw_concept}" reason="blacklisted_garbage"')
        return None
        
    # Purely alphabetic tokens with length >= 3 and no vowels are likely garbage (e.g. random consonants)
    if cleaned.isalpha() and len(cleaned) >= 3 and not _has_vowels(cleaned):
        logger.debug(f'[CONCEPT_NORMALIZER] rejected="{raw_concept}" reason="no_vowels"')
        return None
        
    # Optional DB mapping: resolve the cleaned name against the subject concept taxonomy
    # for synonym/alias canonicalization.
    if db is not None:
        from sqlalchemy import text
        from sqlalchemy.exc import ProgrammingError
        try:
            # Case-insensitive exact match.  The concepts table may store names with
            # arbitrary casing, so always lowercase the result to preserve the
            # invariant that normalize_concept always returns a lowercase string.
            query = text("SELECT name FROM concepts WHERE name ILIKE :concept LIMIT 1")
            result = db.execute(query, {"concept": cleaned}).scalar()
            if result:
                return str(result).strip().lower()

            # No match — fall through to the cleaned name.
            # A fuzzy substring match (ILIKE '%term%') is intentionally not used here:
            #   • it is non-deterministic without an ORDER BY (same input can produce
            #     different rows across queries)
            #   • "acid" matching "nucleic acid" maps an independent concept to an
            #     unrelated one, breaking the canonical-form guarantee
            # If richer synonym mapping is needed, use a dedicated synonym table with
            # an exact-match lookup instead.
            logger.debug(f'[CONCEPT_NORMALIZER] not_in_db fallback="{cleaned}"')
            return cleaned

        except ProgrammingError:
            # Table 'concepts' does not exist — fall through silently.
            db.rollback()
        except Exception as e:
            logger.warning(f"[CONCEPT_NORMALIZER] DB error mapping concept: {e}")
            db.rollback()

    return cleaned

class ConceptResolver:
    """Service to validate and resolve concepts before they enter the adaptive system."""
    
    @staticmethod
    def resolve(concept: Optional[str], topic: Optional[str] = None, db=None) -> Optional[str]:
        """
        Attempts to resolve the primary concept.
        If invalid, falls back to the topic.
        Returns None if both are invalid.
        """
        if concept:
            normalized = normalize_concept(concept, db=db)
            if normalized:
                return normalized
                
        if topic:
            normalized_topic = normalize_concept(topic, db=db)
            if normalized_topic:
                return normalized_topic
                
        return None
