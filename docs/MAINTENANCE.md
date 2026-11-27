# Maintenance and continuity plan

What it takes to keep **Remembering the Waters** safe, working and alive after go-live, who does it, and what it costs. It covers Sections 9.8 and 11.8 of the master plan and gives the hosting, maintenance and cost information for the project's archive sustainability plan (deliverable 13).

## Who is responsible

| Responsibility | Who |
|---|---|
| Moderation, reports, safety concerns, approvals, content | The named team of **admins**, working to the response times in the [Admin manual](ADMIN-GUIDE.md) |
| The admin team, analytics, audit log, overdue approvals, incident lead | The **Super Admins** (at least two) |
| Server, updates, backups, restore tests, app releases, fixes | The **technical maintainer**: the developer during the support period, then a provider or staff member the project names |
| Accounts, renewals and budget | The project owner |

The roles, the approval rules and the audit log give the structure for long-term management: nothing important is decided by one person, and every action is recorded.

## Calendar of tasks

| How often | Task | Who | How |
|---|---|---|---|
| **Every day** | Clear the moderation queue, reports and safety concerns within the response times | Admins | ADMINISTRATIVE CONTROLS |
| **Every week** | Read the audit log for failed sign-ins and lockouts; decide overdue approvals | Super Admin | [SUPER-ADMIN-GUIDE.md](SUPER-ADMIN-GUIDE.md) |
| **Every week** | Check that last night's backup exists and the off-site copy arrived | Maintainer | `ls deploy/backups`; the off-site bucket |
| **Every month** | Apply server security updates and rebuild the containers | Maintainer | [DEPLOYMENT.md](DEPLOYMENT.md), “Uptime and security monitoring” |
| **Every month** | Read the automatic monthly PDF report; check **Background work** for repeated failures | Super Admin | REPORTS; MANAGE ADMINS › System |
| **Every month** | Merge the automatic dependency updates that pass the automatic build | Maintainer | Dependabot pull requests on GitHub |
| **Every quarter** | **Restore test**: restore the newest off-site backup on a spare server, time it, record it | Maintainer | [DISASTER-RECOVERY.md](DISASTER-RECOVERY.md) |
| **Every quarter** | Update frameworks and libraries (server, website, apps); run the full test suite and the load test before release | Maintainer | [TESTING.md](TESTING.md) |
| **Every quarter** | Review: performance against targets, AI quality, security, and costs | Super Admins with the maintainer | Checklist below |
| **Every year** | Security review, and an incident practice | Super Admins with the maintainer | [SECURITY.md](SECURITY.md), [INCIDENT-RESPONSE.md](INCIDENT-RESPONSE.md) |
| **Every year** | App updates to meet new Android and iOS requirements; rebuild and resubmit | Maintainer | [STORE-RELEASE.md](STORE-RELEASE.md), [IOS-RELEASE.md](IOS-RELEASE.md) |
| **Every year** | Renewals: domain, hosting, SSL certificate (if paid), Apple Developer Program, other subscriptions | Project owner | Table below |
| **When someone joins or leaves** | Invite or remove their admin account the same day | Super Admin | MANAGE ADMINS |
| **When a query shows as slow** | Find out why with `EXPLAIN (ANALYZE, BUFFERS) <the query>` in `docker compose exec db psql -U maritime maritime_heritage`; add an index or rewrite it in a migration; check the Performance panel again | Maintainer | SUPER ADMIN › System › Performance |
| **At once** | Security patches for a serious vulnerability; any critical or high defect | Maintainer | [INCIDENT-RESPONSE.md](INCIDENT-RESPONSE.md) |

### Quarterly review checklist

- [ ] **Availability:** was the month-by-month uptime 99.5% or higher? (uptime monitor)
- [ ] **Speed:** are 95% of API responses under 300 ms, and does the first story appear within 2 seconds on 4G and 5 seconds on 3G? (SUPER ADMIN › System › Performance; `tests/perf`, `tests/load`)
- [ ] **AI quality:** were all RED items reviewed within 24 hours? Is the override rate steady? Is any language flagged more than the others? (Analytics › AI quality)
- [ ] **Moderation:** were the response times met? Are approvals going overdue?
- [ ] **Security:** audit log reviewed; dependency and code-scanning alerts cleared; secrets still only in the password manager; leavers removed.
- [ ] **Backups:** restore test done and recorded this quarter.
- [ ] **Costs:** hosting, storage, AI, transcription, translation, maps and SMS spending against the limits; storage growth.
- [ ] **Content:** new stories, counties and water bodies represented, languages; what the next collection or exhibition will be.
- [ ] Decisions and actions written down, with a name and a date for each.

## What is automatic

