# Launch and handover

What the Remembering the Waters research team receives at launch (month 16), and the steps to take full ownership, so the archive never depends on one developer or vendor.

## What is handed over

| Item | Where |
|---|---|
| Full source code: API, website, Android and iOS app, deployment and backup scripts | GitHub repository (transfer to the project's own GitHub organisation) |
| Database schema and migrations | `backend/src/database/migrations` |
| Metadata schema and cataloguing standard | [METADATA.md](METADATA.md) |
| User guide | [USER-GUIDE.md](USER-GUIDE.md) |
| Research team guide (editors and admins) | [ADMIN-GUIDE.md](ADMIN-GUIDE.md) |
| Hosting, backups, CDN, monitoring | [DEPLOYMENT.md](DEPLOYMENT.md) |
| Security controls and checklist | [SECURITY.md](SECURITY.md) |
| Accessibility statement | [ACCESSIBILITY.md](ACCESSIBILITY.md) |
| Publishing the app on Google Play and the App Store | [STORE-RELEASE.md](STORE-RELEASE.md) |
| API reference | `https://<domain>/api/docs` in development, or the `@nestjs/swagger` annotations in the code |
| Admin access | The team's own admin accounts on the live archive |

Ownership of the website, its code and its content passes to the research team on completion, as agreed in the proposal.

## Accounts to put in the project's name

Each should be owned by a shared project email (for example `archive@<organisation>`), with at least two team members able to sign in. Turn on two-step sign-in everywhere.

- [ ] **Domain registrar** (the archive's domain) with auto-renew on
- [ ] **Hosting provider** (server) and **object storage** (if used)
- [ ] **Cloudflare** (CDN and DNS), if used
- [ ] **Email sending** (SMTP provider) for password reset and review emails
- [ ] **Uptime monitor** with alerts to two people
- [ ] **Google Search Console** (domain verified)
- [ ] **GitHub** organisation holding the code
- [ ] **Google Play Console** and **Apple Developer** accounts, if the app is published under the project's name
- [ ] **Password manager** holding: server login, `.env` secrets, `MEDIA_ENCRYPTION_KEY`, `BACKUP_PASSPHRASE`, the Android upload keystore and its password

## Handover steps

1. Transfer the GitHub repository to the project's organisation (*Settings, Transfer*).
2. Move each account above to the project email, or invite the team as owners and then remove the developer.
3. Rotate every secret the developer has seen: `JWT_*`, `MEDIA_SIGNING_SECRET`, `DB_PASSWORD` and the server login. Restart with `docker compose up -d`.
   - `MEDIA_ENCRYPTION_KEY` and `BACKUP_PASSPHRASE` stay as they are, because existing files depend on them. Store them in the team's password manager.
4. Admins create their own accounts, then remove or downgrade the developer's account under *Users and roles*.
5. Run the *Before launch* checklist in [SECURITY.md](SECURITY.md).
6. Make and restore a backup together, so the team has done it once.

## Staff training (half a day)

| Session | Covers | Guide |
|---|---|---|
| 1. Using the archive | Search, browse, map, players, citations, sharing, Light mode | USER-GUIDE |
| 2. Cataloguing | Metadata fields, consent and rights, transcripts, publishing, large videos | ADMIN-GUIDE, METADATA |
| 3. Reviewing and people | Submissions, roles, suspensions, password resets, messages | ADMIN-GUIDE |
| 4. Keeping it running | Dashboard, reports and the audit log, storage alerts, backups, takedown requests, who to call | ADMIN-GUIDE, DEPLOYMENT |

## After launch

Basic access support follows launch, as agreed in the proposal. Report problems through the contact form or directly to the developer, with:

- the page or screen;
- what you expected;
- what happened, with a screenshot.

Any changes of scope are agreed in writing first.

From year 2 the project pays the providers directly for hosting, domain, SSL and app store fees (about KES 28,500 a year, plus USD 99 a year for Apple if the iOS app is published).
