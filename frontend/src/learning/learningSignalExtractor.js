/**
 * Learning Signal Extractor
 *
 * Transforms an array of raw LearningEvents (from adaptiveLearningStore) into a
 * normalised LearningSignal consumable directly by adaptiveDecisionEngine.decide().
 *
 * Pipeline:
 *   adaptiveLearningStore → extractLearningSignals() → adaptiveDecisionEngine
 *
 * Design constraints:
 *   - Pure, deterministic, synchronous
 *   - No React, no storage, no network calls
 *   - Input events are never mutated
 *   - All thresholds in CONFIG (exported for tests and academic reports)
 *   - Every sub-calculator exported individually for unit testing
 *
 * Event schema reference: ./learningEventSchema.js
 *   - eventId       : UUID, unique per event
 *   - contentId     : canonical item identifier (questionId / cardId / examQuestionId)
 *   - timestamp     : ISO 8601 string
 *   - responseTimeMs: nullable — measured answer latency
 *   - easeRating    : 1-5 — flashcard-specific (1=Again, 2=Hard, 3=Good, 4=Easy, 5=Perfect)
 *   - isCorrect     : boolean | null — null for ungraded exam items
 *
 * ⚠️  The returned LearningSignal omits `currentDifficulty` and `source`, which are
 *     session-context values not derivable from events. Merge them before calling decide():
 *
 *       const signal = extractLearningSignals(events);
 *       const decision = decide({ ...signal, currentDifficulty: 'intermediate', source: 'quiz' });
 */

import { LEARNING_EVENT_TYPE, LEARNING_SOURCE } from './learningEventSchema.js';

// ── Configuration ─────────────────────────────────────────────────────────────
// Single source of truth for every threshold and weight used in this module.
// Export allows tests and academic reports to inspect exact values.

export const CONFIG = Object.freeze({

    /** Sliding window for recency-weighted accuracy. */
    RECENT_WINDOW: 5,

    FLASHCARD: Object.freeze({
        /**
         * Minimum easeRating counted as a successful review.
         * Scale: 1=Again 2=Hard 3=Good 4=Easy 5=Perfect
         * ≥ 3 means "Good or better", matching common SRS interpretations.
         */
        CORRECT_EASE_MIN: 3,
    }),

    HESITATION: Object.freeze({
        /** Responses longer than this (ms) are flagged as slow deliberation. */
        LONG_DELIBERATION_MS: 15_000,
        /** ITEM_INTERACTED events before an answer that constitute a self-correction. */
        HIGH_INTERACTION_THRESHOLD: 2,
        /**
         * Component weights — must sum to exactly 1.0 to keep the index naturally in [0, 1].
         *   INTERACTION: avg ITEM_INTERACTED per answer, normalised against 3 max
         *   LONG_TIME:   fraction of answers exceeding LONG_DELIBERATION_MS
         *   CORRECTION:  fraction of answers with ≥ HIGH_INTERACTION_THRESHOLD before them
         */
        INTERACTION_WEIGHT: 0.30,
        LONG_TIME_WEIGHT:   0.45,
        CORRECTION_WEIGHT:  0.25,
    }),

    CONFIDENCE_TREND: Object.freeze({
        /** Minimum graded answer events required to detect a meaningful trend. */
        MIN_EVENTS_FOR_TREND: 4,
        /** Second-half accuracy must exceed first-half by this to be "improving". */
        IMPROVING_DELTA:  0.10,
        /** Second-half accuracy must fall below first-half by this to be "declining". */
        DECLINING_DELTA: -0.10,
    }),

    RETENTION: Object.freeze({
        HIGH_RISK_ACCURACY:   0.35,
        MEDIUM_RISK_ACCURACY: 0.55,
        HIGH_HESITATION:      0.65,
        /** Cumulative risk score that maps to 'high'. */
        HIGH_RISK_SCORE:   3,
        /** Cumulative risk score that maps to 'medium'. */
        MEDIUM_RISK_SCORE: 1,
    }),

    DIFFICULTY_DRIFT: Object.freeze({
        TOO_EASY_ACCURACY:    0.85,
        TOO_HARD_ACCURACY:    0.50,
        TOO_EASY_HESITATION:  0.25,
        TOO_HARD_HESITATION:  0.65,
        /**
         * Upper bound for "mixed zone" — recentAccuracy below this combined with
         * high hesitation also signals too_hard even if above TOO_HARD_ACCURACY.
         */
        MIXED_ACCURACY_UPPER: 0.65,
    }),

    VARIANCE: Object.freeze({
        /** Minimum graded events before variance is meaningful. */
        MIN_EVENTS: 4,
        /** Sliding-window size for variance; matches RECENT_WINDOW. */
        WINDOW:     5,
    }),

    MASTERY: Object.freeze({
        /** masteryScore below this → weak concept. */
        WEAK_THRESHOLD:   0.45,
        /** masteryScore above this → strong concept. */
        STRONG_THRESHOLD: 0.80,
        /**
         * masteryScore = accuracy × ACCURACY_WEIGHT + (1 − hesitation) × DECISIVENESS_WEIGHT
         * Weights must sum to 1.0.
         */
        ACCURACY_WEIGHT:      0.70,
        DECISIVENESS_WEIGHT:  0.30,
        /** Per-concept interaction count is normalised against this ceiling. */
        MAX_AVG_INTERACTIONS: 3,
    }),
});

