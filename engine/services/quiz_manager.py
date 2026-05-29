"""
Adaptive quiz manager — single source of truth for all adaptive quiz logic.

Responsibilities:
  - Session difficulty tracking (streak-based)
  - Student model persistence delegation
  - Context retrieval coordination
  - LLM question generation delegation

api.py routes are thin controllers that call into this module only.
"""
import logging
import os
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

logger = logging.getLogger("engine-quiz-manager")

_DIFFICULTY_LEVELS = ["beginner", "intermediate", "advanced"]

# Avg response time (seconds) above which the student is considered to be
# struggling with pacing, so difficulty is nudged down by one step.
_HIGH_RESPONSE_TIME_THRESHOLD = float(
    os.getenv("STUDENT_HIGH_RESPONSE_TIME_THRESHOLD", "30.0")
)


def _ensure_list(value) -> list:
    """Return value as a list; collapse None/str to empty list (Redis round-trip safety)."""
    if value is None or isinstance(value, str):
        return []
    if isinstance(value, list):
        return value
    try:
        return list(value)
    except TypeError:
        return []


def resolve_quiz_difficulty(
    mode: str,
    ui_difficulty: str,
    session_state: Dict[str, Any],
    student_profile: Dict[str, Any],
    last_answer_correct: Optional[bool],
) -> str:
    """Single source of truth for quiz difficulty resolution."""
    if ui_difficulty not in _DIFFICULTY_LEVELS:
        ui_difficulty = "intermediate"

    if mode == "fixed":
        return ui_difficulty

    base_idx = _DIFFICULTY_LEVELS.index(ui_difficulty)

    # Initial question
    if last_answer_correct is None:
        accuracy = float(student_profile.get("accuracy", 0.5))
        avg_response_time = float(student_profile.get("avg_response_time", 0.0))
        idx = base_idx
        if accuracy >= 0.8:
            idx = min(2, base_idx + 1)
        elif accuracy <= 0.4 or avg_response_time > _HIGH_RESPONSE_TIME_THRESHOLD:
            idx = max(0, base_idx - 1)
        return _DIFFICULTY_LEVELS[idx]

    history = session_state.get("difficulty_history") or []
    if history:
        prev_diff = history[-1]
        prev_idx = _DIFFICULTY_LEVELS.index(prev_diff) if prev_diff in _DIFFICULTY_LEVELS else base_idx
    else:
        prev_idx = base_idx

    streak_count = int(session_state.get("streak_count", 0))
    accuracy = float(student_profile.get("accuracy", 0.5))
    avg_response_time = float(student_profile.get("avg_response_time", 0.0))

    next_idx = prev_idx

    if last_answer_correct is True:
        if streak_count >= 2:
            next_idx += 1
    else:
        next_idx -= 1

    # Bias from accuracy
    if accuracy >= 0.85 and next_idx < 2 and streak_count >= 1:
        next_idx += 1
    elif accuracy <= 0.35 and next_idx > 0:
        next_idx -= 1

    # Bias from response time: high avg response time signals struggle → nudge down
    if avg_response_time > _HIGH_RESPONSE_TIME_THRESHOLD and next_idx > 0:
        next_idx -= 1

    # Clamp bounds to base ± 1 (anchor constraints)
    max_idx = min(2, base_idx + 1)
    min_idx = max(0, base_idx - 1)
    
    # Smooth transitions (±1 step max)
    if next_idx > prev_idx + 1:
        next_idx = prev_idx + 1
    elif next_idx < prev_idx - 1:
        next_idx = prev_idx - 1

    next_idx = max(min_idx, min(max_idx, next_idx))

    return _DIFFICULTY_LEVELS[next_idx]


def _default_session(ui_difficulty: str = "intermediate") -> Dict[str, Any]:
    return {
        "streak_count": 0,
        "total": 0,
        "difficulty_history": [],
        "ui_difficulty": ui_difficulty,
        "last_concept": None,
    }


