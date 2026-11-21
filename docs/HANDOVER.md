# Launch and handover

What the project team receives at launch, and the steps to take full ownership, so the archive never depends on one developer or provider. Ownership of the platform, its code and its content passes to the project on completion, as agreed in the proposal.

## What is handed over

| Item | Where |
|---|---|
| Source code: server, website, Android and iOS app, deployment and backup scripts, tests | GitHub repository (moved to the project's own GitHub organisation) |
| How it is built | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Every API route | [API.md](API.md) |
| Database schema and migrations | `backend/src/database/migrations` |
| Metadata and cataloguing standard, and the spreadsheet template | [METADATA.md](METADATA.md), [metadata-template.csv](metadata-template.csv) |
| User guide | [USER-GUIDE.md](USER-GUIDE.md) |
| Handbook for documenting and uploading stories | [HANDBOOK.md](HANDBOOK.md) |
| Admin manual | [ADMIN-GUIDE.md](ADMIN-GUIDE.md) |
| Super Admin guide | [SUPER-ADMIN-GUIDE.md](SUPER-ADMIN-GUIDE.md) |
| Hosting, settings, CDN, monitoring | [DEPLOYMENT.md](DEPLOYMENT.md) |
| Backups and disaster recovery | [DISASTER-RECOVERY.md](DISASTER-RECOVERY.md) |
| Security controls | [SECURITY.md](SECURITY.md) |
| Incident response | [INCIDENT-RESPONSE.md](INCIDENT-RESPONSE.md) |
| Testing and quality assurance | [TESTING.md](TESTING.md) |
| Accessibility statement | [ACCESSIBILITY.md](ACCESSIBILITY.md) |
| Maintenance, continuity and running costs | [MAINTENANCE.md](MAINTENANCE.md) |
| Publishing the apps | [STORE-RELEASE.md](STORE-RELEASE.md), [IOS-RELEASE.md](IOS-RELEASE.md) |
| What must be done before opening | [GO-LIVE.md](GO-LIVE.md) |
| The master plan and its checklist | `Maritime Heritage Project - Development Master Plan.docx`; [MASTER-PLAN-CHECKLIST.md](MASTER-PLAN-CHECKLIST.md) and its Word copy |
| Admin access | The team's own admin and Super Admin accounts on the live archive |

## Accounts to put in the project's name

The full list is in [GO-LIVE.md](GO-LIVE.md), section 2. Each is owned by a shared project email, with at least two team members able to sign in, and two-step sign-in turned on. The password manager holds the server login, every `.env` secret, `MEDIA_ENCRYPTION_KEY`, `BACKUP_PASSPHRASE`, and the Android upload keystore with its password.

## Handover steps

1. Move the GitHub repository to the project's organisation (*Settings › Transfer*).
2. Move each account to the project email, or invite the team as owners and then remove the developer.
3. Change every secret the developer has seen: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `MEDIA_SIGNING_SECRET`, `DB_PASSWORD` and the server login. Restart with `docker compose up -d`. Everyone is signed out once.
   - `MEDIA_ENCRYPTION_KEY` and `BACKUP_PASSPHRASE` stay as they are, because existing files and backups depend on them. Keep them in the team's password manager.
4. The Super Admins confirm their own accounts, approve the admin team, and remove the developer's admin account in **MANAGE ADMINS**.
5. Work through [GO-LIVE.md](GO-LIVE.md).
6. Make a backup and restore it together on a spare server, so the team has done it once ([DISASTER-RECOVERY.md](DISASTER-RECOVERY.md)).

## Staff training

| Session | For | Covers | Guide |
|---|---|---|---|
| 1. Using the archive | Everyone | Browsing and the tabs, search, the map, listening and watching, citing, sharing, settings, offline use | [USER-GUIDE.md](USER-GUIDE.md) |
| 2. Documenting and uploading | Researchers, partners, community champions | Consent, recording, describing, sharing a story, the metadata template | [HANDBOOK.md](HANDBOOK.md), [METADATA.md](METADATA.md) |
| 3. Moderating | Admins | How stories are checked, moderation, reports, safety concerns, account actions, appeals, approvals | [ADMIN-GUIDE.md](ADMIN-GUIDE.md) |
| 4. Curating | Admins | Company stories and testimonies with consent and validation, collections, incidents, bulk import, resources, announcements, reports | [ADMIN-GUIDE.md](ADMIN-GUIDE.md) |
| 5. Running the archive | Super Admins and the maintainer | Managing admins, overdue approvals, analytics, the audit log, Background work, backups, incidents, the maintenance calendar | [SUPER-ADMIN-GUIDE.md](SUPER-ADMIN-GUIDE.md), [MAINTENANCE.md](MAINTENANCE.md), [INCIDENT-RESPONSE.md](INCIDENT-RESPONSE.md) |

Train on the test site, where nothing done affects the real archive.

## After launch

Basic access support follows launch, as agreed in the proposal. Report a problem through the feedback form, in GitHub Issues, or to the maintainer, with:

- the page or screen;
- what you expected;
- what happened, with a screenshot.

Any change of scope is agreed in writing first.

From year 2 the project pays the providers directly. The yearly running costs are in [MAINTENANCE.md](MAINTENANCE.md): about KES 28,500 a year for hosting, SSL, domain, backups, CDN and monitoring, plus USD 99 a year for Apple if the iPhone app is published under the project's account, and the pay-as-you-go services (AI, transcription, translation, SMS).