// ── Private helpers ───────────────────────────────────────────────────────────

function _clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}

/**
 * Convert an ISO 8601 string or epoch number to epoch milliseconds.
 * Returns 0 on unparseable input so sort comparisons remain stable.
 */
function _toMs(ts) {
    if (typeof ts === 'number' && isFinite(ts)) return ts;
    if (typeof ts === 'string') {
        const ms = new Date(ts).getTime();
        return isNaN(ms) ? 0 : ms;
    }
    return 0;
}

/** True when the event carries a completed answer or review outcome. */
function _isAnswerEvent(event) {
    const et = event?.eventType;
    // Explicit exclusion prevents VIEW/INTERACT events from leaking into
    // correctness logic even if they accidentally carry an isCorrect field.
    if (et === LEARNING_EVENT_TYPE.ITEM_VIEWED || et === LEARNING_EVENT_TYPE.ITEM_INTERACTED) return false;
    return et === LEARNING_EVENT_TYPE.ITEM_ANSWERED || et === LEARNING_EVENT_TYPE.ITEM_REVIEWED;
}

/** True when the event is a learner UI interaction (option selection, card flip, etc.). */
function _isInteractionEvent(event) {
    return event?.eventType === LEARNING_EVENT_TYPE.ITEM_INTERACTED;
}

/**
 * Source-agnostic correctness normalisation:
 *
 *   flashcards (any eventType) → easeRating ≥ CONFIG.FLASHCARD.CORRECT_EASE_MIN
 *   ITEM_REVIEWED (non-flashcard) → easeRating if present, else isCorrect
 *   quiz / exam → isCorrect === true
 *
 * Returns false for exam events with isCorrect=null (pending grading).
 * Always pair with _hasKnownOutcome() to exclude them from accuracy denominators.
 */
function _isCorrect(event) {
    if (
        event?.source === LEARNING_SOURCE.FLASHCARDS ||
        event?.eventType === LEARNING_EVENT_TYPE.ITEM_REVIEWED
    ) {
        if (typeof event.easeRating === 'number') {
            return event.easeRating >= CONFIG.FLASHCARD.CORRECT_EASE_MIN;
        }
    }
    return event?.isCorrect === true;
}

/**
 * True when the correctness outcome of the event is definitively known.
 * Exam events with isCorrect=null (pending grading) return false.
 * Flashcard and quiz events always have a deterministic outcome.
 */
function _hasKnownOutcome(event) {
    // VIEW and INTERACT events never carry graded outcomes; exclude them explicitly
    // so that an accidental isCorrect field on such events is never counted.
    if (
        event?.eventType === LEARNING_EVENT_TYPE.ITEM_VIEWED ||
        event?.eventType === LEARNING_EVENT_TYPE.ITEM_INTERACTED
    ) return false;

    if (
        event?.source === LEARNING_SOURCE.FLASHCARDS ||
        event?.eventType === LEARNING_EVENT_TYPE.ITEM_REVIEWED
    ) {
        return typeof event.easeRating === 'number';
    }
    return event?.isCorrect !== null && event?.isCorrect !== undefined;
}

/**
 * Extract a valid response time in ms from an event.
 * Returns null when the field is absent, non-finite, or zero (timing placeholder).
 */
