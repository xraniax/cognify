/**
 * learningEventSchema.js — Unified Learning Event Contract v1.0.0
 *
 * Canonical event schema consumed by the adaptive learning layer.
 * All learning systems (quiz, flashcards, exam) emit events conforming to this contract.
 *
 * THIS FILE IS SCHEMA ONLY.
 * No emission logic. No transport. No storage. No UI assumptions.
 * Import the constants for runtime use; use the JSDoc typedefs for IntelliSense.
 *
 * ─── Discriminant strategy ────────────────────────────────────────────────────
 *
 *   `eventType` narrows to the event category (what happened).
 *   `source`    narrows to the learning system (which system emitted it).
 *
 *   For event types whose payload shape differs by source (e.g. ITEM_ANSWERED),
 *   the concrete typedef is split per source: QuizItemAnsweredEvent,
 *   FlashcardItemAnsweredEvent, ExamItemAnsweredEvent. Callers narrow with:
 *
 *     if (ev.eventType === 'ITEM_ANSWERED' && ev.source === 'quiz') { ... }
 *
 * ─── Adding a new learning system ────────────────────────────────────────────
 *
 *   1. Add its key to LEARNING_SOURCE and LearningSource.
 *   2. Define its answer payload typedef (e.g. PracticeAnswerPayload).
 *   3. Add a concrete answered-event typedef for that source.
 *   4. Union it into ItemAnsweredEvent and LearningEvent.
 *   No other changes needed — base, session events, and shared types are unaffected.
 *
 * @module learningEventSchema
 */

// ---------------------------------------------------------------------------
// Runtime constants (safe to import anywhere — no side effects)
// ---------------------------------------------------------------------------

/**
 * Canonical source identifiers for all learning systems.
 * @type {Readonly<{ QUIZ: 'quiz', FLASHCARDS: 'flashcards', EXAM: 'exam' }>}
 */
export const LEARNING_SOURCE = Object.freeze({
    QUIZ:       'quiz',
    FLASHCARDS: 'flashcards',
    EXAM:       'exam',
});

/**
 * Canonical event type identifiers, shared across all learning systems.
 *
 * ITEM_REVIEWED is listed here for completeness; it is primarily emitted
 * by the flashcard system but treated as a first-class unified event type
 * so future review-style systems can reuse it without a schema change.
 *
 * @type {Readonly<{
 *   ITEM_VIEWED:       'ITEM_VIEWED',
 *   ITEM_INTERACTED:   'ITEM_INTERACTED',
 *   ITEM_ANSWERED:     'ITEM_ANSWERED',
 *   ITEM_REVIEWED:     'ITEM_REVIEWED',
 *   SESSION_STARTED:   'SESSION_STARTED',
 *   SESSION_COMPLETED: 'SESSION_COMPLETED',
 *   SESSION_RESET:     'SESSION_RESET',
 * }>}
 */
export const LEARNING_EVENT_TYPE = Object.freeze({
    ITEM_VIEWED:       'ITEM_VIEWED',
    ITEM_INTERACTED:   'ITEM_INTERACTED',
    ITEM_ANSWERED:     'ITEM_ANSWERED',
    ITEM_REVIEWED:     'ITEM_REVIEWED',
    SESSION_STARTED:   'SESSION_STARTED',
    SESSION_COMPLETED: 'SESSION_COMPLETED',
    SESSION_RESET:     'SESSION_RESET',
});

/** Bump on breaking payload shape changes. Additive fields do not require a bump. */
export const LEARNING_EVENT_SCHEMA_VERSION = '1.0.0';

// ---------------------------------------------------------------------------
// JSDoc type aliases
// ---------------------------------------------------------------------------

/**
 * @typedef {'quiz' | 'flashcards' | 'exam'} LearningSource
 */

/**
 * @typedef {'ITEM_VIEWED' | 'ITEM_INTERACTED' | 'ITEM_ANSWERED' | 'ITEM_REVIEWED'
 *   | 'SESSION_STARTED' | 'SESSION_COMPLETED' | 'SESSION_RESET'} LearningEventType
 */

// ---------------------------------------------------------------------------
// Base — fields present on EVERY LearningEvent
// ---------------------------------------------------------------------------

