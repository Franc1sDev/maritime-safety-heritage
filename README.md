# Maritime Safety Heritage Archive: Clickable Prototype (v0.2)

**Open it in any browser:** https://franc1sdev.github.io/maritime-safety-heritage/

**Android app prototype:** see [`mobile-app/`](mobile-app/) and download the APK from the **Releases** page.

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

The sign-in page also has two round buttons, Researcher and Admin, that sign you in with one click. Before a showcase, open **See more → Reset demo data** to restore the original state.

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
