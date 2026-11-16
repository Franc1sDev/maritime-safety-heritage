-- Sign in with Google and Apple. Each account can be linked to one Google and one Apple identity.
-- password_set is false for accounts made through Google or Apple until the person chooses a password.
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS apple_sub text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_set boolean NOT NULL DEFAULT true;
CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_idx ON users (google_sub) WHERE google_sub IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_apple_sub_idx ON users (apple_sub) WHERE apple_sub IS NOT NULL;