function _getResponseTimeMs(event) {
    const ms = event?.responseTimeMs;
    if (typeof ms === 'number' && isFinite(ms) && ms > 0) return ms;
    return null;
}

/**
 * Concept/topic key for mastery grouping.
 * Resolution: concept → topicName → topic → subjectId → 'unknown'
 * Falls back to subjectId so every event is always classified.
 */
function _getConceptKey(event) {
    return event?.concept ?? event?.topicName ?? event?.topic ?? event?.subjectId ?? 'unknown';
}

/**
 * Minimum elapsed time (ms) between two events of the same
 * (eventType, sessionId, contentId) for both to be kept.
 * Events arriving closer together than this are treated as duplicates.
 */
const _NOISY_DEDUP_WINDOW_MS = 2_000;

/** True for event types that are high-frequency noise sources (VIEW + INTERACT). */
function _isNoisyEvent(event) {
    const et = event?.eventType;
    return et === LEARNING_EVENT_TYPE.ITEM_VIEWED || et === LEARNING_EVENT_TYPE.ITEM_INTERACTED;
}

/**
 * Remove duplicate ITEM_VIEWED and ITEM_INTERACTED events that arrive within
 * _NOISY_DEDUP_WINDOW_MS of a prior event with the same (eventType, sessionId, contentId).
 *
 * Only the first occurrence in each window is retained. Non-noisy events
 * (ITEM_ANSWERED, ITEM_REVIEWED, SESSION_*) pass through untouched.
 *
 * Motivation: React re-renders and component remounts can re-fire
 * ITEM_VIEWED/ITEM_INTERACTED with fresh eventIds but identical semantic content
 * within a few milliseconds, inflating hesitation scores and interaction counts.
 *
 * Must be called after chronological sorting so the "first seen" semantics are
 * based on actual event time, not push order.
 *
 * @param {Object[]} events - chronologically sorted LearningEvents
 * @returns {Object[]} new array with noisy duplicates removed; input never mutated
 */
function _deduplicateNoisy(events) {
    const lastKeptMs = new Map(); // dedup key → epoch ms of last kept event
    const result     = [];

    for (const ev of events) {
        if (!_isNoisyEvent(ev)) {
            result.push(ev);
            continue;
        }
        const key  = `${ev.eventType}\x00${ev.sessionId ?? ''}\x00${ev.contentId ?? ''}`;
        const evMs = _toMs(ev.timestamp);
        const last = lastKeptMs.get(key);

        if (last === undefined || evMs - last >= _NOISY_DEDUP_WINDOW_MS) {
            lastKeptMs.set(key, evMs);
            result.push(ev);
        }
        // else: drop — arrived within the dedup window for the same (type, session, content)
    }

    return result;
}

/**
 * Maximum elapsed time (ms) between two ITEM_ANSWERED events for the same
 * (sessionId, contentId) for the earlier one to be treated as superseded.
 * A rapid incorrect answer followed by a correct correction within this window
 * will not break the streak — only the final answer is counted.
 */
const _STREAK_CORRECTION_WINDOW_MS = 3_000;

/**
 * For streak computation only: remove an ITEM_ANSWERED event when a later
 * ITEM_ANSWERED for the same (sessionId, contentId) arrives within
 * _STREAK_CORRECTION_WINDOW_MS — the later answer supersedes the earlier one.
 *
 * Only applied when both events carry a non-null contentId to prevent
 * over-aggressive filtering for events that lack a content identifier.
 *
 * Prevents a rapid self-correction (option changed before final submit,
 * or a dev-mode double-invoke) from resetting the streak when the accepted
 * answer is correct.
 *
 * @param {Object[]} gradedEvents - chronologically sorted, graded answer events
 * @returns {Object[]} filtered array; input is never mutated
 */
function _filterSupersededAnswers(gradedEvents) {
    if (gradedEvents.length <= 1) return gradedEvents;
    const toRemove = new Set();
    for (let i = 0; i < gradedEvents.length; i++) {
        const ev = gradedEvents[i];
        if (!ev.contentId || !ev.sessionId) continue;
        const evMs = _toMs(ev.timestamp);
        for (let j = i + 1; j < gradedEvents.length; j++) {
            const next   = gradedEvents[j];
            const nextMs = _toMs(next.timestamp);
            if (nextMs - evMs > _STREAK_CORRECTION_WINDOW_MS) break;
            if (next.sessionId === ev.sessionId && next.contentId === ev.contentId) {
                toRemove.add(i);
                break;
            }
        }
    }
    return gradedEvents.filter((_, i) => !toRemove.has(i));
}

