/**
 * Adaptive Decision Engine
 *
 * Pure, stateless, deterministic decision functions.
 * Consumes a LearningSignal object and returns a DecisionResult.
 * Zero side-effects. No React dependency. No storage.
 *
 * ── Expected input contract (LearningSignal) ────────────────────────────────
 * Produced by the Learning Signal Extractor from raw LearningEvents.
 *
 * {
 *   // Performance metrics
 *   accuracy:          number  0–1   overall correct / total across all attempts
 *   recentAccuracy:    number  0–1   correct / total over the most recent N events (window)
 *   streak:            number  ≥ 0   consecutive correct answers; resets to 0 on any wrong
 *   totalAttempts:     number  ≥ 0   total answer events processed into these signals
 *
 *   // Concept-level signals
 *   weakConcepts:      string[]      concept/topic names with accuracy below weak threshold
 *   strongConcepts:    string[]      concept/topic names with accuracy above strong threshold
 *
 *   // Context
 *   currentDifficulty: 'beginner' | 'intermediate' | 'advanced'
 *   source:            'quiz' | 'flashcard' | 'exam'   (informational; logic is source-agnostic)
 * }
 *
 * ── Guaranteed output contract (DecisionResult) ─────────────────────────────
 * {
 *   nextDifficulty:     'easier' | 'same' | 'harder'
 *   recommendedAction:  'review' | 'continue' | 'revise'
 *   weakAreas:          string[]
 *   confidenceScore:    number  0–1  (rule-based cap: 0.95)
 *   explanation: {
 *     difficulty: string   human-readable reason for difficulty decision
 *     action:     string   human-readable reason for action decision
 *     confidence: string   human-readable reason for confidence score
 *   }
 * }
 */

// ── Learner archetype and spaced repetition enums ──────────────────────────

/**
 * Four archetypes that describe a learner's longitudinal performance pattern.
 * Computed from accuracy variance, trend, streak, and hesitation signals.
 * Used to adjust the weak/strong concept split in recommendations.
 */
export const LEARNER_ARCHETYPE = Object.freeze({
    FAST_LEARNER:   'FAST_LEARNER',
    STEADY_LEARNER: 'STEADY_LEARNER',
    INCONSISTENT:   'INCONSISTENT',
    STRUGGLING:     'STRUGGLING',
});

/**
 * Spaced repetition status for a concept, derived from mastery + forgetting curve.
 * DUE   — retention below threshold or overdue; present first
 * SOON  — retention declining; schedule soon
 * FRESH — recently studied and well-retained; no immediate action needed
 */
export const SPACED_REP_STATUS = Object.freeze({
    DUE:   'DUE',
    SOON:  'SOON',
    FRESH: 'FRESH',
});

// ── Decision thresholds ─────────────────────────────────────────────────────
// All thresholds are exported so they appear in academic reports and unit tests
// without requiring magic-number archaeology.

