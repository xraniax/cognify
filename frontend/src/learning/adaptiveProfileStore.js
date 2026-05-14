/**
 * Adaptive Profile Store
 *
 * Persistent learner-profile layer. Sits after the signal extraction pipeline:
 *   adaptiveLearningStore → learningSignalExtractor → adaptiveProfileStore
 *
 * Maintains one longitudinal adaptive state object per subject. Profiles survive
 * page refresh via localStorage and are cached in memory for O(1) reads.
 *
 * Storage layout:
 *   One key per subject: cognify_adaptive_profile_<subjectId>
 *
 * Initialization:
 *   All previously persisted profiles are loaded into the in-memory Map at import
 *   time by scanning localStorage for the module prefix.
 *
 * NO React. NO hooks. NO Zustand. NO Redux. Pure JS module.
 *
 * ── Usage pattern ────────────────────────────────────────────────────────────
 *   // After a quiz/flashcard/exam session ends:
 *   import { updateProfileFromEvents } from './adaptiveProfileStore.js';
 *   const profile = updateProfileFromEvents(subjectId, sessionEvents);
 *   // profile.currentDifficulty, .weakConcepts, .retentionRisk, etc. are ready.
 */

import { extractLearningSignals } from './learningSignalExtractor.js';
import {
    adaptiveDecisionEngine,
    LEARNER_ARCHETYPE,
    SPACED_REP_STATUS,
    THRESHOLDS,
} from '../services/adaptiveDecisionEngine.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_PREFIX    = 'cognify_adaptive_profile_';
const MAX_HISTORY       = 100;

/**
 * Ordered difficulty scale. Index position is used for arithmetic movement
 * (+1 = harder, -1 = easier) and is intentionally kept small and explicit.
 */
const DIFFICULTY_LEVELS = Object.freeze(['beginner', 'intermediate', 'advanced']);

/**
 * Smoothing factor for per-concept masteryScore EMA.
 * 0.3 = 30 % new batch, 70 % prior history — prevents single-session jumps.
 */
const MASTERY_EMA_ALPHA = 0.3;

/**
 * Minimum number of consecutive decisions with the same direction before a
 * difficulty flip is committed. Prevents rapid harder↔easier oscillation.
 */
const HYSTERESIS_MIN_CONSISTENT = 2;

/**
 * EMA weight for per-archetype probability scores.
 * 0.35 = 35 % new session, 65 % history — smooth transitions, no hard flips.
 */
const ARCHETYPE_EMA_ALPHA = 0.35;

/**
 * Ebbinghaus forgetting curve: retentionScore = masteryScore × e^(-t / stabilityDays)
 * stabilityDays = MIN + masteryScore × (MAX - MIN)
 *   masteryScore = 0 → 1-day stability  (very fragile memory)
 *   masteryScore = 1 → 30-day stability (strong, durable memory)
 */
const FORGETTING = Object.freeze({
    MIN_STABILITY_DAYS: 1,
    MAX_STABILITY_DAYS: 30,
});

/** Default archetypeScores for a brand-new profile (neutral prior). */
const DEFAULT_ARCHETYPE_SCORES = Object.freeze({
    [LEARNER_ARCHETYPE.FAST_LEARNER]:   0,
    [LEARNER_ARCHETYPE.STEADY_LEARNER]: 0.5,
    [LEARNER_ARCHETYPE.INCONSISTENT]:   0,
    [LEARNER_ARCHETYPE.STRUGGLING]:     0,
});

// ── In-memory cache ───────────────────────────────────────────────────────────

/** @type {Map<string, Object>} Mutable profile objects keyed by subjectId. */
const _profiles = new Map();

// ── Persistence helpers ───────────────────────────────────────────────────────

function _storageKey(subjectId) {
    return `${STORAGE_PREFIX}${subjectId}`;
}

/**
 * Read and JSON-parse a profile from localStorage.
 * Returns null on missing key, quota error, corrupt JSON, or non-object value.
 *
 * @param {string} subjectId
 * @returns {Object|null}
 */
