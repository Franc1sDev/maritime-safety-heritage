-- Optional media store inside PostgreSQL (STORAGE_DRIVER=database), for small hosted setups without object storage.
-- Files are kept in 1 MB chunks so byte ranges (audio and video seeking) can be read without loading the whole file.
CREATE TABLE IF NOT EXISTS media_objects (
  storage_key text PRIMARY KEY,
  size_bytes bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS media_chunks (
  storage_key text NOT NULL REFERENCES media_objects(storage_key) ON DELETE CASCADE,
  chunk_no integer NOT NULL,
  data bytea NOT NULL,
  PRIMARY KEY (storage_key, chunk_no)
);