/**
 * Build Map<eventId|eventRef, interactionCount> for all answer events.
 *
 * For each answer event, counts how many ITEM_INTERACTED events occurred in the
 * same session before it. When both answer and interaction carry a contentId,
 * they must match; when either is absent, session + time ordering is used alone.
 *
 * Complexity: O(|answers| × |interactions|) — acceptable for client-side volumes.
 */
function _buildInteractionCounts(events) {
    const answerEvents      = events.filter(_isAnswerEvent);
    const interactionEvents = events.filter(_isInteractionEvent);
    const counts            = new Map();

    for (const answer of answerEvents) {
        const aMs      = _toMs(answer.timestamp);
        const aContent = answer.contentId ?? null;
        let count = 0;

        for (const ie of interactionEvents) {
            if (ie.sessionId !== answer.sessionId) continue;
            if (_toMs(ie.timestamp) >= aMs) continue;
            const ieContent = ie.contentId ?? null;
            // When both have a contentId they must match; otherwise correlate by session+time only.
            if (aContent !== null && ieContent !== null && ieContent !== aContent) continue;
            count++;
        }

        // Prefer eventId for the key; fall back to object reference when eventId is absent.
        counts.set(answer.eventId ?? answer, count);
    }

    return counts;
}

// ── Individual calculators ─────────────────────────────────────────────────────

/**
 * Overall correctness ratio across all graded answer events.
 * Ungraded events (exam items with isCorrect=null) are excluded from both
 * the numerator and denominator to avoid accuracy distortion.
 *
 * @param {Object[]} events - LearningEvents, any order
 * @returns {number} [0, 1]; 0 when no graded answer events exist
 */
export function computeAccuracy(events) {
    const graded = events.filter(_isAnswerEvent).filter(_hasKnownOutcome);
    if (graded.length === 0) return 0;
    return graded.filter(_isCorrect).length / graded.length;
}

/**
 * Accuracy over the most recent `window` graded answer events.
 * Gracefully uses all available events when fewer than `window` exist.
 *
 * @param {Object[]} events - LearningEvents in chronological order
 * @param {number}   [window=CONFIG.RECENT_WINDOW]
 * @returns {number} [0, 1]; 0 when no graded answer events exist
 */
export function computeRecentAccuracy(events, window = CONFIG.RECENT_WINDOW) {
    const graded = events.filter(_isAnswerEvent).filter(_hasKnownOutcome);
    if (graded.length === 0) return 0;
    const recent = graded.slice(-window);
    return recent.filter(_isCorrect).length / recent.length;
}

/**
 * Count of consecutive correct answers ending at the most recent graded event.
 * Scans backward and resets to 0 at the first incorrect graded answer.
 * Ungraded events are not counted and do not break the streak.
 *
 * @param {Object[]} events - LearningEvents in chronological order
 * @returns {number} ≥ 0
 */
export function computeStreak(events) {
    const graded   = events.filter(_isAnswerEvent).filter(_hasKnownOutcome);
    const filtered = _filterSupersededAnswers(graded);
    let streak = 0;
    for (let i = filtered.length - 1; i >= 0; i--) {
        if (_isCorrect(filtered[i])) streak++;
        else break;
    }
    return streak;
}

/**
 * Mean response time in ms across all answer events with valid timing data.
 * Includes ungraded events — hesitation is independent of grading status.
 * Filters out null, non-finite, and zero (timing placeholder) values.
 *
 * @param {Object[]} events - LearningEvents, any order
 * @returns {number} ms ≥ 0; 0 when no valid timing data exists
 */
export function computeAverageResponseTimeMs(events) {
    const times = events
        .filter(_isAnswerEvent)
        .map(_getResponseTimeMs)
        .filter((t) => t !== null);
    if (times.length === 0) return 0;
    return times.reduce((sum, t) => sum + t, 0) / times.length;
}

