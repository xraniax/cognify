-- 06_harden_job_lifecycle.sql
-- Adds fields for robust job tracking and observability

-- Keep status as VARCHAR to avoid type-casting drift across environments.
-- Ensure key lifecycle columns exist and normalize legacy values.
ALTER TABLE materials
ADD COLUMN IF NOT EXISTS status VARCHAR(20),
ADD COLUMN IF NOT EXISTS error_message TEXT,
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

ALTER TABLE materials ALTER COLUMN status SET DEFAULT 'PENDING_JOB';

UPDATE materials
SET status = 'COMPLETED'
WHERE status IS NULL OR UPPER(status) = 'PENDING';
