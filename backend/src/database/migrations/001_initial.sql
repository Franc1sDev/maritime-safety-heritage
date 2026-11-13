-- Maritime Safety Heritage Archive: initial schema.
-- Applied once by `npm run migrate`; tracked in schema_migrations.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SEQUENCE IF NOT EXISTS record_identifier_seq START 1;
CREATE SEQUENCE IF NOT EXISTS submission_reference_seq START 1;

CREATE TABLE users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           varchar(120) NOT NULL,
  email          varchar(254) NOT NULL,
  password_hash  varchar(255) NOT NULL,
  role           varchar(10)  NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  status         varchar(12)  NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  organisation   varchar(160) NOT NULL DEFAULT '',
  failed_logins  integer      NOT NULL DEFAULT 0,
  locked_until   timestamptz,
  last_login_at  timestamptz,
  created_at     timestamptz  NOT NULL DEFAULT now(),
  updated_at     timestamptz  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_key ON users (email);

CREATE TABLE refresh_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  varchar(128) NOT NULL,
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  user_agent  varchar(300) NOT NULL DEFAULT '',
  ip          varchar(64)  NOT NULL DEFAULT '',
  created_at  timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id);
CREATE UNIQUE INDEX refresh_tokens_hash_key ON refresh_tokens (token_hash);

CREATE TABLE password_reset_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  varchar(128) NOT NULL,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX password_reset_tokens_hash_key ON password_reset_tokens (token_hash);

CREATE TABLE water_bodies (
  id         serial PRIMARY KEY,
  name       varchar(120) NOT NULL,
  kind       varchar(10)  NOT NULL CHECK (kind IN ('ocean','lake','river')),
  latitude   numeric(9,6),
  longitude  numeric(9,6)
);
CREATE UNIQUE INDEX water_bodies_name_key ON water_bodies (name);

CREATE TABLE subjects (
  id     serial PRIMARY KEY,
  slug   varchar(80)  NOT NULL,
  label  varchar(120) NOT NULL
);
CREATE UNIQUE INDEX subjects_slug_key ON subjects (slug);

CREATE TABLE records (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier         varchar(20) NOT NULL DEFAULT ('MSH-' || lpad(nextval('record_identifier_seq')::text, 4, '0')),
  type               varchar(12) NOT NULL CHECK (type IN ('oral','photo','record','testimony')),
  format             varchar(12) NOT NULL CHECK (format IN ('audio','video','image','document','text')),
  title              varchar(300) NOT NULL,
  summary            text NOT NULL DEFAULT '',
  body               text,
  year               integer CHECK (year IS NULL OR year BETWEEN 1800 AND 2200),
  year_approximate   boolean NOT NULL DEFAULT false,
  water_body_id      integer REFERENCES water_bodies(id) ON DELETE SET NULL,
  county             varchar(80)  NOT NULL DEFAULT '',
  place              varchar(200) NOT NULL DEFAULT '',
  latitude           numeric(9,6) CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  longitude          numeric(9,6) CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  creator            varchar(200) NOT NULL DEFAULT '',
  narrator           varchar(200) NOT NULL DEFAULT '',
  interviewer        varchar(200) NOT NULL DEFAULT '',
  photographer       varchar(200) NOT NULL DEFAULT '',
  language           varchar(120) NOT NULL DEFAULT '',
  rights             varchar(200) NOT NULL DEFAULT '',
  consent            varchar(300) NOT NULL DEFAULT '',
  duration_seconds   integer CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  status             varchar(12) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','unpublished')),
  views              integer NOT NULL DEFAULT 0,
  -- Subject labels, transcript text and names, refreshed by the API on every save.
  search_text        text NOT NULL DEFAULT '',
  search             tsvector GENERATED ALWAYS AS (
                       setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
                       setweight(to_tsvector('simple', coalesce(summary, '')), 'B') ||
                       setweight(to_tsvector('simple', coalesce(body, '') || ' ' || place || ' ' || county || ' ' || search_text), 'C')
                     ) STORED,
  created_by_id      uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by_id      uuid REFERENCES users(id) ON DELETE SET NULL,
  published_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz
);
CREATE UNIQUE INDEX records_identifier_key ON records (identifier);
CREATE INDEX records_search_idx ON records USING gin (search);
CREATE INDEX records_status_idx ON records (status) WHERE deleted_at IS NULL;
CREATE INDEX records_type_idx ON records (type);
CREATE INDEX records_water_body_idx ON records (water_body_id);
CREATE INDEX records_year_idx ON records (year);

