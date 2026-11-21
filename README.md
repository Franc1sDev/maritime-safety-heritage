# Remembering the Waters

Kenya's open-access archive of maritime and inland-water safety heritage: stories, testimonies, historical records and
incident records from the coast, the lakes and the rivers. Version 2 follows the *Development Master Plan* (v1.2); progress
against every requirement is in [`docs/MASTER-PLAN-CHECKLIST.md`](docs/MASTER-PLAN-CHECKLIST.md).

| Part | Folder |
|---|---|
| API (NestJS + PostgreSQL): sign-in, stories, AI review, moderation and approvals, inbox, incidents, analytics | [`backend/`](backend/README.md) |
| Website and web app (React + TypeScript), served by the API at the same address | [`web/`](web/README.md) |
| Android and iOS app (Flutter), using the same API and the same wording | [`mobile-app/`](mobile-app/README.md) |
| Hosting: Docker, automatic HTTPS, Redis, virus scanning, encrypted backups | [`deploy/`](deploy/), [`Dockerfile`](Dockerfile), [`render.yaml`](render.yaml) |
| The earlier website and app, kept for reference | `_old_web/`, `_old_app/` |

## Documentation

| For | Read |
|---|---|
| Everyone who uses the archive | [User guide](docs/USER-GUIDE.md) |
| People collecting and adding stories | [Handbook](docs/HANDBOOK.md), [Metadata standard](docs/METADATA.md) and its [template](docs/metadata-template.csv) |
| Admins | [Admin manual](docs/ADMIN-GUIDE.md) |
| Super Admins | [Super Admin guide](docs/SUPER-ADMIN-GUIDE.md) |
| Developers | [Architecture](docs/ARCHITECTURE.md), [API reference](docs/API.md), [Testing](docs/TESTING.md) |
| Whoever hosts it | [Deployment](docs/DEPLOYMENT.md), [Security](docs/SECURITY.md), [Backups and disaster recovery](docs/DISASTER-RECOVERY.md), [Incident response](docs/INCIDENT-RESPONSE.md), [Maintenance](docs/MAINTENANCE.md) |
| Publishing the apps | [Store release](docs/STORE-RELEASE.md), [iOS release](docs/IOS-RELEASE.md) |
| Launch and handover | [Go-live checklist](docs/GO-LIVE.md), [Handover](docs/HANDOVER.md), [Accessibility](docs/ACCESSIBILITY.md) |

## Try it on Windows

Open `backend` and double-click `4-TRY-WITH-DEMO-DATABASE.bat`. It needs no PostgreSQL setup. Run `1-SETUP.bat` first (it installs the packages and builds the website). Then go to http://localhost:4000/. Contributors use the test sign-in (any name); admins sign in at `/admin/sign-in` with `grace@demo.ke` / `admin1234` (the sign-in code is printed in the window), and the Super Admin with `admin@demo.ke` / `admin1234`. These demo accounts exist only outside production.

Every push runs the checks in [`.github/workflows/ci.yml`](.github/workflows/ci.yml):

- the API's 44 end-to-end tests;
- the website's type check, tests and build;
- the Android APK and Google Play bundle;
- the unsigned iOS build;
- the production server image.

---

# Clickable prototype (v0.2, phase 1)

**Open it in any browser:** https://franc1sdev.github.io/maritime-safety-heritage/

**Android app prototype:** download https://franc1sdev.github.io/maritime-safety-heritage/downloads/Maritime-Heritage-prototype.apk (source in [`mobile-app/`](mobile-app/)).

The Phase 1 "clickable prototype" from the proposal (slide 18). It shows how the finished website and hybrid app will look and behave, using **sample content only**.

## What's new in v0.2