export const THRESHOLDS = Object.freeze({
    difficulty: Object.freeze({
        // Escalate difficulty when performance is sustained and strong.
        harder: Object.freeze({
            minRecentAccuracy: 0.80,  // ≥ 80 % in recent window
            minStreak:         3,     // ≥ 3 consecutive correct
            minAttempts:       3,     // need at least 3 data points
        }),
        // De-escalate when recent performance is poor.
        easier: Object.freeze({
            maxRecentAccuracy: 0.45,  // < 45 % in recent window
        }),
    }),
    action: Object.freeze({
        // Full material revision — systematic failure.
        revise: Object.freeze({
            maxAccuracy: 0.40,            // overall accuracy < 40 %
        }),
        // Targeted concept review — specific knowledge gaps.
        review: Object.freeze({
            maxAccuracy:       0.65,      // overall accuracy < 65 %
            minWeakConcepts:   2,         // at least 2 concepts flagged weak
        }),
        // Continue on current path — performance is adequate.
        continue: Object.freeze({}),
    }),
    confidence: Object.freeze({
        // Weighted formula: attemptFactor×attemptWeight + accuracy×accuracyWeight + streakFactor×streakWeight + coherenceBonus
        fullDataAttempts:    15,   // attempts at which attempt-saturation factor reaches 1.0
        maxStreakForFullScore: 5,  // streak ≥ this saturates the streak component
        attemptWeight:       0.40, // weight for attempt-saturation factor
        accuracyWeight:      0.35, // weight for overall accuracy
        streakWeight:        0.25, // weight for normalised streak
        coherenceBonus:      0.10, // bonus when accuracy and streak directions agree
        min:                 0.05, // floor — even 1 attempt yields a weak signal
        max:                 0.95, // ceiling — rule-based systems are never fully certain
    }),
    spaced_rep: Object.freeze({
        DUE_RETENTION:  0.50, // retentionScore below this → DUE regardless of time
        DUE_DAYS:       14,   // days since last seen → always DUE regardless of retention
        SOON_RETENTION: 0.75, // retentionScore below this → SOON (not yet DUE)
        SOON_DAYS:       7,   // days since last seen → SOON (not yet DUE_DAYS)
    }),
    recommendation: Object.freeze({
        /** Default fraction of reviewConcepts filled by weak/DUE concepts. */
        WEAK_DUE_WEIGHT:            0.70,
        /** Archetype overrides — more remediation for STRUGGLING, more reinforcement for FAST. */
        WEAK_DUE_WEIGHT_STRUGGLING: 0.85,
        WEAK_DUE_WEIGHT_FAST:       0.60,
        /** Maximum concepts returned in reviewConcepts list. */
        MAX_REVIEW_CONCEPTS:        10,
        /** masteryScore below this → weak (eligible for urgency queue). */
        WEAK_THRESHOLD:             0.45,
        /** masteryScore above this → strong (eligible for reinforcement queue). */
        STRONG_THRESHOLD:           0.80,
    }),
});

// ── Internal helpers ────────────────────────────────────────────────────────

function _clamp(value, low, high) {
    return Math.max(low, Math.min(high, value));
}

/**
 * Signals are coherent when accuracy direction and streak direction agree.
 * Coherence increases confidence because two independent indicators converge.
 *
 * Direction mapping:
 *   accuracy  ≥ 0.65 → up  |  ≤ 0.50 → down  |  otherwise → neutral
 *   streak    ≥ 3    → up  |  === 0   → down  |  otherwise → neutral
 *
 * Returns true only when both are non-neutral and equal.
 */
function _signalsCoherent(accuracy, streak) {
    const accDir   = accuracy >= 0.65 ? 'up' : accuracy <= 0.50 ? 'down' : 'neutral';
    const streakDir = streak  >= 3    ? 'up' : streak  === 0    ? 'down' : 'neutral';
    return accDir !== 'neutral' && streakDir !== 'neutral' && accDir === streakDir;
}

// ── Validation ──────────────────────────────────────────────────────────────

const _VALID_DIFFICULTIES = new Set(['beginner', 'intermediate', 'advanced']);
const _VALID_SOURCES      = new Set(['quiz', 'flashcard', 'exam']);

function _validate(signals) {
    if (!signals || typeof signals !== 'object' || Array.isArray(signals)) {
        throw new TypeError('signals must be a plain object');
    }

    const numericRequired = ['accuracy', 'recentAccuracy', 'streak', 'totalAttempts'];
    for (const field of numericRequired) {
        if (typeof signals[field] !== 'number' || !isFinite(signals[field])) {
            throw new TypeError(`signals.${field} must be a finite number`);
        }
    }

    if (!_VALID_DIFFICULTIES.has(signals.currentDifficulty)) {
        throw new TypeError(
            `signals.currentDifficulty must be one of: ${[..._VALID_DIFFICULTIES].join(' | ')}`
        );
    }

    if (signals.source !== undefined && !_VALID_SOURCES.has(signals.source)) {
        throw new TypeError(
            `signals.source must be one of: ${[..._VALID_SOURCES].join(' | ')}`
        );
    }

    if (signals.accuracy < 0 || signals.accuracy > 1) {
        throw new RangeError('signals.accuracy must be in [0, 1]');
    }
    if (signals.recentAccuracy < 0 || signals.recentAccuracy > 1) {
        throw new RangeError('signals.recentAccuracy must be in [0, 1]');
    }
    if (signals.streak < 0) {
        throw new RangeError('signals.streak must be ≥ 0');
    }
    if (signals.totalAttempts < 0) {
        throw new RangeError('signals.totalAttempts must be ≥ 0');
    }
}

