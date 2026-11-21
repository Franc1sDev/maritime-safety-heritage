# Maritime Safety Heritage Archive: website

The full website, built from the approved prototype's design: the same round options inside each page, "See more" for everything else, the sea slideshow on the welcome page, and pop-ups for details. It now works with real accounts, the real archive and real files through the API.

It is served by the API (see [`../backend`](../backend/README.md)) from the same address, so there is nothing to build or install separately. Run the API and open http://localhost:4000/.

## What it covers

- **Everyone:** welcome page, about, contact form, mobile app page.
- **Accounts:**
  - sign in, create an account;
  - reset a forgotten password by email;
  - edit your profile, change your password, sign out on one or every device.
- **Signed-in users:**
  - search with highlighted matches, including inside transcripts;
  - browse with filters (type, water body, decade, county, order) and pages;
  - items with real audio and video, a transcript that follows playback and is clickable, photos, documents, details, location, citation and related items;
  - the incident map;
  - sharing a story with up to 5 files and an upload progress bar, and seeing your submissions and their status.
- **Admins:**
  - a dashboard;
  - records: filter, publish, unpublish, delete and restore, and CSV export;
  - uploading and cataloguing, with subjects, a transcript editor and files;
  - reviewing submissions: approving creates a draft to catalogue, declining sends a note to the contributor;
  - users: create with a one-time password, change roles, suspend, reset passwords;
  - the contact inbox;
  - reports and the full audit log.

## Files

- `index.html`: the page shell
- `assets/api.js`: talks to the API. The sign-in token stays in memory; the session cookie is `httpOnly`.
- `assets/app.js`: every page
- `assets/styles.css`, `assets/icons.js`: design and icons (Lucide, ISC licence)
- `assets/vendor/leaflet`: map library (BSD licence), served locally

## Notes

- The welcome-page sea footage still streams from Mixkit, as in the prototype. Replace it with the project's own footage, or download it to the archive's storage, before launch.
- Map tiles come from CARTO and OpenStreetMap.
- The page only runs its own scripts and talks only to its own API: a strict Content Security Policy enforces this.