function _readStorage(subjectId) {
    try {
        const raw = localStorage.getItem(_storageKey(subjectId));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

/**
 * Serialize and write a profile to localStorage.
 * Silently swallows quota errors — in-memory state remains the authority.
 *
 * @param {Object} profile
 */
function _writeStorage(profile) {
    try {
        localStorage.setItem(_storageKey(profile.subjectId), JSON.stringify(profile));
    } catch {
        // localStorage quota exceeded — in-memory cache is still correct.
    }
}

/**
 * Remove a profile key from localStorage.
 *
 * @param {string} subjectId
 */
function _removeStorage(subjectId) {
    try {
        localStorage.removeItem(_storageKey(subjectId));
    } catch {
        // Ignore — profile has already been removed from memory.
    }
}

// ── Default profile factory ───────────────────────────────────────────────────

/**
 * Build a blank profile for a subject that has no learning history.
 *
 * @param {string} subjectId
 * @returns {Object}
 */
function _defaultProfile(subjectId) {
    const now = new Date().toISOString();
    return {
        subjectId,

        createdAt: now,
        updatedAt: now,

        totalEvents:   0,
        totalAttempts: 0,

        currentDifficulty: 'beginner',

        overallAccuracy:       0,
        recentAccuracy:        0,
        averageResponseTimeMs: 0,
        hesitationIndex:       0,
        // retentionRisk mirrors learningSignalExtractor output: 'low' | 'medium' | 'high'
        retentionRisk:         'low',
        confidenceTrend:       'stable',

        weakConcepts:   [],
        strongConcepts: [],

        conceptMastery: {},

        archetype:       LEARNER_ARCHETYPE.STEADY_LEARNER,
        archetypeScores: { ...DEFAULT_ARCHETYPE_SCORES },

        difficultyHistory:     [],
        signalHistory:         [],
        recommendationHistory: [],

        currentDecision:        null,
        currentMasterySnapshot: null,
    };
}

// ── Math helpers ──────────────────────────────────────────────────────────────

function _clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}

// ── Archetype helpers ─────────────────────────────────────────────────────────

/**
 * Compute a raw score in [0, 1] for each learner archetype from the current
 * batch's extracted signals. Higher = more evidence for that archetype this session.
 *
 * Scoring rationale:
 *   FAST_LEARNER   — high recent accuracy + improving trend + strong streak + low hesitation
 *   STEADY_LEARNER — accuracy in middle band + stable trend + low variance
 *   INCONSISTENT   — high accuracy variance + low streak despite non-trivial accuracy
 *   STRUGGLING     — low accuracy + high hesitation + declining trend
 *
 * Scores are independent and do not need to sum to 1 — the EMA-smoothed version
 * in the profile is used for argmax selection, not as a probability distribution.
 *
 * @param {Object} signals - output of extractLearningSignals
 * @returns {{ FAST_LEARNER: number, STEADY_LEARNER: number, INCONSISTENT: number, STRUGGLING: number }}
 */
function _computeArchetypeScores(signals) {
    const {
        accuracy, recentAccuracy, streak, hesitationIndex,
        confidenceTrend, accuracyVariance = 0,
    } = signals;

    // FAST_LEARNER: strong recent performance, improving, low hesitation
    const fastScore = _clamp(
        Math.min(recentAccuracy / 0.80, 1.0) * 0.35 +
        (confidenceTrend === 'improving' ? 0.25 : 0)  +
        Math.min(streak / 5, 1.0) * 0.25              +
        (1 - hesitationIndex) * 0.15,
        0, 1
    );

    // STEADY_LEARNER: accuracy in [0.50, 0.80] band, stable trend, low variance
    const accInBand = (accuracy >= 0.50 && accuracy <= 0.80)
        ? 1 - Math.abs(accuracy - 0.65) / 0.15   // peaks at 0.65
        : 0;
    const steadyScore = _clamp(
        _clamp(accInBand, 0, 1) * 0.35                                       +
        (confidenceTrend === 'stable' ? 0.30 : 0.10)                         +
        Math.max(0, 1 - accuracyVariance / 0.20) * 0.35,
        0, 1
    );

    // INCONSISTENT: high variance + low streak when accuracy isn't critically low
    const inconsistentScore = _clamp(
        Math.min(accuracyVariance / 0.20, 1.0) * 0.60                             +
        (streak < 3 && accuracy >= 0.40 ? (1 - streak / 3) * 0.25 : 0)            +
        (accuracyVariance > 0.10 && accuracy >= 0.40 && accuracy <= 0.80 ? 0.15 : 0),
        0, 1
    );

    // STRUGGLING: low accuracy + high hesitation + declining trend
    const strugglingScore = _clamp(
        Math.max(0, 1 - accuracy / 0.50) * 0.50                                         +
        Math.max(0, (hesitationIndex - 0.50) / 0.50) * 0.25                             +
        (confidenceTrend === 'declining' ? 0.25 : 0),
        0, 1
    );

    return {
        [LEARNER_ARCHETYPE.FAST_LEARNER]:   parseFloat(fastScore.toFixed(3)),
        [LEARNER_ARCHETYPE.STEADY_LEARNER]: parseFloat(steadyScore.toFixed(3)),
        [LEARNER_ARCHETYPE.INCONSISTENT]:   parseFloat(inconsistentScore.toFixed(3)),
        [LEARNER_ARCHETYPE.STRUGGLING]:     parseFloat(strugglingScore.toFixed(3)),
    };
}

/**
 * Return the archetype key with the highest smoothed score.
 * Falls back to STEADY_LEARNER when scores map is empty or all scores are 0.
 *
 * @param {Object} scores - { [archetypeKey]: number }
 * @returns {string} one of LEARNER_ARCHETYPE values
 */
function _resolveArchetype(scores) {
    let best = LEARNER_ARCHETYPE.STEADY_LEARNER;
    let bestScore = -1;
    for (const [archetype, score] of Object.entries(scores)) {
        if (score > bestScore) { bestScore = score; best = archetype; }
    }
    return best;
}

// ── Hysteresis helper ─────────────────────────────────────────────────────────

/**
 * Return true when `history` contains at least min(minCount, history.length)
 * consecutive trailing entries all recommending `direction`.
 *
 * On the very first session history has exactly one entry (the current decision)
 * so `available = 1` and the check passes with a single consistent signal —
 * allowing the initial difficulty change. On subsequent sessions, `minCount`
 * consecutive agreements are required, preventing rapid flip-backs.
 *
 * @param {Array<{nextDifficulty: string}>} history - profile.recommendationHistory
 * @param {'easier'|'same'|'harder'} direction
 * @param {number} minCount
 * @returns {boolean}
 */
function _hasConsistentDirection(history, direction, minCount) {
    if (direction === 'same') return true;
    const available = Math.min(history.length, minCount);
    if (available === 0) return false;
    const recent = history.slice(-available);
    return recent.every((r) => r.nextDifficulty === direction);
}

// ── Snapshot helper ───────────────────────────────────────────────────────────

/**
 * Return a shallow-frozen copy of a profile object.
 * Prevents callers from mutating the cached internal reference.
 *
 * @param {Object} profile
 * @returns {Readonly<Object>}
 */
function _snapshot(profile) {
    return Object.freeze({ ...profile });
}

// ── Difficulty helpers ────────────────────────────────────────────────────────

/**
 * Convert a relative direction ('harder'|'same'|'easier') into an absolute
 * difficulty level, clamped within DIFFICULTY_LEVELS bounds.
 *
 * @param {string} current   - current absolute difficulty
 * @param {'easier'|'same'|'harder'} direction
 * @returns {string}
 */
function _resolveAbsoluteDifficulty(current, direction) {
    if (direction === 'same') return current;
    const idx     = DIFFICULTY_LEVELS.indexOf(current);
    const safeIdx = idx < 0 ? 0 : idx;
    if (direction === 'harder') return DIFFICULTY_LEVELS[Math.min(safeIdx + 1, DIFFICULTY_LEVELS.length - 1)];
    if (direction === 'easier') return DIFFICULTY_LEVELS[Math.max(safeIdx - 1, 0)];
    return current;
}

// ── Module initialization ─────────────────────────────────────────────────────

/**
 * Scan localStorage at import time to hydrate the in-memory cache with all
 * previously persisted profiles. Corrupt or unrecognized entries are skipped.
 * A try/catch guards the whole function so SSR / restricted contexts start empty.
 */
function _init() {
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
            const subjectId = key.slice(STORAGE_PREFIX.length);
            if (!subjectId) continue;
            const profile = _readStorage(subjectId);
            if (profile && typeof profile.subjectId === 'string') {
                _profiles.set(subjectId, profile);
            }
        }
    } catch {
        // localStorage unavailable (SSR, test sandbox, restricted context) — start empty.
    }
}

