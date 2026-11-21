# API reference

Every route of the **Remembering the Waters** API. This page is generated from the server itself by `scripts/api-reference.py`; do not edit it by hand.

- **Base address:** `/api/v1` on the archive's address (for example `https://<your domain>/api/v1`).
- **Format:** JSON. Uploads use multipart form data, or the tus protocol for large files.
- **Signing in:** send the access token as `Authorization: Bearer <token>`. Tokens last about 15 minutes and are renewed with `POST /auth/refresh`.
- **Language:** send `X-Language: en` or `sw` (or `Accept-Language`) to get messages in that language.
- **Errors:** `{ "statusCode", "code", "message", "details" }`. `code` is stable and safe to test for; `message` is in the reader's language.
- **Lists:** long lists use a cursor: pass back `nextCursor` as `cursor` for the next page.
- **Repeating a request safely:** send an `Idempotency-Key` header when creating a story, so a retry cannot create it twice.
- **Live updates:** a Socket.IO connection on the same address carries notifications, message and analytics updates.
- **Interactive version:** `/api/docs` on a development or test server (it is off in production unless `API_DOCS=true`).

172 routes in 11 groups.

**Who may call** — *Anyone*: no sign-in needed. *Signed in*: any signed-in person. *Admin*, *Super Admin*: that role only.

## Analytics and PDF reports

| Method | Path | What it does | Who may call |
|---|---|---|---|
| GET | `/admin/analytics/ai` | AI quality measures, thresholds and today’s use | Admin or Super Admin |
| PUT | `/admin/analytics/ai/thresholds` | Recalibrate the GREEN / YELLOW / RED thresholds | Super Admin |
| GET | `/admin/analytics/charts` | The charts available | Admin or Super Admin |
| GET | `/admin/analytics/reports` | Previous and automatic monthly PDF reports | Admin or Super Admin |
| POST | `/admin/analytics/reports` | Generate a PDF report for a period with chosen charts (prepared in the background) | Admin or Super Admin |
| GET | `/admin/analytics/series` | A chart per day, week, month or year. Live updates arrive on the WebSocket “analytics” event. | Admin or Super Admin |
| GET | `/admin/analytics/summary` | The measures the platform reports: stories, contributors, counties, incidents, resources, moderation response | Admin or Super Admin |

## Approvals

| Method | Path | What it does | Who may call |
|---|---|---|---|
| GET | `/admin/approvals` | Approval requests with their votes and progress | Admin or Super Admin |
| GET | `/admin/approvals/waiting` | Requests waiting for my decision | Admin |
| GET | `/admin/approvals/{id}` | One approval request | Admin or Super Admin |
| POST | `/admin/approvals/{id}/resubmit` | Answer a request for changes and restart voting | Admin |
| POST | `/admin/approvals/{id}/vote` | Approve, reject or request changes, with a written justification | Admin |
| POST | `/super/approvals/{id}/decide` | Super Admin decision on a request that passed its deadline | Super Admin |

## Archive

