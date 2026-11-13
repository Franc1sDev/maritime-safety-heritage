#!/bin/sh
# Restores a backup made by backup.sh.
#   docker compose exec backup restore.sh 2026-11-13T0200Z
# Stop the api service first (docker compose stop api) so nothing writes during the restore.
# The media volume is mounted read-only in this container; restore media with the command printed at the end.
set -eu
: "${BACKUP_PASSPHRASE:?Set BACKUP_PASSPHRASE in .env}"
stamp=${1:?Give the backup time, for example 2026-11-13T0200Z (see ls /backups)}
dir=/backups
( cd "$dir" && sha256sum -c "checksums-$stamp.sha256" )
echo "Restoring the database from db-$stamp.dump.enc"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in "$dir/db-$stamp.dump.enc" \
  | pg_restore --clean --if-exists --no-owner --dbname "$PGDATABASE"
echo "Database restored."
echo "To restore media files, run on the server:"
echo "  docker compose run --rm -v maritime-heritage_media:/data/storage --entrypoint sh backup -c \\"
echo "    'openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in /backups/media-$stamp.tar.gz.enc | tar -C /data -xzf -'"
