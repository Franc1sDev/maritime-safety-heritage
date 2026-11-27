# Testing and quality assurance plan

How **Remembering the Waters** is tested before every release and before go-live, and what has been tested so far. It covers Section 10 of the master plan, and Sections 4.10 (security testing) and 8.10 (speed targets).

## Automatic tests on every change

The automatic build on GitHub (`.github/workflows/ci.yml`) runs all of these on every push. A change that fails any of them is not released.

| Suite | What it checks | Where | Size |
|---|---|---|---|
| **Server tests** | Every main journey through the API against a real database: sign-in for Contributors and admins, lockout, token reuse, roles and permissions, stories and the AI review, comments, messages and requests, reports, moderation, approvals, uploads, signed links, encryption, exports, analytics. Plus unit tests of the rules: AI flag levels, the two-thirds approval majority, reserved usernames, authenticator codes, field encryption, file-type detection, spreadsheet reading, dates, numbers and paging | `backend/test` | 88 tests |
| **Website tests** | The main screens render and behave: tabs, the story form, sign-in, the hints, settings | `web/src/__tests__` | 19 tests |
| **App tests** | The app's network layer (retries without duplicates, offline reading, actions queued offline, uploads in pieces with pause, resume and cancel) and its text helpers (dates, counts, names, translations). The screens themselves are checked on real devices (below) | `mobile-app/test` | 19 tests |
| **App build** | The Android app (APK and AAB) and the iOS app compile | GitHub Actions | — |
| **Browser tests** | Real browser journeys: visitor, Contributor (sign up, welcome, react, comment, favourite, share a story and see it go live, profile, messages), languages, admin (sign in with a code, every admin page, approving a request), Super Admin, slow 3G, offline | `web/e2e/journeys.cjs` | 19 tests |
| **Accessibility** | Automated WCAG 2.1 A and AA checks (axe) on public, signed-in, story-form and admin pages, in light and dark themes, plus a keyboard-only test of the first screen | `web/e2e/journeys.cjs` | Included above |
| **Access test** | Every API route called as a visitor, a Contributor, an admin and a Super Admin: each role is let in or turned away exactly as [API.md](API.md) says. Then every route is called with nonsense input, which must be refused clearly, never cause a server error | `tests/security/access-matrix.py` | 676 access checks and 2,244 nonsense-input checks |
| **API reference** | [API.md](API.md) still matches the server | `scripts/api-reference.py` | — |
| **Lighthouse** | A simulated mid-range phone on a slow connection: performance 80 or more; accessibility, best practices and SEO 95 or more | `tests/perf/lighthouse.cjs` | — |
| **Load test** | 200 simulated people browsing, reacting, commenting, posting and messaging for 30 seconds. 95% of requests must be under 300 ms, with no server errors | `tests/load/node-load.mjs` | — |
| **AI evaluation set** | 38 labelled samples in English, Kiswahili and Dholuo: no legitimate story may be blocked, and harmful English and Kiswahili samples must reach an admin. `npm run ai:eval` runs it against a real provider to compare them | `tests/ai-eval` | 38 samples |
| **Code scanning** | CodeQL security analysis; weekly and on every change to `main` | `.github/workflows/codeql.yml` | — |
| **Web vulnerability scan** | OWASP ZAP baseline (passive) scan of the running site; any high-risk finding fails the build. The report is kept with each build | `.github/workflows/ci.yml` | — |
| **Known vulnerabilities** | `npm audit` of the server's and website's packages; any high or critical one fails the build | `.github/workflows/ci.yml` | — |
| **Dependency updates** | Dependabot proposes updates weekly; each passes the same tests before it is merged | `.github/dependabot.yml` | — |

To run them yourself, see each folder's README and the commands at the top of each test file.

## Targets

| Target | From | How it is measured |
|---|---|---|
| First story appears within 2 s on 4G and 5 s on 3G | Section 8.10 | Browser test on simulated 3G; Lighthouse; visitors' page speed (LCP) in SUPER ADMIN › System › Performance |
| 95% of API requests under 300 ms | Section 8.10 | Load test; SUPER ADMIN › System › Performance in production, with an alert to the Super Admins above 300 ms |
| Uptime 99.5% or more each month | Section 7.1 | Uptime monitor in production |
| AI review finishes within 3 minutes | Section 5.2 | Server tests; **AI reviews within 3 minutes** in Analytics in production |
| WCAG 2.1 AA | Section 3.5 | Automated checks, plus the manual checks below |
| Restore within 4 hours; database loss at most 15 minutes | Section 7.4 | Quarterly restore test ([DISASTER-RECOVERY.md](DISASTER-RECOVERY.md)) |

## Results so far (21 November 2026)

