import logging
from typing import Any, Dict, Literal, Optional

from .student_model import (
    update_student_performance,
    update_student_performance_from_learning_event,
)
from .learner_state_sync import LearnerStateSyncService

logger = logging.getLogger("engine-learning-event")


def handle_learning_event(
    user_id: str,
    concept: str,
    is_correct: bool,
    source: Literal["quiz", "quiz_static", "flashcards", "exam"],
    db=None,
    response_time: Optional[float] = None,
    subject_id: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Route all learning events through a single entry point."""
    from .concept_resolver import ConceptResolver
    
    resolved_concept = ConceptResolver.resolve(concept, db=db)
    
    logger.info(
        "[LEARNING_EVENT] source=%s user_id=%s concept=%s resolved_concept=%s is_correct=%s",
        source,
        user_id,
        concept,
        resolved_concept,
        is_correct,
    )

    if source == "quiz":
        if response_time is None:
            raise ValueError("response_time is required for quiz learning events")
        result = update_student_performance(
            user_id=user_id,
            is_correct=is_correct,
            response_time=float(response_time),
            concept=resolved_concept,
            subject_id=subject_id,
        )
    else:
        if resolved_concept:
            update_student_performance_from_learning_event(
                user_id=user_id,
                concept=resolved_concept,
                is_correct=is_correct,
                source=source,
                subject_id=subject_id,
            )
        else:
            logger.debug("[LEARNING_EVENT] skipping student model update for invalid concept: %s", concept)
        result = None

    # Async durability sync; never blocks learning flow.
    LearnerStateSyncService.schedule_sync(user_id, reason=source)

    logger.info(
        "[LEARNING_EVENT] updated Redis for user=%s source=%s",
        user_id,
        source,
    )
    return result
