-- Development Master Plan (v1.2): the archive becomes an open-access, story-centred platform.
-- The earlier catalogue tables held sample content only, so they are replaced, not converted.

DROP TABLE IF EXISTS record_views, record_subjects, transcript_segments, submissions, messages, media_files, records, subjects, water_bodies, notifications CASCADE;
DROP SEQUENCE IF EXISTS record_identifier_seq, submission_reference_seq;
DELETE FROM media_chunks; DELETE FROM media_objects;

CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- PostGIS adds faster map queries where the server has it; the platform also works without it.
DO $$ BEGIN CREATE EXTENSION IF NOT EXISTS postgis; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'PostGIS not available; using latitude and longitude columns.'; END $$;

-- ---------- Accounts ----------
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE users ALTER COLUMN role TYPE text, ALTER COLUMN status TYPE text, ALTER COLUMN name TYPE text;
UPDATE users SET role = CASE role WHEN 'admin' THEN 'super_admin' WHEN 'editor' THEN 'admin' ELSE 'contributor' END;
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'contributor';
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('contributor','admin','super_admin'));
ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('active','warned','suspended','deleted','pending','declined','removed'));
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'password',
  ADD COLUMN IF NOT EXISTS provider_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS provider_picture text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS use_provider_identity boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS avatar text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS photo_media_id uuid,
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS profile_complete boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepted_terms_at timestamptz,
  ADD COLUMN IF NOT EXISTS age_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended_until timestamptz,
  ADD COLUMN IF NOT EXISTS status_reason text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS deletion_reason text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS purge_at timestamptz,
  ADD COLUMN IF NOT EXISTS warnings int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trained boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
UPDATE users SET username = lower(regexp_replace(split_part(email, '@', 1), '[^a-zA-Z0-9_]', '_', 'g')) || '_' || substr(id::text, 1, 4) WHERE username IS NULL AND role = 'contributor';
UPDATE users SET profile_complete = true WHERE role <> 'contributor';
CREATE UNIQUE INDEX IF NOT EXISTS users_username_key ON users (lower(username)) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_username_trgm ON users USING gin (username gin_trgm_ops);

CREATE SEQUENCE IF NOT EXISTS admin_code_seq START 1;
CREATE TABLE admin_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  admin_name text NOT NULL,
  admin_code text NOT NULL UNIQUE DEFAULT ('ADM-' || lpad(nextval('admin_code_seq')::text, 4, '0')),
  staff_number text NOT NULL DEFAULT '',
  id_number_enc text,
  phone text NOT NULL DEFAULT '',
  email_verified boolean NOT NULL DEFAULT false,
  phone_verified boolean NOT NULL DEFAULT false,
  mfa_secret_enc text,
  mfa_totp_enabled boolean NOT NULL DEFAULT false,
  invited_by uuid,
  invite_token_hash text,
  invite_expires_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO admin_profiles (user_id, admin_name, email_verified, approved_at)
  SELECT id, 'Admin – ' || split_part(name, ' ', 1), true, now() FROM users WHERE role IN ('admin','super_admin');

CREATE TABLE mfa_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel text NOT NULL,
  code_hash text NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mfa_codes_user_idx ON mfa_codes (user_id, created_at DESC);

CREATE TABLE follows (
  follower_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id)
);
CREATE INDEX follows_followee_idx ON follows (followee_id);

CREATE TABLE blocks (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('block','mute')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, target_id, kind)
);
CREATE INDEX blocks_target_idx ON blocks (target_id) WHERE kind = 'block';

CREATE TABLE push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('android','ios','web')),
  token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
CREATE UNIQUE INDEX push_tokens_token_key ON push_tokens (md5(token));
CREATE INDEX push_tokens_user_idx ON push_tokens (user_id);

