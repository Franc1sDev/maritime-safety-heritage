-- Editors, encrypted media and account deletion.

-- Editors catalogue and review content; only admins manage people, messages and reports.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('user','editor','admin'));

-- Deleted accounts are kept as anonymous rows so archive history stays intact.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('active','suspended','deleted'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Files stored after this migration are encrypted at rest (AES-256-CTR, IV in the first 16 bytes).
ALTER TABLE media_files ADD COLUMN IF NOT EXISTS encrypted boolean NOT NULL DEFAULT false;
