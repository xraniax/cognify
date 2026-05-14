/**
 * Adaptive Runtime Orchestrator
 *
 * The single ingestion entry point for all learning systems (quiz, flashcards, exams).
 * Coordinates the full adaptation pipeline on every event:
 *
 *   ingest(event)
 *     → adaptiveLearningStore.appendEvent()          — persist the event
 *     → adaptiveLearningStore.getEventsBySubject()   — retrieve full subject history
 *     → adaptiveProfileStore.updateProfileFromEvents() — re-derive signals + update profile
 *     → latestDecisionCache update                   — cache decision from updated profile
 *
 * Learning systems must NEVER call the store, extractor, or decision engine directly.
 * They emit unified learning events — the runtime owns the rest.
 *
 * NO React. NO hooks. NO Zustand. NO Redux. Pure JS module.
 *
 * ── Usage ────────────────────────────────────────────────────────────────────
 *   import { ingest } from './adaptiveRuntime.js';
 *
 *   // After any question answer, card review, or exam submission:
 *   const { profile, decision } = ingest(learningEvent) ?? {};
 *
 *   // Read current learner state without ingesting:
 *   import { getLatestProfile, getLatestDecision } from './adaptiveRuntime.js';
 */

import { appendEvent, getEventsBySubject }      from './adaptiveLearningStore.js';
import {
    updateProfileFromEvents,
    getSubjectProfile,
    clearSubjectProfile,
    getAllProfiles,
} from './adaptiveProfileStore.js';
import { LEARNING_SOURCE, LEARNING_EVENT_TYPE } from './learningEventSchema.js';

// ── Validation constants ──────────────────────────────────────────────────────

const _REQUIRED_FIELDS   = ['source', 'eventType', 'sessionId', 'subjectId'];
const _VALID_SOURCES     = new Set(Object.values(LEARNING_SOURCE));
const _VALID_EVENT_TYPES = new Set(Object.values(LEARNING_EVENT_TYPE));

// ── Latest decision cache ─────────────────────────────────────────────────────

/**
 * One frozen decision snapshot per subjectId, updated on every successful ingest.
 * Shape: { nextDifficulty, recommendedAction, confidenceScore, updatedAt }
 *
 * @type {Map<string, Readonly<Object>>}
 */
const _latestDecisionCache = new Map();

// ── Event idempotency registry ────────────────────────────────────────────────

/**
 * Per-subject set of already-processed eventIds.
 * Prevents re-ingesting the same event when ingest() is called more than once
 * with the same event object (React re-render, hot-reload, stream retry).
 * Only populated for events that carry a non-empty string eventId.
 * Cleared per-subject by clearSubjectRuntime().
 *
 * @type {Map<string, Set<string>>}
 */
const _processedEventIds = new Map();

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * Validate that an event has all required fields with acceptable values.
 * Returns a human-readable error string, or null when valid.
 *
 * @param {unknown} event
 * @returns {string|null}
 */
function _validateEvent(event) {
    if (!event || typeof event !== 'object' || Array.isArray(event)) {
        return 'event must be a plain object';
    }

    const missing = _REQUIRED_FIELDS.filter(
        (f) => !event[f] || typeof event[f] !== 'string'
    );
    if (missing.length > 0) {
        return `missing or invalid required string field(s): ${missing.join(', ')}`;
    }

    if (!_VALID_SOURCES.has(event.source)) {
        return `unknown source "${event.source}"; expected one of: ${[..._VALID_SOURCES].join(', ')}`;
    }

    if (!_VALID_EVENT_TYPES.has(event.eventType)) {
        return `unknown eventType "${event.eventType}"; expected one of: ${[..._VALID_EVENT_TYPES].join(', ')}`;
    }

    return null;
}

/**
 * Write profile.currentDecision to the decision cache.
 * currentDecision is the single source of truth set by the profile store;
 * this function no longer reads recommendationHistory.
 *
 * @param {string}           subjectId
 * @param {Readonly<Object>} profile   - frozen profile snapshot from updateProfileFromEvents
 */
