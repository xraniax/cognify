/**
 * Quiz event schema — unified event format for StaticQuizView and AdaptiveQuizView.
 *
 * Usage:
 *   1. Call createQuizSession() at component mount; store the result in a ref.
 *   2. Call the appropriate make*Event() factory at each lifecycle transition.
 *   3. Events are plain, frozen objects — store or forward them as needed.
 *
 * This module does NOT emit, queue, or transmit events. It only defines structure.
 */

// ---------------------------------------------------------------------------
// Session ID
// ---------------------------------------------------------------------------

function generateSessionId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    // Fallback for environments without crypto.randomUUID (Safari < 15.4, jsdom)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
}

// ---------------------------------------------------------------------------
// Event type constants
// ---------------------------------------------------------------------------

export const QUIZ_EVENTS = Object.freeze({
    QUESTION_VIEWED:   'QUESTION_VIEWED',
    OPTION_SELECTED:   'OPTION_SELECTED',
    ANSWER_SUBMITTED:  'ANSWER_SUBMITTED',
    QUESTION_ADVANCED: 'QUESTION_ADVANCED',
    QUIZ_COMPLETED:    'QUIZ_COMPLETED',
    QUIZ_RESET:        'QUIZ_RESET',
});

// ---------------------------------------------------------------------------
// Session context
// ---------------------------------------------------------------------------

/**
 * Create a stable session context to pass into every make*Event() call.
 * Store the returned object in a useRef — it must not change across re-renders.
 *
 * `createdAt` doubles as the quiz start timestamp for Adaptive mode
 * (which has no startedAtRef). For Static mode, pass startedAtRef.current
 * explicitly to makeQuizCompletedEvent instead.
 *
 * Pass `sessionId` and `createdAt` when restoring a session from localStorage
 * so all events continue under the original identity (not a new UUID).
 *
 * @param {'static'|'adaptive'} mode
 * @param {{
 *   subjectId?:  string|null,
 *   materialId?: string|null,
 *   quizId?:     string|null,
 *   sessionId?:  string|null,   — restore an existing session ID; null → generate a new one
 *   createdAt?:  string|null,   — restore the original ISO start timestamp; null → now
 * }} ids
 * @returns {Readonly<{ sessionId: string, createdAt: string, mode: string, subjectId: string|null, materialId: string|null, quizId: string|null }>}
 */
export function createQuizSession(mode, { subjectId = null, materialId = null, quizId = null, sessionId = null, createdAt = null } = {}) {
    return Object.freeze({
        sessionId:  sessionId  ?? generateSessionId(),
        createdAt:  createdAt  ?? new Date().toISOString(),
        mode,
        subjectId:  subjectId  ?? null,
        materialId: materialId ?? null,
        quizId:     quizId     ?? null,
    });
}

// ---------------------------------------------------------------------------
// Internal base stamp (not exported — callers use the make*Event factories)
// ---------------------------------------------------------------------------

function makeBase(session, eventType) {
    return {
        eventType,
        timestamp:  new Date().toISOString(),
        sessionId:  session.sessionId,
        mode:       session.mode,
        subjectId:  session.subjectId,
        materialId: session.materialId,
        quizId:     session.quizId,
    };
}

// ---------------------------------------------------------------------------
// Event factories
// ---------------------------------------------------------------------------

/**
 * QUESTION_VIEWED — fired when a new question becomes visible to the user.
 *
 * Call sites:
 *   Static  — on mount (first question) and after advanceQuestion() resets state.
 *   Adaptive — after fetchQuestion() resolves and setQuestion() is called.
 *
 * @param {ReturnType<typeof createQuizSession>} session
 * @param {{
 *   questionIndex:  number,        — 0-based; currentQuestionIndex (static) or questionCount (adaptive)
 *   questionId:     string|null,   — question.id from mapQuestion output
 *   correctAnswer:  string,        — question.correct_answer (stored locally, not shown pre-submit)
 *   totalQuestions: number|null,   — questions.length (static) or MAX_ADAPTIVE_QUESTIONS (adaptive)
 * }} fields
 */
export function makeQuestionViewedEvent(session, { questionIndex, questionId, correctAnswer, totalQuestions }) {
    return Object.freeze({
        ...makeBase(session, QUIZ_EVENTS.QUESTION_VIEWED),
        questionIndex:  Number(questionIndex),
        questionId:     questionId ?? null,
        correctAnswer:  String(correctAnswer),
        totalQuestions: totalQuestions != null ? Number(totalQuestions) : null,
    });
}

/**
 * OPTION_SELECTED — fired each time the user changes their selected option
 * before submitting. May fire multiple times per question.
 *
 * Call sites:
 *   Both modes — inside selectOption(), after the guard checks pass.
 *
 * @param {ReturnType<typeof createQuizSession>} session
 * @param {{
 *   questionIndex:  number,
 *   questionId:     string|null,
 *   selectedOption: string,
 * }} fields
 */
