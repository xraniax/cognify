-- Fix: 'UNVERIFIED' was used by the application for new local registrations
-- but was never added to the users_status_check constraint, causing all
-- registrations to fail with a constraint violation.
-- Also adds the verification_token_hash / expires columns that the auth
-- controller writes to but that were never added to the schema.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS verification_token_hash TEXT,
    ADD COLUMN IF NOT EXISTS verification_token_expires TIMESTAMPTZ;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;

ALTER TABLE users
    ADD CONSTRAINT users_status_check
    CHECK (status IN ('ACTIVE', 'SUSPENDED', 'DELETED', 'UNVERIFIED'));
