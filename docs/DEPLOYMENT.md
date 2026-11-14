# Deployment and hosting

How to put the archive online at its own domain with HTTPS, backups, a CDN, virus scanning and monitoring. It runs on any Linux server with Docker, from any provider (for example DigitalOcean, Hetzner, AWS Lightsail, Azure or a Kenyan host). The pitch budget covers 12 months of these running costs.

## What runs where

```
 visitors (web + app)
        │  HTTPS
        ▼
   CDN (Cloudflare, optional) ──► Caddy (HTTPS certificates, compression)
                                     │
                                     ▼
                     API + website (Node.js, one container)
                      │            │              │
                PostgreSQL     ClamAV        media storage
                (database)  (virus scan)  (server disk or S3/R2/B2)
                      │                           │
                      └──── daily encrypted backup ┘──► off-site copy (rclone)
```

Everything is in [`deploy/`](../deploy): `docker-compose.yml`, `Caddyfile`, `.env.production.example` and the backup image.

## Free test hosting (current)

Until the project buys hosting, the archive runs free on Render at https://maritime-heritage.onrender.com, set up by [`render.yaml`](../render.yaml):

- One free web service (the API and website) and one free Render PostgreSQL database, in Frankfurt.
- The database also holds the media files, encrypted (`STORAGE_DRIVER=database`). Uploads are limited to 100 MB each.
- Render generates every secret, including the first admin's password. To see it: Render, *maritime-heritage*, *Environment*, `SEED_ADMIN_PASSWORD`, then the eye icon.
- **Email** works once you add `SMTP_PASSWORD` (a Gmail app password) under *Environment*.
- **Limits:**
  - the service sleeps after 15 minutes without visitors (about a minute to wake);
  - the free database expires 30 days after it was created (14 November 2026) unless upgraded;
  - there is no virus scanner.
- Every push to `main` redeploys automatically.

To move to paid hosting, follow the steps below. Export the test data first if any of it is worth keeping.

## 1. Server and domain

1. Rent a server: Ubuntu 24.04, 2 vCPU, 4 GB RAM, 80 GB disk is enough to start. Choose a region near Kenya (Johannesburg or Cape Town) or use a CDN.
2. Install Docker: `curl -fsSL https://get.docker.com | sh`.
3. Register the archive's domain (for example `.or.ke`, `.co.ke` or `.org`) and point an **A record** to the server's IP address. Add `www` as well; it redirects to the main address.
4. Open only ports 22, 80 and 443 in the server firewall.

## 2. Settings

```bash
git clone https://github.com/Franc1sDev/maritime-safety-heritage.git /opt/archive
cd /opt/archive/deploy
cp .env.production.example .env
nano .env
```

Fill in every value. Generate each secret with `openssl rand -base64 48`. Store copies of `MEDIA_ENCRYPTION_KEY`, `BACKUP_PASSPHRASE` and `DB_PASSWORD` in the team's password manager. **Without them, encrypted media and backups cannot be read.**

## 3. Start

```bash
docker compose up -d --build
docker compose logs -f api      # wait for "API running"
```

On the first start the database tables are created and the first admin account is made from `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`. Sign in at `https://<your domain>`, change that password under My account, then delete `SEED_ADMIN_PASSWORD` from `.env`.

Load the archive's real content through **Upload and catalogue**; leave `SEED_SAMPLE_DATA=false` in production.

## HTTPS and the SSL certificate

Caddy obtains and renews a free, trusted certificate automatically. If the project buys a paid certificate (budget line B2), put the certificate and key in `deploy/certs/`, mount that folder in the `caddy` service, and replace the site block's TLS line as the comment in the `Caddyfile` shows.

HSTS, secure cookies and automatic upgrade to HTTPS are on in production.

## Media storage

- **Server disk** (`STORAGE_DRIVER=local`): simplest. Files sit in the `media` Docker volume and are included in the daily backup.
- **Cloud object storage** (`STORAGE_DRIVER=s3`): grows with the archive, with no disk to fill. It works with Cloudflare R2 (no download fees), AWS S3, Backblaze B2, DigitalOcean Spaces and Google Cloud Storage (S3-compatible endpoint). Create a **private** bucket and an access key limited to that bucket, then set the `S3_*` values.
  - Turn on the provider's server-side encryption as well. Files are already encrypted by the archive before they leave the server.
  - Add a **lifecycle rule** that moves objects older than, say, 180 days to the cheaper archive tier: S3 Glacier Deep Archive, GCS Archive, Azure Archive or R2 Infrequent Access. Masters are rarely opened; web copies stay in the normal tier.
  - Keep a second copy with another provider, using `BACKUP_RCLONE_REMOTE`.

