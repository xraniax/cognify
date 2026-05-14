/**
 * quizPayloadExample.js — concrete serialized payload reference.
 *
 * Scenario: static mode, 3-question quiz on Operating Systems.
 *   Q0 — CPU acronym    → wrong answer, no option changes, short hesitation
 *   Q1 — Round Robin    → correct answer, fast response, no changes
 *   Q2 — Race condition → correct answer, changed mind once, longer deliberation
 *
 * The fixture events match the exact shape produced by the make*Event() factories
 * in quizEvents.js. serializeSession() is called with a fixed generatedAt so the
 * output is fully deterministic (suitable for snapshot tests).
 *
 * Usage (dev only):
 *   import { FIXTURE_EVENTS, EXAMPLE_PAYLOAD } from '@/quiz/quizPayloadExample';
 *   console.log(JSON.stringify(EXAMPLE_PAYLOAD, null, 2));
 *
 * Expected serialized output is annotated at the bottom of this file.
 */

import { serializeSession } from './quizPayloadSerializer';

// ---------------------------------------------------------------------------
// Fixture constants
// ---------------------------------------------------------------------------

const SESSION_ID  = 'a1b2c3d4-e5f6-4a89-abcd-ef0123456789';
const SUBJECT_ID  = 'subj-os-fundamentals';
const MATERIAL_ID = 'mat-processes-scheduling';
const QUIZ_ID     = 'quiz-2026-05-07-001';
const T0          = '2026-05-07T10:00:00.000Z';  // session start

// Build an ISO timestamp at T0 + offsetMs
function t(offsetMs) {
    return new Date(Date.parse(T0) + offsetMs).toISOString();
}

// Shared session header present in every emitted event
const HDR = {
    sessionId:  SESSION_ID,
    mode:       'static',
    subjectId:  SUBJECT_ID,
    materialId: MATERIAL_ID,
    quizId:     QUIZ_ID,
};

// ---------------------------------------------------------------------------
// Fixture events — exact shape from make*Event() factories
// ---------------------------------------------------------------------------
//
// Timeline (offsets in ms from T0):
//
//   0       QUESTION_VIEWED     q#0
//   2 000   OPTION_SELECTED     q#0  "Computer Processing Unit"  ← wrong pick
//   2 500   ANSWER_SUBMITTED    q#0  wrong, no change, 500 ms deliberation
//   2 600   QUESTION_ADVANCED   0 → 1
//   3 000   QUESTION_VIEWED     q#1
//   3 700   OPTION_SELECTED     q#1  "Round Robin"  ← fast correct pick
//   4 100   ANSWER_SUBMITTED    q#1  correct, 400 ms deliberation
//   4 200   QUESTION_ADVANCED   1 → 2
//   5 000   QUESTION_VIEWED     q#2
//   7 500   OPTION_SELECTED     q#2  "A deadlock between two processes"  ← first pick (wrong)
//   9 000   OPTION_SELECTED     q#2  "Non-deterministic outcome..."       ← changed mind
//  10 200   ANSWER_SUBMITTED    q#2  correct, 2 700 ms deliberation, 1 option change
//  10 300   QUESTION_ADVANCED   2 → null (results)
//  10 400   QUIZ_COMPLETED

