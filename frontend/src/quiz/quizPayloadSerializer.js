/**
 * Quiz analytics payload serializer.
 *
 * Pure, deterministic functions — no I/O, no side effects, no ML logic.
 * Takes a raw event array from getSessionEvents() / eventQueueRef.current
 * and returns a structured, backend-ready payload.
 *
 * Target signals preserved by this contract:
 *
 *   Adaptive difficulty     — per-question isCorrect, streak context, responseTimeMs
 *   Learner performance     — score/streak trajectory, accuracy, session duration
 *   Hesitation analysis     — toFirstSelectionMs, deliberationMs, toSubmissionMs, optionChanges
 *   Mastery estimation      — isCorrect × responseTimeMs joint signal per question
 *   Recommendation systems  — questionId × correctness × advancedToIndex navigation graph
 *
 * Schema version is bumped on breaking payload shape changes.
 * Additive-only changes (new optional fields) do not require a version bump.
 */

export const SCHEMA_VERSION = '1.0.0';

// Local event type mirror — avoids importing quizEvents.js (prevents circular dependency risk).
const EV = Object.freeze({
    QUESTION_VIEWED:   'QUESTION_VIEWED',
    OPTION_SELECTED:   'OPTION_SELECTED',
    ANSWER_SUBMITTED:  'ANSWER_SUBMITTED',
    QUESTION_ADVANCED: 'QUESTION_ADVANCED',
    QUIZ_COMPLETED:    'QUIZ_COMPLETED',
    QUIZ_RESET:        'QUIZ_RESET',
});

// ---------------------------------------------------------------------------
// Internal timestamp utilities
// ---------------------------------------------------------------------------

function tsMs(iso) {
    const n = Date.parse(iso);
    return Number.isFinite(n) ? n : null;
}

// Returns null when either argument is missing/unparseable — safe for optional fields.
function msDelta(laterIso, earlierIso) {
    const a = tsMs(laterIso);
    const b = tsMs(earlierIso);
    return (a !== null && b !== null) ? a - b : null;
}

// ---------------------------------------------------------------------------
// groupEventsByQuestion
// ---------------------------------------------------------------------------

/**
 * Partition a chronological event array into per-question buckets.
 *
 * Routing rules:
 *   QUESTION_ADVANCED → keyed by fromIndex (the question the user is leaving)
 *   QUIZ_COMPLETED, QUIZ_RESET → session-level; returned separately
 *   All others → keyed by questionIndex
 *   Events lacking an index → fall into sessionEvents
 *
 * @param {object[]} events — must be sorted chronologically before calling
 * @returns {{ byQuestion: Map<number, object[]>, sessionEvents: object[] }}
 */
export function groupEventsByQuestion(events) {
    const byQuestion    = new Map();
    const sessionEvents = [];

    for (const ev of events) {
        let idx;
        switch (ev.eventType) {
            case EV.QUIZ_COMPLETED:
            case EV.QUIZ_RESET:
                sessionEvents.push(ev);
                continue;
            case EV.QUESTION_ADVANCED:
                idx = ev.fromIndex;
                break;
            default:
                idx = ev.questionIndex;
        }
        if (idx == null) { sessionEvents.push(ev); continue; }
        if (!byQuestion.has(idx)) byQuestion.set(idx, []);
        byQuestion.get(idx).push(ev);
    }

    return { byQuestion, sessionEvents };
}

// ---------------------------------------------------------------------------
// deriveQuestionSignals
// ---------------------------------------------------------------------------

