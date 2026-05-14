-- ─── 12_learner_state.sql ───────────────────────────────────────────────
-- Canonical learner state snapshot (durable mirror of Redis)

CREATE TABLE IF NOT EXISTS learner_state (
    user_id           UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    accuracy          NUMERIC(6,4) NOT NULL DEFAULT 0.5000,
    avg_response_time NUMERIC(10,4) NOT NULL DEFAULT 0.0000,
    weak_concepts     JSONB NOT NULL DEFAULT '[]'::jsonb,
    strong_concepts   JSONB NOT NULL DEFAULT '[]'::jsonb,
    mastery_score     NUMERIC(6,4),
    retention_score   NUMERIC(6,4),
    last_sync_at      TIMESTAMPTZ,
    version           INT NOT NULL DEFAULT 1,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learner_state_updated_at ON learner_state(updated_at DESC);
