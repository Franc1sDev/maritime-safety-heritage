# Go-live checklist

Everything that must be true before **Remembering the Waters** opens to the public (milestone 7, launch and handover). Work down the list; each item says who does it and where the steps are. The platform itself is built; most of what remains needs the project's accounts, decisions, people or devices.

**Status on 21 November 2026:** the platform runs on the free test site with test sign-in. None of the items below marked ☐ is done yet unless it says so.

## 1. Decisions the project must take (master plan, Appendix B)

The recommended choice is already built for each. Confirm it, or say what to change.

| Decision | Built now | Change by |
|---|---|---|
| Approval rule for overrides, company stories and permanent deletions | Two-thirds of active admins; 7 days; then the Super Admins | `APPROVAL_RULE`, `APPROVAL_DEADLINE_DAYS` |
| Admin second sign-in step | Authenticator app (recommended to each admin), with codes by email or SMS | — |
| Video limits | 5 minutes and 200 MB | `MAX_VIDEO_MINUTES`, `MAX_VIDEO_MB` |
| Sharing targets | The phone's share menu in the app; WhatsApp, Facebook, X, Gmail and Copy Link on the website | Code |
| Who adds Super Admins | An existing Super Admin | — |
| AI provider | Not chosen. The built-in rule-based check runs meanwhile | Compare providers on the evaluation set in English, Kiswahili and Dholuo (`npm run ai:eval`, [tests/ai-eval](../tests/ai-eval/README.md)), then set `AI_PROVIDER` and `AI_API_KEY` |
| Schedule | The 18-month Milestones and Deliverables | — |
| Emergency numbers on the safety form | 999 and 112 | Confirm with partners |
| Minimum age for Contributors | 18 | `MINIMUM_AGE` |
| Oldest phones supported | Android 8.0 and iOS 15 | — |

## 2. Accounts in the project's name

Owned by a shared project email, with at least two people able to sign in, and two-step sign-in turned on. See [HANDOVER.md](HANDOVER.md).

- ☐ Domain name, with auto-renew
- ☐ Production server (or managed hosting) and S3-compatible media storage
- ☐ Off-site backup storage at a second provider
- ☐ Cloudflare (CDN and DNS), if used
- ☐ Email sending (SMTP), for codes, resets and alerts
- ☐ Uptime monitor, alerting two people
- ☐ Password manager holding every secret
- ☐ Google Cloud project: Google sign-in client IDs (web and Android) ([DEPLOYMENT.md](DEPLOYMENT.md), “Sign in with Google and Apple”)
- ☐ Apple Developer Program (USD 99 a year): Sign in with Apple, and the iPhone app
- ☐ Google Play Console (USD 25 once)
- ☐ Firebase, for push notifications to the apps (optional)
- ☐ Africa's Talking, for SMS codes (optional)
- ☐ AI provider account, with a monthly spending limit
- ☐ Google Search Console
- ☐ GitHub organisation holding the code

## 3. Production server

Steps in [DEPLOYMENT.md](DEPLOYMENT.md).

- ☐ Server set up with Docker; `deploy/.env` filled from `.env.production.example`
- ☐ `NODE_ENV=production`; all secrets long, random, unique and saved in the password manager
- ☐ **`DEMO_SIGN_IN=false`** (or removed). The test sign-in must never be on in production
- ☐ `SEED_SAMPLE_DATA=false`; the first admin's password changed, then removed from `.env`
- ☐ `GOOGLE_CLIENT_IDS` and `APPLE_CLIENT_IDS` set; Google and Apple sign-in tried
- ☐ `AI_PROVIDER` and `AI_API_KEY` set; a test story reviewed in English and Kiswahili
- ☐ Email working: an admin receives a sign-in code and a password reset
- ☐ Virus scanner running, and the harmless EICAR test file refused
- ☐ HTTPS works; `http://` and `www` redirect to the official address
- ☐ `/api/docs` not reachable
- ☐ `ANDROID_APP_SHA256` and `APPLE_APP_ID` set, so shared links open in the apps
- ☐ An external scan (Mozilla Observatory, SSL Labs) gives an A grade
- ☐ Uptime monitor on `/api/v1/health`, alerting two people

## 4. Data protection

- ☐ The project is registered with the Office of the Data Protection Commissioner, as data controller and, if required, data processor
- ☐ The privacy policy and terms of use in **ABOUT & RESOURCES** are reviewed by the project's legal adviser and corrected where needed. The current text was written for the build and has not had legal review
- ☐ Processing agreements with the hosting, storage, email, SMS and AI providers, including a 48-hour breach notice to the project
- ☐ The data protection contact is named in [INCIDENT-RESPONSE.md](INCIDENT-RESPONSE.md)
- ☐ Consent forms for the project's own recordings follow the [Handbook](HANDBOOK.md), and the signed forms are kept

## 5. Backups and recovery

- ☐ The backup container runs on the production server, with `BACKUP_PASSPHRASE` saved in the password manager
- ☐ `BACKUP_RCLONE_REMOTE` set; the off-site copy arrives after the first night
- ☐ Continuous backup of the database (WAL archiving, or a managed database with it)
- ☐ **A restore test on a spare server from the off-site copy**, timed and recorded ([DISASTER-RECOVERY.md](DISASTER-RECOVERY.md)). A restore drill on a test database was done on 21 November 2026; the production one is still needed

## 6. Testing that needs people and devices

From [TESTING.md](TESTING.md).

- ☐ The Android app tried on a low-end phone (2 GB), a mid-range phone and a tablet
- ☐ The iPhone app tried through TestFlight on an older iPhone, a current iPhone and an iPad
- ☐ Edge, Firefox and Safari on computers; Chrome and Safari on phones
- ☐ Screen readers: NVDA or JAWS, VoiceOver, TalkBack
- ☐ Kiswahili reviewed by a native speaker
- ☐ **Independent penetration test**, with every high and critical finding fixed and checked again
- ☐ User acceptance testing with community Contributors, admins, a Super Admin and a partner institution; every critical and high problem fixed
- ☐ The speed and load tests repeated on the production server

## 7. People

- ☐ At least two Super Admins, named, each with an authenticator app
- ☐ The admin team named, registered and approved, each with an authenticator app
- ☐ Admins trained with the [Admin manual](ADMIN-GUIDE.md), on the test site
- ☐ The incident lead, technical lead and data protection contact named, with phone numbers, in [INCIDENT-RESPONSE.md](INCIDENT-RESPONSE.md)
- ☐ Who maintains the platform after the support period, and how it is paid for ([MAINTENANCE.md](MAINTENANCE.md))

## 8. Content

- ☐ About page: the project, partners and funder, with their correct names and logos
- ☐ The first testimonies and historical records imported from the collection, consent and validation complete
- ☐ The first collection or online exhibition, ready to approve
- ☐ The handbook completed with screenshots and published in **Learning resources**
- ☐ A launch announcement written

## 9. The apps in the stores

Steps in [STORE-RELEASE.md](STORE-RELEASE.md) and [IOS-RELEASE.md](IOS-RELEASE.md).

- ☐ Store listings: name, description, screenshots, privacy details, content rating, support address
- ☐ Google Play: the background-upload declaration (data sync) and the data safety form
- ☐ App Store: Sign in with Apple added in Xcode; App Privacy answers
- ☐ The apps point at the production address, and `MIN_APP_VERSION` is set

## 10. On the day

- ☐ A backup made just before opening
- ☐ The production address announced; the test site closed or clearly marked as a test
- ☐ The health check, error reports and moderation queue watched closely for the first days
- ☐ The first quarterly review booked ([MAINTENANCE.md](MAINTENANCE.md))
