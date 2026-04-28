-- 14_add_drive_file_id_to_files.sql
ALTER TABLE files ADD COLUMN IF NOT EXISTS drive_file_id VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_files_drive_file_id ON files(drive_file_id);