| Method | Path | What it does | Who may call |
|---|---|---|---|
| POST | `/admin/announcements` | Publish an announcement, with dates for the calendar and an optional push notification | Admin |
| PATCH | `/admin/announcements/{id}` | Edit an announcement (it moves back to the top, labelled Edited) | Admin |
| DELETE | `/admin/announcements/{id}` | Delete an announcement | Admin |
| POST | `/admin/collections` | Create a collection; submit=true sends it for approval | Admin |
| PATCH | `/admin/collections/{id}` | Edit a collection | Admin |
| GET | `/admin/export/archive` | Archive exports | Admin or Super Admin |
| POST | `/admin/export/archive` | Export the whole archive in a standard format (prepared in the background) | Admin or Super Admin |
| GET | `/admin/feedback` | Feedback received | Admin or Super Admin |
| GET | `/admin/import` | Import batches | Admin |
| POST | `/admin/import` | Check a metadata spreadsheet (CSV or .xlsx) against the uploaded files; shows what is ready and what needs attention | Admin |
| GET | `/admin/import/template` | The metadata spreadsheet template for bulk import | Admin |
| GET | `/admin/import/{id}` | One batch with the result for every row | Admin |
| POST | `/admin/import/{id}/submit` | Submit the ready rows for approval as one request | Admin |
| POST | `/admin/incidents` | Create an incident record | Admin |
| PATCH | `/admin/incidents/{id}` | Edit an incident record and link stories and records to it | Admin |
| POST | `/admin/incidents/{id}/decline` | Decline an incident suggested by a contributor | Admin |
| POST | `/admin/places` | Add a place | Admin |
| PATCH | `/admin/places/{id}` | Edit a place | Admin |
| POST | `/admin/resources` | Add a learning resource or online exhibition | Admin |
| PATCH | `/admin/resources/{id}` | Edit a resource | Admin |
| DELETE | `/admin/resources/{id}` | Remove a resource | Admin |
| GET | `/admin/safety-concerns` | The safety concerns queue | Admin |
| PATCH | `/admin/safety-concerns/{id}` | Acknowledge, add notes, record a referral, or close | Admin |
| GET | `/announcements` | Announcements, most recently created or edited first | Anyone |
| POST | `/announcements/{id}/read` | Mark an announcement as opened | Signed in |
| GET | `/collections` | Curated collections and online exhibitions | Anyone |
| GET | `/collections/{id}` | One collection with its stories | Anyone |
| GET | `/config` | Lists and standard texts: languages, categories, report and deletion reasons, rules, limits | Anyone |
| POST | `/feedback` | Suggest an improvement to the archive | Anyone |
| GET | `/incidents` | Incident records, searchable by name, year, water body and type | Anyone |
| GET | `/incidents/export.csv` | The incident records as a dataset (CSV) | Anyone |
| POST | `/incidents/match` | Suggest the incident a story may belong to, for a person to confirm | Signed in |
| GET | `/incidents/{id}` | An incident page with every story, testimony and record linked to it | Anyone |
| GET | `/map` | Map Explore: stories (clustered when zoomed out) and the incident layer; bbox=west,south,east,north | Anyone |
| GET | `/places` | Location auto-complete from the places list | Anyone |
| GET | `/resources` | Learning resources: filter by type, audience and language | Anyone |
| GET | `/resources/{id}` | Read one resource on screen | Anyone |
| POST | `/resources/{id}/download` | A download link for the resource file (counted) | Anyone |
| POST | `/safety-concerns` | Report a current safety concern on the water. Not an emergency service. | Anyone |
| GET | `/search` | Search stories, transcripts, incidents, places, contributors and learning resources | Anyone |
| GET | `/timeline` | Stories and incidents by decade and year of the event | Anyone |

## Health

| Method | Path | What it does | Who may call |
|---|---|---|---|
| GET | `/health` | Is the API up and can it reach the database? | Anyone |

## INBOX

| Method | Path | What it does | Who may call |
|---|---|---|---|
| GET | `/inbox` | My conversations and message requests, each with its unread count | Signed in |
| POST | `/inbox` | Send a message to a person, to the admins, or into a conversation. Idempotency-Key prevents duplicates on retry. | Contributor or Admin |
| GET | `/inbox/{id}` | The full correspondence of one conversation | Signed in |
| POST | `/inbox/{id}/accept` | Accept a message request | Signed in |
| POST | `/inbox/{id}/decline` | Decline a message request | Signed in |
| POST | `/inbox/{id}/read` | Mark a conversation as read | Signed in |

## Manage admins and audit log

| Method | Path | What it does | Who may call |
|---|---|---|---|
| GET | `/admin/audit-log` | The audit log: Super Admins see everything, admins their own actions | Admin or Super Admin |
| PUT | `/admin/contributors/{id}/trained` | Mark a Contributor as trained (for the “active trained contributors” measure) | Admin |
| GET | `/super/admins` | Admins, Super Admins and registrations waiting for approval | Super Admin |
| POST | `/super/admins/invite` | Add an admin by invitation | Super Admin |
| POST | `/super/admins/{id}/decision` | Approve or decline an admin registration | Super Admin |
| GET | `/super/admins/{id}/id-number` | Show an admin’s ID or passport number (recorded in the audit log) | Super Admin |
| POST | `/super/admins/{id}/promote` | Add a Super Admin from the existing admins | Super Admin |
| POST | `/super/admins/{id}/remove` | Remove an admin (they lose access immediately) | Super Admin |
| GET | `/super/jobs` | Background job queue: waiting, working and failed | Super Admin |

## Media

| Method | Path | What it does | Who may call |
|---|---|---|---|
| POST | `/media` | Upload one file. It is type-checked, virus-scanned and stored encrypted; attach it to a story, comment or message by its id. | Anyone |
| GET | `/media/avatar/{id}` | A profile photo | Anyone |
| GET | `/media/file/{id}/{variant}` | Download or stream a file (signed, expiring link only) | Anyone with a valid signed link |
| DELETE | `/media/{id}` | Remove a file you uploaded and have not yet used | Signed in |
| POST | `/uploads` | tus: start a resumable upload (Upload-Length and Upload-Metadata headers) | Signed in |
| OPTIONS | `/uploads` | tus: what this server supports | Anyone |
| GET | `/uploads/{id}` | The stored file of a finished resumable upload (its id is what a story, comment or message attaches) | Signed in |
| PATCH | `/uploads/{id}` | tus: send the next piece (Upload-Offset header, application/offset+octet-stream body) | Signed in |
| DELETE | `/uploads/{id}` | tus: cancel an upload | Signed in |
| HEAD | `/uploads/{id}` | tus: how much has arrived so far | Signed in |

