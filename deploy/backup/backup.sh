#!/bin/sh
# Encrypted backup of the database and media files.
#  - Database: pg_dump, compressed, then encrypted with AES-256 (BACKUP_PASSPHRASE).
#  - Media: the stored files are already encrypted at rest; they are archived as they are.
#  - Optional off-site copy with rclone to any cloud (BACKUP_RCLONE_REMOTE, for example "r2:maritime-backups").
set -eu
: "${BACKUP_PASSPHRASE:?Set BACKUP_PASSPHRASE (long random text) in .env}"
stamp=$(date -u +%Y-%m-%dT%H%MZ)
dir=/backups
mkdir -p "$dir"

echo "[$stamp] Backing up the database"
pg_dump --format=custom --no-owner | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_PASSPHRASE -out "$dir/db-$stamp.dump.enc"

echo "[$stamp] Backing up media"
tar -C /data -cf - storage | gzip -1 | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_PASSPHRASE -out "$dir/media-$stamp.tar.gz.enc"

# Checksums let a restore confirm the files are complete.
( cd "$dir" && sha256sum "db-$stamp.dump.enc" "media-$stamp.tar.gz.enc" > "checksums-$stamp.sha256" )

keep=${BACKUP_KEEP_DAYS:-14}
find "$dir" -type f \( -name 'db-*' -o -name 'media-*' -o -name 'checksums-*' \) -mtime +"$keep" -delete

if [ -n "${BACKUP_RCLONE_REMOTE:-}" ]; then
  echo "[$stamp] Copying off-site to $BACKUP_RCLONE_REMOTE"
  rclone copy "$dir" "$BACKUP_RCLONE_REMOTE" --include "*-$stamp*"
fi
echo "[$stamp] Backup finished: $(du -sh "$dir" | cut -f1) kept in $dir"