export function makeOptionSelectedEvent(session, { questionIndex, questionId, selectedOption }) {
    return Object.freeze({
        ...makeBase(session, QUIZ_EVENTS.OPTION_SELECTED),
        questionIndex:  Number(questionIndex),
        questionId:     questionId ?? null,
        selectedOption: String(selectedOption),
    });
}

/**
 * ANSWER_SUBMITTED — fired when the user locks in their answer (submitAnswer()).
 * Carries the complete answer outcome including post-answer score and streak.
 *
 * Call sites:
 *   Static  — after applyScoring() and responsesRef.push(), before setIsSubmitted(true).
 *   Adaptive — after setIsSubmitted(true) and applyScoring() (ordering preserved per mode).
 *
 * responseTimeMs:
 *   Adaptive — (Date.now() - startTimeRef.current); caller computes, module coerces.
 *   Static   — no per-question timer; pass 0.
 *
 * score/streak — pass the values AFTER applyScoring() has run (i.e. updated state
 * may not have flushed yet; pass the computed next values explicitly if needed).
 *
 * @param {ReturnType<typeof createQuizSession>} session
 * @param {{
 *   questionIndex:  number,
 *   questionId:     string|null,
 *   selectedOption: string,
 *   correctAnswer:  string,
 *   isCorrect:      boolean,
 *   responseTimeMs: number,
 *   score:          number,
 *   streak:         number,
 * }} fields
 */
export function makeAnswerSubmittedEvent(session, {
    questionIndex, questionId, selectedOption, correctAnswer,
    isCorrect, responseTimeMs, score, streak,
}) {
    return Object.freeze({
        ...makeBase(session, QUIZ_EVENTS.ANSWER_SUBMITTED),
        questionIndex:  Number(questionIndex),
        questionId:     questionId ?? null,
        selectedOption: String(selectedOption),
        correctAnswer:  String(correctAnswer),
        isCorrect:      Boolean(isCorrect),
        responseTimeMs: Number(responseTimeMs) || 0,
        score:          Number(score),
        streak:         Number(streak),
    });
}

/**
 * QUESTION_ADVANCED — fired when the user clicks Next/advances past a submitted question.
 * Fire this before the async fetch (Adaptive) or index update (Static) occurs.
 *
 * toIndex is null when the user is advancing into the results screen (final question).
 *
 * Call sites:
 *   Static  — at the top of advanceQuestion(), after the nextLockRef guard.
 *   Adaptive — at the top of advanceQuestion(), after the nextLockRef guard.
 *
 * @param {ReturnType<typeof createQuizSession>} session
 * @param {{
 *   fromIndex:  number,        — index of the question being left
 *   toIndex:    number|null,   — index of the next question; null → results screen
 *   questionId: string|null,   — ID of the question being left
 * }} fields
 */
export function makeQuestionAdvancedEvent(session, { fromIndex, toIndex, questionId }) {
    return Object.freeze({
        ...makeBase(session, QUIZ_EVENTS.QUESTION_ADVANCED),
        fromIndex:  Number(fromIndex),
        toIndex:    toIndex != null ? Number(toIndex) : null,
        questionId: questionId ?? null,
    });
}

/**
 * QUIZ_COMPLETED — fired when the results screen is shown (end of quiz).
 *
 * startedAt:
 *   Static   — startedAtRef.current (ISO string, persisted across refreshes).
 *   Adaptive — session.createdAt (the closest proxy; Adaptive has no startedAtRef).
 *
 * Call sites:
 *   Static  — inside advanceQuestion()'s final-question branch, alongside the analytics call.
 *   Adaptive — inside advanceQuestion()'s finally block, before setShowResults(true).
 *
 * @param {ReturnType<typeof createQuizSession>} session
 * @param {{
 *   totalQuestions: number,
 *   finalScore:     number,
 *   finalStreak:    number,
 *   startedAt:      string,   — ISO
 *   completedAt:    string,   — ISO; pass new Date().toISOString() at completion time
 * }} fields
 */
export function makeQuizCompletedEvent(session, { totalQuestions, finalScore, finalStreak, startedAt, completedAt }) {
    return Object.freeze({
        ...makeBase(session, QUIZ_EVENTS.QUIZ_COMPLETED),
        totalQuestions: Number(totalQuestions),
        finalScore:     Number(finalScore),
        finalStreak:    Number(finalStreak),
        startedAt:      String(startedAt),
        completedAt:    String(completedAt),
    });
}

/**
 * QUIZ_RESET — fired when the user resets the quiz from any state.
 *
 * Call sites:
 *   Both modes — at the top of resetQuiz(), before any state mutation.
 *
 * @param {ReturnType<typeof createQuizSession>} session
 * @param {{
 *   atQuestionIndex: number,   — currentQuestionIndex (static) or questionCount (adaptive) at reset time
 *   atScore:         number,   — score at time of reset
 * }} fields
 */
export function makeQuizResetEvent(session, { atQuestionIndex, atScore }) {
    return Object.freeze({
        ...makeBase(session, QUIZ_EVENTS.QUIZ_RESET),
        atQuestionIndex: Number(atQuestionIndex),
        atScore:         Number(atScore),
    });
}