/**
 * Compute per-question derived signals from one question's event bucket.
 *
 * status values:
 *   'answered'                — ANSWER_SUBMITTED present
 *   'advanced_without_answer' — QUESTION_ADVANCED present but no ANSWER_SUBMITTED
 *   'viewed_only'             — only QUESTION_VIEWED (and possibly OPTION_SELECTED) seen
 *
 * Hesitation breakdown (all values in ms; null when prerequisite event is absent):
 *
 *   toFirstSelectionMs  Time from QUESTION_VIEWED to first OPTION_SELECTED.
 *                       Measures initial cognitive load and topic familiarity.
 *                       High values → topic is unfamiliar or question is ambiguous.
 *
 *   deliberationMs      Time from first OPTION_SELECTED to ANSWER_SUBMITTED.
 *                       Captures the full decision window regardless of option changes.
 *                       High values + correct → careful reasoning.
 *                       High values + incorrect → confusion or guessing under pressure.
 *
 *   toSubmissionMs      Time from LAST OPTION_SELECTED to ANSWER_SUBMITTED.
 *                       Confirmation latency after settling on the final pick.
 *                       Low values after option changes → impulsive switch.
 *                       High values → second-guessing the final choice.
 *
 *   optionChanges       (OPTION_SELECTED count − 1). 0 = locked in on first pick.
 *                       Combined with isCorrect: changed + correct → self-correction signal.
 *
 * Note on responseTimeMs:
 *   Adaptive mode: component-measured (Date.now() - startTimeRef.current) — ground truth.
 *   Static mode:   always 0 — use hesitation.deliberationMs for timing analysis instead.
 *
 * @param {object[]} events — event bucket for ONE question, in chronological order
 * @returns {object} — plain object, not frozen (caller freezes after mapping)
 */
export function deriveQuestionSignals(events) {
    const viewed     = events.find(e => e.eventType === EV.QUESTION_VIEWED);
    const selections = events.filter(e => e.eventType === EV.OPTION_SELECTED);
    const submitted  = events.find(e => e.eventType === EV.ANSWER_SUBMITTED);
    const advanced   = events.find(e => e.eventType === EV.QUESTION_ADVANCED);

    const firstSel      = selections[0]     ?? null;
    const lastSel       = selections.at(-1) ?? null;
    const optionChanges = Math.max(0, selections.length - 1);

    const status = submitted
        ? 'answered'
        : advanced
        ? 'advanced_without_answer'
        : 'viewed_only';

    return {
        questionIndex:   viewed?.questionIndex  ?? advanced?.fromIndex  ?? null,
        questionId:      viewed?.questionId     ?? submitted?.questionId ?? null,
        totalQuestions:  viewed?.totalQuestions ?? null,
        correctAnswer:   viewed?.correctAnswer  ?? submitted?.correctAnswer ?? null,
        status,

        // Answer outcome — all null until submitted
        selectedOption:  submitted?.selectedOption ?? lastSel?.selectedOption ?? null,
        isCorrect:       submitted?.isCorrect      ?? null,
        responseTimeMs:  submitted?.responseTimeMs ?? null,
        scoreAfter:      submitted?.score          ?? null,
        streakAfter:     submitted?.streak         ?? null,

        // Navigation — null if this was the last question (toIndex = null in QUESTION_ADVANCED)
        advancedToIndex: advanced?.toIndex ?? null,

        hesitation: {
            toFirstSelectionMs: msDelta(firstSel?.timestamp,  viewed?.timestamp),
            deliberationMs:     msDelta(submitted?.timestamp, firstSel?.timestamp),
            toSubmissionMs:     msDelta(submitted?.timestamp, lastSel?.timestamp),
            optionChanges,
        },

        // Raw sub-sequence for this question — preserved for reprocessing / future signals.
        events,
    };
}

// ---------------------------------------------------------------------------
// serializeSession
// ---------------------------------------------------------------------------

/**
 * Serialize a raw event queue into a backend-ready analytics payload.
 *
 * The payload is:
 *   • Frozen and JSON-serializable (no functions, no circular refs)
 *   • Ordered: questions[] ascending by questionIndex; events[] chronological
 *   • Deterministic: same rawEvents + same opts → identical output
 *   • Complete: raw events are preserved verbatim in both events[] (full log)
 *     and questions[i].events (per-question sub-sequence) for full fidelity
 *
 * @param {object[]} rawEvents
 *   Array from getSessionEvents(sessionId) or [...eventQueueRef.current]
 *
 * @param {{
 *   schemaVersion?: string,   — override schema version (default: SCHEMA_VERSION)
 *   generatedAt?:   string,   — override ISO generation timestamp (default: now)
 * }} opts
 *
 * @returns {Readonly<{
 *   schemaVersion: string,
 *   generatedAt:   string,
 *   session:       Readonly<object> | null,
 *   summary:       Readonly<object> | null,
 *   questions:     ReadonlyArray<Readonly<object>>,
 *   events:        ReadonlyArray<object>,
 * }>}
 */
