-- ─── 12_global_analytics.sql ───────────────────────────────────────────────────
-- Global and subject-level aggregate snapshot tables and insights.

CREATE TABLE IF NOT EXISTS user_subject_analytics (
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id          UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    crs_score           NUMERIC(5,2),
    understanding       NUMERIC(5,2),
    retention           NUMERIC(5,2),
    mastery             NUMERIC(5,2),
    confidence          NUMERIC(5,2),
    concept_count       INT NOT NULL DEFAULT 0,
    mastered_count      INT NOT NULL DEFAULT 0,
    at_risk_count       INT NOT NULL DEFAULT 0,
    trend_7d            NUMERIC(5,2),
    last_activity_at    TIMESTAMPTZ,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, subject_id)
);

CREATE TABLE IF NOT EXISTS user_global_analytics (
    user_id              UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    overall_readiness    NUMERIC(5,2),
    momentum_score       NUMERIC(5,2),
    consistency_score    NUMERIC(5,2),
    study_streak         INT NOT NULL DEFAULT 0,
    active_days_30d      INT NOT NULL DEFAULT 0,
    strongest_subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    weakest_subject_id   UUID REFERENCES subjects(id) ON DELETE SET NULL,
    total_mastered       INT NOT NULL DEFAULT 0,
    total_at_risk        INT NOT NULL DEFAULT 0,
    global_understanding NUMERIC(5,2),
    global_retention     NUMERIC(5,2),
    global_mastery       NUMERIC(5,2),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_insights (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id   UUID REFERENCES subjects(id) ON DELETE CASCADE,
    concept_name VARCHAR(120),
    type         VARCHAR(50) NOT NULL,
    priority     INT NOT NULL,
    title        TEXT NOT NULL,
    body         TEXT NOT NULL,
    cta_label    VARCHAR(50),
    cta_action   TEXT,
    dismissed    BOOLEAN NOT NULL DEFAULT false,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_insights_user ON user_insights(user_id, dismissed);