def _build_progress(student: Dict[str, Any], session: Dict[str, Any], current_difficulty: str) -> Dict[str, Any]:
    return {
        "accuracy": float(student.get("accuracy", 0.5)),
        "weak_concepts": list(student.get("weak_concepts") or []),
        "strong_concepts": list(student.get("strong_concepts") or []),
        "difficulty": current_difficulty,
    }


def _fetch_chunk_texts(
    db: Session, subject_id: str, topic: Optional[str], top_k: int,
    material_ids: Optional[List] = None,
) -> List[str]:
    from .retrieval import retrieve_chunks_by_topic
    chunks_with_scores = retrieve_chunks_by_topic(
        db, subject_id, topic, int(top_k), material_ids=material_ids or None
    )
    texts = [c.content for c, _ in chunks_with_scores if c.content]
    if not texts:
        raise ValueError("No retrieval context found for this subject/topic.")
    return texts


def _extract_concept_names(concepts: List[Any], db=None) -> List[str]:
    from .concept_resolver import normalize_concept
    names: List[str] = []
    for concept in concepts:
        if isinstance(concept, dict):
            raw = concept.get("name")
        elif isinstance(concept, str):
            raw = concept
        else:
            raw = None
        if raw:
            name = normalize_concept(str(raw), db=db)
            if name:
                names.append(name)
            else:
                logger.warning("[CONCEPT] dropped invalid concept raw=%r", raw)
    return names


def _select_target_concept(
    subject_id: str,
    difficulty: str,
    weak_concepts: List[str],
    strong_concepts: Optional[List[str]] = None,
    last_concept: Optional[str] = None,
    db=None,
) -> str:
    from .knowledge_graph_service import get_or_build_concepts

    concepts = get_or_build_concepts(subject_id, difficulty, db=db)
    concept_names = _extract_concept_names(concepts, db=db)
    logger.info(
        "_select_target_concept subject_id=%s difficulty=%s graph_concepts=%d "
        "weak=%d strong=%d last_concept=%r",
        subject_id, difficulty, len(concept_names),
        len(weak_concepts), len(strong_concepts or []), last_concept,
    )

    if not concept_names:
        raise ValueError(f"No concepts available for subject_id={subject_id}")

    # Priority: weak > neutral > strong.
    # Concepts mastered (strong) are deprioritized — only selected when no
    # weaker or neutral alternative exists.
    weak_set = set(weak_concepts)
    strong_set = set(strong_concepts or [])

    weak_pool    = [n for n in concept_names if n in weak_set]
    neutral_pool = [n for n in concept_names if n not in weak_set and n not in strong_set]
    strong_pool  = [n for n in concept_names if n in strong_set and n not in weak_set]

    # Build prioritized list: weak first, then neutral, then strong.
    prioritized = weak_pool + neutral_pool + strong_pool or concept_names

    # Rotate away from last_concept to avoid back-to-back repeats.
    if last_concept and len(prioritized) > 1:
        rotated = [c for c in prioritized if c != last_concept]
        return rotated[0] if rotated else prioritized[0]

    return prioritized[0]


def _get_domain_concepts(subject_id: str) -> Optional[set]:
    """Return the set of all concept names in the subject's knowledge graph, or None if not cached."""
    from .knowledge_graph_service import get_subject_graph
    graph = get_subject_graph(subject_id)
    if not graph:
        return None
    names: set = set()
    for cat in ("core_concepts", "supporting_concepts", "minor_concepts"):
        for c in graph.get(cat) or []:
            name = c.get("name") if isinstance(c, dict) else None
            if name:
                names.add(name)
    return names if names else None