-- ---------- Places and incidents ----------
CREATE TABLE places (
  id serial PRIMARY KEY,
  name text NOT NULL,
  alt_names text[] NOT NULL DEFAULT '{}',
  type text NOT NULL DEFAULT 'town',
  county text NOT NULL DEFAULT '',
  water_body text NOT NULL DEFAULT '',
  latitude numeric(9,6),
  longitude numeric(9,6),
  search text NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX places_name_key ON places (lower(name));
CREATE INDEX places_search_trgm ON places USING gin (search gin_trgm_ops);

CREATE SEQUENCE incident_code_seq START 1;
CREATE TABLE incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE DEFAULT ('INC-' || lpad(nextval('incident_code_seq')::text, 4, '0')),
  title text NOT NULL,
  event_date date,
  date_approximate boolean NOT NULL DEFAULT false,
  place_id int REFERENCES places(id) ON DELETE SET NULL,
  place_name text NOT NULL DEFAULT '',
  latitude numeric(9,6),
  longitude numeric(9,6),
  water_body text NOT NULL DEFAULT '',
  vessel text NOT NULL DEFAULT '',
  incident_type text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  outcome text NOT NULL DEFAULT '',
  sources text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('suggested','draft','published','declined')),
  suggested_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX incidents_title_trgm ON incidents USING gin (title gin_trgm_ops);