CREATE TABLE record_subjects (
  record_id   uuid    NOT NULL REFERENCES records(id) ON DELETE CASCADE,
  subject_id  integer NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  PRIMARY KEY (record_id, subject_id)
);
CREATE INDEX record_subjects_subject_idx ON record_subjects (subject_id);

CREATE TABLE transcript_segments (
  id             serial PRIMARY KEY,
  record_id      uuid    NOT NULL REFERENCES records(id) ON DELETE CASCADE,
  position       integer NOT NULL,
  start_seconds  integer NOT NULL CHECK (start_seconds >= 0),
  text           text    NOT NULL
);
CREATE INDEX transcript_segments_record_idx ON transcript_segments (record_id, position);

CREATE TABLE submissions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference          varchar(20) NOT NULL DEFAULT ('SUB-' || lpad(nextval('submission_reference_seq')::text, 4, '0')),
  submitted_by_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type               varchar(12) NOT NULL CHECK (type IN ('oral','photo','record','testimony')),
  title              varchar(300) NOT NULL,
  description        text NOT NULL,
  year               integer CHECK (year IS NULL OR year BETWEEN 1800 AND 2200),
  water_body_id      integer REFERENCES water_bodies(id) ON DELETE SET NULL,
  place              varchar(200) NOT NULL DEFAULT '',
  consent_confirmed  boolean NOT NULL CHECK (consent_confirmed),
  status             varchar(12) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  review_note        text NOT NULL DEFAULT '',
  reviewed_by_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at        timestamptz,
  record_id          uuid REFERENCES records(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX submissions_reference_key ON submissions (reference);
CREATE INDEX submissions_status_idx ON submissions (status, created_at);
CREATE INDEX submissions_by_idx ON submissions (submitted_by_id);

CREATE TABLE media_files (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id       uuid REFERENCES records(id) ON DELETE SET NULL,
  submission_id   uuid REFERENCES submissions(id) ON DELETE SET NULL,
  role            varchar(12) NOT NULL DEFAULT 'original' CHECK (role IN ('original','web','thumbnail')),
  storage_key     varchar(300) NOT NULL,
  original_name   varchar(255) NOT NULL,
  mime_type       varchar(120) NOT NULL,
  size_bytes      bigint NOT NULL,
  sha256          char(64) NOT NULL,
  uploaded_by_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX media_files_storage_key_key ON media_files (storage_key);
CREATE INDEX media_files_record_idx ON media_files (record_id);
CREATE INDEX media_files_submission_idx ON media_files (submission_id);

CREATE TABLE messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        varchar(120) NOT NULL,
  email       varchar(254) NOT NULL,
  subject     varchar(200) NOT NULL,
  body        text NOT NULL,
  read        boolean NOT NULL DEFAULT false,
  user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_created_idx ON messages (created_at DESC);

CREATE TABLE activity_log (
  id           bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  actor_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_name   varchar(120) NOT NULL DEFAULT '',
  action       varchar(60)  NOT NULL,
  entity_type  varchar(40)  NOT NULL DEFAULT '',
  entity_id    varchar(64)  NOT NULL DEFAULT '',
  summary      varchar(400) NOT NULL DEFAULT '',
  details      jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip           varchar(64)  NOT NULL DEFAULT '',
  created_at   timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX activity_log_created_idx ON activity_log (created_at DESC);
CREATE INDEX activity_log_action_idx ON activity_log (action);

CREATE TABLE record_views (
  id         bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  record_id  uuid NOT NULL REFERENCES records(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  viewed_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX record_views_viewed_idx ON record_views (viewed_at);
CREATE INDEX record_views_record_idx ON record_views (record_id);