def next_question_only(
    *,
    user_id: str,
    subject_id: str,
    topic: Optional[str],
    language: str,
    top_k: int,
    db: Session,
    material_ids: Optional[List] = None,
) -> Dict[str, Any]:
    """
    Return the first question of an adaptive session.

    Does NOT update the student model — the student has not answered yet.
    Persists an initial session record so subsequent submit calls have a
    baseline to advance from.
    """
    from .student_model import get_subject_student
    from .generation import generate_validated_quiz_question
    from .redis_client import get_quiz_session, update_quiz_session

    ui_difficulty = "intermediate"  # Can be parameterized via API later
    session = get_quiz_session(user_id, subject_id) or _default_session(ui_difficulty)
    session["difficulty_history"] = _ensure_list(session.get("difficulty_history"))
    student = get_subject_student(user_id, subject_id)

    difficulty = resolve_quiz_difficulty(
        mode="adaptive",
        ui_difficulty=ui_difficulty,
        session_state=session,
        student_profile=student,
        last_answer_correct=None
    )

    session["difficulty_history"] = [difficulty]
    # weak/strong_concepts are loaded from canonical Redis SETs (student model, DB 1).
    # They are never stored in the session hash.
    weak_concepts   = list(student.get("weak_concepts") or [])
    strong_concepts = list(student.get("strong_concepts") or [])

    target_concept = _select_target_concept(
        subject_id, difficulty, weak_concepts,
        strong_concepts=strong_concepts,
        last_concept=session.get("last_concept"),
        db=db,
    )

    distractor_pool = []
    if target_concept:
        from .knowledge_graph_service import get_related_concepts
        distractor_pool = get_related_concepts(subject_id, target_concept)

    chunk_texts = _fetch_chunk_texts(db, subject_id, target_concept, top_k, material_ids=material_ids)

    question = generate_validated_quiz_question(
        chunks=chunk_texts,
        difficulty=difficulty,
        target_concept=target_concept,
        distractor_pool=distractor_pool,
        language=language,
    )

    # Store correct answer and explanation server-side for the next submit call.
    session["last_concept"] = target_concept
    session["last_correct_answer"] = question.get("correct_answer")
    session["last_explanation"] = question.get("explanation") or ""
    update_quiz_session(user_id, subject_id, session)

    logger.info(
        "next_question_only user=%s subject=%s difficulty=%s concept=%s",
        user_id, subject_id, difficulty, target_concept or "<none>",
    )

    return {
        "question": question,
        "progress": _build_progress(student, session, difficulty),
        "session": session,
    }