function _cacheDecisionFromProfile(subjectId, profile) {
    if (!profile.currentDecision) return;
    _latestDecisionCache.set(subjectId, Object.freeze({ ...profile.currentDecision }));
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Ingest a single learning event through the full adaptation pipeline.
 *
 * Steps:
 *   1. Validate required fields (source, eventType, sessionId, subjectId)
 *   2. appendEvent → adaptiveLearningStore
 *   3. getEventsBySubject → full subject event history (includes the new event)
 *   4. updateProfileFromEvents → re-derive signals, apply decision, persist profile
 *   5. Cache latest decision from the updated profile's recommendationHistory
 *
 * Returns null (and logs a warning) when the event fails validation.
 * Unexpected pipeline errors are caught and logged; a partial result is returned
 * with whichever fields were successfully computed.
 *
 * @param {Object} event - LearningEvent conforming to learningEventSchema
 * @returns {Readonly<{
 *   event:    Readonly<Object>,
 *   profile:  Readonly<Object>,
 *   decision: Readonly<Object>|null,
 * }>|null}
 */
export function ingest(event) {
    // ── 1. Validate ───────────────────────────────────────────────────────────
    const validationError = _validateEvent(event);
    if (validationError) {
        console.warn(`[AdaptiveRuntime] Rejected event — ${validationError}`, event);
        return null;
    }

    const { subjectId } = event;
    const eventId = (typeof event.eventId === 'string' && event.eventId) ? event.eventId : null;

    // ── 2. Idempotency check ──────────────────────────────────────────────────
    // If this eventId was already processed for this subject, return the current
    // cached state without touching the store or re-running the pipeline.
    // Handles React re-renders, hot-reload, and stream retries emitting duplicate events.
    if (eventId !== null && _processedEventIds.get(subjectId)?.has(eventId)) {
        const profile  = getSubjectProfile(subjectId);
        const decision = _latestDecisionCache.get(subjectId) ?? null;
        return Object.freeze({ event: Object.freeze({ ...event }), profile: profile ?? null, decision });
    }

    let storedEvent = null;
    try {
        // Frozen shallow copy returned to caller — the original is never mutated.
        storedEvent = Object.freeze({ ...event });

        // ── 3. Append to event store ──────────────────────────────────────────
        appendEvent(event);

        // Mark as processed only after appendEvent succeeds, so a failed append
        // does not block a valid retry from re-attempting.
        if (eventId !== null) {
            if (!_processedEventIds.has(subjectId)) _processedEventIds.set(subjectId, new Set());
            _processedEventIds.get(subjectId).add(eventId);
        }

        // ── 4. Retrieve full subject history, sorted chronologically ──────────
        // getEventsBySubject returns a shallow copy in push order. Sorting here
        // is an explicit contract; extractLearningSignals sorts again as a backstop.
        const subjectEvents = getEventsBySubject(subjectId)
            .sort((a, b) => new Date(a?.timestamp || 0) - new Date(b?.timestamp || 0));

        // ── 5. Update learner profile ─────────────────────────────────────────
        const profile = updateProfileFromEvents(subjectId, subjectEvents);

        // ── 6. Cache decision derived from the updated profile ────────────────
        _cacheDecisionFromProfile(subjectId, profile);

        const decision = _latestDecisionCache.get(subjectId) ?? null;

        return Object.freeze({ event: storedEvent, profile, decision });

    } catch (err) {
        console.warn('[AdaptiveRuntime] Pipeline error during ingest:', err);
        return Object.freeze({ event: storedEvent, profile: null, decision: null });
    }
}

/**
 * Ingest multiple learning events sequentially, preserving insertion order.
 *
 * Each event is processed independently via ingest(). An invalid event produces
 * a null entry at the corresponding index — it does not abort the rest of the batch.
 *
 * @param {Object[]} events
 * @returns {Array<Readonly<Object>|null>}
 */
export function ingestBatch(events) {
    if (!Array.isArray(events)) {
        console.warn('[AdaptiveRuntime] ingestBatch expects an array; received:', typeof events);
        return [];
    }

    const results = [];
    for (const event of events) {
        results.push(ingest(event));
    }
    return results;
}

/**
 * Return the latest cached adaptive decision for a subject.
 * Updated on every successful ingest for that subject.
 *
 * Returns null when the subject has no cached decision yet.
 *
 * @param {string} subjectId
 * @returns {Readonly<{
 *   nextDifficulty:    string,
 *   recommendedAction: string,
 *   confidenceScore:   number,
 *   updatedAt:         string,
 * }>|null}
 */
export function getLatestDecision(subjectId) {
    const decision = _latestDecisionCache.get(subjectId);
    return decision ? Object.freeze({ ...decision }) : null;
}

/**
 * Return the current frozen adaptive profile for a subject.
 * Delegates directly to adaptiveProfileStore — the authoritative learner state.
 *
 * Returns null when the subject has no profile.
 *
 * @param {string} subjectId
 * @returns {Readonly<Object>|null}
 */
export function getLatestProfile(subjectId) {
    return getSubjectProfile(subjectId);
}

/**
 * Return a lightweight diagnostic snapshot of the runtime's current state.
 * Intended for debug/admin tooling and monitoring dashboards.
 *
 * @returns {Readonly<{
 *   activeSubjects:  number,
 *   cachedDecisions: number,
 *   subjects: ReadonlyArray<Readonly<{
 *     subjectId:         string,
 *     currentDifficulty: string,
 *     overallAccuracy:   number,
 *     retentionRisk:     string,
 *     weakConceptsCount: number,
 *     updatedAt:         string,
 *   }>>
 * }>}
 */
export function getRuntimeSnapshot() {
    const profiles = getAllProfiles();

    const subjects = profiles.map((p) =>
        Object.freeze({
            subjectId:         p.subjectId,
            currentDifficulty: p.currentDifficulty,
            overallAccuracy:   p.overallAccuracy,
            retentionRisk:     p.retentionRisk,
            weakConceptsCount: Array.isArray(p.weakConcepts) ? p.weakConcepts.length : 0,
            updatedAt:         p.updatedAt,
        })
    );

    return Object.freeze({
        activeSubjects:  profiles.length,
        cachedDecisions: _latestDecisionCache.size,
        subjects:        Object.freeze(subjects),
    });
}

/**
 * Clear all runtime state for a subject: adaptive profile and cached decision.
 *
 * The global event store is intentionally NOT cleared — raw events are retained
 * for audit trails, replays, and cross-subject analytics.
 *
 * @param {string} subjectId
 */
export function clearSubjectRuntime(subjectId) {
    clearSubjectProfile(subjectId);
    _latestDecisionCache.delete(subjectId);
    _processedEventIds.delete(subjectId);
}
