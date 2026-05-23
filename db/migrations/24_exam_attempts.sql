-- 24_exam_attempts.sql ─────────────────────────────────────────────────────────
-- Persists in-progress and submitted exam attempt state so answers, progress,
-- and graded results survive server restarts and page refreshes.
--
-- Design:
--   One row per (user_id, material_id). The same row is updated by autosave
--   during the attempt and then updated again on submission. Analytics go to
--   mock_exam_attempts + exam_concept_scores (unchanged).
--
-- UNIQUE (user_id, material_id): one active attempt slot per user per exam.
--   saveAttempt: upserts with WHERE submitted_at IS NULL (won't overwrite results)
--   submitExam:  upserts unconditionally (allows re-take to overwrite previous result)

CREATE TABLE IF NOT EXISTS exam_attempts (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID        NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
    material_id    UUID        NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    subject_id     UUID                 REFERENCES subjects(id)  ON DELETE SET NULL,

    -- In-progress state (written by autosave)
    current_index  SMALLINT    NOT NULL DEFAULT 0,
    answers        JSONB       NOT NULL DEFAULT '[]'::jsonb,
    flagged        JSONB       NOT NULL DEFAULT '{}'::jsonb,
    started_at     TIMESTAMPTZ,

    -- Submission result (written on submit)
    submitted_at   TIMESTAMPTZ,
    score          SMALLINT,
    max_score      SMALLINT,
    result_details JSONB,

    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (user_id, material_id)
);

CREATE INDEX IF NOT EXISTS idx_exam_attempts_user_material
    ON exam_attempts(user_id, material_id);

CREATE INDEX IF NOT EXISTS idx_exam_attempts_user_updated
    ON exam_attempts(user_id, updated_at DESC);
