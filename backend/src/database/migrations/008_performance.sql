-- Performance monitoring (Sections 9.4 and 11.8).

-- Real-user measurements from the website: how quickly pages appear and respond on people's own phones and
-- computers. No user, address or device identifier is kept: only the measure, its value, the kind of page and the
-- connection type the browser reports.
CREATE TABLE IF NOT EXISTS web_vitals (
  id         bigserial PRIMARY KEY,
  at         timestamptz NOT NULL DEFAULT now(),
  metric     varchar(8)  NOT NULL,
  value      real        NOT NULL,
  page       varchar(40) NOT NULL DEFAULT '',
  connection varchar(12) NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS web_vitals_at ON web_vitals (at);

-- Query statistics, when the database server preloads pg_stat_statements (deploy/docker-compose.yml does).
-- Where it is not available (some managed databases), nothing happens and the archive works as before.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_stat_statements') THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'pg_stat_statements not enabled: %', SQLERRM;
    END;
  END IF;
END $$;