/**
 * Normalised learner uncertainty score in [0, 1].
 * 0 = highly decisive   1 = highly hesitant
 *
 * Three independent components weighted to sum to 1.0 (weights in CONFIG.HESITATION):
 *   1. Interaction intensity  — avg ITEM_INTERACTED per answer, capped at 3  × 0.30
 *   2. Long-deliberation rate — fraction of answers exceeding LONG_DELIBERATION_MS × 0.45
 *   3. Self-correction rate   — fraction of answers with ≥ HIGH_INTERACTION_THRESHOLD × 0.25
 *
 * Applies to all answer events regardless of grading status, since UI behaviour
 * reveals hesitation independent of whether the answer is graded.
 *
 * @param {Object[]} events - LearningEvents in chronological order
 * @returns {number} [0, 1]
 */
export function computeHesitationIndex(events) {
    const answers = events.filter(_isAnswerEvent);
    if (answers.length === 0) return 0;

    const t                = CONFIG.HESITATION;
    const interactionCounts = _buildInteractionCounts(events);

    let totalInteractions     = 0;
    let longDeliberationCount = 0;
    let selfCorrectionCount   = 0;

    for (const answer of answers) {
        const interactions = interactionCounts.get(answer.eventId ?? answer) ?? 0;
        totalInteractions += interactions;

        const ms = _getResponseTimeMs(answer);
        if (ms !== null && ms > t.LONG_DELIBERATION_MS) longDeliberationCount++;
        if (interactions >= t.HIGH_INTERACTION_THRESHOLD) selfCorrectionCount++;
    }

    const interactionSignal = Math.min(1, (totalInteractions / answers.length) / 3);
    const longTimeSignal    = longDeliberationCount / answers.length;
    const correctionSignal  = selfCorrectionCount  / answers.length;

    const raw =
        interactionSignal * t.INTERACTION_WEIGHT +
        longTimeSignal    * t.LONG_TIME_WEIGHT   +
        correctionSignal  * t.CORRECTION_WEIGHT;

    return _clamp(parseFloat(raw.toFixed(3)), 0, 1);
}

/**
 * Standard deviation of per-question or sliding-window accuracies.
 *
 * When enough events exist for sliding windows (≥ WINDOW): computes accuracy for
 * each overlapping window of WINDOW events, then returns the std-dev of those
 * window accuracies. This detects macro-level inconsistency across the session.
 *
 * When events ≥ MIN_EVENTS but < WINDOW: uses binary correct/incorrect values
 * directly, equivalent to Bernoulli std-dev = √(p(1−p)).
 *
 * Returns 0 when fewer than MIN_EVENTS graded events exist (insufficient signal).
 * Output is always in [0, 0.5] in practice; clamped to [0, 1] for contract safety.
 *
 * @param {Object[]} events - LearningEvents in chronological order
 * @returns {number} [0, 1]
 */
export function computeAccuracyVariance(events) {
    const graded = events.filter(_isAnswerEvent).filter(_hasKnownOutcome);
    const { MIN_EVENTS, WINDOW } = CONFIG.VARIANCE;
    if (graded.length < MIN_EVENTS) return 0;

    const values = graded.length >= WINDOW
        ? (() => {
            const wins = [];
            for (let i = 0; i <= graded.length - WINDOW; i++) {
                const slice = graded.slice(i, i + WINDOW);
                wins.push(slice.filter(_isCorrect).length / slice.length);
            }
            return wins;
        })()
        : graded.map((ev) => (_isCorrect(ev) ? 1 : 0));

    const n    = values.length;
    const mean = values.reduce((s, v) => s + v, 0) / n;
    const sd   = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
    return _clamp(parseFloat(sd.toFixed(3)), 0, 1);
}

/**
 * Detect whether learner confidence is trending positively, negatively, or holding.
 *
 * Method: split graded answer events into first and second chronological halves;
 * compare accuracy between halves. Falls back to 'stable' when insufficient
 * graded events exist (< MIN_EVENTS_FOR_TREND).
 *
 * @param {Object[]} events - LearningEvents in chronological order
 * @returns {'improving' | 'stable' | 'declining'}
 */