- **Blue, black and white theme**, with icons for every option, type of material and fact.
- **Round "orb" buttons inside each page** for the main options. Clicking one zooms it in and shows a short description that fades away, then the option opens. Clicking it a second time skips the wait.
- **See more** (also round) reveals the remaining options in a left-hand rail and at the top, with a brief blue glow so you can see what appeared. The left and right margins stay empty until then.
- **Top bar** keeps only My account and Sign out.
- **The landing page and the welcome page after sign-in** (users and admins) play a slideshow of real sea footage behind the orbs: waves, the tide, fishermen on a boat, ferries arriving, rowing, a boat at dusk.
- **No video?** Check Light mode. It hides video to save data and is remembered between visits. The welcome page shows a **Show video** button while it is on.
- **Every other page** has a large icon in the background showing what the page is about.
- **Extra details open in pop-ups** instead of cluttering the page. Examples: filters, catalogue records, locations, citations, password changes, user creation, map list.
- **Quick search** under See more, or with **Ctrl + K** from any page.

## How to open it

- **Online:** https://franc1sdev.github.io/maritime-safety-heritage/
- **Offline copy:** double-click `index.html` (Chrome or Edge recommended). No installation, server or database needed.

**Be online for the showcase, with Light mode off.** The background videos, map, and fonts load from the internet. Offline, everything still works: the landing and welcome pages show a wave icon instead of video, and the map switches to a simple offline view.

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Normal user (researcher) | researcher@demo.ke | demo1234 |
| Admin (research team) | admin@demo.ke | admin1234 |

There is one sign-in form for everyone; the account decides where you land (the research team goes straight to the dashboard). Before a showcase, open **See more → Reset demo data** to restore the original state.

## Suggested 10-minute walkthrough

| # | Show | Proposal slide |
|---|---|---|
| 1 | Landing page, then sign in as **Researcher**: the welcome page with the sea slideshow | 4, 16 |
| 2 | Click an orb once to show the zoom and description; click **See more** to show the rail and top options appearing with the blue glow | 8 |
| 3 | **Search**: type `life jackets`; matches are highlighted, even inside transcripts | 7 |
| 4 | **Browse**: switch type with the orbs, then open **Filters** (water body, decade, county, order) | 7 |
| 5 | Open *Night crossings on the Likoni channel*: **Play** (the transcript follows along), then **Details**, **Location**, **Cite** | 5, 7, 12 |
| 6 | **Incident map**: type orbs at the bottom, **List** to fly to a place | 7 |
| 7 | **Share a story**: pick a type orb, fill in the form, send it; it appears under **My submissions** | 16 |
| 8 | **See more → Light mode** and **Larger text**: low-bandwidth and accessibility | 8 |
| 9 | **See more → Mobile app preview**: the same archive in a phone frame | 9 |
| 10 | Sign out, sign in as **Admin**: the welcome page now offers Dashboard, Review and Upload | 16 |
| 11 | **Review** → **Approve and catalogue** → **Save and publish**: the item goes live | 8, 16 |
| 12 | **Dashboard** orbs: Records (publish/unpublish), Users (roles, suspend, reset password), Messages, Reports (charts, activity log, CSV export) | 16 |

## What is simulated in the prototype

| Prototype | Full build (Months 13–16) |
|---|---|
| Data saved in the browser (localStorage) | Secure database and API shared by website and app |
| Placeholder artwork and simulated audio/video playback for archive items | Real media in cloud object storage, streamed via CDN |
| Welcome-page footage streamed from Mixkit | Footage downloaded and served from the archive's own storage (or replaced with the project's own footage) |
| Demo passwords in plain text | Salted password hashes, email reset links, HTTPS |
| Phone-frame preview | Store-ready Android and iOS hybrid app |
| Simple keyword search | Indexed full-text search with pagination |

## Credits

- Icons: [Lucide](https://lucide.dev) (ISC licence), embedded in `assets/icons.js` so they work offline.
- Welcome-page footage: [Mixkit](https://mixkit.co) free stock video licence.
- Map tiles: © OpenStreetMap contributors, © CARTO.
- Fonts: Sora and Manrope from Google Fonts.

## Files

- `index.html`: the page shell
- `assets/app.js`: all screens and behaviour
- `assets/data.js`: sample records, users and submissions (edit this to change demo content)
- `assets/icons.js`: the icon set
- `assets/styles.css`: design and responsive layout