## Moderation and reports

| Method | Path | What it does | Who may call |
|---|---|---|---|
| POST | `/admin/accounts/{id}/action` | Warn, suspend or propose permanent deletion of an account | Admin |
| GET | `/admin/held/{kind}` | Comments or messages held by AI review | Admin |
| POST | `/admin/held/{kind}/{id}` | Allow or block a held comment or message | Admin |
| GET | `/admin/moderation` | Stories with their ID and AI flag; filter by flag, pending review, AI-blocked not overridden, AI-blocked overridden; sort by most recent or oldest | Admin |
| GET | `/admin/reports` | The reports queue, grouped by item | Admin |
| POST | `/admin/reports/{type}/{id}/action` | Dismiss, warn, drop the story, suspend, or propose permanent deletion | Admin |
| POST | `/admin/reports/{type}/{id}/notes` | Add an internal note | Admin |
| POST | `/admin/stories/{id}/comments-hide` | Hide or show comments, with a reason shown to Contributors | Admin |
| POST | `/admin/stories/{id}/comments-lock` | Lock or unlock comments, with a reason shown to Contributors | Admin |
| POST | `/admin/stories/{id}/correction` | Add or clear a correction note linking to official safety guidance | Admin |
| GET | `/admin/stories/{id}/history` | Moderation history of a story | Admin |
| POST | `/admin/stories/{id}/keep-blocked` | Keep a RED story blocked | Admin |
| POST | `/admin/stories/{id}/override` | Override an AI ban: needs a justification and the other admins’ approval | Admin |
| POST | `/admin/stories/{id}/release` | Publish a story the AI could not check, after reading it | Admin |
| POST | `/admin/stories/{id}/remove` | Delete a story (the Contributor is told and can Ask Why) | Admin |
| POST | `/admin/stories/{id}/restore` | Second review: restore a removed story (a different admin from the one who removed it) | Admin |
| POST | `/admin/stories/{id}/validate` | Record that a testimony was validated with its storyteller (and publish it if it was waiting) | Admin |
| POST | `/admin/stories/{id}/withdraw-consent` | The storyteller withdrew consent: remove the story | Admin |
| POST | `/auth/suspension/ask-why` | Ask why my account is suspended (with the token given at sign-in) | Anyone |
| POST | `/reports` | Report a story, a comment or a Contributor: one or more preset reasons and/or a description | Contributor or Admin |
| POST | `/stories/{id}/ask-why` | Ask the admins why my story was removed or not posted | Signed in |

## Profile and people

| Method | Path | What it does | Who may call |
|---|---|---|---|
| GET | `/contributors` | Contributors who have posted at least one story, with search | Anyone |
| GET | `/contributors/{username}` | A Contributor’s public profile | Anyone |
| GET | `/me/blocked` | People I have blocked or muted | Signed in |
| POST | `/me/delete` | Delete my account: one preset reason and/or my own words. Removed at once, erased after 30 days. | Signed in |
| POST | `/me/export` | Download my data: prepared in the background as a ZIP | Signed in |
| GET | `/me/exports` | My data downloads | Signed in |
| GET | `/me/following` | Who I follow | Signed in |
| GET | `/me/notifications` | My notifications and unread counts; priority=true for the floating ones that need my action | Signed in |
| POST | `/me/notifications/read` | Mark all notifications read | Signed in |
| POST | `/me/notifications/{id}/read` | Mark one notification read | Signed in |
| POST | `/me/push-tokens` | Register this device or browser for push notifications | Signed in |
| POST | `/me/push-tokens/remove` | Stop push notifications on this device | Signed in |
| GET | `/me/reminders` | My reminders | Signed in |
| POST | `/me/reminders` | Add a reminder with a due time | Signed in |
| PATCH | `/me/reminders/{id}` | Change a reminder | Signed in |
| DELETE | `/me/reminders/{id}` | Delete a reminder | Signed in |
| PUT | `/me/reminders/{id}/done` | Mark a reminder done or not done | Signed in |
| PATCH | `/me/settings` | Theme, high contrast, text size, reduced motion, language, low-data mode, read receipts, notification settings and quiet hours | Signed in |
| GET | `/people/search` | People to tag with @ | Signed in |
| PUT | `/people/{id}/block` | Block or unblock | Signed in |
| PUT | `/people/{id}/follow` | Follow or unfollow a Contributor | Contributor or Admin |
| PUT | `/people/{id}/mute` | Mute or unmute | Signed in |

## Sign-in and account