export function computeConfidenceTrend(events) {
    const graded = events.filter(_isAnswerEvent).filter(_hasKnownOutcome);
    const { MIN_EVENTS_FOR_TREND, IMPROVING_DELTA, DECLINING_DELTA } = CONFIG.CONFIDENCE_TREND;

    if (graded.length < MIN_EVENTS_FOR_TREND) return 'stable';

    const mid        = Math.ceil(graded.length / 2);
    const firstHalf  = graded.slice(0, mid);
    const secondHalf = graded.slice(mid);

    const acc   = (arr) => arr.filter(_isCorrect).length / arr.length;
    const delta = acc(secondHalf) - acc(firstHalf);

    if (delta >= IMPROVING_DELTA)  return 'improving';
    if (delta <= DECLINING_DELTA)  return 'declining';
    return 'stable';
}

/**
 * Estimate how likely the learner is to forget the material soon.
 *
 * Risk scoring — conditions are additive:
 *   accuracy < HIGH_RISK_ACCURACY                  → +2 (dominant signal)
 *   accuracy < MEDIUM_RISK_ACCURACY (else)         → +1
 *   hesitationIndex > HIGH_HESITATION              → +1
 *   confidenceTrend === 'declining'                → +1
 *
 *   score ≥ HIGH_RISK_SCORE   → 'high'
 *   score ≥ MEDIUM_RISK_SCORE → 'medium'
 *   else                      → 'low'
 *
 * Accepts pre-computed signals rather than raw events — allows calling
 * individually without re-running extraction.
 *
 * @param {number} accuracy        - overall accuracy [0, 1]
 * @param {number} hesitationIndex - [0, 1]
 * @param {'improving'|'stable'|'declining'} confidenceTrend
 * @returns {'low' | 'medium' | 'high'}
 */
export function computeRetentionRisk(accuracy, hesitationIndex, confidenceTrend) {
    const { HIGH_RISK_ACCURACY, MEDIUM_RISK_ACCURACY, HIGH_HESITATION,
            HIGH_RISK_SCORE, MEDIUM_RISK_SCORE } = CONFIG.RETENTION;

    let score = 0;
    if      (accuracy < HIGH_RISK_ACCURACY)   score += 2;
    else if (accuracy < MEDIUM_RISK_ACCURACY) score += 1;
    if (hesitationIndex > HIGH_HESITATION)    score += 1;
    if (confidenceTrend === 'declining')       score += 1;

    if (score >= HIGH_RISK_SCORE)   return 'high';
    if (score >= MEDIUM_RISK_SCORE) return 'medium';
    return 'low';
}

/**
 * Estimate whether the current content difficulty is well-matched to the learner.
 *
 * Uses recentAccuracy (not overall) to reflect the learner's current performance
 * rather than their historical average.
 *
 * Heuristics:
 *   recentAccuracy > TOO_EASY_ACCURACY AND hesitation < TOO_EASY_HESITATION → 'too_easy'
 *   recentAccuracy < TOO_HARD_ACCURACY OR
 *     (recentAccuracy < MIXED_ACCURACY_UPPER AND hesitation > TOO_HARD_HESITATION) → 'too_hard'
 *   otherwise → 'appropriate'
 *
 * @param {number} recentAccuracy  - recent window accuracy [0, 1]
 * @param {number} hesitationIndex - [0, 1]
 * @returns {'too_easy' | 'appropriate' | 'too_hard'}
 */
export function computeDifficultyDrift(recentAccuracy, hesitationIndex) {
    const t = CONFIG.DIFFICULTY_DRIFT;

    if (recentAccuracy > t.TOO_EASY_ACCURACY && hesitationIndex < t.TOO_EASY_HESITATION) {
        return 'too_easy';
    }
    if (
        recentAccuracy < t.TOO_HARD_ACCURACY ||
        (recentAccuracy < t.MIXED_ACCURACY_UPPER && hesitationIndex > t.TOO_HARD_HESITATION)
    ) {
        return 'too_hard';
    }
    return 'appropriate';
}

/**
 * Build per-concept mastery entries from graded answer events.
 *
 * Concept key resolution: concept → topicName → topic → subjectId → 'unknown'
 *
 * Per-concept hesitation uses interaction-count signal only (response-time baselines
 * are not available at concept level without a reference distribution).
 *
 * masteryScore = clamp(
 *   accuracy × ACCURACY_WEIGHT + (1 − hesitation) × DECISIVENESS_WEIGHT,
 *   0, 1
 * )
 *
 * @param {Object[]} events - LearningEvents in chronological order
 * @returns {Readonly<Object>} conceptKey → frozen entry per concept
 */
