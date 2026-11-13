# Maritime Safety Heritage Archive: API

The secure backend shared by the website and the mobile app. It runs on NestJS (Node.js) with PostgreSQL. The data model follows [`docs/METADATA.md`](../docs/METADATA.md).

## Run it on Windows

You need Node.js 22 or later and PostgreSQL (16, 17 or 18).

1. Double-click **`1-SETUP.bat`** (once). It does four things:
   - installs the packages;
   - creates a `maritime` database account and the `maritime_heritage` database;
   - writes `.env` with new random secrets;
   - creates the tables and loads the sample content.
2. Double-click **`2-START-API.bat`**. The API runs on http://localhost:4000/api/v1, and the interactive API docs open at http://localhost:4000/api/docs.
3. Double-click **`3-RUN-TESTS.bat`** to run the automated tests. They use a temporary database, so your data is not touched.

Local demo accounts: `researcher@demo.ke` / `demo1234` and `admin@demo.ke` / `admin1234`. Demo accounts are never created when `NODE_ENV=production`.

## Commands

| Command | What it does |
|---|---|
| `npm run build` | Compile to `dist/` |
| `npm start` | Run the compiled API |
| `npm run migrate` | Apply new SQL migrations from `src/database/migrations` |
| `npm run seed` | Create the first admin and, if enabled, the sample content |
| `npm test` | 28 end-to-end tests against a throwaway PostgreSQL |
| `npm run lint` | Type-check everything |

## What the API covers

| Area | Endpoints (all under `/api/v1`) | Who |
|---|---|---|
| Account | `auth/register`, `auth/login`, `auth/refresh`, `auth/logout`, `auth/logout-all`, `auth/me`, `auth/change-password`, `auth/forgot-password`, `auth/reset-password` | Everyone |
| Archive | `GET records` (full-text search, filters, sorting, pages), `GET records/map`, `GET records/:id` (by id or `MSH-0001`) | Signed in |
| Cataloguing | `POST records`, `PATCH records/:id`, `publish`, `unpublish`, `DELETE`, `restore`, `GET records/deleted` | Admin |
| Files | `POST records/:id/media`, `GET media/:id/link`, `DELETE media/:id`, `GET media/file/:id` (signed link, supports seeking) | Admin / signed in |
| Vocabularies | `GET vocab`; `POST/PATCH/DELETE vocab/subjects` | Signed in / admin |
| Submissions | `POST submissions` (up to 5 files), `GET submissions/mine`, `GET submissions`, `approve`, `reject` | Signed in / admin |
| Contact | `POST messages` (no sign-in); `GET/PATCH/DELETE messages` | Everyone / admin |
| Users | `GET/POST users`, `PATCH users/:id`, `POST users/:id/reset-password` | Admin |
| Reports | `reports/summary`, `reports/activity`, `reports/export?kind=records\|submissions\|activity` (CSV) | Admin |
| Health | `GET health` | Everyone |

## Security

- **Passwords:** salted scrypt hashes with a minimum strength rule. Sign-in takes the same time whether or not the email exists, and an account locks for 15 minutes after 5 failed attempts.
- **Sessions:**
  - Short-lived access tokens (15 minutes) and rotating refresh tokens (30 days), stored only as hashes.
  - Reusing an old refresh token ends every session of that account.
  - The website keeps its refresh token in an `httpOnly`, `SameSite=Strict` cookie, which needs a custom header to use. The app keeps it in secure device storage.
- **Access control:** every route needs sign-in unless it is marked public. Roles are checked on each request, and suspensions and role changes take effect immediately.
- **Input:** every request body and query is validated, and unknown fields are rejected. All database access uses parameters, never string-built SQL.
- **Files:**
  - Type is checked from the file's bytes, not its name.
  - Files are stored under random names with a SHA-256 checksum, and never public.
  - They are served only through signed links that expire after an hour, with `nosniff` and a sandboxing CSP.
- **Rate limits:** sign-in, registration, password reset, contact form and uploads.
- **Headers and CORS:** Helmet security headers, and CORS limited to listed origins.
- **Audit log:** every sign-in, failed sign-in, lockout and admin action is recorded with the IP address.
- **Errors:** unexpected errors are logged on the server and never shown to clients. CSV exports neutralise spreadsheet formulas.

## Configuration

Settings are read from `.env` (see [`.env.example`](.env.example)). In production the API refuses to start with weak or default secrets.

For media, `STORAGE_DRIVER=local` keeps files in `./storage`. `STORAGE_DRIVER=s3` uses any S3-compatible service: Cloudflare R2, AWS S3, Backblaze B2 or DigitalOcean Spaces.

## Sample content

The sample records are placeholders written for the prototype. They are not real testimonies.