/**
 * Fields shared by every event, regardless of source or type.
 *
 * `eventType` is declared here as the wide union; concrete subtypes narrow it
 * to the specific string literal via intersection so the discriminant is
 * available on the base when you do not yet know the specific type.
 *
 * `contentId` is the canonical content identifier:
 *   quiz       → questionId
 *   flashcards → cardId
 *   exam       → examQuestionId
 * Session-level events (SESSION_STARTED, SESSION_COMPLETED, SESSION_RESET)
 * set contentId to null — they describe the session, not a specific item.
 *
 * `difficulty` is a 0–1 normalized difficulty estimate at the time of emission.
 * Adaptive systems update this per item; null when difficulty is unknown or
 * not applicable (e.g. static quizzes that don't carry per-question difficulty).
 *
 * `responseTimeMs` is the measured latency between item presentation and
 * answer submission in milliseconds. Null when not measured by the emitting
 * system (e.g. static quiz mode — use hesitation.deliberationMs instead).
 *
 * @typedef {Object} LearningEventBase
 * @property {string}             eventId        - UUID v4; unique per emitted event
 * @property {string}             sessionId      - UUID v4; groups events for one activity session
 * @property {string}             timestamp      - ISO 8601 datetime ("2026-05-07T10:00:00.000Z")
 * @property {LearningSource}     source         - learning system that emitted this event
 * @property {LearningEventType}  eventType      - narrowed to a literal string in each concrete subtype
 * @property {string}             subjectId      - subject this content belongs to
 * @property {string | null}      materialId     - source material, if applicable
 * @property {string | null}      contentId      - canonical content identifier; null for session events
 * @property {number | null}      difficulty     - 0–1 normalized difficulty estimate; null if unknown
 * @property {number | null}      responseTimeMs - measured answer latency in ms; null if not measured
 * @property {string}             schemaVersion  - value of LEARNING_EVENT_SCHEMA_VERSION at emit time
 */

// ---------------------------------------------------------------------------
// Item-level payload mixins
// (fields added to item-scoped events on top of LearningEventBase)
// ---------------------------------------------------------------------------

/**
 * Added to ITEM_VIEWED events.
 *
 * @typedef {Object} ItemViewedPayload
 * @property {number}        contentIndex - 0-based position of this item within the session
 * @property {number | null} totalItems   - declared total items; null for dynamically-sized sessions
 */

/**
 * Added to ITEM_INTERACTED events.
 *
 * `interactionType` is a free-form string; recommended values by source:
 *   quiz       — 'option_selected'
 *   flashcards — 'card_flipped', 'ease_hovered'
 *   exam       — 'answer_typed', 'option_selected'
 *
 * `interactionValue` is the raw interaction payload (selected option text,
 * partially typed answer, etc.). Null when the interaction carries no discrete value.
 *
 * @typedef {Object} ItemInteractedPayload
 * @property {number}        contentIndex      - 0-based position of this item
 * @property {string | null} interactionType   - semantic label for the interaction
 * @property {string | null} interactionValue  - raw value associated with this interaction
 */

// ---------------------------------------------------------------------------
// Source-specific answer payload mixins
// (added only to ITEM_ANSWERED / ITEM_REVIEWED events from the matching source)
// ---------------------------------------------------------------------------

/**
 * Quiz answer payload. Merged into ITEM_ANSWERED when source='quiz'.
 *
 * `score` and `streak` are post-answer cumulative values.
 * The delta can be derived by comparing with the previous ITEM_ANSWERED event.
 *
 * @typedef {Object} QuizAnswerPayload
 * @property {string}  selectedOption - the option text the learner chose
 * @property {boolean} isCorrect      - whether selectedOption matches the correct answer
 * @property {number}  score          - cumulative score after this answer
 * @property {number}  streak         - current correct-answer streak length after this answer
 */

/**
 * Flashcard review payload. Merged into ITEM_ANSWERED and ITEM_REVIEWED when source='flashcards'.
 *
 * `easeRating` follows a 1–5 scale (1=Again, 2=Hard, 3=Good, 4=Easy, 5=Perfect).
 * `interval` is the next scheduled review gap in days, post-rating (SM-2 / FSRS output).
 * `flippedSide` records which face was active when the rating was submitted.
 *
 * @typedef {Object} FlashcardReviewPayload
 * @property {'front' | 'back'} flippedSide - card face shown at time of rating
 * @property {1 | 2 | 3 | 4 | 5} easeRating - learner ease rating
 * @property {number}            interval    - next review interval in days
 */

/**
 * Exam answer payload. Merged into ITEM_ANSWERED when source='exam'.
 *
 * `isCorrect` is null for open-ended or manually graded items — grade is not
 * known at emit time and will be set by the grading pipeline.
 * `partialCredit` is a 0–1 fraction; 1.0 = full credit, 0.0 = no credit.
 * `grade` is raw points awarded; null until the item has been graded.
 *
 * @typedef {Object} ExamAnswerPayload
 * @property {string}          selectedAnswer - the answer text / choice selected
 * @property {boolean | null}  isCorrect      - null for open-ended / pending-grade items
 * @property {number | null}   partialCredit  - 0–1 partial credit fraction; null if binary
 * @property {number | null}   grade          - raw grade points; null if pending grading
 */

// ---------------------------------------------------------------------------
// Session-level payload mixins
// (added to SESSION_* events; contentId is null for these events)
// ---------------------------------------------------------------------------

