-- 23_goal_plans.sql
-- Fix study_sessions schema + persistent study plans per user

-- Fix: duration_minutes had no DEFAULT, causing StudySession.start() to fail
-- with a NOT NULL constraint violation on every session insert.
ALTER TABLE study_sessions
    ALTER COLUMN duration_minutes SET DEFAULT 0;

-- Store the latest AI-generated study plan per user.
-- ON CONFLICT (user_id) DO UPDATE lets us upsert cleanly.
CREATE TABLE IF NOT EXISTS user_study_plans (
    id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_data     JSONB       NOT NULL,
    generated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_study_plans_user ON user_study_plans(user_id);
