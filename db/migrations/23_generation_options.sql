-- 23_generation_options.sql
-- Adds a generation_options JSONB column to materials for analytics tracking.
-- Stores difficulty, summary_mode, and other generation parameters at creation time.

ALTER TABLE materials ADD COLUMN IF NOT EXISTS generation_options JSONB;

COMMENT ON COLUMN materials.generation_options IS
    'Stores the generation parameters used (difficulty, summary_mode, count, etc.) for analytics.';

CREATE INDEX IF NOT EXISTS idx_materials_gen_options ON materials USING GIN (generation_options)
    WHERE generation_options IS NOT NULL;