// ── Core decision functions (individually testable) ─────────────────────────

/**
 * Determine whether difficulty should increase, stay, or decrease.
 *
 * Bounds:
 *   - 'harder' is never returned when currentDifficulty === 'advanced'
 *   - 'easier' is never returned when currentDifficulty === 'beginner'
 *
 * @param {Object} signals - validated LearningSignal
 * @returns {{ value: 'easier'|'same'|'harder', reason: string }}
 */
function computeNextDifficulty(signals) {
    _validate(signals);

    const { recentAccuracy, streak, totalAttempts, currentDifficulty } = signals;
    const t = THRESHOLDS.difficulty;

    const canGoHarder = currentDifficulty !== 'advanced';
    const canGoEasier = currentDifficulty !== 'beginner';

    if (
        canGoHarder &&
        totalAttempts   >= t.harder.minAttempts &&
        streak          >= t.harder.minStreak &&
        recentAccuracy  >= t.harder.minRecentAccuracy
    ) {
        return {
            value: 'harder',
            reason: (
                `Recent accuracy ${_pct(recentAccuracy)} ≥ ${_pct(t.harder.minRecentAccuracy)} ` +
                `and streak ${streak} ≥ ${t.harder.minStreak} correct in a row ` +
                `(${totalAttempts} attempts observed)`
            ),
        };
    }

    if (canGoEasier && recentAccuracy <= t.easier.maxRecentAccuracy) {
        return {
            value: 'easier',
            reason: (
                `Recent accuracy ${_pct(recentAccuracy)} ≤ ${_pct(t.easier.maxRecentAccuracy)} ` +
                `— learner is struggling in current difficulty band`
            ),
        };
    }

    return {
        value: 'same',
        reason: (
            `Recent accuracy ${_pct(recentAccuracy)} is within the target performance band ` +
            `(${_pct(t.easier.maxRecentAccuracy)}–${_pct(t.harder.minRecentAccuracy)})`
        ),
    };
}

/**
 * Determine whether the learner should revise, review weak concepts, or continue.
 *
 * Priority: revise > review > continue
 *   revise  — overall accuracy is critically low; fundamental re-study needed
 *   review  — overall accuracy is below threshold AND multiple weak concepts identified
 *   continue — performance is adequate on both dimensions
 *
 * @param {Object} signals - validated LearningSignal
 * @returns {{ value: 'review'|'continue'|'revise', reason: string }}
 */
function computeRecommendedAction(signals) {
    _validate(signals);

    const { accuracy, weakConcepts = [] } = signals;
    const t = THRESHOLDS.action;

    if (accuracy <= t.revise.maxAccuracy) {
        return {
            value: 'revise',
            reason: (
                `Overall accuracy ${_pct(accuracy)} ≤ ${_pct(t.revise.maxAccuracy)} — ` +
                `fundamental material revision recommended before advancing`
            ),
        };
    }

    if (
        weakConcepts.length >= t.review.minWeakConcepts &&
        accuracy            <= t.review.maxAccuracy
    ) {
        return {
            value: 'review',
            reason: (
                `${weakConcepts.length} weak concept(s) identified and overall accuracy ` +
                `${_pct(accuracy)} ≤ ${_pct(t.review.maxAccuracy)} — ` +
                `targeted concept review recommended`
            ),
        };
    }

    return {
        value: 'continue',
        reason: (
            `Overall accuracy ${_pct(accuracy)} is adequate ` +
            `with ${weakConcepts.length} weak concept(s) — continue on current path`
        ),
    };
}

