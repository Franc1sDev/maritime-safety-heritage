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

# What is kept (master plan, Section 7.3): every day's backup for 30 days, Sunday's for 3 months,
# and the backup of the 1st of each month for 1 year. Older ones are removed.
daily=${BACKUP_KEEP_DAYS:-30}; weekly=${BACKUP_KEEP_WEEKLY_DAYS:-92}; monthly=${BACKUP_KEEP_MONTHLY_DAYS:-366}
today=$(date -u +%s)
removed=""
for f in "$dir"/db-*.dump.enc "$dir"/media-*.tar.gz.enc "$dir"/checksums-*.sha256; do
  [ -e "$f" ] || continue
  day=$(basename "$f" | sed -n 's/^[a-z]*-\([0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}\)T.*/\1/p')
  [ -n "$day" ] || continue
  made=$(date -u -d "$day 00:00:00" +%s 2>/dev/null) || continue
  age=$(( (today - made) / 86400 ))
  [ "$age" -le "$daily" ] && continue
  [ "$(date -u -d "$day 00:00:00" +%u)" = "7" ] && [ "$age" -le "$weekly" ] && continue
  [ "${day#????-??-}" = "01" ] && [ "$age" -le "$monthly" ] && continue
  rm -f "$f"
  removed="$removed $(basename "$f")"
done

if [ -n "${BACKUP_RCLONE_REMOTE:-}" ]; then
  echo "[$stamp] Copying off-site to $BACKUP_RCLONE_REMOTE"
  rclone copy "$dir" "$BACKUP_RCLONE_REMOTE" --include "*-$stamp*"
  # The off-site copy follows the same 30-day, 3-month and 1-year rule: only the files removed here just now are removed there.
  # (Never a mirror: if this server's backup folder were lost, a mirror would empty the off-site copy too.)
  for name in $removed; do rclone deletefile "$BACKUP_RCLONE_REMOTE/$name" 2>/dev/null || true; done
fi
echo "[$stamp] Backup finished: $(du -sh "$dir" | cut -f1) kept in $dir"