export function computeConceptMasteryMap(events) {
    const graded            = events.filter(_isAnswerEvent).filter(_hasKnownOutcome);
    const interactionCounts = _buildInteractionCounts(events);
    const t                 = CONFIG.MASTERY;

    const accumulator = {};

    for (const ev of graded) {
        const key = _getConceptKey(ev);
        if (!accumulator[key]) {
            accumulator[key] = { attempts: 0, correct: 0, times: [], interactions: [] };
        }
        const entry = accumulator[key];
        entry.attempts += 1;
        if (_isCorrect(ev)) entry.correct += 1;

        const ms = _getResponseTimeMs(ev);
        if (ms !== null) entry.times.push(ms);

        entry.interactions.push(interactionCounts.get(ev.eventId ?? ev) ?? 0);
    }

    const result = {};

    for (const [key, data] of Object.entries(accumulator)) {
        const accuracy = data.attempts > 0 ? data.correct / data.attempts : 0;

        const avgResponseTimeMs = data.times.length > 0
            ? data.times.reduce((s, v) => s + v, 0) / data.times.length
            : 0;

        const avgInteractions = data.interactions.length > 0
            ? data.interactions.reduce((s, v) => s + v, 0) / data.interactions.length
            : 0;
        const hesitation = _clamp(Math.min(1, avgInteractions / t.MAX_AVG_INTERACTIONS), 0, 1);

        const masteryScore = _clamp(
            accuracy         * t.ACCURACY_WEIGHT +
            (1 - hesitation) * t.DECISIVENESS_WEIGHT,
            0, 1
        );

        result[key] = Object.freeze({
            attempts:          data.attempts,
            correct:           data.correct,
            accuracy:          parseFloat(accuracy.toFixed(3)),
            avgResponseTimeMs: parseFloat(avgResponseTimeMs.toFixed(1)),
            hesitation:        parseFloat(hesitation.toFixed(3)),
            masteryScore:      parseFloat(masteryScore.toFixed(3)),
        });
    }

    return Object.freeze(result);
}

/**
 * Derive weak concepts from a conceptMasteryMap.
 * Weak: masteryScore < CONFIG.MASTERY.WEAK_THRESHOLD
 * Sorted for deterministic output across identical inputs.
 *
 * @param {Readonly<Object>} conceptMasteryMap - output of computeConceptMasteryMap
 * @returns {string[]}
 */
export function computeWeakConcepts(conceptMasteryMap) {
    return Object.entries(conceptMasteryMap)
        .filter(([, v]) => v.masteryScore < CONFIG.MASTERY.WEAK_THRESHOLD)
        .map(([k]) => k)
        .sort();
}

/**
 * Derive strong concepts from a conceptMasteryMap.
 * Strong: masteryScore > CONFIG.MASTERY.STRONG_THRESHOLD
 * Sorted for deterministic output across identical inputs.
 *
 * @param {Readonly<Object>} conceptMasteryMap - output of computeConceptMasteryMap
 * @returns {string[]}
 */
export function computeStrongConcepts(conceptMasteryMap) {
    return Object.entries(conceptMasteryMap)
        .filter(([, v]) => v.masteryScore > CONFIG.MASTERY.STRONG_THRESHOLD)
        .map(([k]) => k)
        .sort();
}

/**
 * Compute per-source performance analytics.
 * Only sources present in the event set appear in the output.
 *
 * `attempts` counts all answer events for the source (graded + ungraded).
 * `accuracy` is computed over graded events only (excludes pending-grade exam items).
 * `avgResponseTimeMs` uses all answer events with valid timing (graded + ungraded).
 *
 * @param {Object[]} events - LearningEvents, any order
 * @returns {Readonly<Object>} source → frozen { attempts, accuracy, avgResponseTimeMs }
 */
