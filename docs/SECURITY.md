# Security

How the archive meets the security commitments in the project pitch, and what the team must keep doing after launch.

## What is built in

| Commitment | How it is done |
|---|---|
| **Data in transit encrypted (HTTPS)** | Caddy serves only HTTPS with automatic certificates; HTTP redirects to HTTPS. HSTS is on in production, and the app uses `https://` addresses in store builds (plain HTTP is turned off with `-PstoreRelease` on Android and is allowed only for local networks on iOS). |
| **Database and media encrypted at rest** | Every media file is encrypted with AES-256 before storage, using `MEDIA_ENCRYPTION_KEY`. Range reads still work, so audio and video can seek. For the database, use a provider with encrypted disks (all major clouds do this by default) or a managed PostgreSQL with encryption at rest. |
| **Salted password hashes** | scrypt with a random salt per password; never stored or logged in plain text. Sign-in takes the same time whether or not the email exists. |
| **Signed, expiring links for files** | Files are never public. Each link is signed with HMAC-SHA256 and expires after an hour, and only people allowed to see the item get one. |
| **Encrypted backups** | Daily database and media backups encrypted with AES-256 (`BACKUP_PASSPHRASE`), with checksums and an optional off-site copy. |
| **SSL certificate on the domain** | Automatic, or a paid certificate (see [DEPLOYMENT.md](DEPLOYMENT.md)). |
| **Role-based access** | Member, editor and admin roles, checked on every request. Role changes and suspensions take effect at once. |
| **Defences against SQL injection and cross-site scripting** | All database queries use parameters. All input is validated, and unknown fields are rejected. Everything shown on pages is escaped. A strict Content Security Policy allows scripts only from the archive itself. Helmet security headers are on. |
| **Malware scanning** | ClamAV scans every upload before it is stored, and file types are checked from their contents, not their names. |
| **Uptime monitoring** | `/api/v1/health` checks the API and database for an external monitor; storage alerts are emailed. |
| **Security testing before launch** | 40 automated end-to-end tests cover sign-in, lockout, token reuse, access rules, file signatures, encryption and file-type checks; see the checklist below. |

### Accounts and sessions

- Sessions use 15-minute access tokens and refresh tokens that rotate on each use. Refresh tokens are stored only as hashes.
- Reusing an old refresh token ends every session of that account.
- The website keeps its refresh token in an `httpOnly`, `SameSite=Strict` cookie that needs a custom header. The app keeps it in the phone's secure storage (Keychain or Keystore).
- An account locks for 15 minutes after 5 wrong passwords. Password reset links are single-use, expire in 30 minutes and are rate-limited.
- People can close their own account. Their personal details are erased and their name is removed from the audit log.

### Protecting the original

- One official domain, verified in Google Search Console; `www` and other names redirect to it.
- Canonical links, a sitemap and structured data tell search engines which site is the original.
- Photos carry a visible credit with the item identifier. The website blocks the right-click menu and dragging on media, and video download controls are hidden.
- Rate limits on sign-in, search, uploads and the public catalogue make bulk copying slow. Every access to items is counted, and staff actions are logged.
- Every page carries a copyright notice and links to the terms of use. Takedown steps are in [ADMIN-GUIDE.md](ADMIN-GUIDE.md).

No public website can be made impossible to copy. The aim is to make copying hard, easy to detect and quick to remove.

## Secrets

| Secret | Where | If lost | If leaked |
|---|---|---|---|
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | server `.env` | Everyone signs in again | Change it and restart; all sessions end |
| `MEDIA_SIGNING_SECRET` | server `.env` | Links are re-issued automatically | Change it and restart |
| `MEDIA_ENCRYPTION_KEY` | server `.env` **and** password manager | **Stored media cannot be read** | Media stays protected only by server access; plan a re-encryption |
| `BACKUP_PASSPHRASE` | server `.env` **and** password manager | **Backups cannot be restored** | Change it; older backups keep the old passphrase |
| `DB_PASSWORD` | server `.env` | Reset it in PostgreSQL | Change it in both places |
| Android upload keystore and password | offline, with the team | Ask Google Play support to reset the upload key | Ask Google to reset it |

Never commit `.env`, keystores or `key.properties`; the repository's ignore rules exclude them.

## Before launch checklist

- [ ] All secrets are long random values, unique to production, and saved in the password manager.
- [ ] `NODE_ENV=production`; the server refuses to start with weak secrets.
- [ ] `SEED_SAMPLE_DATA=false`; the demo accounts don't exist (they are never created in production).
- [ ] The first admin password has been changed and removed from `.env`.
- [ ] HTTPS works, and `http://` and `www` redirect to the official address.
- [ ] A test upload of the harmless EICAR test file is refused by the virus scanner.
- [ ] A backup has been made and restored on a spare server.
- [ ] The uptime monitor alerts the team.
- [ ] `/api/docs` is not reachable (it is off in production unless `API_DOCS=true`).
- [ ] An external scan (for example Mozilla Observatory and SSL Labs) gives an A grade.

## After launch

- Apply server and container updates monthly ([DEPLOYMENT.md](DEPLOYMENT.md)).
- Review the audit log weekly for failed sign-ins and lockouts.
- Remove staff accounts the day someone leaves the team.
- Test a backup restore every three months.
- Run `npm audit` and `flutter pub outdated` before each release.