export const FIXTURE_EVENTS = Object.freeze([
    // ── Question 0 — "What does CPU stand for?" ──────────────────────────────
    Object.freeze({
        ...HDR, eventType: 'QUESTION_VIEWED', timestamp: t(0),
        questionIndex: 0, questionId: 'q-cpu-acronym',
        correctAnswer: 'Central Processing Unit', totalQuestions: 3,
    }),
    Object.freeze({
        ...HDR, eventType: 'OPTION_SELECTED', timestamp: t(2_000),
        questionIndex: 0, questionId: 'q-cpu-acronym',
        selectedOption: 'Computer Processing Unit',
    }),
    Object.freeze({
        ...HDR, eventType: 'ANSWER_SUBMITTED', timestamp: t(2_500),
        questionIndex: 0, questionId: 'q-cpu-acronym',
        selectedOption: 'Computer Processing Unit',
        correctAnswer: 'Central Processing Unit',
        isCorrect: false, responseTimeMs: 0, score: 0, streak: 0,
    }),
    Object.freeze({
        ...HDR, eventType: 'QUESTION_ADVANCED', timestamp: t(2_600),
        fromIndex: 0, toIndex: 1, questionId: 'q-cpu-acronym',
    }),

    // ── Question 1 — "Which scheduling algorithm gives equal time slices?" ───
    Object.freeze({
        ...HDR, eventType: 'QUESTION_VIEWED', timestamp: t(3_000),
        questionIndex: 1, questionId: 'q-scheduling-rr',
        correctAnswer: 'Round Robin', totalQuestions: 3,
    }),
    Object.freeze({
        ...HDR, eventType: 'OPTION_SELECTED', timestamp: t(3_700),
        questionIndex: 1, questionId: 'q-scheduling-rr',
        selectedOption: 'Round Robin',
    }),
    Object.freeze({
        ...HDR, eventType: 'ANSWER_SUBMITTED', timestamp: t(4_100),
        questionIndex: 1, questionId: 'q-scheduling-rr',
        selectedOption: 'Round Robin', correctAnswer: 'Round Robin',
        isCorrect: true, responseTimeMs: 0, score: 1, streak: 1,
    }),
    Object.freeze({
        ...HDR, eventType: 'QUESTION_ADVANCED', timestamp: t(4_200),
        fromIndex: 1, toIndex: 2, questionId: 'q-scheduling-rr',
    }),

    // ── Question 2 — "What is a race condition?" ─────────────────────────────
    Object.freeze({
        ...HDR, eventType: 'QUESTION_VIEWED', timestamp: t(5_000),
        questionIndex: 2, questionId: 'q-race-condition',
        correctAnswer: 'Non-deterministic outcome from concurrent shared-data access',
        totalQuestions: 3,
    }),
    Object.freeze({
        // First pick — wrong. User reconsiders.
        ...HDR, eventType: 'OPTION_SELECTED', timestamp: t(7_500),
        questionIndex: 2, questionId: 'q-race-condition',
        selectedOption: 'A deadlock between two processes',
    }),
    Object.freeze({
        // Second pick — correct. Changed mind 1 500 ms after first pick.
        ...HDR, eventType: 'OPTION_SELECTED', timestamp: t(9_000),
        questionIndex: 2, questionId: 'q-race-condition',
        selectedOption: 'Non-deterministic outcome from concurrent shared-data access',
    }),
    Object.freeze({
        ...HDR, eventType: 'ANSWER_SUBMITTED', timestamp: t(10_200),
        questionIndex: 2, questionId: 'q-race-condition',
        selectedOption: 'Non-deterministic outcome from concurrent shared-data access',
        correctAnswer:  'Non-deterministic outcome from concurrent shared-data access',
        isCorrect: true, responseTimeMs: 0, score: 2, streak: 2,
    }),
    Object.freeze({
        ...HDR, eventType: 'QUESTION_ADVANCED', timestamp: t(10_300),
        fromIndex: 2, toIndex: null, questionId: 'q-race-condition',  // null → results screen
    }),

    // ── Session completion ────────────────────────────────────────────────────
    Object.freeze({
        ...HDR, eventType: 'QUIZ_COMPLETED', timestamp: t(10_400),
        totalQuestions: 3, finalScore: 2, finalStreak: 2,
        startedAt:   t(0),       // startedAtRef.current for static mode
        completedAt: t(10_400),
    }),
]);

// ---------------------------------------------------------------------------
// Serialized payload
// Pass a fixed generatedAt so the output is fully deterministic.
// ---------------------------------------------------------------------------