/**
 * Compute a confidence score for the current decision in [0.05, 0.95].
 *
 * Three weighted factors + optional coherence bonus:
 *   1. Attempt saturation (40 %) — data quantity; saturates at fullDataAttempts
 *   2. Overall accuracy   (35 %) — performance quality
 *   3. Streak saturation  (25 %) — consistency; saturates at maxStreakForFullScore
 *   4. Coherence bonus   (+10 %) — when accuracy and streak directions agree
 *
 * Using all three prevents a low-accuracy learner from reaching high confidence
 * simply by answering many questions, and prevents a short streak on few attempts
 * from spiking confidence unrealistically.
 *
 * @param {Object} signals - validated LearningSignal
 * @returns {number}
 */
function computeConfidenceScore(signals) {
    _validate(signals);

    const { accuracy, recentAccuracy, streak, totalAttempts } = signals;
    const t = THRESHOLDS.confidence;

    const attemptFactor  = Math.min(1.0, totalAttempts / t.fullDataAttempts);
    const streakFactor   = Math.min(1.0, streak / t.maxStreakForFullScore);
    const coherenceBonus = _signalsCoherent(recentAccuracy, streak) ? t.coherenceBonus : 0;

    const raw =
        attemptFactor * t.attemptWeight  +
        accuracy      * t.accuracyWeight +
        streakFactor  * t.streakWeight   +
        coherenceBonus;

    return _clamp(parseFloat(raw.toFixed(3)), t.min, t.max);
}

/**
 * Extract weak areas from signals.
 * Returns a deduplicated, sorted copy — deterministic for the same input.
 *
 * @param {Object} signals - validated LearningSignal
 * @returns {string[]}
 */
function computeWeakAreas(signals) {
    _validate(signals);
    const raw = Array.isArray(signals.weakConcepts) ? signals.weakConcepts : [];
    return [...new Set(raw)].sort();
}

/**
 * Build an ordered list of concepts to study next.
 *
 * Two queues are built from conceptMastery:
 *   urgent — DUE (spacedRepStatus === 'DUE') OR weak (masteryScore < WEAK_THRESHOLD)
 *   strong — masteryScore > STRONG_THRESHOLD, for spaced reinforcement
 *
 * Sorting:
 *   urgent: retentionScore asc  (lowest = most forgotten = highest priority)
 *   strong: masteryScore desc   (highest mastery = most efficient to reinforce)
 *
 * Learner archetype adjusts the urgent/strong split:
 *   STRUGGLING   → 85 % urgent  (more remediation)
 *   FAST_LEARNER → 60 % urgent  (more reinforcement / advancement)
 *   others       → 70 % urgent  (default)
 *
 * The final list interleaves 2 urgent : 1 strong so reinforcement is
 * distributed evenly throughout rather than piled at the end.
 *
 * @param {Object} [conceptMastery]   - profile.conceptMastery with retentionScore + spacedRepStatus
 * @param {string} [learnerArchetype] - one of LEARNER_ARCHETYPE values
 * @returns {string[]} ordered concept names, length ≤ MAX_REVIEW_CONCEPTS
 */