_init();

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Ensure a profile exists for the given subject and return it.
 *
 * - When the profile is already in the in-memory cache: returns it immediately.
 * - When a persisted profile exists in localStorage: loads and caches it.
 * - Otherwise: creates a default profile, caches it, and persists it.
 *
 * Idempotent — safe to call multiple times for the same subjectId.
 *
 * @param {string} subjectId
 * @returns {Readonly<Object>} frozen shallow copy of the profile
 */
export function initializeSubjectProfile(subjectId) {
    if (_profiles.has(subjectId)) {
        return _snapshot(_profiles.get(subjectId));
    }

    const stored  = _readStorage(subjectId);
    const profile = stored ?? _defaultProfile(subjectId);
    _profiles.set(subjectId, profile);
    if (!stored) _writeStorage(profile);

    return _snapshot(profile);
}

/**
 * Return a frozen snapshot of the current profile for a subject.
 * Returns null when the subject has never been initialized.
 *
 * Never exposes mutable internal references — callers receive a shallow copy.
 *
 * @param {string} subjectId
 * @returns {Readonly<Object>|null}
 */
export function getSubjectProfile(subjectId) {
    const profile = _profiles.get(subjectId);
    return profile ? _snapshot(profile) : null;
}

/**
 * Ingest a batch of new learning events, re-derive all adaptive signals,
 * run the decision engine, and update the longitudinal profile state.
 *
 * Full pipeline executed internally:
 *   1. extractLearningSignals(events)
 *   2. adaptiveDecisionEngine.decide({ ...signals, currentDifficulty })
 *   3. Merge signals into the profile (scalars replaced; counters accumulated;
 *      concept mastery merged concept-by-concept; histories appended and capped)
 *   4. Assign profile.currentDecision — single source of truth for the runtime
 *   5. Persist updated profile to localStorage
 *   5. Return frozen snapshot
 *
 * Signal semantics:
 *   - Scalar signals (accuracy, hesitation, etc.) are replaced with the latest
 *     batch values — they reflect the learner's current, not historical, state.
 *   - totalEvents / totalAttempts accumulate across all calls.
 *   - conceptMastery is merged: existing concept entries are overwritten when the
 *     new batch contains events for that concept; unseen concepts are preserved.
 *   - All three history arrays are capped at MAX_HISTORY (100) — oldest removed.
 *   - difficultyHistory receives a new entry only when the difficulty actually changes.
 *
 * When events is empty or not an array, the existing profile is returned unchanged.
 *
 * @param {string}   subjectId
 * @param {Object[]} events    - LearningEvent objects (from the current session/batch)
 * @returns {Readonly<Object>} frozen profile snapshot after the update
 */
