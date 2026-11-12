# Maritime Safety Heritage Archive: Clickable Prototype (v0.1)

The Phase 1 "clickable prototype" from the proposal (slide 18). It shows how the finished website and hybrid app will look and behave, using **sample content only**.

## How to open it

1. Double-click `index.html` (Chrome or Edge recommended).
2. That's it: no installation, server or database needed.

Be online for the showcase: the incident map tiles and fonts load from the internet. Offline, everything still works and the map switches to a simple offline view.

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Normal user (researcher) | researcher@demo.ke | demo1234 |
| Admin (research team) | admin@demo.ke | admin1234 |

The sign-in page also has one-click buttons for both. Use **Reset demo data** in the yellow bar to restore the original state before a showcase.

## Suggested 10-minute walkthrough

| # | Show | Proposal slide |
|---|---|---|
| 1 | Home page: mission, search bar, archive stats, the four material types | 4, 5 |
| 2 | Sign in as the **researcher** (everyone signs in) | 16 |
| 3 | Search `life jackets`, then filter by water body / decade / county; note highlighted matches inside transcripts | 7 |
| 4 | Open *Night crossings on the Likoni channel*: press play, the transcript follows along; click a line to jump | 5, 7 |
| 5 | Open a photograph (watermark), a document scan and a testimony; show the catalogue record, consent and licence notice | 8, 12 |
| 6 | **Map**: pins by type, click a list item to fly to it | 7 |
| 7 | **Contribute**: submit a story with a file and consent tick; it appears under "Your submissions" as Pending | 16 |
| 8 | **A+** and **Light** buttons: larger text and low-bandwidth mode | 8 |
| 9 | **📱 App**: the same archive inside a phone frame with an app tab bar | 9 |
| 10 | Sign out, sign in as **admin**: dashboard KPIs, visits and most-viewed | 16 |
| 11 | **Submissions** → *Approve & catalogue* → complete metadata → *Save & publish*; the item is now live in the archive | 8, 16 |
| 12 | **Records**: publish / unpublish; **Users & roles**: change role, suspend, reset password, create user | 16 |
| 13 | **Reports & logs**: views by water body, collection health, activity log, CSV export | 16 |

## What is simulated in the prototype

| Prototype | Full build (Months 13–16) |
|---|---|
| Data saved in the browser (localStorage) | Secure database + API shared by website and app |
| Placeholder artwork and simulated audio/video playback | Real media in cloud object storage, streamed via CDN |
| Demo passwords in plain text | Salted password hashes, email reset links, HTTPS |
| Phone frame preview | Store-ready Android and iOS hybrid app |
| Simple keyword search | Indexed full-text search with pagination |

## Files

- `index.html`: the page shell
- `assets/app.js`: all screens and behaviour
- `assets/data.js`: sample records, users and submissions (edit here to change demo content)
- `assets/styles.css`: design and responsive layout