export const EXAMPLE_PAYLOAD = serializeSession(FIXTURE_EVENTS, {
    generatedAt: '2026-05-07T10:00:10.400Z',
});

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * EXPECTED OUTPUT  (JSON.stringify(EXAMPLE_PAYLOAD, null, 2))
 * questions[i].events and events[] omitted here for readability;
 * they carry the raw event objects verbatim.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * {
 *   "schemaVersion": "1.0.0",
 *   "generatedAt":   "2026-05-07T10:00:10.400Z",
 *
 *   "session": {
 *     "sessionId":   "a1b2c3d4-e5f6-4a89-abcd-ef0123456789",
 *     "mode":        "static",
 *     "subjectId":   "subj-os-fundamentals",
 *     "materialId":  "mat-processes-scheduling",
 *     "quizId":      "quiz-2026-05-07-001",
 *     "startedAt":   "2026-05-07T10:00:00.000Z",
 *     "completedAt": "2026-05-07T10:00:10.400Z",
 *     "status":      "completed"
 *   },
 *
 *   "summary": {
 *     "totalQuestionsInQuiz":    3,
 *     "totalQuestionsPresented": 3,
 *     "totalQuestionsAnswered":  3,
 *     "correctAnswers":          2,
 *     "incorrectAnswers":        1,
 *     "accuracy":                0.6667,
 *     "finalScore":              2,
 *     "finalStreak":             2,
 *     "sessionDurationMs":       10400,
 *     "startedAt":   "2026-05-07T10:00:00.000Z",
 *     "completedAt": "2026-05-07T10:00:10.400Z"
 *   },
 *
 *   "questions": [
 *     {
 *       "questionIndex":   0,
 *       "questionId":      "q-cpu-acronym",
 *       "totalQuestions":  3,
 *       "correctAnswer":   "Central Processing Unit",
 *       "status":          "answered",
 *       "selectedOption":  "Computer Processing Unit",
 *       "isCorrect":       false,
 *       "responseTimeMs":  0,
 *       "scoreAfter":      0,
 *       "streakAfter":     0,
 *       "advancedToIndex": 1,
 *       "hesitation": {
 *         "toFirstSelectionMs": 2000,   ← 2s before first touch — medium familiarity
 *         "deliberationMs":      500,   ← decided quickly once touched
 *         "toSubmissionMs":      500,   ← same (no option changes)
 *         "optionChanges":         0    ← locked in on first pick (wrong)
 *       },
 *       "events": [ ...4 raw events for q#0... ]
 *     },
 *     {
 *       "questionIndex":   1,
 *       "questionId":      "q-scheduling-rr",
 *       "totalQuestions":  3,
 *       "correctAnswer":   "Round Robin",
 *       "status":          "answered",
 *       "selectedOption":  "Round Robin",
 *       "isCorrect":       true,
 *       "responseTimeMs":  0,
 *       "scoreAfter":      1,
 *       "streakAfter":     1,
 *       "advancedToIndex": 2,
 *       "hesitation": {
 *         "toFirstSelectionMs":  700,   ← fast first touch — high familiarity signal
 *         "deliberationMs":      400,   ← quick confirmation
 *         "toSubmissionMs":      400,   ← same (no option changes)
 *         "optionChanges":         0    ← confident single pick (correct)
 *       },
 *       "events": [ ...4 raw events for q#1... ]
 *     },
 *     {
 *       "questionIndex":   2,
 *       "questionId":      "q-race-condition",
 *       "totalQuestions":  3,
 *       "correctAnswer":   "Non-deterministic outcome from concurrent shared-data access",
 *       "status":          "answered",
 *       "selectedOption":  "Non-deterministic outcome from concurrent shared-data access",
 *       "isCorrect":       true,
 *       "responseTimeMs":  0,
 *       "scoreAfter":      2,
 *       "streakAfter":     2,
 *       "advancedToIndex": null,        ← null = this was the final question
 *       "hesitation": {
 *         "toFirstSelectionMs": 2500,   ← 2.5s before first touch — low initial confidence
 *         "deliberationMs":     2700,   ← long decision window (first touch → submit)
 *         "toSubmissionMs":     1200,   ← 1.2s after final pick → second-guessing the switch
 *         "optionChanges":         1    ← changed mind once; combined with isCorrect=true
 *                                          this is a self-correction signal
 *       },
 *       "events": [ ...5 raw events for q#2... ]
 *     }
 *   ],
 *
 *   "events": [ ...all 14 raw events, chronological... ]
 * }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SIGNAL INTERPRETATION NOTES FOR ADAPTIVE ENGINE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Q0  isCorrect=false + optionChanges=0 + deliberationMs=500
 *      → Confident wrong answer. Not a hesitation problem — likely a knowledge gap.
 *        Candidate for targeted review of this concept.
 *
 *  Q1  isCorrect=true + toFirstSelectionMs=700 + deliberationMs=400
 *      → Fast confident correct answer. Strong mastery signal for Round Robin.
 *        Difficulty may be too low for this learner on this concept.
 *
 *  Q2  isCorrect=true + optionChanges=1 + deliberationMs=2700 + toSubmissionMs=1200
 *      → Self-correction under uncertainty. Learner initially reached for the wrong
 *        answer but caught themselves. Partial mastery — knows the right answer
 *        exists but needed deliberation to surface it. Good reinforcement candidate.
 *
 *  accuracy=0.6667, finalStreak=2, sessionDurationMs=10400
 *      → Mid-range session performance. Streak recovered after Q0 miss.
 *        The learner finished strong — adaptive difficulty could stay flat or
 *        nudge slightly harder on the next session.
 */