-- ---------- Stories ----------
CREATE SEQUENCE story_code_seq START 1;
CREATE TABLE import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposer_id uuid REFERENCES users(id) ON DELETE SET NULL,
  spreadsheet_name text NOT NULL DEFAULT '',
  rows jsonb NOT NULL DEFAULT '[]',
  ready int NOT NULL DEFAULT 0,
  need_attention int NOT NULL DEFAULT 0,
  items_created int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'checked' CHECK (status IN ('checked','submitted','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE DEFAULT ('MS-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('story_code_seq')::text, 5, '0')),
  type text NOT NULL DEFAULT 'community' CHECK (type IN ('community','testimony','record')),
  author_id uuid REFERENCES users(id) ON DELETE SET NULL,
  posted_as text NOT NULL DEFAULT 'self' CHECK (posted_as IN ('self','told_by','anonymous','company')),
  told_by text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  language text NOT NULL DEFAULT 'en',
  incident_id uuid REFERENCES incidents(id) ON DELETE SET NULL,
  place_id int REFERENCES places(id) ON DELETE SET NULL,
  place_name text NOT NULL DEFAULT '',
  latitude numeric(9,6),
  longitude numeric(9,6),
  county text NOT NULL DEFAULT '',
  water_body text NOT NULL DEFAULT '',
  event_date date,
  date_approximate boolean NOT NULL DEFAULT false,
  category text NOT NULL DEFAULT '',
  vessel text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  rights text NOT NULL DEFAULT 'All rights reserved',
  allow_download boolean NOT NULL DEFAULT true,
  sensitive boolean NOT NULL DEFAULT false,
  consent_confirmed boolean NOT NULL DEFAULT false,
  validated boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','reviewing','pending_review','published','blocked','removed','deleted','awaiting_approval','awaiting_validation')),
  ai_flag text CHECK (ai_flag IN ('GREEN','YELLOW','RED')),
  ai_score numeric(5,2),
  ai_explanation jsonb,
  ai_overridden boolean NOT NULL DEFAULT false,
  pending_edit jsonb,
  removed_reason text NOT NULL DEFAULT '',
  removed_by uuid,
  comments_locked boolean NOT NULL DEFAULT false,
  comments_locked_reason text NOT NULL DEFAULT '',
  comments_hidden boolean NOT NULL DEFAULT false,
  comments_hidden_reason text NOT NULL DEFAULT '',
  hearts int NOT NULL DEFAULT 0,
  heartbreaks int NOT NULL DEFAULT 0,
  laughs int NOT NULL DEFAULT 0,
  comment_count int NOT NULL DEFAULT 0,
  share_count int NOT NULL DEFAULT 0,
  link_count int NOT NULL DEFAULT 0,
  favourite_count int NOT NULL DEFAULT 0,
  view_count int NOT NULL DEFAULT 0,
  download_count int NOT NULL DEFAULT 0,
  trending_score double precision NOT NULL DEFAULT 0,
  edit_history jsonb NOT NULL DEFAULT '[]',
  edited_at timestamptz,
  import_batch_id uuid REFERENCES import_batches(id) ON DELETE SET NULL,
  idempotency_key text,
  published_at timestamptz,
  deleted_at timestamptz,
  purge_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  transcript_text text NOT NULL DEFAULT '',
  search tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(place_name, '') || ' ' || coalesce(vessel, '') || ' ' || coalesce(category, '') || ' ' || coalesce(county, '') || ' ' || coalesce(water_body, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(body, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(transcript_text, '')), 'D')
  ) STORED
);
CREATE INDEX stories_feed_idx ON stories (trending_score DESC, id) WHERE status = 'published';
CREATE INDEX stories_recent_idx ON stories (published_at DESC, id) WHERE status = 'published';
CREATE INDEX stories_author_idx ON stories (author_id, created_at DESC);
CREATE INDEX stories_place_idx ON stories (place_id) WHERE status = 'published';
CREATE INDEX stories_incident_idx ON stories (incident_id) WHERE status = 'published';
CREATE INDEX stories_status_idx ON stories (status, created_at DESC);
CREATE INDEX stories_search_idx ON stories USING gin (search);
CREATE INDEX stories_body_trgm ON stories USING gin ((title || ' ' || place_name) gin_trgm_ops);
CREATE INDEX stories_geo_idx ON stories (latitude, longitude) WHERE status = 'published' AND latitude IS NOT NULL;
CREATE UNIQUE INDEX stories_idem_key ON stories (author_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX stories_purge_idx ON stories (purge_at) WHERE purge_at IS NOT NULL;

CREATE TABLE record_sources (
  story_id uuid PRIMARY KEY REFERENCES stories(id) ON DELETE CASCADE,
  institution text NOT NULL DEFAULT '',
  reference text NOT NULL DEFAULT '',
  original_date text NOT NULL DEFAULT '',
  creator text NOT NULL DEFAULT '',
  rights_statement text NOT NULL DEFAULT '',
  obtained text NOT NULL DEFAULT ''
);

CREATE TABLE consent_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL UNIQUE REFERENCES stories(id) ON DELETE CASCADE,
  storyteller text NOT NULL DEFAULT '',
  consent_type text NOT NULL DEFAULT '',
  consent_date date,
  form_media_id uuid,
  restrictions jsonb NOT NULL DEFAULT '{}',
  validated_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  author_id uuid REFERENCES users(id) ON DELETE SET NULL,
  parent_id uuid REFERENCES comments(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '',
  language text NOT NULL DEFAULT '',
  mentions uuid[] NOT NULL DEFAULT '{}',
  reaction_count int NOT NULL DEFAULT 0,
  ai_flag text,
  ai_explanation jsonb,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('reviewing','published','pending_review','blocked','deleted')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX comments_story_idx ON comments (story_id, created_at);

CREATE TABLE comment_reactions (
  comment_id uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('heart','heartbreak','laugh')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);

CREATE TABLE reactions (
  story_id uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('heart','heartbreak','laugh')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, user_id)
);
CREATE TABLE favourites (
  story_id uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, story_id)
);
CREATE TABLE shares (
  id bigserial PRIMARY KEY,
  story_id uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('share','copy_link','cite','download')),
  target text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shares_story_idx ON shares (story_id);