- **Tests on every change:** the automatic build on GitHub runs the server, website and app tests, the browser tests, the access test, Lighthouse and a load test, and builds the Android and iOS apps. A change that fails is not released.
- **Dependency updates:** Dependabot proposes updates for the server, website, app and build tools.
- **Code scanning:** CodeQL scans the code for security faults on every change and weekly.
- **Backups:** nightly, encrypted, checked and copied off-site, kept for 30 days, 3 months and 1 year (once the production server is set up).
- **Erasing:** deleted accounts and stories are erased after 30 days; stories removed by admins after 1 year.
- **Monthly PDF report** on the first day of each month.

## What each update needs

| Update | Steps |
|---|---|
| Server and website | Merge to `main` when the automatic build is green; deploy to the test site and check; deploy to production; watch the health check and error reports for an hour. To go back, redeploy the previous version |
| Database changes | Migrations run automatically at start. Take a backup first for any migration that changes existing data |
| Android app | Raise the version; build; internal test; release on Google Play |
| iOS app | Raise the version; build on a Mac or a cloud build service; TestFlight; App Store review |
| Retiring an old app version | Set `MIN_APP_VERSION` on the server: older apps ask their users to update |

## Running costs

From the master plan, Appendix G.2 (Kenya shillings per year). The first 12 months are paid from the project budget; from year 2 the project owner pays the providers directly.

| Item | For | KES per year |
|---|---|---|
| Web hosting and storage | Server, database and media storage | 15,000 |
| SSL certificate | Secure HTTPS on the archive domain | 3,500 |
| Domain name | Yearly renewal of the web address | 1,500 |
| Backups and CDN | Daily backups; fast loading worldwide | 4,000 |
| Security and uptime monitoring | Malware scans and downtime alerts | 2,500 |
| Contingency | Price changes or extra storage | 2,000 |
| **Total** | | **28,500** |

If the apps are published under the project's own store accounts: the Apple Developer Program is USD 99 a year (about KES 13,000), and Google Play is USD 25 once.

**Not in that total, and to be decided:** the pay-as-you-go services, which are free up to a limit and then charged by use. Set a monthly spending limit and an alert on each account.

| Service | Used for | If it is not paid for |
|---|---|---|
| AI review | Checking every story, comment and message | The built-in rule-based check keeps working, with less nuance |
| Transcription | Transcripts of audio and video | People type transcripts by hand |
| Translation | The Translate button | The button says translation is not available |
| Maps | Google map on the website | The website shows its built-in map of Kenya's coast, lakes and rivers; the app always uses free OpenStreetMap tiles |
| SMS | Sign-in codes by text message | Codes by email and authenticator app |
| Technical maintenance | The maintainer's time for the tasks above | Not costed in Appendix G; to be agreed in the support arrangement |

Cost control already built in: AI results and translations are saved so each is paid for once; uploads are compressed before sending; free tiers and free test hosting are used during development.

## Keeping the archive alive

Technology alone does not sustain an archive.

- Trained Contributors and community champions keep adding stories. Admins tick **This Contributor has been trained by the project** on a Contributor's profile, so the project can report how many trained Contributors are active.
- New **collections**, **online exhibitions** and **announcements** give people a reason to return.
- The **feedback form** and the safety concerns show what communities need next.
- The monthly report carries the measures the project reports: stories, counties, incidents, Contributors, resource use, citations and downloads.

## Technical continuity

The archive can be moved, or handed to another institution, without loss:

- **Everything is documented:** [ARCHITECTURE.md](ARCHITECTURE.md), [API.md](API.md), [DEPLOYMENT.md](DEPLOYMENT.md), [SECURITY.md](SECURITY.md), [METADATA.md](METADATA.md) and the guides.
- **Open formats and standard metadata:** Dublin Core fields; originals kept unchanged with checksums; web copies in MP4, M4A and WebP.
- **A complete export** of the published archive at any time (ADMINISTRATIVE CONTROLS › Import › Export the archive).
- **No lock-in:** the platform runs in standard Docker containers on any Linux server, with PostgreSQL and S3-compatible storage. Each outside service (AI, email, SMS, maps, storage) is behind one setting and can be changed.
- **The source code and its history** are in a repository the project owns ([HANDOVER.md](HANDOVER.md)).

## Growing and reuse

- **More people:** the server can be made larger; a second API container, a read replica of the database and a CDN can be added without changing the code ([ARCHITECTURE.md](ARCHITECTURE.md), “Growing”).
- **More languages:** each language is one translation file; right-to-left layout is supported.
- **Other countries:** because the platform is documented and multilingual, it can serve as a model for similar archives in other coastal and inland-water countries. The places, categories, emergency numbers and rules are settings and data, not code.
