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
        
    # Optional DB mapping
    if db is not None:
        from sqlalchemy import text
        from sqlalchemy.exc import ProgrammingError
        try:
            # 1. Exact or ILIKE match
            query = text("SELECT name FROM concepts WHERE name ILIKE :concept LIMIT 1")
            result = db.execute(query, {"concept": cleaned}).scalar()
            if result:
                return str(result)
                
            # 2. Fuzzy match
            # Simplest approach without pg_trgm is a partial ILIKE
            query_fuzzy = text("SELECT name FROM concepts WHERE name ILIKE :fuzzy LIMIT 1")
            result_fuzzy = db.execute(query_fuzzy, {"fuzzy": f"%{cleaned}%"}).scalar()
            if result_fuzzy:
                return str(result_fuzzy)
                
            # If we reach here, the table exists but the concept wasn't found at all
            logger.debug(f'[CONCEPT_NORMALIZER] rejected="{raw_concept}" reason="not_in_db"')
            return None
                
        except ProgrammingError:
            # Table 'concepts' does not exist
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