export function updateProfileFromEvents(subjectId, events) {
    if (!Array.isArray(events) || events.length === 0) {
        return initializeSubjectProfile(subjectId);
    }

    if (!_profiles.has(subjectId)) initializeSubjectProfile(subjectId);

    // Shallow copy so mutations don't corrupt the cached version until we commit.
    const profile = { ..._profiles.get(subjectId) };

    // Defensive normalization: list fields may be strings in stale localStorage data.
    if (!Array.isArray(profile.weakConcepts))          profile.weakConcepts          = [];
    if (!Array.isArray(profile.strongConcepts))        profile.strongConcepts        = [];
    if (!Array.isArray(profile.difficultyHistory))     profile.difficultyHistory     = [];
    if (!Array.isArray(profile.signalHistory))         profile.signalHistory         = [];
    if (!Array.isArray(profile.recommendationHistory)) profile.recommendationHistory = [];

    // ── 1. Extract signals ────────────────────────────────────────────────────
    const signals = extractLearningSignals(events);
    const now     = new Date().toISOString();
    const nowMs   = Date.now();

    // ── 2. Update learner archetype (EMA-smoothed) ────────────────────────────
    // Raw scores are computed from current batch signals; each score is then
    // blended with the stored score via EMA so a single outlier session can't
    // hard-flip the archetype. _resolveArchetype picks the argmax.
    const rawScores  = _computeArchetypeScores(signals);
    const prevScores = profile.archetypeScores ?? { ...DEFAULT_ARCHETYPE_SCORES };
    const smoothedScores = {};
    for (const key of Object.values(LEARNER_ARCHETYPE)) {
        smoothedScores[key] = parseFloat(
            (ARCHETYPE_EMA_ALPHA * rawScores[key] + (1 - ARCHETYPE_EMA_ALPHA) * (prevScores[key] ?? 0)).toFixed(3)
        );
    }
    profile.archetypeScores = smoothedScores;
    profile.archetype       = _resolveArchetype(smoothedScores);

    // ── 3. Merge concept mastery — EMA + forgetting curve ─────────────────────
    // 3a: merge current-batch concepts; masteryScore is EMA-smoothed, attempts
    //     accumulate, accuracy reflects the most recent batch result.
    const updatedMastery = { ...profile.conceptMastery };
    for (const [concept, data] of Object.entries(signals.conceptMasteryMap)) {
        const prev = updatedMastery[concept];
        updatedMastery[concept] = {
            masteryScore: prev
                ? parseFloat((MASTERY_EMA_ALPHA * data.masteryScore + (1 - MASTERY_EMA_ALPHA) * prev.masteryScore).toFixed(3))
                : data.masteryScore,
            attempts:              prev ? prev.attempts + data.attempts : data.attempts,
            accuracy:              data.accuracy,
            averageResponseTimeMs: data.avgResponseTimeMs,
            lastUpdated:           now,
        };
    }

    // 3b: apply Ebbinghaus forgetting curve + spaced-rep classification to ALL
    //     concepts (not just those in the current batch). Concepts studied today
    //     get timeSinceSeen ≈ 0 → decay ≈ 1.0. Concepts not seen for days decay
    //     based on their mastery-derived memory stability.
    const srpT = THRESHOLDS.spaced_rep;
    for (const [concept, entry] of Object.entries(updatedMastery)) {
        const lastSeenMs       = entry.lastUpdated ? new Date(entry.lastUpdated).getTime() : nowMs;
        const timeSinceSeenDays = Math.max(0, (nowMs - lastSeenMs) / 86_400_000);
        const stabilityDays    = FORGETTING.MIN_STABILITY_DAYS +
            entry.masteryScore * (FORGETTING.MAX_STABILITY_DAYS - FORGETTING.MIN_STABILITY_DAYS);
        const decayFactor      = Math.exp(-timeSinceSeenDays / stabilityDays);
        const retentionScore   = parseFloat(Math.min(1, entry.masteryScore * decayFactor).toFixed(3));

        const spacedRepStatus =
            retentionScore < srpT.DUE_RETENTION  || timeSinceSeenDays > srpT.DUE_DAYS  ? SPACED_REP_STATUS.DUE  :
            retentionScore < srpT.SOON_RETENTION || timeSinceSeenDays > srpT.SOON_DAYS ? SPACED_REP_STATUS.SOON :
            SPACED_REP_STATUS.FRESH;

        updatedMastery[concept] = { ...entry, retentionScore, spacedRepStatus };
    }
    profile.conceptMastery = updatedMastery;

    // ── 4. Run the decision engine ────────────────────────────────────────────
    // conceptMastery now contains retentionScore + spacedRepStatus so the engine
    // can use them for recommendedNextConcept / reviewConcepts.
    const decision = adaptiveDecisionEngine.decide({
        accuracy:          signals.accuracy,
        recentAccuracy:    signals.recentAccuracy,
        streak:            signals.streak,
        totalAttempts:     signals.totalAttempts,
        weakConcepts:      signals.weakConcepts,
        currentDifficulty: profile.currentDifficulty,
        conceptMastery:    updatedMastery,
        learnerArchetype:  profile.archetype,
    });

    // ── 5. Update scalar / list fields ────────────────────────────────────────
    profile.updatedAt             = now;
    profile.totalEvents           = profile.totalEvents   + events.length;
    profile.totalAttempts         = profile.totalAttempts + signals.totalAttempts;
    profile.overallAccuracy       = signals.accuracy;
    profile.recentAccuracy        = signals.recentAccuracy;
    profile.averageResponseTimeMs = signals.averageResponseTimeMs;
    profile.hesitationIndex       = signals.hesitationIndex;
    profile.retentionRisk         = signals.retentionRisk;
    profile.confidenceTrend       = signals.confidenceTrend;
    profile.weakConcepts          = [...signals.weakConcepts];
    profile.strongConcepts        = [...signals.strongConcepts];

    // ── 6. Append signal snapshot ─────────────────────────────────────────────
    profile.signalHistory = [
        ...profile.signalHistory,
        {
            timestamp:        now,
            accuracy:         signals.accuracy,
            recentAccuracy:   signals.recentAccuracy,
            hesitationIndex:  signals.hesitationIndex,
            accuracyVariance: signals.accuracyVariance,
            retentionRisk:    signals.retentionRisk,
            confidenceTrend:  signals.confidenceTrend,
            archetype:        profile.archetype,
        },
    ].slice(-MAX_HISTORY);

    // ── 7. Append recommendation snapshot + update currentDecision ────────────
    profile.recommendationHistory = [
        ...profile.recommendationHistory,
        {
            timestamp:              now,
            nextDifficulty:         decision.nextDifficulty,
            recommendedAction:      decision.recommendedAction,
            confidenceScore:        decision.confidenceScore,
            recommendedNextConcept: decision.recommendedNextConcept,
        },
    ].slice(-MAX_HISTORY);

    profile.currentDecision = {
        nextDifficulty:         decision.nextDifficulty,
        recommendedAction:      decision.recommendedAction,
        confidenceScore:        decision.confidenceScore,
        recommendedNextConcept: decision.recommendedNextConcept,
        reviewConcepts:         decision.reviewConcepts,
        updatedAt:              now,
    };

    // ── 8. Apply difficulty change if warranted — hysteresis guard ────────────
    const prevDifficulty = profile.currentDifficulty;
    const newDifficulty  = _resolveAbsoluteDifficulty(prevDifficulty, decision.nextDifficulty);

    if (
        newDifficulty !== prevDifficulty &&
        _hasConsistentDirection(profile.recommendationHistory, decision.nextDifficulty, HYSTERESIS_MIN_CONSISTENT)
    ) {
        profile.currentDifficulty = newDifficulty;
        profile.difficultyHistory = [
            ...profile.difficultyHistory,
            {
                timestamp: now,
                from:      prevDifficulty,
                to:        newDifficulty,
                reason:    decision.explanation.difficulty,
            },
        ].slice(-MAX_HISTORY);
    }

    // ── 9. Commit to cache and persist ────────────────────────────────────────
    _profiles.set(subjectId, profile);
    _writeStorage(profile);

    return _snapshot(profile);
}