Moving to another host or cloud takes 3 to 5 working days plus copy time: restore a backup on the new server, copy the media, then change the DNS record. The web address stays the same.

## Backups

The `backup` container runs every night at `BACKUP_HOUR`. It writes three files to `deploy/backups/` and keeps them for `BACKUP_KEEP_DAYS`:

- the database, encrypted with AES-256;
- the media files, already encrypted at rest;
- a checksum file.

Set `BACKUP_RCLONE_REMOTE` to copy each backup off-site:

```bash
docker compose run --rm backup rclone config   # once, to create the remote (for example an R2 or B2 bucket)
```

Then mount the rclone config into the backup service, and set `BACKUP_RCLONE_REMOTE=remote:bucket`.

To run a backup now: `docker compose exec backup backup.sh`.

**Test a restore every three months.** Restore on a spare server, never on the live one:

```bash
docker compose stop api
docker compose exec backup restore.sh 2026-11-13T0200Z
docker compose start api
```

## CDN (faster loading in every country)

Put the domain on Cloudflare (free plan). Move the domain's nameservers to Cloudflare, keep the A record **proxied** (orange cloud), and set SSL mode to **Full (strict)**.

- Website files (`/assets/*`) are cached at the edge.
- The API and signed media links are private and not cached.
- Cloudflare also adds DDoS protection and bot management, which make bulk copying harder.

With Cloudflare in front there are two proxies (Cloudflare, then Caddy), so set `TRUST_PROXY=2` in `.env`. The audit log and rate limits then use visitors' real addresses. Without Cloudflare, leave it at the image default of one proxy.

## Virus scanning

The `clamav` container scans every upload before it is stored, and updates its virus signatures by itself. With `CLAMAV_REQUIRED=true`, uploads pause instead of skipping the scan if the scanner is down. The scanner needs about 1.5 GB of memory.

## Uptime and security monitoring

- **Uptime:** add a free monitor (UptimeRobot, Better Stack or Cloudflare Health Checks) for `https://<your domain>/api/v1/health` every 5 minutes, alerting the team by email or SMS. The check fails if the API or the database is down.
- **Storage:** set `STORAGE_ALERT_GB` and `ALERT_EMAILS`. The team is emailed when media passes 80% of that level.
- **Security updates:** run `apt upgrade` monthly on the server, and rebuild monthly to pick up patched base images:

  ```bash
  git pull && docker compose build --pull && docker compose up -d
  ```

- **Malware scanning:** every upload is scanned on arrival (see above). For the server itself, turn on the hosting provider's malware scanning, or install ClamAV on the host (`apt install clamav`) and add a weekly `clamscan -r --infected /opt/archive` to cron.
- **Logs:** Caddy keeps access logs in its data volume. The archive's audit log (Reports and logs) records sign-ins and every staff action.

## Search engines (Google Search Console)

1. Sign in to Google Search Console with the project's Google account and add the domain property.
2. Verify ownership with the DNS TXT record Google shows. This proves the archive is the original.
3. Submit `https://<your domain>/sitemap.xml`. It lists the home page, the catalogue and every published item.
4. Repeat for Bing Webmaster Tools if you want (it can import from Google).

Every public page carries a canonical link to the official address, page titles and descriptions, and structured data describing each archive item. Turn the public catalogue off with `PUBLIC_PREVIEWS=false` if the team prefers search engines to see only the home page.

## Updating the archive

```bash
cd /opt/archive && git pull
cd deploy && docker compose up -d --build
```

New database migrations run automatically at start. Take a backup first (`docker compose exec backup backup.sh`).

## Running costs (from year 2)

| Item | Typical cost per year |
|---|---|
| Server (2 vCPU, 4 GB) | USD 70 to 150 |
| Object storage, 100 to 500 GB | USD 20 to 100 |
| Domain | KES 1,500 |
| SSL certificate | Free (automatic), or KES 3,500 for a paid certificate |
| CDN and uptime monitoring | Free plans |
| Apple Developer Program (if publishing on iOS) | USD 99 |

The pitch budget estimates about KES 28,500 a year for hosting, SSL, domain, backups, CDN and monitoring.