export function computeSourceBreakdown(events) {
    const answers  = events.filter(_isAnswerEvent);
    const bySource = {};

    for (const ev of answers) {
        const src = ev.source ?? 'unknown';
        if (!bySource[src]) {
            bySource[src] = { attempts: 0, gradedTotal: 0, correct: 0, times: [] };
        }
        const entry = bySource[src];
        entry.attempts += 1;

        if (_hasKnownOutcome(ev)) {
            entry.gradedTotal += 1;
            if (_isCorrect(ev)) entry.correct += 1;
        }

        const ms = _getResponseTimeMs(ev);
        if (ms !== null) entry.times.push(ms);
    }

    const result = {};
    for (const [src, data] of Object.entries(bySource)) {
        result[src] = Object.freeze({
            attempts:          data.attempts,
            accuracy:          data.gradedTotal > 0
                ? parseFloat((data.correct / data.gradedTotal).toFixed(3))
                : 0,
            avgResponseTimeMs: data.times.length > 0
                ? parseFloat((data.times.reduce((s, t) => s + t, 0) / data.times.length).toFixed(1))
                : 0,
        });
    }

    return Object.freeze(result);
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Transform an array of raw LearningEvents into a complete, frozen LearningSignal.
 *
 * Events may arrive in any order. This function sorts by timestamp (ISO 8601 strings
 * are compared via Date parsing) before passing to order-sensitive calculators
 * (streak, recentAccuracy, confidenceTrend). The input array is never mutated.
 *
 * @param {Object[]} events - raw LearningEvent objects from adaptiveLearningStore
 * @returns {Readonly<{
 *   accuracy:              number,
 *   recentAccuracy:        number,
 *   streak:                number,
 *   totalAttempts:         number,
 *   averageResponseTimeMs: number,
 *   hesitationIndex:       number,
 *   confidenceTrend:       'improving'|'stable'|'declining',
 *   retentionRisk:         'low'|'medium'|'high',
 *   difficultyDrift:       'too_easy'|'appropriate'|'too_hard',
 *   weakConcepts:          string[],
 *   strongConcepts:        string[],
 *   conceptMasteryMap:     Object,
 *   sourceBreakdown:       Object,
 * }>}
 */
export function extractLearningSignals(events) {
    if (!Array.isArray(events)) {
        throw new TypeError('events must be an array');
    }

    // Sort chronologically without mutating the caller's array.
    const sorted = [...events].sort((a, b) => _toMs(a.timestamp) - _toMs(b.timestamp));

    // Deduplicate ITEM_VIEWED and ITEM_INTERACTED events that land within
    // _NOISY_DEDUP_WINDOW_MS of each other for the same (type, session, content).
    // Raw events are preserved in the store; only signal computation uses the
    // clean array. ITEM_ANSWERED / ITEM_REVIEWED events are never touched here.
    const deduped = _deduplicateNoisy(sorted);

    // ── Primitive signals — computed on the deduplicated event set ──────────
    const accuracy              = computeAccuracy(deduped);
    const recentAccuracy        = computeRecentAccuracy(deduped);
    const streak                = computeStreak(deduped);
    const totalAttempts         = deduped.filter(_isAnswerEvent).length;
    const averageResponseTimeMs = computeAverageResponseTimeMs(deduped);
    const hesitationIndex       = computeHesitationIndex(deduped);
    const confidenceTrend       = computeConfidenceTrend(deduped);
    const accuracyVariance      = computeAccuracyVariance(deduped);

    // ── Derived signals — combine previously computed primitives ────────────
    const retentionRisk   = computeRetentionRisk(accuracy, hesitationIndex, confidenceTrend);
    const difficultyDrift = computeDifficultyDrift(recentAccuracy, hesitationIndex);

    // ── Concept-level signals ───────────────────────────────────────────────
    const conceptMasteryMap = computeConceptMasteryMap(deduped);
    const weakConcepts      = computeWeakConcepts(conceptMasteryMap);
    const strongConcepts    = computeStrongConcepts(conceptMasteryMap);

    // ── Per-source analytics ────────────────────────────────────────────────
    const sourceBreakdown = computeSourceBreakdown(deduped);

    return Object.freeze({
        accuracy:              parseFloat(accuracy.toFixed(3)),
        recentAccuracy:        parseFloat(recentAccuracy.toFixed(3)),
        streak,
        totalAttempts,
        averageResponseTimeMs: parseFloat(averageResponseTimeMs.toFixed(1)),
        hesitationIndex,
        accuracyVariance,
        confidenceTrend,
        retentionRisk,
        difficultyDrift,
        weakConcepts,
        strongConcepts,
        conceptMasteryMap,
        sourceBreakdown,
    });
}
