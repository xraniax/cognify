/**
 * Analytics Contract Layer — single source of truth for all analytics computations.
 *
 * All mastery thresholds, SQL state fragments, time window resolvers, scale
 * conversions, score classifiers, and dashboard structural normalizers are
 * defined here and imported by analytics.service.js.  No threshold, window,
 * or scale constant is duplicated elsewhere.
 */

import { BASE_THRESHOLDS, READINESS_WEIGHTS, TREND_WEIGHTS, trendLabel } from '../analytics/index.js';

// Re-export engine constants so consumers import through one gateway
export { READINESS_WEIGHTS, TREND_WEIGHTS };

// ─── Mastery thresholds (DB scale: 0–100) ────────────────────────────────────

/** Mastery state cut-points derived from BASE_THRESHOLDS × 100.
 *  mastered ≥ 80 | developing ≥ 60 | weak ≥ 40 | critical < 40 */
export const MASTERY_THRESHOLDS = {
    MASTERED:   Math.round(BASE_THRESHOLDS.developing * 100),  // 80
    DEVELOPING: Math.round(BASE_THRESHOLDS.weak       * 100),  // 60
    WEAK:       Math.round(BASE_THRESHOLDS.critical   * 100),  // 40
};

/** Insight decay alert trigger: concepts below this score AND stale → generate alert.
 *  Midpoint between DEVELOPING and WEAK — covers concepts that are struggling but
 *  not yet fully critical.  Derived so it tracks threshold changes automatically. */
export const INSIGHT_DECAY_THRESHOLD = (MASTERY_THRESHOLDS.DEVELOPING + MASTERY_THRESHOLDS.WEAK) / 2;  // 50

// ─── SQL WHERE fragments ──────────────────────────────────────────────────────

/** SQL WHERE fragments for mastery_score state classification.
 *  Derived from MASTERY_THRESHOLDS — never hand-written elsewhere. */
export const MASTERY_STATE_SQL = {
    mastered:   `mastery_score >= ${MASTERY_THRESHOLDS.MASTERED}`,
    developing: `mastery_score >= ${MASTERY_THRESHOLDS.DEVELOPING} AND mastery_score < ${MASTERY_THRESHOLDS.MASTERED}`,
    weak:       `mastery_score >= ${MASTERY_THRESHOLDS.WEAK} AND mastery_score < ${MASTERY_THRESHOLDS.DEVELOPING}`,
    critical:   `mastery_score < ${MASTERY_THRESHOLDS.WEAK}`,
};

// ─── Time window resolvers ────────────────────────────────────────────────────

/** Resolve a 'from' parameter to a Date.  null → epoch (all-time). */
export const resolveFrom = (from) => from ? new Date(from) : new Date('1970-01-01T00:00:00Z');

/** Resolve a 'to' parameter to a Date.  null → now. */
export const resolveTo   = (to)   => to   ? new Date(to)  : new Date();

// ─── Scale conversion ─────────────────────────────────────────────────────────

/** Convert engine [0,1] score to DB [0,100] scale (1 decimal place). */
export const to100 = (v) => Math.round((v ?? 0) * 1000) / 10;

// ─── Score classifier ─────────────────────────────────────────────────────────

/** Classify a DB-scale (0–100) mastery score into a canonical state label.
 *  Uses fixed MASTERY_THRESHOLDS (confidence=1, no trend adjustment). */
export function classifyScore(score100) {
    if (score100 >= MASTERY_THRESHOLDS.MASTERED)   return 'mastered';
    if (score100 >= MASTERY_THRESHOLDS.DEVELOPING) return 'developing';
    if (score100 >= MASTERY_THRESHOLDS.WEAK)       return 'weak';
    return 'critical';
}

// ─── Dashboard structural normalizer ─────────────────────────────────────────

/**
 * Normalize a partial dashboard object into the canonical response shape.
 *
 * Guarantees:
 * - All top-level fields are present with correct defaults.
 * - meta.trend is always { value, label } — fast path uses this shape already;
 *   engine path uses { quiz, exam, combined, label } which is remapped here.
 * - Empty path (no readiness data) produces 'unstarted' / 'insufficient' defaults.
 */
export function normalizeDashboard(raw) {
    const rawTrend   = raw.meta?.trend;
    const trendValue = rawTrend?.value ?? rawTrend?.combined ?? null;

    return {
        subject: {
            id:   raw.subject?.id   ?? null,
            name: raw.subject?.name ?? null,
        },
        readiness: {
            score:              raw.readiness?.score              ?? 0,
            label:              raw.readiness?.label              ?? 'unstarted',
            confidence:         raw.readiness?.confidence         ?? 0,
            data_quality:       raw.readiness?.data_quality       ?? 'insufficient',
            snapshot_age_hours: raw.readiness?.snapshot_age_hours ?? null,
        },
        breakdown: {
            understanding: raw.breakdown?.understanding ?? null,
            retention:     raw.breakdown?.retention     ?? null,
            mastery:       raw.breakdown?.mastery       ?? null,
        },
        meta: {
            consistency:        raw.meta?.consistency        ?? null,
            trend: {
                value: trendValue,
                label: rawTrend?.label ?? trendLabel(trendValue),
            },
            total_interactions: raw.meta?.total_interactions ?? 0,
            quiz_count:         raw.meta?.quiz_count         ?? 0,
            flashcard_count:    raw.meta?.flashcard_count    ?? 0,
            exam_count:         raw.meta?.exam_count         ?? 0,
            last_activity_at:   raw.meta?.last_activity_at  ?? null,
        },
        weak_concepts:         raw.weak_concepts         ?? [],
        next_suggested_action: raw.next_suggested_action ?? null,
    };
}