/**
 * Apply an external or manually-constructed adaptive decision to the profile.
 *
 * Records the decision's difficulty direction as an absolute difficulty change
 * and appends to difficultyHistory when the difficulty actually changes.
 * When decision.nextDifficulty === 'same', this function is a no-op.
 *
 * Use this for:
 *   - Manual instructor overrides
 *   - Server-side recommendations
 *   - Replaying decisions from a saved audit trail
 *
 * @param {string} subjectId
 * @param {Object} decision  - DecisionResult from adaptiveDecisionEngine.decide()
 * @returns {Readonly<Object>} frozen profile snapshot after the update
 */
export function applyAdaptiveDecision(subjectId, decision) {
    if (!_profiles.has(subjectId)) initializeSubjectProfile(subjectId);

    const profile        = { ..._profiles.get(subjectId) };
    const prevDifficulty = profile.currentDifficulty;
    const newDifficulty  = _resolveAbsoluteDifficulty(prevDifficulty, decision.nextDifficulty ?? 'same');

    if (newDifficulty === prevDifficulty) {
        return _snapshot(profile);
    }

    const now = new Date().toISOString();
    profile.currentDifficulty = newDifficulty;
    profile.updatedAt         = now;
    profile.difficultyHistory = [
        ...profile.difficultyHistory,
        {
            timestamp: now,
            from:      prevDifficulty,
            to:        newDifficulty,
            reason:    decision.explanation?.difficulty ?? '',
        },
    ].slice(-MAX_HISTORY);

    profile.currentDecision = {
        nextDifficulty:         decision.nextDifficulty,
        recommendedAction:      decision.recommendedAction      ?? 'continue',
        confidenceScore:        decision.confidenceScore        ?? 0,
        recommendedNextConcept: decision.recommendedNextConcept ?? null,
        reviewConcepts:         decision.reviewConcepts         ?? [],
        updatedAt:              now,
    };

    _profiles.set(subjectId, profile);
    _writeStorage(profile);

    return _snapshot(profile);
}

/**
 * Delete a subject's profile from both the in-memory cache and localStorage.
 * After this call, getSubjectProfile returns null until the profile is re-initialized.
 *
 * @param {string} subjectId
 */
export function clearSubjectProfile(subjectId) {
    _profiles.delete(subjectId);
    _removeStorage(subjectId);
}

/**
 * Return frozen snapshots of all profiles currently in the in-memory cache.
 * Profiles are ordered by the sequence in which they were first loaded or created.
 *
 * @returns {ReadonlyArray<Readonly<Object>>}
 */
export function getAllProfiles() {
    return [..._profiles.values()].map(_snapshot);
}