| Method | Path | What it does | Who may call |
|---|---|---|---|
| POST | `/auth/admin/email` | Change the verification email: sends a code to the new address | Admin or Super Admin |
| POST | `/auth/admin/email/confirm` | Confirm the new verification email | Admin or Super Admin |
| POST | `/auth/admin/forgot-password` | Email a password reset link to an admin | Anyone |
| POST | `/auth/admin/login` | Admin sign-in, step 1: email and password | Anyone |
| POST | `/auth/admin/mfa/authenticator` | Start adding an authenticator app | Admin or Super Admin |
| POST | `/auth/admin/mfa/authenticator/confirm` | Confirm the authenticator app with a code | Admin or Super Admin |
| POST | `/auth/admin/mfa/authenticator/remove` | Remove the authenticator app | Admin or Super Admin |
| POST | `/auth/admin/mfa/send` | Send a sign-in code by email or SMS | Anyone |
| POST | `/auth/admin/mfa/verify` | Admin sign-in, step 2: the second factor | Anyone |
| PATCH | `/auth/admin/password` | Change the admin password | Admin or Super Admin |
| POST | `/auth/admin/register` | Admin registration (approved by a Super Admin), or completing an invitation | Anyone |
| POST | `/auth/admin/reset-password` | Choose a new admin password with the emailed link | Anyone |
| POST | `/auth/demo` | Local demo only: sign in as a sample Contributor | Anyone |
| POST | `/auth/logout` | Sign out of this device | Anyone |
| GET | `/auth/me` | The signed-in account | Signed in |
| POST | `/auth/oauth/apple` | Continue with Apple: sign in, or create a Contributor account | Anyone |
| POST | `/auth/oauth/apple/callback` | Return address for Sign in with Apple on Android | Anyone |
| POST | `/auth/oauth/google` | Continue with Google: sign in, or create a Contributor account | Anyone |
| POST | `/auth/profile` | First-time profile setup, and later profile changes | Contributor |
| GET | `/auth/providers` | Sign-in options for Contributors (Google, Apple) with their public client ids | Anyone |
| POST | `/auth/refresh` | Swap the refresh token for a new session | Anyone with a valid refresh token |
| POST | `/auth/restore` | Restore an account within 30 days of deleting it | Anyone |
| GET | `/auth/sessions` | Devices signed in to this account | Signed in |
| POST | `/auth/sessions/end-all` | Sign out everywhere | Signed in |
| DELETE | `/auth/sessions/{id}` | Sign out one device | Signed in |
| GET | `/auth/username-available` | Check a username as it is typed | Anyone |

## Stories

| Method | Path | What it does | Who may call |
|---|---|---|---|
| DELETE | `/comments/{id}` | Delete my comment | Signed in |
| PUT | `/comments/{id}/reaction` | React to a comment | Contributor or Admin |
| GET | `/comments/{id}/translate` | Machine translation of a comment, cached | Anyone |
| GET | `/me/stories` | My stories, with their engagement and views, and my drafts | Signed in |
| PUT | `/media/{id}/transcript` | Correct the transcript of an audio or video file | Signed in |
| GET | `/stories` | The story feed for every “Stories by” tab: trending, following, favorites, location, contributor, incident, collection, timeline and search | Anyone |
| POST | `/stories` | Share a story (or save a draft). Send an Idempotency-Key header so a retry never creates a duplicate. | Contributor or Admin |
| GET | `/stories/downloads/{exportId}` | Is the ZIP download ready? | Anyone |
| POST | `/stories/suggest` | AI suggestions for category, tags and language, for the contributor to confirm | Signed in |
| GET | `/stories/{id}` | One story by id or story ID (e.g. MS-2026-00918) | Anyone |
| PATCH | `/stories/{id}` | Edit a draft or a published story (changes to a published story are checked before they show) | Contributor or Admin |
| DELETE | `/stories/{id}` | Delete my story (recoverable for 30 days, then erased) | Signed in |
| GET | `/stories/{id}/cite` | Ready-made citations and the permanent link | Anyone |
| GET | `/stories/{id}/comments` | Comments and replies; sort=top (default), recent or oldest | Anyone |
| POST | `/stories/{id}/comments` | Comment or reply, with text, a file, or both; tag people with @username | Contributor or Admin |
| POST | `/stories/{id}/download` | Prepare a ZIP of the story’s content (where the contributor allows downloads) | Anyone |
| PUT | `/stories/{id}/favourite` | Add to Favorites, or remove if it is already there | Contributor or Admin |
| PUT | `/stories/{id}/reaction` | React with Heart, Heartbreak or Laugh; the same reaction again removes it | Contributor or Admin |
| GET | `/stories/{id}/review` | Progress and outcome of the AI review | Signed in |
| POST | `/stories/{id}/share` | Record a share, a copied link or a citation | Anyone |
| POST | `/stories/{id}/submit` | Send a draft for AI review | Contributor or Admin |
| GET | `/stories/{id}/translate` | Machine translation into the reader’s language, cached | Anyone |
| POST | `/stories/{id}/view` | Record a view | Anyone |