export function serializeSession(
    rawEvents,
    { schemaVersion = SCHEMA_VERSION, generatedAt = new Date().toISOString() } = {},
) {
    // Defensive chronological sort. Events are normally appended in order, but guard
    // against any out-of-order entries (e.g. clock skew, future multi-source merges).
    const events = [...rawEvents].sort(
        (a, b) => (tsMs(a.timestamp) ?? 0) - (tsMs(b.timestamp) ?? 0),
    );

    if (events.length === 0) {
        return Object.freeze({
            schemaVersion,
            generatedAt,
            session:   null,
            summary:   null,
            questions: Object.freeze([]),
            events:    Object.freeze([]),
        });
    }

    // ── Session metadata ──────────────────────────────────────────────────────

    const first       = events[0];
    const completedEv = events.find(e => e.eventType === EV.QUIZ_COMPLETED);
    const resetEv     = events.find(e => e.eventType === EV.QUIZ_RESET);

    // startedAt: QUIZ_COMPLETED.startedAt is the authoritative value (startedAtRef for
    // static, session.createdAt for adaptive). Fall back to first event's timestamp.
    const startedAt   = completedEv?.startedAt  ?? first.timestamp;
    const completedAt = completedEv?.completedAt ?? null;

    const session = Object.freeze({
        sessionId:  first.sessionId,
        mode:       first.mode,          // 'static' | 'adaptive'
        subjectId:  first.subjectId  ?? null,
        materialId: first.materialId ?? null,
        quizId:     first.quizId     ?? null,
        startedAt,
        completedAt,
        // 'completed' → reached results screen
        // 'reset'     → user hit reset before completing
        // 'abandoned' → neither — tab closed mid-quiz
        status: completedEv ? 'completed' : resetEv ? 'reset' : 'abandoned',
    });

    // ── Per-question signals ──────────────────────────────────────────────────

    const { byQuestion } = groupEventsByQuestion(events);
    const sortedIndices  = [...byQuestion.keys()].sort((a, b) => a - b);
    const questions      = Object.freeze(
        sortedIndices.map(idx => Object.freeze(deriveQuestionSignals(byQuestion.get(idx)))),
    );

    // ── Summary ───────────────────────────────────────────────────────────────

    const answered     = questions.filter(q => q.status === 'answered');
    const correct      = answered.filter(q => q.isCorrect === true);
    const lastAnswered = answered.at(-1) ?? null;

    // totalQuestionsInQuiz: the declared length of the quiz (≥ totalQuestionsPresented
    // when a session was abandoned early). Prefers QUIZ_COMPLETED since it's authoritative.
    const totalQuestionsInQuiz =
        completedEv?.totalQuestions ??
        questions.find(q => q.totalQuestions != null)?.totalQuestions ??
        null;

    const summary = Object.freeze({
        totalQuestionsInQuiz,
        totalQuestionsPresented: questions.length,   // distinct QUESTION_VIEWED events
        totalQuestionsAnswered:  answered.length,    // distinct ANSWER_SUBMITTED events
        correctAnswers:          correct.length,
        incorrectAnswers:        answered.length - correct.length,
        // null when no questions answered — avoids misleading 0/0 = NaN artefact
        accuracy: answered.length > 0
            ? +(correct.length / answered.length).toFixed(4)
            : null,
        finalScore:   completedEv?.finalScore  ?? lastAnswered?.scoreAfter  ?? 0,
        finalStreak:  completedEv?.finalStreak ?? lastAnswered?.streakAfter ?? 0,
        sessionDurationMs: msDelta(completedAt, startedAt),
        startedAt,
        completedAt,
    });

    return Object.freeze({
        schemaVersion,
        generatedAt,
        session,
        summary,
        questions,
        events: Object.freeze(events),  // full chronological log — raw fidelity
    });
}