def submit_answer_and_get_next(
    *,
    user_id: str,
    subject_id: str,
    topic: Optional[str],
    is_correct: bool,
    response_time: float,
    language: str,
    top_k: int,
    db: Session,
    material_ids: Optional[List] = None,
    user_answer: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Record the student's answer, update adaptive state, and return the next question.

    Sequence:
      1. Persist answer metrics to student model (accuracy, response time, topic strength).
      2. Advance session difficulty/streak based on correctness.
      3. Reload student profile so the next question reflects the updated accuracy.
      4. Retrieve context chunks and generate the next question.
    """
    from .learning_event_router import handle_learning_event
    from .student_model import get_subject_student
    from .generation import generate_validated_quiz_question
    from .redis_client import get_quiz_session, update_quiz_session

    # Step 1: Load session to retrieve the concept from the question that was just answered.
    session = get_quiz_session(user_id, subject_id) or _default_session("intermediate")
    session["difficulty_history"] = _ensure_list(session.get("difficulty_history"))
    raw_concept = session.get("last_concept")
    current_concept = str(raw_concept).strip() if raw_concept else None

    if not current_concept:
        raise ValueError(
            f"last_concept missing from session for user_id={user_id} subject_id={subject_id}"
        )

    # Server-side correctness verification: if the client sends user_answer (an option index),
    # compare it against the stored correct_answer rather than trusting is_correct from the client.
    stored_correct = session.get("last_correct_answer")
    if user_answer is not None and stored_correct is not None:
        try:
            is_correct = int(user_answer) == int(stored_correct)
        except (TypeError, ValueError):
            pass  # keep client-supplied is_correct as fallback

    # Persist answer to the student model; concept=None skips concept-level tracking.
    handle_learning_event(
        user_id=user_id,
        concept=current_concept,
        is_correct=is_correct,
        source="quiz",
        response_time=float(response_time),
        subject_id=subject_id,
    )
    # Reload updated student profile (accuracy now reflects this answer).
    student = get_subject_student(user_id, subject_id)

    # Step 2: Update session state
    session["total"] = int(session.get("total", 0)) + 1
    if is_correct:
        session["streak_count"] = int(session.get("streak_count", 0)) + 1
    else:
        session["streak_count"] = 0

    # weak/strong_concepts are loaded from canonical Redis SETs (student model, DB 1).
    # They are never stored in the session hash.
    weak_concepts   = list(student.get("weak_concepts") or [])
    strong_concepts = list(student.get("strong_concepts") or [])
    ui_diff = session.get("ui_difficulty", "intermediate")

    # Step 3: Call resolver
    difficulty = resolve_quiz_difficulty(
        mode="adaptive",
        ui_difficulty=ui_diff,
        session_state=session,
        student_profile=student,
        last_answer_correct=is_correct
    )

    history = session.get("difficulty_history", [])
    history.append(difficulty)
    session["difficulty_history"] = history

    # Step 4: Generate the next question.
    target_concept = _select_target_concept(
        subject_id, difficulty, weak_concepts,
        strong_concepts=strong_concepts,
        last_concept=current_concept,
        db=db,
    )

    distractor_pool = []
    if target_concept:
        from .knowledge_graph_service import get_related_concepts
        distractor_pool = get_related_concepts(subject_id, target_concept)

    chunk_texts = _fetch_chunk_texts(db, subject_id, target_concept, top_k, material_ids=material_ids)

    question = generate_validated_quiz_question(
        chunks=chunk_texts,
        difficulty=difficulty,
        target_concept=target_concept,
        distractor_pool=distractor_pool,
        language=language,
    )

    # Capture answered question's feedback from session before overwriting with next question.
    answered_correct_answer = session.get("last_correct_answer")
    answered_explanation = session.get("last_explanation") or ""

    # Store next question's correct answer and explanation for the following submit call.
    session["last_concept"] = target_concept
    session["last_correct_answer"] = question.get("correct_answer")
    session["last_explanation"] = question.get("explanation") or ""
    update_quiz_session(user_id, subject_id, session)

    logger.info(
        "submit_answer_and_get_next user=%s subject=%s correct=%s difficulty=%s concept=%s accuracy=%.3f",
        user_id, subject_id, is_correct, difficulty,
        target_concept or "<none>", float(student.get("accuracy", 0.5)),
    )

    return {
        "question": question,
        "is_correct": is_correct,
        "correct_answer": answered_correct_answer,
        "explanation": answered_explanation if answered_explanation else None,
        "progress": _build_progress(student, session, difficulty),
        "session": session,
    }


def init_exam_session(
    *,
    user_id: str,
    subject_id: str,
    exam_id: str,
    ui_difficulty: str = "intermediate",
    db: Session,
) -> Dict[str, Any]:
    """Initialize adaptive exam session. Returns initial adaptive state."""
    from .student_model import get_subject_student
    from .redis_client import get_exam_session, update_exam_session

    session = get_exam_session(user_id, subject_id, exam_id) or _default_session(ui_difficulty)
    session["difficulty_history"] = _ensure_list(session.get("difficulty_history"))
    try:
        student = get_subject_student(user_id, subject_id)
    except Exception as exc:
        logger.error("[EXAM_INIT] get_subject_student FAIL user=%s subject=%s error=%s — using default profile", user_id, subject_id, exc)
        student = {"accuracy": 0.5, "avg_response_time": 0.0, "weak_concepts": [], "strong_concepts": []}

    difficulty = resolve_quiz_difficulty(
        mode="adaptive",
        ui_difficulty=ui_difficulty,
        session_state=session,
        student_profile=student,
        last_answer_correct=None
    )

    session["difficulty_history"] = [difficulty]
    weak_concepts = list(student.get("weak_concepts") or [])
    strong_concepts = list(student.get("strong_concepts") or [])

    target_concept = _select_target_concept(
        subject_id, difficulty, weak_concepts,
        strong_concepts=strong_concepts,
        last_concept=session.get("last_concept"),
        db=db,
    )

    session["last_concept"] = target_concept
    update_exam_session(user_id, subject_id, exam_id, session)

    return {
        "difficulty": difficulty,
        "target_concept": target_concept,
        "progress": _build_progress(student, session, difficulty),
    }


def get_exam_adaptive_state(
    *,
    user_id: str,
    subject_id: str,
    exam_id: str,
    batch_results: List[Dict[str, Any]],
    db: Session,
) -> Dict[str, Any]:
    """Process batch results, update student model, return next adaptive state."""
    from .learning_event_router import handle_learning_event
    from .student_model import get_subject_student
    from .redis_client import get_exam_session, update_exam_session

    session = get_exam_session(user_id, subject_id, exam_id) or _default_session("intermediate")
    session["difficulty_history"] = _ensure_list(session.get("difficulty_history"))

    for res in batch_results:
        concept = res.get("concept")
        is_correct = res.get("is_correct")
        response_time = res.get("response_time", 0.0)

        handle_learning_event(
            user_id=user_id,
            concept=concept,
            is_correct=is_correct,
            source="exam",
            response_time=float(response_time),
            subject_id=subject_id,
            db=db,
        )

        session["total"] = int(session.get("total", 0)) + 1
        if is_correct:
            session["streak_count"] = int(session.get("streak_count", 0)) + 1
        else:
            session["streak_count"] = 0

    try:
        student = get_subject_student(user_id, subject_id)
    except Exception as exc:
        logger.error("[EXAM_ADAPTIVE_UPDATE] get_subject_student FAIL user=%s subject=%s error=%s — using default profile", user_id, subject_id, exc)
        student = {"accuracy": 0.5, "avg_response_time": 0.0, "weak_concepts": [], "strong_concepts": []}
    weak_concepts = list(student.get("weak_concepts") or [])
    strong_concepts = list(student.get("strong_concepts") or [])
    ui_diff = session.get("ui_difficulty", "intermediate")

    last_is_correct = batch_results[-1].get("is_correct") if batch_results else None
    difficulty = resolve_quiz_difficulty(
        mode="adaptive",
        ui_difficulty=ui_diff,
        session_state=session,
        student_profile=student,
        last_answer_correct=last_is_correct,
    )

    logger.info(
        "[ADAPTIVE_DECISION] user_id=%s exam_id=%s accuracy=%.4f avg_rt=%.2f "
        "streak=%d last_correct=%s ui_diff=%s -> difficulty=%s "
        "weak=%d strong=%d",
        user_id, exam_id,
        float(student.get("accuracy", 0.5)),
        float(student.get("avg_response_time", 0.0)),
        int(session.get("streak_count", 0)),
        last_is_correct,
        ui_diff, difficulty,
        len(weak_concepts), len(strong_concepts),
    )

    history = session.get("difficulty_history", [])
    history.append(difficulty)
    session["difficulty_history"] = history

    target_concept = _select_target_concept(
        subject_id, difficulty, weak_concepts,
        strong_concepts=strong_concepts,
        last_concept=session.get("last_concept"),
        db=db,
    )

    session["last_concept"] = target_concept
    update_exam_session(user_id, subject_id, exam_id, session)

    return {
        "difficulty": difficulty,
        "target_concept": target_concept,
        "progress": _build_progress(student, session, difficulty),
    }

