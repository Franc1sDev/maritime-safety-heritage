# Architecture

How **Remembering the Waters** is built, for whoever maintains or extends it. It covers Section 2 (system architecture) and Section 8 (performance and growing) of the master plan. For running it, see [DEPLOYMENT.md](DEPLOYMENT.md); for every route, [API.md](API.md).

## The parts

```
  Website (React)        Android and iOS app (Flutter)
        │                          │
        └──────────── HTTPS ───────┘          (optional CDN in front)
                         │
                 Caddy (certificates, compression)
                         │
          ┌──────── API + website server (NestJS, Node.js) ────────┐
          │  REST API /api/v1   ·   live updates (Socket.IO)        │
          │  background jobs    ·   serves the built website        │
          └───┬───────────┬──────────────┬─────────────┬───────────┘
              │           │              │             │
         PostgreSQL     Redis        media storage    outside services
         (all data,   (optional:    (server disk,     AI review, email,
          and the     queue, cache,  S3-compatible,   SMS, push, maps,
          job queue    live updates  or the database   virus scanner
          without      across        on the free
          Redis)       servers)      test site)
```

| Part | Technology | Folder |
|---|---|---|
| API and server | NestJS 11 on Node.js 22, TypeScript | `backend/` |
| Database | PostgreSQL (16 or 17), plain SQL through a small helper (`common/db.ts`); migrations in `backend/src/database/migrations` | |
| Website | React 18, TypeScript, Vite; TanStack Query; i18next; installable (PWA) with offline reading | `web/` |
| App | Flutter, one code base for Android and iOS | `mobile-app/` |
| Deployment | Docker Compose: API, PostgreSQL, Redis, ClamAV, Caddy, backup | `deploy/` |
| Free test site | Render, from `render.yaml` | |

The server is a **modular monolith**: one program, divided into modules with clear jobs. This is simpler to run and maintain than many small services, and any module can later be moved out if it ever needs to be.

## Server modules

| Module | Folder | Does |
|---|---|---|
| Auth | `auth/` | Google and Apple sign-in for Contributors; email, password and second-step code (authenticator app, email or SMS) for admins; tokens, refresh with reuse detection, lockout, sessions |
| Users | `users/` | Profiles, settings, follows, blocks and mutes, reminders, notifications, data download, deleting an account |
| Stories | `stories/` | Stories, testimonies and records; the feed and every “Stories by” tab; search; reactions, comments, favourites, shares, views, citations, translations, transcripts |
| Media | `media/` | Uploads (ordinary and resumable tus), file-type checks, virus scanning, web copies, encryption at rest, signed links |
| AI | `ai/` | The review of stories, comments and messages; category and tag suggestions; transcription; translation. Providers: Anthropic, OpenAI, Gemini, or the built-in rule-based check |
| Moderation | `moderation/` | The moderation queues, admin decisions, reports, account actions, appeals (“Ask Why”), safety concerns |
| Approvals | `approvals/` | Requests that need the admins' agreement, votes, the two-thirds rule, deadlines, overdue requests going to the Super Admins |
| Archive | `archive/` | Incidents, places, collections and exhibitions, learning resources, announcements, the map, bulk import, full export |
| Inbox | `inbox/` | Conversations, message requests, messages to the admins |
| Team | `team/` | Admin registration and invitations, managing admins, the audit log, the Background work page |
| Analytics | `analytics/` | Live figures, charts, AI quality, PDF reports (including the automatic monthly one) |
| Public | `public/` | Search-engine pages, link previews for shared stories, sitemap, app links (`/.well-known/…`) |
| Health | `health/` | `/api/v1/health` for the uptime monitor |
| Common | `common/` | Database helper, errors and messages in each language, rate limits, audit, notifications, email, jobs, cache, live updates, encryption, spreadsheets, PDFs, ZIPs |

## Data

About 50 tables. The main ones:

| Area | Tables |
|---|---|
| People | `users`, `admin_profiles`, `refresh_tokens`, `mfa_codes`, `push_tokens`, `follows`, `blocks` |
| Content | `stories`, `media_files`, `transcript_segments`, `content_translations`, `consent_records`, `record_sources` |
| Engagement | `reactions`, `comments`, `comment_reactions`, `favourites`, `shares`, `story_views` |
| Archive | `incidents`, `places`, `water_bodies`, `collections`, `collection_items`, `resources`, `announcements` |
| Moderation | `moderation_decisions`, `reports`, `safety_concerns`, `approval_requests`, `approval_votes` |
| Messages | `conversations`, `conversation_members`, `dm_messages`, `notifications`, `reminders` |
| Running | `jobs`, `activity_log` (the audit log), `analytics_events`, `analytics_daily`, `analytics_reports`, `ai_usage`, `app_settings`, `import_batches`, `data_exports` |

Some older tables (`records`, `submissions`, `subjects` and others) remain from version 1 so that an upgrade loses nothing. Version 2 does not use them.

**Migrations** run automatically when the server starts, in number order. Each runs once. Never change a migration that has already run anywhere; add a new one.

**Stable codes:** stories `MS-2026-00042`, incidents `INC-0003`, admins `ADM-0007` ([METADATA.md](METADATA.md)).

## How a story travels

