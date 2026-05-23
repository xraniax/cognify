-- 25_adaptive_exams.sql
-- Add batch_index and mode to support adaptive exams
ALTER TABLE exam_attempts 
  ADD COLUMN IF NOT EXISTS batch_index INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mode VARCHAR(16) DEFAULT 'static';