CREATE TABLE story_views (
  id bigserial PRIMARY KEY,
  story_id uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id uuid,
  visitor text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX story_views_story_idx ON story_views (story_id, created_at);

CREATE TABLE media_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES users(id) ON DELETE SET NULL,
  story_id uuid REFERENCES stories(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES comments(id) ON DELETE CASCADE,
  message_id uuid,
  purpose text NOT NULL DEFAULT 'story',
  kind text NOT NULL CHECK (kind IN ('image','video','audio','document')),
  position int NOT NULL DEFAULT 0,
  storage_key text NOT NULL UNIQUE,
  original_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  sha256 text NOT NULL,
  encrypted boolean NOT NULL DEFAULT false,
  width int, height int,
  duration_seconds int,
  variants jsonb NOT NULL DEFAULT '{}',
  alt_text text NOT NULL DEFAULT '',
  transcript text NOT NULL DEFAULT '',
  transcript_segments jsonb,
  scan_result text NOT NULL DEFAULT 'not_scanned',
  processing text NOT NULL DEFAULT 'done' CHECK (processing IN ('queued','working','done','failed')),
  checksum_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX media_files_story_idx ON media_files (story_id, position);
CREATE INDEX media_files_owner_idx ON media_files (owner_id, created_at DESC);

-- ---------- Moderation, reports, approvals ----------
CREATE TABLE moderation_decisions (
  id bigserial PRIMARY KEY,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  ai_flag text,
  ai_score numeric(5,2),
  ai_explanation jsonb,
  model text NOT NULL DEFAULT '',
  guidance_version text NOT NULL DEFAULT '',
  admin_action text NOT NULL DEFAULT '',
  reason text NOT NULL DEFAULT '',
  admin_id uuid,
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX moderation_target_idx ON moderation_decisions (target_type, target_id, created_at DESC);

CREATE TABLE reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid REFERENCES users(id) ON DELETE SET NULL,
  target_type text NOT NULL CHECK (target_type IN ('story','user','comment')),
  target_id uuid NOT NULL,
  reasons text[] NOT NULL DEFAULT '{}',
  description text NOT NULL DEFAULT '',
  urgent boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  action text NOT NULL DEFAULT '',
  notes jsonb NOT NULL DEFAULT '[]',
  handled_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reports_open_idx ON reports (status, created_at);
CREATE INDEX reports_target_idx ON reports (target_type, target_id);

CREATE TABLE approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('override','company_story','collection','account_deletion','import_batch')),
  target_id uuid NOT NULL,
  title text NOT NULL DEFAULT '',
  proposer_id uuid REFERENCES users(id) ON DELETE SET NULL,
  justification text NOT NULL DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','changes_requested','overdue')),
  deadline timestamptz,
  decided_at timestamptz,
  decided_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX approval_requests_status_idx ON approval_requests (status, created_at);
CREATE TABLE approval_votes (
  request_id uuid NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
  admin_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote text NOT NULL CHECK (vote IN ('approve','reject','changes')),
  justification text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (request_id, admin_id)
);

-- ---------- Inbox, announcements, notifications ----------
CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'direct' CHECK (kind IN ('direct','issue')),
  topic text NOT NULL DEFAULT '',
  issue_type text NOT NULL DEFAULT '',
  issue_ref text NOT NULL DEFAULT '',
  with_admins boolean NOT NULL DEFAULT false,
  direct_key text UNIQUE,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE conversation_members (
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_request boolean NOT NULL DEFAULT false,
  last_read_at timestamptz,
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX conversation_members_user_idx ON conversation_members (user_id);
CREATE TABLE dm_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES users(id) ON DELETE SET NULL,
  system boolean NOT NULL DEFAULT false,
  body text NOT NULL DEFAULT '',
  ai_flag text,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','held','deleted')),
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dm_messages_conv_idx ON dm_messages (conversation_id, created_at);
CREATE UNIQUE INDEX dm_messages_idem_key ON dm_messages (sender_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
ALTER TABLE media_files ADD CONSTRAINT media_files_message_fk FOREIGN KEY (message_id) REFERENCES dm_messages(id) ON DELETE CASCADE;

CREATE TABLE announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  dates jsonb NOT NULL DEFAULT '[]',
  send_push boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  sort_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX announcements_sort_idx ON announcements (sort_at DESC) WHERE deleted_at IS NULL;
CREATE TABLE announcement_reads (
  announcement_id uuid NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, user_id)
);

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  link text NOT NULL DEFAULT '',
  data jsonb NOT NULL DEFAULT '{}',
  priority boolean NOT NULL DEFAULT false,
  action_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  done_at timestamptz
);
CREATE INDEX notifications_user_idx ON notifications (user_id, created_at DESC);
CREATE INDEX notifications_action_idx ON notifications (action_key) WHERE done_at IS NULL;

-- ---------- Collections, resources, safety concerns, feedback ----------
CREATE TABLE collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'collection' CHECK (kind IN ('collection','exhibition')),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  cover_media_id uuid,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','awaiting_approval','published','rejected')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE collection_items (
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  story_id uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  note text NOT NULL DEFAULT '',
  PRIMARY KEY (collection_id, story_id)
);

CREATE TABLE resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  type text NOT NULL CHECK (type IN ('policy_brief','learning_summary','educational_material','handbook','exhibition')),
  summary text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  media_id uuid,
  collection_id uuid REFERENCES collections(id) ON DELETE SET NULL,
  audience text NOT NULL DEFAULT '',
  language text NOT NULL DEFAULT 'en',
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published')),
  published_at timestamptz DEFAULT now(),
  views int NOT NULL DEFAULT 0,
  downloads int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE SEQUENCE safety_concern_seq START 1;
CREATE TABLE safety_concerns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE DEFAULT ('SC-' || lpad(nextval('safety_concern_seq')::text, 5, '0')),
  reporter_id uuid REFERENCES users(id) ON DELETE SET NULL,
  contact text NOT NULL DEFAULT '',
  place_name text NOT NULL DEFAULT '',
  latitude numeric(9,6),
  longitude numeric(9,6),
  description text NOT NULL,
  photo_media_id uuid,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','acknowledged','referred','closed')),
  notes jsonb NOT NULL DEFAULT '[]',
  referral text NOT NULL DEFAULT '',
  share_identity boolean NOT NULL DEFAULT false,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX safety_concerns_status_idx ON safety_concerns (status, created_at);

CREATE TABLE feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- Analytics (kept apart from the main data) ----------
CREATE TABLE analytics_events (
  id bigserial PRIMARY KEY,
  type text NOT NULL,
  story_id uuid,
  actor text NOT NULL DEFAULT '',
  actor_type text NOT NULL DEFAULT 'visitor',
  meta jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX analytics_events_type_idx ON analytics_events (type, created_at);
CREATE TABLE analytics_daily (
  day date NOT NULL,
  metric text NOT NULL,
  value bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (day, metric)
);
CREATE TABLE analytics_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  period_from date NOT NULL,
  period_to date NOT NULL,
  charts text[] NOT NULL DEFAULT '{}',
  automatic boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'generating' CHECK (status IN ('generating','ready','failed')),
  narrative text NOT NULL DEFAULT '',
  media_id uuid,
  requested_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- Translations, exports, background jobs ----------
CREATE TABLE content_translations (
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  language text NOT NULL,
  source_hash text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (target_type, target_id, language)
);
CREATE TABLE data_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'my_data',
  status text NOT NULL DEFAULT 'preparing' CHECK (status IN ('preparing','ready','failed')),
  media_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE jobs (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','working','done','failed')),
  attempts int NOT NULL DEFAULT 0,
  progress int NOT NULL DEFAULT 0,
  error text NOT NULL DEFAULT '',
  run_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX jobs_queue_idx ON jobs (status, run_at) WHERE status = 'queued';
CREATE TABLE ai_usage (
  day date NOT NULL,
  task text NOT NULL,
  calls int NOT NULL DEFAULT 0,
  PRIMARY KEY (day, task)
);
CREATE TABLE app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL
);

-- ---------- Audit log: permanent and unchangeable ----------
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS reason text NOT NULL DEFAULT '';
-- The log keeps the actor's id as a plain value, so erasing an account never rewrites history.
ALTER TABLE activity_log DROP CONSTRAINT IF EXISTS activity_log_actor_id_fkey;
ALTER TABLE activity_log ALTER COLUMN action TYPE text, ALTER COLUMN entity_type TYPE text, ALTER COLUMN summary TYPE text, ALTER COLUMN actor_name TYPE text;
CREATE OR REPLACE FUNCTION audit_log_is_append_only() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'The audit log cannot be edited or deleted.'; END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS activity_log_append_only ON activity_log;
CREATE TRIGGER activity_log_append_only BEFORE UPDATE OR DELETE ON activity_log FOR EACH ROW EXECUTE FUNCTION audit_log_is_append_only();
CREATE INDEX IF NOT EXISTS activity_log_actor_idx ON activity_log (actor_id, created_at DESC);