1. The person uploads files first. Each is checked by its contents (not its name), scanned for viruses, encrypted and stored. A background job makes the web copies.
2. The story is created with an `Idempotency-Key`, so a retry on a bad connection cannot create it twice.
3. On **SEND** a background job reviews it. The AI gives a score and an explanation per guideline: GREEN publishes, YELLOW publishes with a note, RED blocks and queues it for the admins.
4. The person is told the result through a notification and a live update.
5. Admins act on RED items. Overrides, company stories, collections, imports and permanent account deletions go through approvals.
6. Every decision is written to the audit log, which cannot be changed.

## Background work

Slow work never runs inside a person's request. Jobs are kept in PostgreSQL, or in Redis through BullMQ when `REDIS_URL` is set. They are retried with increasing waits, and failures show on the Super Admin's **Background work** page.

| Job | Does |
|---|---|
| `media.process` | Web copies of images, audio and video |
| `story.review` | AI review of a story |
| `story.transcribe` | Transcript of audio or video |
| `story.zip` | A story's files for download |
| `import.run` | Creates the items of an approved import batch |
| `archive.export` | The full export |
| `user.export` | A person's data download |
| `analytics.report` | A PDF report |

Timed tasks also run:

| Every | Task |
|---|---|
| Minute | Reminders that are due |
| 5 minutes | Trending order of stories |
| 10 minutes | Analytics totals |
| 15 minutes | Approvals past their deadline go to the Super Admins |
| 30 minutes | Reports open for more than 48 hours are flagged and the admins are reminded |
| Hour | Erasing accounts and stories whose waiting time has passed |
| 6 hours | Checking stored media files against their checksums; the automatic monthly report (once a month) |
| 12 hours | A warning when media storage is nearly full |

## Security in the design

The full list is in [SECURITY.md](SECURITY.md). In brief:

- Every route is closed unless marked public, and roles are checked on the server. The access test proves this route by route on every change.
- Admins sign in with a second step. Tokens are short-lived, and reusing an old refresh token signs that account out everywhere.
- Media is encrypted at rest (AES-256) with a checksum for each file, and served through signed links that expire. Originals are never served.
- Admins' ID or passport numbers are encrypted field by field (AES-256-GCM, which also detects tampering).
- Every input is validated. Unreadable values are refused with a clear message, never a server error.
- Rate limits on every route: 180 requests a minute by default, 10 sign-in attempts a minute, and set limits for posting, commenting, messaging, reporting and the public forms (`common/rate-limits.ts`).
- Errors never reveal internal details.

## Languages

All text on screen is written in English and used as the key. Each language is one file: `web/src/locales/sw.ts` for the website. The app's `assets/i18n/sw.json` is generated from the website's file plus `sw.app.json` by `scripts/sync-translations.mjs`. Messages from the server are in `backend/src/common/messages.ts`. To add a language, add a file, add the language to the list in the server configuration, and rebuild.

## Settings

Every setting is an environment variable with a safe default. The full list with explanations is in `backend/.env.example`; the most important are in [DEPLOYMENT.md](DEPLOYMENT.md). Outside services are each behind one setting and can be changed or switched off:

| Service | Settings | Without it |
|---|---|---|
| AI | `AI_PROVIDER`, `AI_API_KEY` | The built-in rule-based review |
| Email | `SMTP_*` or `MAIL_WEBHOOK_URL` | No emails are sent (sign-in codes, password resets, alerts); admins sign in with an authenticator app or SMS codes |
| SMS | `AT_USERNAME`, `AT_API_KEY` | Codes by email and authenticator app |
| Push | `FCM_SERVICE_ACCOUNT`, `VAPID_*` | Notifications in the archive only |
| Storage | `STORAGE_DRIVER` and `S3_*` | Server disk |
| Virus scanner | `CLAMAV_HOST`, `CLAMAV_REQUIRED` | In production uploads are refused while the scanner cannot be reached. With `CLAMAV_REQUIRED=false` (as on the free test site) files are still type-checked but not scanned |
| Maps | `GOOGLE_MAPS_BROWSER_KEY` | The website's built-in map |

## Growing

The archive runs on one server for its expected use. When it needs more:

| Need | Step | Code change |
|---|---|---|
| More people at once | A larger server, then a second API container behind Caddy. Set `REDIS_URL` so jobs, cache and live updates are shared | None |
| Heavy background work | Run a separate worker container with `JOBS_WORKER=true`, and `JOBS_WORKER=false` on the API containers | None |
| More reading from the database | A read replica, or a managed PostgreSQL | Small |
| Faster worldwide | A CDN in front (Cloudflare); the website's files are already compressed and cached for a year | None |
| More media | S3-compatible object storage, with lifecycle rules that move originals to low-cost archive storage | None |

The load test ([TESTING.md](TESTING.md)) shows where a server of a given size reaches its limit.

## Where to start in the code

- `backend/src/app.module.ts` — how the modules fit together.
- `backend/src/config/config.ts` — every setting.
- `backend/src/stories/stories.service.ts` — the feed, search and stories.
- `backend/src/ai/ai.service.ts` — the review.
- `web/src/App.tsx` — the website's shell and routes.
- `mobile-app/lib/main.dart` — the app's shell.
- `backend/test/api.e2e-spec.ts` — the best description of how everything is meant to behave.
