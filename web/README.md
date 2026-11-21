# Website and web app

The Remembering the Waters website: a React + TypeScript single-page app (Vite), installable as a web app (PWA).
The API serves the built files from `web/dist` at the same address, so there is nothing separate to host.

| Command | What it does |
|---|---|
| `npm install` | Installs the packages (once) |
| `npm run dev` | Development server on http://localhost:5173 (needs the API running on port 4000) |
| `npm run build` | Type-checks and builds the site into `web/dist` |
| `npm test` | Runs the front-end tests |

Where things are:

- `src/App.tsx` – the page shell: the round icons, the persistent STORIES page and the page that opens beside it.
- `src/pages/` – one file per page (Stories, Share, Profile, About, Inbox, Announcements, Auth, Admin, Super …).
- `src/components/` – the story frame, media players, map, charts, dialogs and icons.
- `src/lib/` – the API client, sign-in state, offline queue, uploads and languages.
- `src/locales/` – interface text. English is the key; `sw.ts` is Kiswahili; `luo.ts` is waiting for a Dholuo translator.
- `src/styles.css` – the design tokens (colours, type, spacing, motion) and all styles.
