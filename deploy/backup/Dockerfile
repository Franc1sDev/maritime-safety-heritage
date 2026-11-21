FROM postgres:17-alpine
RUN apk add --no-cache openssl rclone tzdata
COPY backup.sh restore.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/restore.sh
# Runs a backup every day at BACKUP_HOUR (server time, default 02:00) and keeps them for 30 days (daily), 3 months (Sundays) and 1 year (the 1st of each month).
CMD ["sh", "-c", "while true; do now=$(date +%H); if [ \"$now\" = \"${BACKUP_HOUR:-02}\" ]; then backup.sh || echo 'Backup failed'; sleep 3600; fi; sleep 600; done"]