function computeReviewConcepts(conceptMastery, learnerArchetype) {
    if (!conceptMastery || typeof conceptMastery !== 'object') return [];

    const t = THRESHOLDS.recommendation;

    const weakDueWeight =
        learnerArchetype === LEARNER_ARCHETYPE.STRUGGLING   ? t.WEAK_DUE_WEIGHT_STRUGGLING :
        learnerArchetype === LEARNER_ARCHETYPE.FAST_LEARNER ? t.WEAK_DUE_WEIGHT_FAST       :
        t.WEAK_DUE_WEIGHT;

    const urgent = [];
    const strong = [];

    for (const [concept, data] of Object.entries(conceptMastery)) {
        const isDue    = data.spacedRepStatus === SPACED_REP_STATUS.DUE;
        const isWeak   = data.masteryScore < t.WEAK_THRESHOLD;
        const isStrong = data.masteryScore > t.STRONG_THRESHOLD;

        if (isDue || isWeak) {
            urgent.push({ concept, retentionScore: data.retentionScore ?? 0, masteryScore: data.masteryScore });
        } else if (isStrong) {
            strong.push({ concept, masteryScore: data.masteryScore });
        }
    }

    // Most forgotten (lowest retention) first
    urgent.sort((a, b) => (a.retentionScore ?? 0) - (b.retentionScore ?? 0));
    // Best-retained strong concepts first (most efficient reinforcement)
    strong.sort((a, b) => b.masteryScore - a.masteryScore);

    const totalSlots  = Math.min(t.MAX_REVIEW_CONCEPTS, urgent.length + strong.length);
    if (totalSlots === 0) return [];

    const urgentSlots = Math.round(totalSlots * weakDueWeight);
    const strongSlots = totalSlots - urgentSlots;

    const urgentNames = urgent.slice(0, Math.max(urgentSlots, urgent.length > 0 ? 1 : 0)).map(e => e.concept);
    const strongNames = strong.slice(0, Math.max(strongSlots, strong.length > 0 && urgentSlots < totalSlots ? 1 : 0)).map(e => e.concept);

    // Interleave 2 urgent : 1 strong so the balance is visible throughout the list
    const result = [];
    let ui = 0;
    let si = 0;
    while (result.length < totalSlots) {
        if (ui < urgentNames.length) result.push(urgentNames[ui++]);
        if (ui < urgentNames.length && result.length < totalSlots) result.push(urgentNames[ui++]);
        if (si < strongNames.length && result.length < totalSlots) result.push(strongNames[si++]);
        if (ui >= urgentNames.length && si >= strongNames.length) break;
    }
    return result;
}

// ── Main entry point ────────────────────────────────────────────────────────

/**
 * Run all decision functions and return a single DecisionResult.
 *
 * This is the primary API for callers that do not need to run sub-decisions
 * independently. All sub-functions are also exported for unit testing.
 *
 * @param {Object} signals - LearningSignal (see module-level JSDoc)
 * @returns {DecisionResult}
 */
function decide(signals) {
    _validate(signals);

    const difficulty      = computeNextDifficulty(signals);
    const action          = computeRecommendedAction(signals);
    const confidenceScore = computeConfidenceScore(signals);
    const weakAreas       = computeWeakAreas(signals);
    const coherent        = _signalsCoherent(signals.recentAccuracy, signals.streak);
    const reviewConcepts  = computeReviewConcepts(signals.conceptMastery, signals.learnerArchetype);

    return {
        nextDifficulty:         difficulty.value,
        recommendedAction:      action.value,
        recommendedNextConcept: reviewConcepts[0] ?? null,
        reviewConcepts,
        weakAreas,
        confidenceScore,
        explanation: {
            difficulty: difficulty.reason,
            action:     action.reason,
            confidence: (
                `Confidence based on ${signals.totalAttempts} attempt(s); ` +
                `signals are ${coherent ? 'coherent (accuracy and streak agree)' : 'mixed (accuracy and streak disagree)'}`
            ),
        },
    };
}

// ── Formatting helper (module-private) ──────────────────────────────────────

function _pct(ratio) {
    return `${Math.round(ratio * 100)}%`;
}

// ── Exports ─────────────────────────────────────────────────────────────────

export const adaptiveDecisionEngine = {
    // Primary API
    decide,

    // Sub-decisions — individually callable for testing and academic reporting
    computeNextDifficulty,
    computeRecommendedAction,
    computeConfidenceScore,
    computeWeakAreas,
    computeReviewConcepts,

    // Exported for transparency in tests and reports
    THRESHOLDS,
};