All automatic suites above pass on the latest change.

| Test | Result |
|---|---|
| First story on 4G / 3G | 1.1 s / 2.7 s (targets 2 s / 5 s) |
| Lighthouse, simulated phone | Performance 90; accessibility 100; best practices 100; SEO 100 |
| Load: 200 people for 30 s (the automatic build's test) | 10,291 requests; median 17 ms; 95% under 71 ms; no server errors |
| Load: a 1,000-person peak | Passed the 300 ms target, with no server errors |
| Load: 2,000 people at once | No errors, but 95% of responses took up to 7 s on the 2-processor test machine. A peak of this size needs a larger server or a second API container ([ARCHITECTURE.md](ARCHITECTURE.md), “Growing”) |
| Accessibility | No automated WCAG A or AA failures on any page tested, in either theme |
| Access | No route lets in a role it should not; no nonsense input causes a server error |
| Backup and restore drill | Database and media wiped and restored identical ([DISASTER-RECOVERY.md](DISASTER-RECOVERY.md)) |

These were measured on a 2-processor cloud test machine, not on the production server. They must be repeated on the production server before go-live.

## What still needs people

Automatic tests cannot replace these. Each is required before go-live.

### Test devices (Section 10.3)

| Kind | Devices | Status |
|---|---|---|
| Android | A low-end phone (2 GB memory), a mid-range phone and a tablet, from Android 8 to the latest | **Not yet done.** The app builds; it has not yet been run on a real phone |
| iOS | An older supported iPhone, a current iPhone and an iPad | **Not yet done.** Needs an Apple Developer account and TestFlight ([IOS-RELEASE.md](IOS-RELEASE.md)) |
| Browsers on computers | Chrome, Edge, Firefox and Safari | Chrome (Chromium) tested automatically; the others to be checked by hand |
| Browsers on phones | Chrome on Android, Safari on iPhone | To be checked by hand |

On each device check: sign-in with Google (and Apple on iPhone), the first-use hints, browsing every tab, playing audio and video, sharing a story with a photo and a recording, a large upload with pause and resume, Wi-Fi-only uploads, offline reading and queued reactions, notifications, share links opening in the app, and for an admin the fingerprint or face lock.

### Manual accessibility checks

- A screen reader on each platform: NVDA or JAWS on Windows, VoiceOver on iPhone and Mac, TalkBack on Android.
- Text at 200%, high contrast, and reduced motion.
- See [ACCESSIBILITY.md](ACCESSIBILITY.md), “Still to check before launch”.

### Language review

- Kiswahili: a native-speaker reviewer reads every screen, the rules and the emails. **Not yet done.**
- Dholuo and other languages: translation not started; needs translators.

### Security

- **An independent penetration test before public launch**, with every high and critical finding fixed before go-live (Section 4.10). **Not yet done.** Give the testers [SECURITY.md](SECURITY.md), [API.md](API.md) and test accounts on the test site.
- A security review every year after launch ([MAINTENANCE.md](MAINTENANCE.md)).

### User acceptance testing (Section 10.4)

Before go-live, the project team and a small group of community Contributors use the test site for real tasks and record what goes wrong.

| Who | Tasks |
|---|---|
| 3–5 community Contributors, including someone using a low-end phone and someone more comfortable in Kiswahili | Sign in, share a story by voice and with photos, browse, react and comment, message the admins, report a safety concern |
| 2 admins | Moderate a blocked story, act on a report, approve a company story, import a small batch from the template, publish a resource and an announcement, make a PDF report |
| 1 Super Admin | Approve an admin registration, decide an overdue approval, read the audit log |
| A researcher or partner institution | Search, cite, download, and check a full export |

Record each problem in GitHub Issues with the page, what was expected, what happened, and a screenshot. Go-live waits until every critical and high problem is fixed and checked again.

## Defects

| Level | Meaning | Fix |
|---|---|---|
| **Critical** | Data lost or exposed, security broken, or the platform unusable | Immediately; no release until fixed |
| **High** | A main feature broken with no way round it | Before the next release |
| **Medium** | Something works wrongly but there is a way round it | Planned |
| **Low** | Cosmetic | When convenient |

Every fixed defect gets a test that would have caught it, where that is possible. For example, after the access test found six kinds of nonsense input that caused server errors, the fixes got server and unit tests, and the access test itself now runs on every change.

## Before each release

- [ ] The automatic build is green: tests, browser tests, access test, Lighthouse and load test.
- [ ] New or changed screens checked on one phone and one computer.
- [ ] A backup was taken before any database change that alters existing data.
- [ ] Deployed to the test site first and checked there.
- [ ] After deploying to production, the health check and error reports were watched for an hour.