/**
 * Added to SESSION_STARTED events.
 *
 * `mode` is a free-form string; recommended values by source:
 *   quiz       — 'static' | 'adaptive'
 *   flashcards — 'review' | 'learn'
 *   exam       — 'timed' | 'untimed' | 'practice'
 *
 * @typedef {Object} SessionStartedPayload
 * @property {number | null} totalItems - declared item count; null for dynamically-sized sessions
 * @property {string}        mode       - delivery mode for this session
 */

/**
 * Added to SESSION_COMPLETED events.
 *
 * `accuracy` is null when itemsAnswered === 0 (avoids 0/0 division artefact).
 * `startedAt` / `completedAt` are ISO timestamps — durationMs is pre-computed
 * for convenience (completedAt − startedAt); callers should not re-derive it.
 *
 * @typedef {Object} SessionCompletedPayload
 * @property {number}        totalItems     - total items in the session
 * @property {number}        itemsAnswered  - items the learner actually answered
 * @property {number}        correctAnswers - count of correct / positively-rated answers
 * @property {number | null} accuracy       - correctAnswers / itemsAnswered; null if itemsAnswered === 0
 * @property {number}        finalScore     - cumulative score at session end
 * @property {number}        durationMs     - wall-clock session duration in ms
 * @property {string}        startedAt      - ISO timestamp when session began
 * @property {string}        completedAt    - ISO timestamp when session ended
 */

/**
 * Added to SESSION_RESET events.
 *
 * Captures the session state at the moment the learner triggered a reset.
 * The adaptive engine uses this to distinguish voluntary resets from
 * abandonment (which produces no SESSION_RESET event at all).
 *
 * @typedef {Object} SessionResetPayload
 * @property {number} atContentIndex - 0-based index of the item displayed when reset was triggered
 * @property {number} atScore        - cumulative score at the moment of reset
 */

// ---------------------------------------------------------------------------
// Concrete event types — discriminated union members
// Each is an intersection of LearningEventBase + a specific eventType literal
// + any source-specific payload mixin that applies to that event.
// ---------------------------------------------------------------------------

// ── Item-scoped ──────────────────────────────────────────────────────────────

/**
 * @typedef {LearningEventBase & ItemViewedPayload & { eventType: 'ITEM_VIEWED' }} ItemViewedEvent
 */

/**
 * @typedef {LearningEventBase & ItemInteractedPayload & { eventType: 'ITEM_INTERACTED' }} ItemInteractedEvent
 */

// ITEM_ANSWERED — payload shape differs by source; one concrete type per source.

/**
 * @typedef {LearningEventBase & QuizAnswerPayload
 *   & { eventType: 'ITEM_ANSWERED', source: 'quiz' }
 * } QuizItemAnsweredEvent
 */

/**
 * @typedef {LearningEventBase & FlashcardReviewPayload
 *   & { eventType: 'ITEM_ANSWERED', source: 'flashcards' }
 * } FlashcardItemAnsweredEvent
 */

/**
 * @typedef {LearningEventBase & ExamAnswerPayload
 *   & { eventType: 'ITEM_ANSWERED', source: 'exam' }
 * } ExamItemAnsweredEvent
 */

/**
 * Union of all ITEM_ANSWERED variants. Narrow further with `ev.source` to
 * access source-specific payload fields.
 *
 * @typedef {QuizItemAnsweredEvent | FlashcardItemAnsweredEvent | ExamItemAnsweredEvent} ItemAnsweredEvent
 */

// ITEM_REVIEWED — flashcards-primary; available to other systems that model review cycles.

/**
 * @typedef {LearningEventBase & FlashcardReviewPayload & { eventType: 'ITEM_REVIEWED' }} ItemReviewedEvent
 */

// ── Session-scoped ───────────────────────────────────────────────────────────

/**
 * @typedef {LearningEventBase & SessionStartedPayload
 *   & { eventType: 'SESSION_STARTED', contentId: null }
 * } SessionStartedEvent
 */

/**
 * @typedef {LearningEventBase & SessionCompletedPayload
 *   & { eventType: 'SESSION_COMPLETED', contentId: null }
 * } SessionCompletedEvent
 */

/**
 * @typedef {LearningEventBase & SessionResetPayload
 *   & { eventType: 'SESSION_RESET', contentId: null }
 * } SessionResetEvent
 */

// ---------------------------------------------------------------------------
// Master union — the type consumed by the adaptive learning layer
// ---------------------------------------------------------------------------

/**
 * Discriminated union of every concrete learning event type.
 *
 * Narrow on `eventType` first, then on `source` if the event type has
 * per-source payload variants (currently: ITEM_ANSWERED).
 *
 * @typedef {
 *   | ItemViewedEvent
 *   | ItemInteractedEvent
 *   | ItemAnsweredEvent
 *   | ItemReviewedEvent
 *   | SessionStartedEvent
 *   | SessionCompletedEvent
 *   | SessionResetEvent
 * } LearningEvent
 */
