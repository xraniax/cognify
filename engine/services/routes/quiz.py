"""Quiz routes: evaluation, adaptive next-question, and answer submission."""
# This module is part of the Engine Execution Layer.
# All handlers are thin wrappers: they validate the request schema and delegate to quiz_manager.
import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .._route_utils import _stage_error_response, get_db
from ..generation import evaluate_quiz
from ..schemas import (
    QuizEvaluateRequest, QuizEvaluateResponse, QuizNextRequest, QuizSubmitAnswerRequest,
    ExamInitRequest, ExamBatchResultRequest
)

router = APIRouter()
logger = logging.getLogger("engine-api")


@router.post("/evaluate-quiz", response_model=QuizEvaluateResponse)
async def evaluate_quiz_route(body: QuizEvaluateRequest):
    """Evaluate user answers for a quiz."""
    logger.info("Evaluate quiz request: %d submissions", len(body.submissions))
    try:
        result = evaluate_quiz(
            [q.model_dump() for q in body.questions],
            [s.model_dump() for s in body.submissions],
        )
        return result
    except Exception as e:
        logger.exception("Quiz evaluation failed")
        return _stage_error_response("evaluation", "Quiz evaluation failed", details=str(e), status_code=500)


@router.post("/quiz/next")
async def quiz_next_route(body: QuizNextRequest, db: Session = Depends(get_db)):
    """Return the first adaptive question for a session."""
    from ..quiz_manager import next_question_only
    try:
        return next_question_only(user_id=body.user_id.strip(), subject_id=body.subject_id,
                                  topic=body.topic, language=body.language, top_k=body.top_k, db=db)
    except ValueError as exc:
        return _stage_error_response("quiz_next", str(exc), status_code=404)
    except Exception as exc:
        logger.exception("quiz/next failed")
        return _stage_error_response("quiz_next", "Failed to fetch question", details=str(exc), status_code=500)


@router.post("/quiz/submit-answer")
async def quiz_submit_answer_route(body: QuizSubmitAnswerRequest, db: Session = Depends(get_db)):
    """Record answer, update student model, return next adaptive question."""
    from ..quiz_manager import submit_answer_and_get_next
    try:
        return submit_answer_and_get_next(
            user_id=body.user_id.strip(), subject_id=body.subject_id, topic=body.topic,
            is_correct=body.is_correct, response_time=body.response_time,
            language=body.language, top_k=body.top_k, db=db,
            user_answer=body.user_answer,
        )
    except ValueError as exc:
        return _stage_error_response("quiz_submit", str(exc), status_code=404)
    except Exception as exc:
        logger.exception("quiz/submit-answer failed")
        return _stage_error_response("quiz_submit", "Failed to process answer", details=str(exc), status_code=500)


@router.post("/exam/init-session")
async def exam_init_session_route(body: ExamInitRequest, db: Session = Depends(get_db)):
    """Initialize an adaptive exam session."""
    from ..quiz_manager import init_exam_session
    try:
        return init_exam_session(
            user_id=body.user_id.strip(),
            subject_id=body.subject_id,
            exam_id=body.exam_id,
            ui_difficulty=body.ui_difficulty,
            db=db
        )
    except Exception as exc:
        logger.exception("exam/init-session failed")
        return _stage_error_response("exam_init", "Failed to initialize exam session", details=str(exc), status_code=500)


@router.post("/exam/adaptive-state")
async def exam_adaptive_state_route(body: ExamBatchResultRequest, db: Session = Depends(get_db)):
    """Update student model with batch results and get the next adaptive target."""
    from ..quiz_manager import get_exam_adaptive_state
    try:
        results = [r.model_dump() for r in body.batch_results]
        return get_exam_adaptive_state(
            user_id=body.user_id.strip(),
            subject_id=body.subject_id,
            exam_id=body.exam_id,
            batch_results=results,
            db=db
        )
    except Exception as exc:
        logger.exception("exam/adaptive-state failed")
        return _stage_error_response("exam_adaptive_state", "Failed to update adaptive state", details=str(exc), status_code=500)

