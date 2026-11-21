# Backups, restore tests and disaster recovery

This is the written disaster recovery plan of the master plan (Sections 7.4 and 7.5). It says what is backed up, how to restore it, how to prove every quarter that restoring works, and what to do in each kind of loss.

**Status on 21 November 2026.** The backup and restore scripts are written and were tested end to end on a test database (see “Restore test record”). They are not running anywhere yet: the free test site has no backup container. Backups start when the archive moves to its paid production server. Continuous backup of the database (point 2 below) also needs that server.

## What must never be lost

| Data | Where it lives | Backed up by |
|---|---|---|
| Accounts, stories, comments, messages, moderation decisions, approvals, audit log | PostgreSQL | Daily encrypted dump; continuous backup once set up |
| Photos, audio, video and documents (originals and web copies) | Media storage (server disk or object storage) | Daily encrypted archive |
| `MEDIA_ENCRYPTION_KEY`, `BACKUP_PASSPHRASE` and the other secrets | Server `.env` | **The project's password manager.** Without these two keys the media and the backups cannot be read by anyone |
| Source code | GitHub | GitHub, plus the copy on the project computer |

## Targets

| Target | Value | How it is met |
|---|---|---|
| Most data that may be lost: database | 15 minutes | Continuous backup (WAL archiving). Until that is set up, the daily backup means up to 24 hours |
| Most data that may be lost: media | 24 hours | Daily backup |
| Longest time to restore service | 4 hours | The steps below, practised every quarter |

## How backups work

The `backup` container in `deploy/docker-compose.yml` runs `deploy/backup/backup.sh` every night at `BACKUP_HOUR` (02:00 by default).

1. **Database:** a full `pg_dump`, encrypted with AES-256 using `BACKUP_PASSPHRASE` before it is written.
2. **Media:** an archive of the media folder, encrypted the same way. (Each media file is also already encrypted at rest.)
3. **Checksums:** a SHA-256 file, so a restore can confirm that the backup is complete and unchanged.
4. **Off-site copy:** when `BACKUP_RCLONE_REMOTE` is set, the three files are copied to a second provider with rclone.

**How long backups are kept** (Section 7.3): every day's backup for 30 days, Sunday's backup for 3 months, and the backup of the 1st of each month for 1 year. The off-site copy follows the same rule. It is a copy, not a mirror, so losing the server's backup folder cannot empty the off-site copy.

**3-2-1 rule:** the live data, the backup folder on the server, and the off-site copy make three copies on two kinds of storage, with one at a different provider. This holds only when `BACKUP_RCLONE_REMOTE` is set, so setting it is part of go-live.

### Settings (in `deploy/.env`)

| Setting | Meaning |
|---|---|
| `BACKUP_PASSPHRASE` | Long random text. Keep a copy in the password manager |
| `BACKUP_HOUR` | Hour of the nightly backup, server time (default `02`) |
| `BACKUP_RCLONE_REMOTE` | Off-site destination, for example `r2:maritime-backups` |
| `BACKUP_KEEP_DAYS`, `BACKUP_KEEP_WEEKLY_DAYS`, `BACKUP_KEEP_MONTHLY_DAYS` | Defaults 30, 92 and 366 |

To create the off-site destination once: `docker compose run --rm backup rclone config`, then mount the rclone settings file into the backup service.

To run a backup now: `docker compose exec backup backup.sh`.

### Continuous backup of the database (to set up on the production server)

The daily dump alone cannot meet the 15-minute target. On the production server, add WAL archiving with pgBackRest or WAL-G, sending to the same off-site provider. This gives recovery to any minute. It is not configured in this repository yet, because it depends on the server and storage provider chosen. A managed PostgreSQL service (for example from the hosting provider) includes it and is the simpler choice.

## Restoring

Always restore onto a spare server first unless the live one is already lost.

```bash
ls deploy/backups                                   # choose a backup time, for example 2026-11-13T0200Z
docker compose stop api                             # nothing may write during the restore
docker compose exec backup restore.sh 2026-11-13T0200Z
# restore.sh checks the checksums, restores the database, and prints the command that restores the media files
docker compose start api
```

Then check: the home page opens, a story with a photo and one with audio or video play, an admin can sign in, and the newest story is the one expected.

If the backup folder on the server is gone, fetch the files from the off-site copy first: `rclone copy remote:bucket deploy/backups --include "*-2026-11-13T0200Z*"`.

## What to do in each kind of loss

| What happened | What to do | Data lost at most |
|---|---|---|
| **The server is lost** (hardware failure, provider outage, account closed) | Create a new server ([DEPLOYMENT.md](DEPLOYMENT.md), steps 1–3). Put back `.env` from the password manager. Fetch the newest backup from the off-site copy and restore it. Point the domain at the new server | Since the last backup |
| **The media storage is lost or damaged** | Stop the API. Restore the media archive from the newest backup. Start the API. Files uploaded since that backup are gone: the admins ask the Contributors concerned to add them again | Up to 24 hours of uploads |
| **Something was deleted by mistake** | No backup is needed in the first 30 days: an admin can put back a story they removed (**Restore story**), and a person who deleted their own account gets it back by signing in again. After that, or for a deletion made in the database itself, restore the backup onto a spare server and copy the item back | None, if within 30 days |
| **A security breach** | Follow [INCIDENT-RESPONSE.md](INCIDENT-RESPONSE.md) first. Change every secret. If data was changed by the attacker, restore the last backup made before the breach onto a clean server | Since the backup chosen |
| **The database is damaged** | Stop the API. Restore the newest backup that passes its checksum (or, with continuous backup, restore to the minute before the damage) | Since the last backup |
| **An encryption key is lost** | `MEDIA_ENCRYPTION_KEY` or `BACKUP_PASSPHRASE` cannot be recovered by anyone. Take them from the password manager. This is why both must be saved there on the day they are created | — |

## Restore test every quarter

A backup that has never been restored is not proven. Every three months:

1. Start a spare server (or a spare database on the same provider) with the same `.env`.
2. Copy the newest backup from the **off-site** copy, not from the server.
3. Run the restore and time it from start to a working home page.
4. Check the points under “Restoring”, and compare the number of stories with the live site.
5. Write the date, the backup used, the time taken and any problem in the table below. Delete the spare server.

If the restore takes more than 4 hours, or anything is missing, treat it as a high-severity defect.

### Restore test record

| Date | Backup used | Where | Result | Time | By |
|---|---|---|---|---|---|
| 21 Nov 2026 | Made in the test itself | Development test database (PostgreSQL 16) with the sample content plus one new story with a photo | The real `backup.sh` and `restore.sh` were run. The database and media folder were then wiped and restored: all 25 tables had the same row counts, and all 4 media files were byte-for-byte identical. The restored story opened from the API. A wrong passphrase was refused, and a deliberately damaged backup file was caught by the checksum | Under 1 minute (very small data set) | Developer |
| | | Production (first quarterly test) | *To be done after the move to the production server* | | |

The November test proves the scripts work. It does not prove the 4-hour target, which depends on the size of the real archive and must be timed on the production data.
