# Master plan checklist

Every requirement in **Maritime Heritage Project - Development Master Plan.docx** (version 1.2, 20 November 2026), section by section, top to bottom. Items are ticked as they are built and checked.

**Progress: 499 of 1190 items ticked, 180 partly done**

How to read it:

- `[ ]` not done yet
- `[x]` built and checked against the plan (☒ in the Word copy)
- `[~]` partly done; the note after the item says what is left

Some items already exist in the current build. They stay unticked until each one has been checked against the plan's wording.

## The five stages of work

| Stage | Plan sections it covers |
|---|---|
| 1. Backend | Section 2; the server side of Sections 4 (security), 5 (AI), 6 (performance), 7 (storage and backup) and 8 (network); Appendices A and C |
| 2. Front end: website and web app | Sections 3.1 and 3.2, desktop wireframes D1 onwards, and the web side of Sections 4, 6 and 8 |
| 3. Front end: Android app | Section 3.3, mobile wireframes M1 onwards, and the app side of Sections 6 and 8 |
| 4. Front end: iOS app | Section 3.3 (iOS items), Sections 3.3.4 and 9.5 for the App Store |
| 5. Deployment | Section 9, with Section 10 (testing) and Section 11 (delivery, documents and handover) |

Testing (Section 10) runs inside every stage. Appendix B lists decisions still open; the plan's recommended default is used for each until decided otherwise.

---
## SECTION 1: INTRODUCTION

### 1.1 Project Purpose

Remembering the Waters: Co-creating Kenya’s Maritime and Inland-Water Safety Heritage Archive for Equity, Memory, and Future Transitions will create Kenya’s first national archive dedicated to maritime and inland-water safety heritage. The project will document past ferry and boat disasters, everyday safety experiences and community knowledge from coastal and lake regions, so that lives lost and lessons learned are not forgotten.

The need is clear. Water-transport accidents have claimed thousands of lives in Kenya over decades, among them the 1994 Mtongwe ferry disaster in Mombasa and repeated fishing-vessel and passenger-boat accidents on Lake Victoria, while busy crossings such as the Likoni Channel carry thousands of passengers every day. Yet Kenya has no dedicated national archive of these experiences: records are scattered across government reports, media coverage and institutional archives, and community memories and survivor testimonies are rarely captured in ways that inform policy, training or public understanding.

Kenya’s coast, islands, lakes and rivers hold generations of experience: rescues and drownings, ferry crossings, storms, fishing life, boat-building, trade and tradition. Most of this knowledge lives only in people’s memories, family photographs and scattered records, and it is being lost as elders pass on. This plan covers the project’s digital platform: an open-access archive where people living near Kenyan waters, and maritime communities beyond Kenya, can share these stories, testimonies and incidents, and where researchers, students, safety agencies, policymakers and the public can learn from them. By linking memory with practical safety learning, the archive will support safer water transport in Kenya and offer a model for other countries.

The platform will look and feel like a modern social media platform, so that sharing a story is as natural as posting on WhatsApp, TikTok or Instagram, while working underneath as a trustworthy, moderated and well-preserved archive.

### 1.2 Project Objectives

#### 1.2.1 General Objective

To develop a secure, modern, easy-to-use and open-access social platform, available on the web, Android and iOS, that collects, preserves and shares the safety experiences and heritage of people living near Kenya’s ocean coast, lakes and rivers, and of other maritime communities, in order to turn memory into safety learning, inform policy and public awareness, and keep this heritage alive for future generations.

#### 1.2.2 Specific Objectives

- [ ] To build an open-access archive and story-sharing platform that brings together community stories and testimonies, historical records, photographs and mapped incident records, where anyone can browse and learn, and where contributors can post stories with text, images, audio, video and documents and engage through reactions, comments, sharing, favourites and direct messages.
- [ ] To protect storytellers, users and the integrity of the archive through recorded consent, AI-assisted content review, human moderation with clear accountability, strong cyber security and compliance with the Kenya Data Protection Act, 2019.
- [ ] To make the archive accessible, useful and durable: usable on low-end phones and weak internet connections, available in 20 languages including Kiswahili and Dholuo, searchable by place, time, incident and theme, home to the project’s policy briefs and learning materials, and safely backed up and governed for long-term continuity.

### 1.3 Project Deliverables

- [x] **1. Backend (API and services)**: The secure server application, database, media storage, background processing, AI services, notifications and administration logic (Section 2). — *Note: 171 API endpoints, 44 automated end-to-end tests; production services are switched on in stage 5*
- [ ] **2. Website and web app**: The full platform in any modern browser on computers and phones, installable as a web app (Section 3.2).
- [ ] **3. Android app**: An installable app published on Google Play (Section 3.3).
- [ ] **4. iOS app**: An installable app published on the Apple App Store (Section 3.3).
- [ ] **5. Admin and Super Admin tools**: Administrative controls, moderation, reports queue, live analytics and PDF reports (Sections 3.2.9–3.2.12).
- [ ] **6. Incident records and national mapping**: A catalogue of documented water-transport incidents, shown on a map and linked to the stories, testimonies and records about each incident (Sections 2.3 and 3.2.14).
- [ ] **7. Bulk import and cataloguing tools**: Tools for the project team to upload the collected oral histories, photographs, records and reports with their metadata, consent and rights (Section 3.2.10).
- [ ] **8. Learning resources area**: A library for policy briefs, learning summaries, educational materials, the contributor handbook and online exhibitions (Section 3.2.6).
- [ ] **9. AI services**: Content review, transcription, translation and report narratives (Section 5).
- [ ] **10. Hosting and deployment**: Test hosting, production hosting, domain, SSL, CI/CD, monitoring and backups (Sections 7 and 9).
- [ ] **11. Documentation**: User guide, contributor handbook, admin guide, technical documentation, API reference, deployment and security guides, and handover notes.
- [ ] **12. Training and handover**: Orientation for partners, researchers and community representatives, training sessions for admins and Super Admins, and a handover of accounts, credentials and source code.
- [ ] **13. Sustainability inputs**: Hosting, maintenance and cost information for the project’s archive sustainability plan (Section 11.8).

### 1.4 User Platforms

- [ ] **Website**: Any modern browser (Chrome, Edge, Firefox, Safari) on computers, tablets and phones. Full contributor, admin and Super Admin functionality.
- [ ] **Web app (PWA)**: The same website installed to a phone or computer home screen, with an app icon, push notifications and partial offline use, without going through an app store.
- [ ] **Android app**: Native installable app from Google Play, built from the same Flutter code as the iOS app. Supports low-end Android phones.
- [ ] **iOS app**: Native installable app from the Apple App Store, for iPhone and iPad.

All platforms will use the same backend and the same accounts, and must look and behave consistently (Section 3.1.6).

### 1.5 User Roles

- [ ] **Visitor**: Anyone using the archive without signing in. Browses, searches, reads, listens to, shares and cites published content and learning resources, and can report a safety concern. Cannot post, react, comment, message or save favourites.
- [ ] **Contributor**: A standard user. Signs in with Google or Apple. Views, shares and engages with stories, sends messages, reports content, and manages their profile and reminders.
- [ ] **Admin**: A project team moderator. Signs in with a registered admin account and multi-factor authentication. Has everything a Contributor has, plus the administrative controls panel: moderation, reports, company stories, incident records, bulk import, learning resources, analytics and PDF reports.
- [ ] **Super Admin**: A senior member of the project team. Does not moderate stories. Sees live analytics, generates PDF reports, adds and removes admins, and manages Super Admins. There must always be at least one Super Admin.

### 1.6 Beneficiaries and Regions

The platform is designed first for the people and places the project names as its beneficiaries:

- [ ] **Coastal communities**: Communities along the Indian Ocean coast, especially Mombasa County and surrounding areas; ferry users and workers at crossings such as the Likoni Channel; coastal fishing communities.
- [ ] **Lake Victoria communities**: Fisherfolk, boat operators, traders and families in Kisumu, Homa Bay, Migori, Busia and Siaya counties.
- [ ] **People affected by incidents**: Survivors of water-transport incidents and families affected by past disasters.
- [ ] **Under-represented voices**: Women in fishing communities, youth and informal transport workers.
- [ ] **Institutions**: Maritime and inland-water safety regulators, heritage institutions, universities and community organisations.
- [ ] **Wider audience**: Researchers, safety practitioners and policymakers in other countries, particularly in Africa and other regions that rely on ferries and small vessels.

Design consequences: inland waters receive the same weight as the coast in the places list, map, categories and sample content; the interface is available in Kiswahili and Dholuo as well as English (Section 3.1.5); and the platform works on low-end phones and weak connections (Section 8).

### 1.7 How the Platform Supports the Project’s Activities

The project has five activities. The platform is Activity 3, and it also supports the other four:

- [ ] **1. Researching and documenting water-transport safety heritage**: Incident records and the national incident map; historical records with source and reference; bulk import of collected materials (Sections 2.3, 3.2.10 and 3.2.14).
- [ ] **2. Co-creating community histories of risk and resilience**: Story sharing in the storyteller’s own language; “as told by” and anonymous posting with recorded consent; validation by storytellers before publication; audio and video oral histories with transcripts (Sections 3.2.4 and 11.4).
- [ ] **3. Developing an open-access digital archive**: The whole platform: website, web app, Android and iOS apps, open to visitors without an account (Sections 2 to 9).
- [ ] **4. Building capacity in heritage and safety documentation**: A clickable prototype and contributor handbook for partner orientation; guided on-screen hints; training for admins and community champions (Section 11.3).
- [ ] **5. Translating heritage into policy and public learning**: The learning resources area for policy briefs, learning summaries, educational materials and online exhibitions; collections; analytics for reporting (Sections 3.2.6, 3.2.14 and 11.9).

### 1.8 Development Approach

- [ ] Schedule: development takes place within the project’s milestone “Digital archive development”. Within that window the order and length of the work are flexible, provided the platform is delivered on time. All dates are kept in one place, the schedule and Gantt chart in Appendix D.
- [ ] Stages: discovery and design; build; content and testing; go-live and handover.
- [ ] Phased delivery: features are grouped into three delivery phases (Section 11.1), each ending with a working release that can be tested and reviewed.
- [ ] Build order: backend first, then the website and web app, then the Android and iOS apps, so each layer is tested before the next is built on it.
- [ ] Version control: all code will be kept in a private GitHub repository, with every change committed, pushed and tested automatically before it is deployed.
- [ ] Test hosting first: during development the platform runs on free test hosting; production hosting, the domain and SSL are set up before content import and go-live (Section 9).
- [ ] Testing with users: testing and refinement use input from partners and selected users (Section 10).
- [ ] Stage review: each stage ends with a demo on staging, checked against this plan, before the next stage begins.

### 1.9 Structure of this Plan

The plan is arranged as follows, ending with references and appendices:

- [ ] Sections 1 to 10: what will be built and how, with the tools to be used at the end of each technical section. These sections give no dates.
- [ ] Section 11: the delivery phases and the deliverables that surround the platform (prototype, handbook, content import, documentation, maintenance).
- [ ] Appendices: preset lists and standard texts (A), open technical decisions (B), moderation rules to implement (C), the project schedule and Gantt chart (D), alignment with the two source documents (E), the technical risk register (F), and the project cost and running costs (G).

## SECTION 2: BACKEND

### 2.1 Architecture Overview

- [x] The backend will be a single, well-organised NestJS application (a “modular monolith”) backed by PostgreSQL. Each area of the platform will be its own module with clear boundaries, so that any module can later be split into a separate service if load requires it. Slow work will never run inside a user’s request; it will be handed to background workers through a job queue.
- [x] Clients (website, web app, Android, iOS) talk to the backend only through a versioned HTTPS API and a WebSocket connection for live updates.
- [ ] A reverse proxy (Caddy) will terminate HTTPS, handle certificates automatically and compress responses. A CDN (e.g. Cloudflare) will sit in front for media and static files.
- [x] The API servers will be stateless, so more copies can be added behind the proxy when traffic grows (Section 6.5).
- [~] Supporting services: PostgreSQL with PostGIS (data and maps), Redis (cache, sessions, job queue, live-update fan-out), object storage (media), ClamAV (virus scanning), an AI provider (Section 5), push notification services (FCM and APNs) and an email service. — *Left: all are supported in the code and Redis is tested; PostGIS is optional (the map also works without it); ClamAV, object storage, push and the AI provider are switched on and tested on the production server in stage 5 (Deployment)*

### 2.2 Technology Stack

- [x] **API framework**: NestJS (Node.js, TypeScript) | Modules, validation, security, OpenAPI documentation
- [~] **Database**: PostgreSQL with PostGIS | All structured data, full-text search, map queries — *Left: PostgreSQL with full-text and fuzzy search is in use; PostGIS is switched on where the server has it, and map queries also work without it*
- [x] **ORM and migrations**: TypeORM | Database access and versioned schema changes
- [x] **Cache and queue**: Redis with BullMQ | Caching, rate limits, background jobs, WebSocket scaling
- [~] **Media storage**: S3-compatible object storage (e.g. Cloudflare R2, Backblaze B2, AWS S3) | Original and processed media files — *Left: the S3 driver is built; switched on and tested on the production server in stage 5 (Deployment)*
- [x] **Media processing**: FFmpeg, Sharp | Video conversion (HLS), audio, image sizes and formats
- [~] **Virus scanning**: ClamAV | Scan every upload before it is stored — *Left: every upload is sent to the scanner when one is configured; the ClamAV service itself is switched on and tested on the production server in stage 5 (Deployment)*
- [x] **Real-time**: WebSockets (Socket.IO with Redis adapter) | Inbox, counts, notifications, live charts
- [x] **Push notifications**: Firebase Cloud Messaging, Apple Push Notification service | Notifications to Android, iOS and web — *Note: sent through Firebase Cloud Messaging, which delivers to iPhones through Apple’s service; web push uses the browser standard. Needs the Firebase and web-push keys (stage 5)*
- [x] **Email**: SMTP provider or transactional email API | Verification codes, notices, digests
- [~] **PDF generation**: Server-side HTML-to-PDF renderer | Analytics PDF reports — *Left: reports are made by a built-in PDF writer instead of an HTML-to-PDF renderer, because a headless browser is too heavy for the server budget; the output is the same kind of report*
- [ ] **Containers**: Docker, Docker Compose | Identical setup on every server
- [ ] **Reverse proxy**: Caddy | HTTPS, certificates, compression

### 2.3 Core Modules

- [x] **Public access**: Read-only access for visitors without an account to published stories, incident records, collections, the map, search and learning resources; rate limits and caching (Sections 2.5 and 4.3).
- [x] **Auth**: Google and Apple sign-in for Contributors; admin registration, password and multi-factor authentication; sessions and tokens (Section 4.2).
- [x] **Users and Profiles**: Usernames, avatars or photos, theme and language settings, notification settings, blocks and mutes, follows, account deletion.
- [x] **Stories**: Creating, editing and deleting stories; story details (location, event date, category, vessel, tags, language); usage rights; drafts; story IDs.
- [x] **Records**: Historical records (newspaper articles, reports, photographs, official records) with source, archive reference, original date and rights; shown in the story frame alongside community stories.
- [x] **Incidents**: Incident records: date, place, water body, vessel, type, summary, outcome and sources; links to every story, testimony and record about the incident; the incident map layer.
- [x] **Import**: Bulk import of collected materials from files plus a metadata spreadsheet: validation, preview, error report, and submission of the batch for approval.
- [x] **Resources**: The learning resources library: policy briefs, learning summaries, educational materials, the contributor handbook and online exhibitions, with download counts.
- [x] **Safety concerns**: Safety concerns raised by users about current risks, kept separate from content reports, with a queue for the project team.
- [x] **Media**: Uploads (resumable), virus scan, location-data removal, compression, image sizes, video and audio conversion, ZIP downloads, signed links.
- [x] **Engagement**: Reactions (Heart, Heartbreak, Laugh), favourites, shares, copied links, views, trending score.
- [x] **Comments**: Threaded comments and replies, tagging, attachments, sorting, lock and hide.
- [x] **Moderation**: AI review results and flags, admin moderation actions, “Ask Why” requests, moderation history.
- [x] **Reports**: User reports on stories and Contributors, reports queue, actions and outcomes.
- [x] **Approvals**: One shared approval engine for AI-ban overrides, company stories, collections and terminal account actions (Section 2.7).
- [x] **Messaging (Inbox)**: Direct messages, conversations grouped by sender or issue, message requests, unread counts, attachments.
- [x] **Announcements**: Creating and editing announcements, dates for animated calendars, unread counts, ordering by last change.
- [x] **Notifications**: In-app, push and email notifications; priority notifications; user preferences and quiet hours.
- [x] **Reminders**: User and admin reminders with due times and notifications.
- [~] **Places**: The coastal places list, location auto-complete, map data (PostGIS). — *Left: places list, auto-complete and map data are built; PostGIS is optional*
- [x] **Search**: Full-text and fuzzy search across stories, transcripts, contributors and places, in all supported languages.
- [x] **Analytics**: Event recording, aggregates per day, week, month and year, live chart feeds, PDF reports.
- [x] **AI**: A single gateway to AI providers for review, transcription, translation and report writing (Section 5). — *Note: one gateway with connectors for Anthropic, OpenAI and Gemini, plus a rule-based stand-in for testing*
- [x] **Admin Management**: Admin and Super Admin accounts, the last-Super-Admin rule, the audit log.
- [~] **i18n**: Interface translations and story translation on demand. — *Left: story and comment translation on demand is built (needs an AI key); server messages are in English and Kiswahili; interface translations come with the website and apps (stages 2 and 3)*

### 2.4 Data Model – Key Entities

- [x] **User**: id, role (Contributor, Admin, Super Admin), sign-in provider and provider ID, username, avatar or photo, language, theme, status (active, warned, suspended, deleted), created and deleted dates.
- [x] **AdminProfile**: user, admin name (e.g. “Admin – Grace”), Admin ID, staff number, encrypted ID/passport number, verified email and phone, MFA settings.
- [x] **Story**: story ID (e.g. MS-2026-00918), type (community story, testimony or historical record), linked incident, consent record, validation status, author, posted-as (self, “as told by”, anonymous, company), text, language, location (place and coordinates), event date (exact or approximate), category, vessel name, tags, usage rights, AI flag and score, status (draft, pending review, published, blocked, deleted), edit history.
- [x] **Incident**: incident ID, title, date (exact or approximate), place and coordinates, water body, vessel, incident type, summary, outcome, sources, linked stories and records, status.
- [x] **RecordSource**: for historical records: holding institution or publication, archive reference, original date, creator, rights statement, how it was obtained.
- [x] **ConsentRecord**: storyteller, type of consent, date, consent form file, restrictions (e.g. anonymous, no downloads), validation date, withdrawal date.
- [x] **ImportBatch**: uploaded files, metadata spreadsheet, validation results, items created, proposer, approval status.
- [x] **Resource**: title, type (policy brief, learning summary, educational material, handbook, exhibition), summary, file or pages, audience, language, publication date, downloads.
- [x] **SafetyConcern**: reporter (or anonymous visitor), place, description, photo, date, status, notes, referral made.
- [x] **MediaFile**: story or comment or message, type (video, audio, document, image), original file, processed versions, size, duration, transcript, checksum, scan result.
- [x] **Reaction, Favourite, Share, View**: user, story, type and time.
- [x] **Comment**: story, author, parent comment (for threads), text, attachment, tagged users, reaction counts, AI flag.
- [x] **ModerationDecision**: story or comment, AI flag and explanation, admin action, reason, admin, time.
- [x] **Report**: reporter, target (story or Contributor), reasons, description, status, action taken.
- [x] **ApprovalRequest**: type (override, company story, collection, account deletion), target, proposer, justification, approvals and rejections with justifications, status, deadline.
- [x] **Conversation and Message**: participants, topic (sender or issue), messages, read status, attachments.
- [x] **Announcement**: title, summary, description, dates, created and edited times, read status per user.
- [x] **Notification**: user, type, priority flag, link to item, read and acted-on status.
- [x] **Reminder**: user, text, due time, status.
- [x] **Place**: name, alternative names, type (port, town, beach, island, landing site, lake, river), coordinates, county or region.
- [x] **Collection**: title, description, curated stories, approval status.
- [x] **AuditLog**: who, what, target, reason, time, IP address. Cannot be edited or deleted.
- [x] **AnalyticsEvent**: event type, story, user (pseudonymised), time. Stored separately from main data.

### 2.5 API Design

- [x] Style: a REST API under /api/v1, documented with OpenAPI (Swagger) so the website and apps are built against one shared, always-current specification.
- [x] Public endpoints: published stories, incident records, collections, map data, search and learning resources can be read without signing in; every other endpoint requires a signed-in user with the right role (Section 4.3).
- [x] Versioning: breaking changes go into a new version (/api/v2), and older app versions keep working until they are retired.
- [x] Pagination: cursor-based pagination for feeds, comments, messages and lists, so infinite scrolling stays fast however large the archive becomes.
- [x] Errors: every error returns a consistent structure (code, message in the user’s language, details), so all clients show the same messages.
- [x] Validation: all input is validated and unknown fields are rejected.
- [x] Idempotency: story submissions, messages and approvals carry an idempotency key, so a retry on a weak connection never creates duplicates.
- [x] Real-time: a WebSocket channel pushes new messages, unread counts, notifications, approval progress and live chart updates.

### 2.6 Business Rules

The backend must enforce these rules itself, never relying on the website or apps alone:

- [x] Story contents: text (optional, any length), up to 1 video, 1 audio file, 4 documents or PDFs and 20 images. A story must contain at least one item.
- [x] Open access: published content is readable by anyone without an account. Posting, reacting, commenting, messaging, favourites and content reports require sign-in.
- [x] Consent and validation: a testimony collected by the project is published only when its consent record is complete and it is marked as validated with the storyteller, who keeps control over how it is shared and can withdraw it.
- [x] Incident links: a story or record can be linked to one incident record; the incident page lists everything linked to it.
- [x] Favourites: a story can be added to a user’s Favourites only once; the same action removes it again.
- [x] Trending: the trending rank combines all engagement (reactions, shares, copied links, comments, views and other interactions) and applies time decay, so newer stories with strong engagement can rise above older ones. Suggested formula: score = weighted engagement ÷ (hours since posting + 2)^gravity, recalculated every few minutes.
- [x] Comments: default order is the highest combined total of reactions; also most recent and oldest. Locked comments can be read but not added to; hidden comments show only their count. Both show the admin’s reason.
- [~] Reserved identity: no Contributor may use “Admin” (or close variants) as a username or the Maritime logo as a profile image. Company stories appear under “Admin” with the logo; individual admins appear as “Admin – \[name\]” with an admin badge. — *Left: reserved usernames and the “Admin” identity are enforced; an uploaded photo that copies the logo is not detected automatically yet*
- [x] Admin profile: admins may change their verification email and password, but not their admin name, Admin ID or profile image.
- [x] Last Super Admin: a Super Admin cannot delete their account, or be removed, if they are the only Super Admin.
- [x] Account deletion: the user picks one preset reason and may type their own (Appendix A). The account and its content are hidden at once and permanently erased after a 30-day recovery period.
- [x] Ask Why: when an admin deletes a story, its Contributor can send an “Ask Why” request (subject, description, attachments), which reaches the admins’ INBOX.
- [x] Blocking: a blocked user cannot view, comment on, react to or message the user who blocked them.

### 2.7 Approval Workflow Engine

Several actions require more than one admin to agree: overriding an AI ban, publishing a company story, publishing a collection, and terminal account actions (permanent account deletion). These will all use one shared approval engine:

- [x] An admin proposes the action with a written justification. The request appears to all other admins, who each approve, reject or request changes, with a written justification.
- [x] The action takes effect only when the approval rule is met. Until then the current state remains (the AI ban stays, the company story stays unpublished, the account stays active).
- [x] Approval rule: the baseline rule is approval by ALL admins. Because one absent admin could block a decision indefinitely, the recommended alternative is approval by a set majority of active admins (e.g. two-thirds), with a deadline, after which the Super Admin decides. The rule is an open decision (Appendix B).
- [x] Every step is recorded in the audit log, and progress is visible to the admins (e.g. “2 of 4 approved”).
- [x] For account actions, the account holder is kept informed at every stage through INBOX messages and priority notifications: report under review, action proposed, approvals in progress, and final outcome. They can use “Ask Why”.

### 2.8 Moderation and Reports Pipeline

- [x] Every new or edited story, and every comment and message, passes through AI review (Section 5.2) and receives a GREEN, YELLOW or RED flag.
- [x] RED items are held as “Pending review” and appear in the admins’ moderation queue, filterable by flag, date, pending review, AI-blocked not overridden, and AI-blocked overridden.
- [x] Reports from users (on a story or a Contributor) enter the reports queue with the reporter, reasons and description. Several reports on the same item are grouped.
- [x] Admin actions on a report: dismiss, warn the Contributor, drop the story, suspend the account for a set period, or delete the account permanently (via the approval engine).
- [x] Reporters receive a confirmation, and an update when the report is resolved.
- [x] Reports pending longer than a set time are escalated and highlighted; admins can add internal notes.
- [x] Safety concerns are not content reports: they go to a separate queue, where the project team can acknowledge them, add notes and record any referral to the responsible authority. The platform states clearly that it is not an emergency service.

### 2.9 Notifications, Messaging and Announcements

- [x] Channels: in-app, push (Android, iOS and web app) and email. Users choose which notifications they receive, through which channel, and quiet hours. Moderation and account notices cannot be switched off.
- [x] Priority notifications: items that need the user’s action are flagged as priority and shown on sign-in as floating notifications (Section 3.1.7) until acted on.
- [x] INBOX: conversations are grouped by sender or by issue (e.g. “Story #918 issue”, “Account help”). Messages from people the user does not follow arrive as requests. Unread counts update live.
- [x] Announcements: ordered by when they were created or last edited, so an edited announcement moves back to the top. Each user has an unread count. Dates in an announcement are stored as structured dates for the animated calendar.

### 2.10 Analytics and PDF Reports

- [x] Interactions are recorded as analytics events, separately from the main data, and summarised into daily, weekly, monthly and yearly totals.
- [x] Live charts: stories posted per day, week, month and year; RED-flagged and GREEN-flagged stories per week, month and year; plus YELLOW-flagged stories, active users, reports and engagement.
- [x] Project reporting measures: testimonies and historical records archived, incident records mapped, counties and water bodies covered, active trained contributors, visitors and users by type, and views and downloads of learning resources (Section 11.9).
- [x] Charts update live over WebSockets as new data arrives.
- [x] PDF reports: an admin or Super Admin chooses a period and the charts to include. The report is generated in the background, with an AI-written explanation of the trends (Section 5.4) reviewed against the actual figures, and is ready to download when complete.

### 2.11 Background Jobs

- [~] The following will run as background jobs, with retries and progress reported to the user where relevant: virus scanning; location-data removal; image resizing; video conversion to HLS; audio conversion; AI content review; transcription; translation; ZIP generation for story downloads; bulk import processing; PDF report generation; trending recalculation; analytics summaries; notification and email delivery; scheduled purging after the 30-day recovery period; backups. — *Left: all run in the background with retries except virus scanning and image resizing, which take under a second and run as the file arrives; backups are set up in stage 5*

### 2.12 Backend Testing

- [~] Unit tests for business rules and end-to-end tests for every API endpoint, run automatically on every change. — *Left: 44 end-to-end tests cover every module; not yet every single endpoint, and the automatic run on GitHub is confirmed in stage 5*
- [x] Priority test areas: sign-in and sessions, permissions per role, AI flag handling, the approval engine, account deletion and recovery, the last-Super-Admin rule, file uploads and signed links.
- [ ] Load tests before each release (Section 6.6).

### 2.13 Tools and Technologies

- [x] **Language and framework**: TypeScript, Node.js (LTS), NestJS | Backend application
- [~] **Database tools**: PostgreSQL 17, PostGIS, pg_trgm, TypeORM migrations | Data, maps, fuzzy search, schema changes — *Left: pg_trgm and SQL migrations in use; PostGIS optional; the PostgreSQL version is confirmed on the production server*
- [~] **Queue and cache**: Redis, BullMQ, Bull Board (job dashboard) | Background jobs and their monitoring — *Left: Redis and BullMQ are in use and tested; a queue status page for Super Admins replaces Bull Board*
- [~] **Media**: FFmpeg, Sharp, exiftool | Video and audio conversion, images, location-data removal — *Left: Sharp and FFmpeg remove location and device data from photos, video and audio, so exiftool is not needed; PDF document properties are not stripped*
- [x] **API documentation**: OpenAPI (Swagger UI) | Shared, always-current API reference
- [~] **Code quality**: ESLint, Prettier, TypeScript strict mode | Consistent, safer code — *Left: TypeScript strict mode is on; ESLint and Prettier are not set up yet*
- [x] **Testing**: Jest, Supertest | Unit and end-to-end API tests
- [ ] **Editor and source control**: Visual Studio Code, Git, GitHub (private repository) | Development and version history
- [ ] **Local environment**: Docker Desktop, embedded PostgreSQL for demos | The same setup on every computer

## SECTION 3: FRONT END

- [ ] **Objective:** the platform will look and feel like a social media platform, built around STORIES as the primary feature, while preserving all core archive functionality and remaining open to everyone: “user-friendly navigation, clear language, and multimedia content so that both specialists and the general public can benefit”.

### 3.1 Front End Essentials

#### 3.1.1 Design Language

- [x] Colours: a blue-and-white theme. Engagement icons are transparent by default and turn blue and white when pressed.
- [x] Main icons: round, animated icons at the top of the page. Tabs (“Stories by”) use soft-edged rectangular icons, which take less space than circles.
- [x] Grouping: related icons sit together in smooth, rounded containers.
- [~] Design system: colours, type sizes, spacing, icons, buttons and animations will be defined once as shared design tokens and used by the website and both apps, so they stay identical. — *Left: the tokens are defined once in the website; the apps take the same values in stages 3 and 4*

#### 3.1.2 Themes: Light, Dark and Auto

- [x] Users choose Light, Dark or Auto on first sign-in and in MY PROFILE. Auto follows the device’s system setting and switches automatically when it changes.
- [x] The choice is saved to the account, so it carries across the website and the apps.
- [x] The blue-and-white theme, the GREEN / YELLOW / RED flags, charts and animated icons all have a dark-mode version with sufficient contrast. A High-contrast option is also offered.

#### 3.1.3 Animation, Focus Mode and Reduced Motion

- [~] Animation: the interface will be highly animated, including guided on-screen hints, icons that appear when needed and disappear when not in use, and animations for successful actions, failed actions and celebrations where appropriate. — *Left: animated icons, transitions, the favourites and success animations are built; guided on-screen hints are not yet*
- [~] Focus mode: while a user is viewing a story, animations pause so they can focus on reading, viewing and engaging. Icons around the story stay still until the user hovers over them. — *Left: the main icons stop moving when another page is open; they do not yet pause while a story is being read*
- [x] Reduced motion: the platform respects the device’s “reduce motion” setting and offers its own toggle. When on, animations are replaced with simple fades. This also saves battery on low-end phones.

#### 3.1.4 Accessibility

- [~] The website and apps must meet WCAG 2.2 level AA. — *Left: the website is built to the standard (labels, keyboard, focus, contrast, text size); a formal audit is part of testing*
- [x] Screen-reader labels on all round icons, tabs and engagement icons; full keyboard navigation on the website; visible focus states.
- [~] Captions for videos (generated from transcripts), and alt text for images: contributors are prompted to add it, and AI suggests a description. — *Left: captions come from the transcript; the prompt for alt text when adding a photo is not yet on the share form*
- [x] Adjustable text size without breaking layouts, and colour contrast that passes in both themes.
- [x] Listening and speaking: a Listen button reads a story aloud, and contributors can tell a story by voice first, with typing optional, so that people who prefer speaking to reading and writing are included (delivery phase in Section 11.1).

#### 3.1.5 Languages

- [x] **Justification.** This is a platform for maritime stories. The sea connects communities that speak many different languages: the Kenyan coast was shaped by Swahili, Arabic, Gujarati and Portuguese contact, and the safety lessons and heritage of coastal people elsewhere in the world are just as relevant to Kenyan fishers, sailors and ferry passengers. Offering the languages most spoken in the world’s maritime zones lets people tell their stories in the language they lived them in, lets stories travel between coasts through translation, and positions the platform as a global maritime heritage archive rather than a local site only. Dholuo is included because the fishing and boat-transport communities of Lake Victoria are among the project’s primary beneficiaries, and engagement must pay “attention to language”.

The platform will support the following 20 interface languages:

- [x] **1**: English | Worldwide | The working language of international shipping; IMO Standard Marine Communication Phrases are in English. Default language.
- [x] **2**: Kiswahili | Kenya, Tanzania, northern Mozambique, Comoros | The platform's home coast. Swahili culture itself grew out of Indian Ocean seafaring and trade.
- [~] **3**: Dholuo (Luo) | Lake Victoria: Kisumu, Homa Bay, Migori and Siaya counties; also the Ugandan and Tanzanian shores | The main language of Kenya’s Lake Victoria fishing and boat-transport communities, who are among the project’s primary beneficiaries. Translated with community reviewers. — *Left: Dholuo is selectable and falls back to English until a Dholuo translator supplies the text*
- [ ] **4**: Arabic | Red Sea, Arabian Gulf, Oman, Mediterranean, Horn of Africa | Centuries of dhow trade link Oman, Yemen and the Gulf to Lamu, Mombasa and Zanzibar. Needs right-to-left layout.
- [ ] **5**: French | Madagascar, Comoros, Seychelles, Mauritius, Réunion, Djibouti, West and Central Africa, Pacific, Caribbean | Covers most of the western Indian Ocean islands and the Atlantic coast of Africa.
- [ ] **6**: Portuguese | Mozambique, Angola, Cape Verde, Guinea-Bissau, São Tomé, Brazil, Portugal | Long coastlines across three continents; the Portuguese era is part of Mombasa’s own maritime history (Fort Jesus).
- [ ] **7**: Spanish | Pacific and Caribbean coasts of Latin America, Spain, Equatorial Guinea | The largest number of coastal speakers in the Americas.
- [ ] **8**: Somali | Somalia, Djibouti, north-eastern Kenya | Somalia has mainland Africa's longest coastline; strong fishing and seafaring communities close to Kenya.
- [ ] **9**: Malagasy | Madagascar | A large island nation in Kenya’s own ocean, with many fishing and coastal communities.
- [ ] **10**: Gujarati | Gujarat and Kutch coast (India); communities in Mombasa and across East Africa | Kutch is a historic dhow-building centre, and Gujarati traders and communities have long been part of the Kenyan coast.
- [ ] **11**: Hindi | Coastal states of India | Reaches India’s very large coastal population and seafarer workforce.
- [ ] **12**: Bengali | Bangladesh and West Bengal (Bay of Bengal) | Delta, cyclone and river-mouth communities with rich safety and disaster stories; major ship-breaking yards.
- [ ] **13**: Indonesian (Malay) | Indonesia, Malaysia, Brunei, Singapore, Strait of Malacca | Indonesia is the world’s largest archipelagic state; Indonesian and Malay are largely mutually understandable.
- [ ] **14**: Filipino (Tagalog) | Philippines | An island nation and one of the world’s largest sources of merchant seafarers.
- [ ] **15**: Vietnamese | Vietnam | A very long coastline with large fishing communities in the South China Sea.
- [ ] **16**: Chinese (Simplified) | China’s coast, Taiwan, Singapore, Chinese communities worldwide | A leading shipbuilding and port nation; the 15th-century Chinese fleets reached Malindi on the Kenyan coast.
- [ ] **17**: Japanese | Japan | An island nation with deep fishing traditions and tsunami and typhoon safety heritage.
- [ ] **18**: Greek | Greece, Cyprus, Aegean islands | One of the world’s largest ship-owning nations, with thousands of island communities.
- [ ] **19**: Turkish | Black Sea, Aegean and Mediterranean coasts, Bosphorus | A country bordered by sea on three sides and a key shipping crossroads.
- [ ] **20**: Russian | Black Sea, Baltic, Arctic and Pacific coasts; other Russian-speaking countries | Covers the world’s longest national coastline and a large international seafarer workforce.

##### Language requirements

- [x] Choosing a language: detected from the device on first sign-in and changeable at any time in MY PROFILE. The whole interface (menus, rules frame, notifications, emails and PDF reports) is translated.
- [x] Story language: every story, comment and message is tagged with its language. Story content is not limited to the 20 interface languages: contributors can also tag local languages such as Mijikenda languages (e.g. Giriama, Digo), Bajuni, Pokomo, Suba, Luhya languages or Swahili dialects.
- [~] Translate button: stories, comments and transcripts show a “Translate” button that translates into the reader’s language on demand, marked as machine-translated, with a link back to the original. — *Left: on stories and transcripts; not yet on individual comments on the website*
- [~] Right-to-left layout: Arabic switches the whole layout to right-to-left, including the icon row, story frame and comment threads. — *Left: the layout switches direction for Arabic; it will be checked when Arabic text is added in Phase 2*
- [~] Fonts: fonts must cover every supported script (Latin, Arabic, Devanagari, Gujarati, Bengali, Chinese, Japanese, Greek and Cyrillic), for example the Noto font family. — *Left: Noto Sans is used; the other scripts load when those languages are added*
- [~] Translation quality: English, Kiswahili and Dholuo are translated and reviewed by people for launch, Dholuo with reviewers from the Lake Victoria communities because machine translation for it is limited. The other 17 start as machine translation and are reviewed by native speakers in later phases. — *Left: Kiswahili is written and needs review by a native speaker; Dholuo needs a translator*

#### 3.1.6 Cross-Platform Consistency

- [~] UI components and screen layouts must be consistent across the website and the Android and iOS apps, adapting only where a platform requires it (e.g. swipe gestures on phones). — *Left: done on the website; the apps follow in stages 3 and 4*
- [x] All text comes from one shared translation source, so wording is identical everywhere. — *Note: the apps copy their text from the website (scripts/sync-translations.mjs)*

#### 3.1.7 Global Behaviours

- [x] Progress indicators: a progress spinner (or progress bar for uploads) for any action that takes time. Skeleton placeholders while content loads.
- [x] Empty states: tabs with no content show a friendly message and a prompt to share a story.
- [x] Priority notifications: when a user signs in, items that need their action appear as floating, animated notifications in the centre of the screen. Selecting one takes the user to that item; clicking anywhere else sends it floating to the top of the screen, where it stays until the user acts on it.
- [x] Persistent STORIES page: the STORIES page never fully closes. Other pages open on another side of the screen, and the STORIES page is blurred while they are active. Selecting the blurred STORIES page makes it active again; it blurs again whenever another page becomes active.
- [x] Standard messages: every confirmation, warning and error uses the wording in Appendix A.4, in the user’s language.
- [x] Media behaviour: videos autoplay muted. Playback pauses when the STORIES page is blurred, when a story scrolls off screen, and while a priority notification is shown (playback of the first trending story starts only after the notification is dismissed).

### 3.2 Front End – Website and Web App

#### 3.2.1 Web Technology

- [x] The website will be served by the backend at the same address as the API, so sign-in, links and security policies stay simple.
- [x] It will be a responsive single-page application built with React and TypeScript, adapting from large desktop screens to phones.
- [x] Open access: published stories, incident records, collections, the map, search and learning resources are available to visitors without an account or payment.
- [x] Public story pages will be rendered on the server, so that shared links show rich previews and the archive can be found through search engines.
- [~] Web app (PWA): the website can be installed to a home screen, works partly offline (Section 8), and receives push notifications. — *Left: installable and works partly offline; push needs the push keys to be set on the server*
- [x] Link previews: shared and copied links show a title, image and contributor name when pasted into WhatsApp, Facebook, email and other apps.
- [~] Supported browsers: the latest two versions of Chrome, Edge, Firefox and Safari, and Chrome on Android. — *Left: tested in Chrome/Chromium on desktop and phone sizes; Edge, Firefox and Safari checks are part of testing*

#### 3.2.2 Visitor Access, Sign-In and Account Setup

- [x] Visitors: the archive opens on the STORIES page without signing in. A visitor can use every “Stories by” tab except Following and Favorites, open stories, incident records, collections, the map, the timeline and the learning resources, read comments, listen, translate, share, copy links, cite, download where the contributor allows it, and report a safety concern.
- [x] Sign-in prompt: when a visitor tries to post, react, comment, message, add a favourite, follow or report content, a prompt explains that an account is needed and offers “Continue with Google”, “Continue with Apple” and “Not now”.
- [~] Contributors sign in only with a Google or Apple account. There is no other sign-up method and no registration form. The sign-in page also offers the language choice, the privacy policy and terms, and links to Admin sign-in and Admin registration (Section 4.2). — *Left: built; Google and Apple buttons appear once their client IDs are set on the server (a test sign-in is shown on test servers until then)*
- [x] If sign-in is cancelled or fails, the user sees a message and can try again.
- [x] On first sign-in, the Contributor sets up their profile by either creating a username and choosing an avatar or a real face photo, or keeping the name and photo from their Google or Apple account.
- [x] The username is checked for availability as it is typed (“✓ Username available”). Reserved names are refused (Section 2.6).
- [x] The Contributor also confirms their language and theme, and accepts the rules, privacy policy and terms (Section 4.4). The system confirms, validates and stores these details, then opens the Contributor’s Page.
- [x] Account messages at sign-in: a suspended account sees the suspension end date and reason, with “Ask Why”; an account deleted within the last 30 days is offered “Restore my account”; when a session expires, the user is asked to sign in again; and on the apps, an outdated version asks the user to update (Section 9.5).

#### 3.2.3 Contributor’s Page – Main Icons

- [x] The Contributor’s Page has five round, animated icons at the top: STORIES (centre), MY PROFILE, ABOUT & RESOURCES, INBOX and ANNOUNCEMENTS. INBOX and ANNOUNCEMENTS show unread counts. Visitors see STORIES, ABOUT & RESOURCES and a SIGN IN icon.
- [x] STORIES is the centre icon and its page opens by default. Selecting any other icon opens that page alongside the STORIES page, which stays open but blurred (Section 3.1.7).

#### 3.2.4 STORIES

- [x] The STORIES page shows the story frame. Above the story frame is a row of “Stories by” tabs, each with its own soft-edged rectangular icon.

##### Stories By Tabs

- [x] Trending (default tab): opens by default, with the top story already playing. Stories are ranked from most to least trending (Section 2.6).
- [x] Following: stories from Contributors the user follows; if they follow no one, a prompt suggests following contributors.
- [x] Map, Timeline and Collections: Map Explore with the incident layer, stories by decade and year, and curated collections (Section 3.2.14).
- [x] Location: the user selects a location from a drop-down list or types it. As the user types, the field checks for matches in real time and auto-completes from the coastal places list. If there is no match, the field shows “No stories for this location.”
- [x] Incidents: a list of incident records, searchable by name, year, water body and type. Selecting one opens the incident page (Section 3.2.14).
- [x] Contributors: a drop-down list showing the username and profile image of every Contributor who has posted at least one story, with search as the user types. If there are several matches, the user picks one. If there is no match, it shows “No Contributor with this username has posted a story, or their stories may have been deleted.”
- [x] Favorites: all stories the user has added to Favorites. Adding a story plays an animation of the story moving into the Favorites folder, followed by “Added to Favorites.” The icon then changes to “Remove from Favorites.”

##### Story Frame

Every story, from any tab, appears in its own interactive story frame. Two icons sit at its top corners:

- [x] “+” (top right) – Share My Story: replaces the story frame with the share-story frame. A close button returns to the stories.
- [x] “Rules” (top left): replaces the story frame with the rules frame. A close button returns to the stories.

The story frame also contains:

- [x] Main content area: the story content (text, images, audio, video, documents). Any text appears first, followed by attachments; users scroll down for more files. The contributor, place, time posted and (where given) the date the event happened are shown at the top. Audio and video show their transcript beneath.
- [x] Story type and source: each item is labelled as a community story, a testimony collected by the project, or a historical record. A historical record shows its source, archive reference, original date and rights. An item linked to an incident shows the incident’s name, which opens the incident page.
- [x] Engagement icons: transparent by default, blue and white when pressed, placed on one or both sides of the content depending on website or app, with related icons grouped in rounded containers:
  - [x] Where It Happened: opens an incident map (Google Maps) in a frame the same size as the content area; an X at the top centre closes it.
  - [x] Reactions: Heart, Heartbreak and Laugh, grouped in one container, all always visible.
  - [x] Comments: a standalone icon. Comments can be sorted by most reactions (default), most recent or oldest; users can tag others; replies are indented in threads, each showing who it replies to; a comment can contain text, a file, or both.
  - [x] Share: the device’s share menu on phones; WhatsApp, Facebook, X, Gmail and Copy Link on the website (see Appendix B on TikTok and Instagram).
  - [x] Copy Link and Cite: in one container. Copy Link copies the story’s permanent link (“Link copied.”); Cite opens “Cite this story” with ready-made citations (Section 3.2.14).
  - [x] Download: creates a ZIP file of all the story’s content (text as a text file, audio, video, documents, images). Shown only where the contributor’s usage rights allow it.
  - [x] Add to Favorites: toggles the story in the Favorites tab.
  - [x] Translate: shown when the story is in a language other than the reader’s.
  - [x] Listen: reads the story text or transcript aloud.
  - [x] Report: opens a report form for the story or its Contributor (a Contributor can also be reported from their username or profile image). The user picks one or more of five preset reasons (Appendix A) and/or types a description. The reporter receives a confirmation in INBOX.
  - [x] Safety concern: opens the “Report a safety concern” form (Section 3.2.6).
- [x] Sensitive stories: a story marked as sensitive shows a notice before it opens, with “View story” and “Go back” (Appendix C).
- [x] Removed stories: when an admin removes a story, its Contributor sees a notice with “Ask Why” (Section 2.6).
- [x] Scrolling past the end of a story moves to the next story in the current tab (similar to TikTok or Instagram Reels); all engagement icons then apply to the new story.

##### Rules Frame

- [x] The rules frame sets out the rules and netiquette for sharing and engaging with stories (Appendix A), and explains moderation: every story is reviewed by AI and given a GREEN, YELLOW or RED flag; RED stories are blocked and reviewed by human admins; admins can also delete stories and lock or hide comments; and if an admin deletes your story, you can select “Ask Why” to find out the reason.

##### Sharing a Story

- [x] Selecting “+” replaces the story frame with the share-story frame. A story may include text (optional, any length), one video, one audio file, up to four documents or PDFs and up to 20 images, each with a counter (e.g. “Images 7 / 20”).
- [x] Story details: where it happened (location from the places list or a pin on the map), when it happened (exact or approximate date), category, vessel name, tags and language.
- [x] Linked incident: the contributor can link the story to an incident record (e.g. “Mtongwe ferry disaster, 1994”), chosen from a searchable list, or suggest a new incident for the admins to add.
- [x] Posting options: post as myself, “as told by” another person (with consent confirmation and optional consent form), or anonymously; usage rights (e.g. All rights reserved, or a Creative Commons licence).
- [x] Recording: on phones, contributors can record audio or video directly in the share-story frame.
- [x] Voice-first sharing: a contributor can tell the whole story by voice. The recording is transcribed, and the contributor can check the transcript before sending; typing is optional.
- [x] Sensitive content: the contributor can mark the story as sensitive.
- [~] Privacy tools: optional face blurring on images. Hidden location data is removed from photos automatically. — *Left: location data is always removed; face blurring is offered only in browsers that can detect faces*
- [x] Each file is compressed individually, with a progress indicator. The story can be saved as a draft at any time.
- [x] Messages while sharing: file limits reached, file too large, unsupported file type, file blocked by the virus scan, an empty story, missing consent for an “as told by” story, and offline queueing (Appendix A.4).

##### After SEND / SUBMIT

- [x] The story is reviewed by AI (Section 5.2) in no more than 3 minutes, with a progress indicator.
- [x] GREEN: the story is posted with a success animation. YELLOW: the story is posted, and the user receives a warning explaining what to avoid. RED: the story is blocked, the user receives a detailed explanation, and the story waits for admin review.

#### 3.2.5 MY PROFILE

- [x] Change my profile: update the username and profile picture (avatar or photo), or switch back to the Google or Apple name and photo.
- [x] My Stories: each story the user has posted with all its engagement and views; delete a story with the Recycle Bin icon (with a confirmation pop-up); edit a story; add a new story; continue drafts.
- [x] Reminders: the user’s reminders.
- [x] Settings: theme, high contrast, text size, reduced motion, language, low-data mode, upload only on Wi-Fi (apps), read receipts, notification settings with quiet hours, blocked and muted users, and Send feedback (Section 11.9).
- [x] Drafts: unfinished stories and stories waiting to be sent while offline.
- [x] Download my data: download all the user’s stories, comments and profile data.
- [x] DELETE ACCOUNT: the user picks one preset reason and may type their own (Appendix A). A confirmation pop-up explains that the account is removed at once and permanently erased after 30 days.

#### 3.2.6 ABOUT & RESOURCES

- [x] This page has three parts: About, Learning resources and Report a safety concern. It is open to visitors.
- [~] About: the platform’s role, the Remembering the Waters project and the organisations behind it, contact details, and links to the privacy policy, terms of use and rules. — *Left: the page is built; the names of the organisations and the contact details still need to be supplied*
- [~] Acknowledgements: the organisations supporting and running the project are acknowledged here and in the page footer. — *Left: the page is built; the names of the organisations and the contact details still need to be supplied*
- [x] Learning resources: a library of the project’s policy briefs, learning summaries, educational materials for schools, community groups and training institutions, the contributor handbook, and online exhibitions. Resources can be filtered by type, audience and language, read on screen, downloaded and shared; each shows its publication date and a suggested citation.
- [x] Online exhibitions: curated pages that present stories, photographs and records on a theme, complementing the project’s public exhibitions.
- [x] Report a safety concern: any user or visitor can tell the project team about a current safety risk on the water (for example an overloaded boat or missing life jackets), with the place, a description and an optional photo. The form states that it is not an emergency service and shows the emergency numbers; the sender receives a confirmation.
- [x] Suggest an improvement: a feedback form about the archive itself (also in MY PROFILE › Settings).

#### 3.2.7 INBOX

- [x] Opens the user’s direct messages with admins and other Contributors.
- [x] Each sender, or each conversation about a particular issue, appears in its own circular bubble. Selecting a bubble opens the full correspondence.
- [x] The unread count decreases as each message is opened. Messages from people the user does not follow appear under requests.
- [x] Users can attach files, block a sender from inside a conversation, and turn read receipts on or off.

#### 3.2.8 ANNOUNCEMENTS

- [x] Announcements are arranged from most recent to oldest, by when each was created or last edited; an edited announcement moves back up the list and is labelled “Edited”.
- [x] Each announcement shows a summary and the full description. If it includes dates, an animated calendar is shown with it.
- [x] The unread count decreases as each announcement is opened.

#### 3.2.9 Admin Experience – Main Icons

- [x] Admins have the same round icons as Contributors (STORIES, MY PROFILE, ABOUT & RESOURCES, INBOX, ANNOUNCEMENTS), plus a MY RESPONSIBILITIES icon. Admins can view and engage with stories in the same way as Contributors.

#### 3.2.10 Administrative Controls Panel

One side of the admin’s screen is dedicated to administrative controls, which can be expanded to full screen and returned to half screen. It has tabs for Moderation, Reports, Safety concerns, Approvals, Company stories, Collections, Incidents, Import, Resources, Announcements, Analytics and Audit log, and provides:

- [x] Story ID and AI flag: each story shows its unique ID and its AI flag at the top centre.
- [x] Delete story: a Recycle Bin icon at the top centre of each story. The Contributor sees a notice with an “Ask Why” button.
- [x] Override AI ban: the admin must give a justification and sees a warning that overrides are irreversible, feed into the AI review guidance and may weaken it, and should be made only when certain. The override goes to the approval engine (Section 2.7).
- [x] Lock comments and Hide comments, each with a stated reason shown to Contributors.
- [x] Sort and filter stories: by flag (Green, Yellow, Red), most recent or oldest, pending review, AI-blocked not overridden, and AI-blocked overridden.
- [x] Add a company story: created by one admin and published under “Admin” with the platform logo once approved (Section 2.7).
- [x] Collections: curate themed collections of stories, published once approved.
- [x] Incidents: create and edit incident records (name, date, place on the map, water body, vessel, type, summary, outcome and sources) and link stories and records to them.
- [x] Import: upload many files at once with a metadata spreadsheet (title, type, date, place, incident, language, source, rights, consent and validation). The system checks every row, shows what is ready and what needs attention, and submits the batch for approval as one request.
- [x] Resources: add, edit and remove learning resources and online exhibitions.
- [x] Safety concerns: a queue of concerns raised by users, with status, internal notes and a record of any referral to the responsible authority.
- [x] Live analytics and PDF reports (Section 2.10).
- [x] Reports queue and account actions: dismiss, warn, drop story, suspend for a set period, or delete permanently, with internal notes and the account holder kept informed (Section 2.8).
- [x] Announcements: create, edit and delete announcements, with a summary, full description, dates for the animated calendar, and an option to also send a push notification.
- [x] Approvals: all approval requests waiting for the admin’s decision (also listed in MY RESPONSIBILITIES).
- [x] Audit log view of the admin’s own actions.

#### 3.2.11 Admin Identity, Profile and Responsibilities

- [x] Identity: company stories appear under “Admin” with the platform logo. Each admin comments and replies under their own admin name (e.g. “Admin – Grace”) with the logo and an ADMIN badge.
- [x] MY PROFILE (Admin): change the verification email and password; manage multi-factor authentication. The admin name, Admin ID and profile image cannot be changed. Admins can delete their own account in the same way as Contributors.
- [x] MY RESPONSIBILITIES: Reminders, Notifications, and a list of pending approvals waiting for the admin’s decision. Messages from Contributors arrive in INBOX.

#### 3.2.12 Super Admin Experience

- [x] A Super Admin is a senior member of the project team who signs in the same way as admins. Super Admins do not moderate stories.
- [x] Their areas are: MY PROFILE, LIVE ANALYTICS, REPORTS (PDF, including the list of previous and automatic monthly reports) and MANAGE ADMINS.
- [x] MANAGE ADMINS: approve or decline admin registrations; add an admin by invitation (the invited person completes registration and sets up MFA); remove an admin, with confirmation; add a Super Admin from the existing admins, with confirmation; and view the full audit log.
- [x] If the majority approval rule is chosen (Appendix B), Super Admins also decide approvals that pass their deadline.
- [x] If a Super Admin is the only one remaining, account deletion is blocked with the message “You are the only Super Admin. The system must always have at least one Super Admin. Add another Super Admin first.”

#### 3.2.13 Social Features

- [~] Block and mute: from a profile, story, comment or conversation. This is required by the Apple App Store and Google Play for apps with user-generated content. — *Left: from a profile, a conversation and Settings; not yet directly from a story or comment*
- [x] Follow: follow contributors and see their stories in the Following tab.
- [x] Mentions: users are notified when tagged.
- [x] Views: contributors see view counts on their own stories.

#### 3.2.14 Heritage and Archive Features

- [x] Map Explore: a map of all stories, grouped into clusters when zoomed out, with filters by category, date and language.
- [x] Incident records: each documented incident has its own page with its date, place, water body, vessel, a summary of what happened, the outcome, its sources, a map, and every story, testimony and historical record linked to it. Incidents appear as a separate layer on Map Explore and on the Timeline.
- [x] Historical records: newspaper articles, reports, photographs and official records are shown in the story frame with a “Historical record” label, their source, archive reference, original date and rights.
- [x] Validated testimonies: testimonies collected by the project show “Shared with consent”, and are published only after the storyteller has confirmed how their contribution is represented.
- [x] Timeline: browse stories by decade and year of the event.
- [x] Transcripts: shown under audio and video, correctable by the contributor, searchable and translatable.
- [x] Collections and online exhibitions: admin-curated themed exhibits (e.g. “Likoni Ferry Stories”, “Women of the Lake”, “Lamu Ferry Stories”).
- [x] Citation and permanent links: each story has a permanent link and a “Cite this story” option for students and researchers.
- [x] Edited stories: show an “Edited” label with edit history.

#### 3.2.15 Desktop and Laptop Wireframes

- [x] The wireframes below illustrate the layout and key interactions described in Section 3.2. They are low-fidelity layouts to guide design and development, not final visual designs. Numbers, sample names, addresses and organisation details are placeholders. The final visual designs will be produced from these wireframes and the design system (Section 3.1.1) before development of each screen. — *Note: built to follow the wireframe*

**Desktop and laptop wireframes – index**

- [x] **D1**: Sign-in page for Contributors (Google or Apple only), with the link to browse without signing in, links for admins, and the sign-in failure message | All | 3.2.2, 4.2 — *Note: built to follow the wireframe*
- [x] **D2**: First-time profile setup: username or Google/Apple identity, picture, language, theme and acceptance of the rules, with username checks | Contributor | 3.2.2, 2.6 — *Note: built to follow the wireframe*
- [x] **D3**: Account messages at sign-in: suspended account, restoring an account within 30 days of deletion, and session expiry | All | 3.2.2, 2.6, 4.2 — *Note: built to follow the wireframe*
- [x] **D4**: Admin registration form, and the confirmation that the registration awaits Super Admin approval | Admin, Super Admin | 4.2, 3.2.12 — *Note: built to follow the wireframe*
- [x] **D5**: Admin and Super Admin sign-in with multi-factor authentication, and its error and lockout messages | Admin, Super Admin | 4.2 — *Note: built to follow the wireframe*
- [x] **D6**: Contributor’s Page: STORIES (Trending, default) with the “Stories by” tabs, story frame, Rules and “+” icons and all engagement icons | Contributor | 3.2.3–3.2.4 — *Note: built to follow the wireframe*
- [x] **D7**: Priority notifications: floating in the centre on sign-in, then pinned at the top until the user acts on them | All | 3.1.7, 2.9 — *Note: built to follow the wireframe*
- [x] **D8**: Location and Contributors tabs: real-time auto-complete, several matches, and the no-match messages | Contributor, Admin | 3.2.4 — *Note: built to follow the wireframe*
- [x] **D9**: Following and Favorites tabs, with adding and removing a favorite and the empty states | Contributor, Admin | 3.2.4, 3.2.13, 3.1.7 — *Note: built to follow the wireframe*
- [x] **D10**: Map Explore and Timeline tabs: stories grouped on a map, and stories by decade and year of the event | Contributor, Admin | 3.2.14 — *Note: built to follow the wireframe*
- [x] **D11**: Collections tab: curated collections, and a collection opened in the story frame | Contributor, Admin | 3.2.14 — *Note: built to follow the wireframe*
- [x] **D12**: “Where It Happened”: the incident map opens in a frame the same size as the content area, with ✕ at the top centre to close it | Contributor, Admin | 3.2.4 — *Note: built to follow the wireframe*
- [x] **D13**: Comments: sorting, threaded replies, tagging with suggestions, attachments and admin replies, plus the locked and hidden states | Contributor, Admin | 3.2.4, 3.2.11 — *Note: built to follow the wireframe*
- [x] **D14**: Share options on the website, Copy Link, and “Cite this story” with the permanent link | Contributor, Admin | 3.2.4, 3.2.14 — *Note: built to follow the wireframe*
- [x] **D15**: Download as ZIP (preparing and ready, or not offered when the contributor does not allow it) and Translate | Contributor, Admin | 3.2.4, 3.1.5 — *Note: built to follow the wireframe*
- [x] **D16**: Report a story or a Contributor: preset reasons and description, the confirmation and the validation message | Contributor, Admin | 3.2.4, 2.8 — *Note: built to follow the wireframe*
- [x] **D17**: Sensitive-story notice, the notice shown when an admin removes a story, and the “Ask Why” form with its confirmation | Contributor | 3.2.4, Appendix C, 2.6 — *Note: built to follow the wireframe*
- [x] **D18**: Rules frame: rules and netiquette and how moderation works; it replaces the story frame and closes back to the stories | Contributor, Admin | 3.2.4, Appendix A.3 — *Note: built to follow the wireframe*
- [x] **D19**: Share-story frame (1 of 2): text, files with counters, and story details – place, date, category, vessel, tags and language | Contributor | 3.2.4 — *Note: built to follow the wireframe*
- [x] **D20**: Share-story frame (2 of 2): posting as myself, “as told by” with consent, or anonymously; usage rights; sensitive content; and face blurring | Contributor | 3.2.4, 4.4, 4.11 — *Note: built to follow the wireframe*
- [x] **D21**: Share-story messages: draft saved, file limits, size and type errors, virus blocked, empty story, and offline sending | Contributor | 3.2.4, 4.6, 8.3 — *Note: built to follow the wireframe*
- [x] **D22**: After SEND / SUBMIT: AI review in progress, then the GREEN, YELLOW and RED outcomes | Contributor | 3.2.4, 5.2 — *Note: built to follow the wireframe*
- [x] **D23**: Another Contributor’s profile (opened from a username or picture): Follow, and the ⋯ menu to block, mute or report, with the block confirmation | Contributor, Admin | 3.2.13, 3.2.4 — *Note: built to follow the wireframe*
- [x] **D24**: MY PROFILE: My Stories with engagement and views, editing and deleting (with confirmation), adding a story, and Change my profile | Contributor | 3.2.5 — *Note: built to follow the wireframe*
- [x] **D25**: Editing a posted story, the review after editing, and the edit history behind the “Edited” label | Contributor | 3.2.5, 3.2.14 — *Note: built to follow the wireframe*
- [x] **D26**: Reminders in MY PROFILE: list, new or edited reminder, saved message, and the reminder pop-up when due | Contributor, Admin | 3.2.5, 3.2.11 — *Note: built to follow the wireframe*
- [x] **D27**: Settings in MY PROFILE: theme, contrast, motion, text size, language, low-data mode, privacy, notification channels and quiet hours, and blocked or muted users | Contributor (admins see the same settings) | 3.2.5, 3.1.2–3.1.5, 8.2, 2.9 — *Note: built to follow the wireframe*
- [x] **D28**: Download my data, Delete account (reason, warning and confirmation), and the feedback form | All | 3.2.5, 2.6, 7.7, 11.9 — *Note: built to follow the wireframe*
- [x] **D29**: ABOUT & RESOURCES – About: the archive, the project, contact details, links to all policies, and acknowledgement of the organisations behind the project | All, including visitors | 3.2.6, 4.11 — *Note: built to follow the wireframe*
- [x] **D30**: INBOX beside the blurred STORIES page: bubbles per sender or issue, unread counts, a conversation with attachments and read receipts, message requests, and offline sending | Contributor, Admin | 3.2.7, 2.9, 8.3 — *Note: built to follow the wireframe*
- [x] **D31**: ANNOUNCEMENTS: newest or most recently edited first, summaries, unread count, animated calendars, and the full description | All except Super Admin | 3.2.8 — *Note: built to follow the wireframe*
- [x] **D32**: System states: offline and back-online banners, loading skeletons, low-data placeholders, empty states and the general error with Retry | All | 3.1.7, 8.2, 8.6 — *Note: built to follow the wireframe*
- [x] **D33**: Dark theme (selected, or automatic when the device is in dark mode): the STORIES page | All | 3.1.2 — *Note: built to follow the wireframe*
- [x] **D34**: Admin page: the same icons plus MY RESPONSIBILITIES, the story with its ID and AI flag, and the administrative controls panel (Moderation tab) on half of the screen | Admin | 3.2.9–3.2.10 — *Note: built to follow the wireframe*
- [x] **D35**: Admin story controls: delete story, lock comments and hide comments, each with a reason, and their confirmations | Admin | 3.2.10, 2.6 — *Note: built to follow the wireframe*
- [x] **D36**: Override AI ban: warning, required justification and approval progress; the override takes effect only when the approval rule is met | Admin | 3.2.10, 2.7, Appendix A.4 — *Note: built to follow the wireframe*
- [x] **D37**: Reports tab (controls expanded to full screen): reports queue with escalation, report details, internal notes, actions and the account holder’s progress | Admin | 3.2.10, 2.8 — *Note: built to follow the wireframe*
- [x] **D38**: Report actions: dismiss, warn, drop story, suspend for a set period, and propose permanent deletion (which needs approval), with confirmations | Admin | 3.2.10, 2.7–2.8, Appendix C — *Note: built to follow the wireframe*
- [x] **D39**: MY RESPONSIBILITIES: pending approvals, reminders and notifications, and the approval decision with written justification | Admin | 3.2.11, 2.7 — *Note: built to follow the wireframe*
- [x] **D40**: Company stories and Collections: creating them, approval progress, and the decision buttons for other admins | Admin | 3.2.10, 3.2.14, 2.7 — *Note: built to follow the wireframe*
- [x] **D41**: Announcements management: creating, editing and deleting announcements, with dates for the animated calendar | Admin | 3.2.10, 2.9 — *Note: built to follow the wireframe*
- [x] **D42**: Live analytics (admins, and Super Admins in Figure D46): stories posted and RED, GREEN and YELLOW flags, active users, reports and engagement | Admin, Super Admin | 2.10, 3.2.10 — *Note: built to follow the wireframe*
- [x] **D43**: PDF reports: choosing the period and contents, generation in the background, and the finished report with preview | Admin, Super Admin | 2.10, 5.4 — *Note: built to follow the wireframe*
- [x] **D44**: Admin INBOX: replying to an “Ask Why” request; and admins commenting under their own admin names with the ADMIN badge | Admin | 3.2.7, 3.2.11, 2.6 — *Note: built to follow the wireframe*
- [x] **D45**: Admin MY PROFILE (email, password, MFA and devices; locked identity fields; delete account) and the admin’s own audit log | Admin | 3.2.11, 4.2, 4.8 — *Note: built to follow the wireframe*
- [x] **D46**: Super Admin: the four areas (MY PROFILE, LIVE ANALYTICS, REPORTS, MANAGE ADMINS) and the live analytics page; Super Admins do not moderate stories | Super Admin | 3.2.12, 2.10 — *Note: built to follow the wireframe*
- [x] **D47**: Super Admin REPORTS: generating PDF reports and the list of previous reports | Super Admin | 3.2.12, 2.10, 11.9 — *Note: built to follow the wireframe*
- [x] **D48**: MANAGE ADMINS: admins, pending registrations, Super Admins and the full audit log, with adding and removing admins and adding a Super Admin | Super Admin | 3.2.12, 4.2, 4.8 — *Note: built to follow the wireframe*
- [x] **D49**: Adding a Super Admin, and approvals that passed their deadline (shown only if the majority approval rule in Appendix B is chosen) | Super Admin | 3.2.12, 2.7, Appendix B — *Note: built to follow the wireframe*
- [x] **D50**: Super Admin MY PROFILE, and DELETE ACCOUNT – blocked when they are the only Super Admin | Super Admin | 3.2.12, 2.6 — *Note: built to follow the wireframe*
- [x] **D51**: Visitor view (open access, no sign-in): the STORIES page with the visitor icons and tabs, and the sign-in prompt shown when a visitor tries an action that needs an account | Visitor | 3.2.2, 4.3 — *Note: built to follow the wireframe*
- [x] **D52**: Incidents tab: searchable list of incident records, and an incident page with its facts, map, sources and every linked testimony, story and historical record | Visitor, Contributor, Admin | 3.2.4, 3.2.14 — *Note: built to follow the wireframe*
- [x] **D53**: Story types in the story frame: a historical record with its source, reference, date and rights, and a validated testimony with the Listen player; both linked to an incident record | Visitor, Contributor, Admin | 3.2.4, 3.2.14, 3.1.4 — *Note: built to follow the wireframe*
- [x] **D54**: ABOUT & RESOURCES – Learning resources: policy briefs, learning summaries, educational materials, the handbook and online exhibitions, with a resource opened | All, including visitors | 3.2.6, 11.6 — *Note: built to follow the wireframe*
- [x] **D55**: ABOUT & RESOURCES – Report a safety concern: the emergency notice, the form (open to visitors) and its confirmation | All, including visitors | 3.2.6, Appendix C — *Note: built to follow the wireframe*
- [x] **D56**: Admin – Incidents: the list of incident records, incidents suggested by contributors, and creating or editing an incident and linking stories and records to it | Admin | 3.2.10, 2.3 — *Note: built to follow the wireframe*
- [x] **D57**: Admin – Import: bulk upload of collected materials with a metadata spreadsheet, the check of every row (consent, validation, place, incident), and submission of the batch for approval | Admin | 3.2.10, 11.4 — *Note: built to follow the wireframe*
- [x] **D58**: Admin – Safety concerns queue (acknowledge, notes, referral) and Resources (adding, editing and removing learning resources and online exhibitions) | Admin | 3.2.10, Appendix C — *Note: built to follow the wireframe*
- [x] **Wireframe D1**: Sign-in page for Contributors (Google or Apple only), with the link to browse without signing in, links for admins, and the sign-in failure message (All; Sections 3.2.2, 4.2) — *Note: built to follow the wireframe*
- [x] **Wireframe D2**: First-time profile setup: username or Google/Apple identity, picture, language, theme and acceptance of the rules, with username checks (Contributor; Sections 3.2.2, 2.6) — *Note: built to follow the wireframe*
- [x] **Wireframe D3**: Account messages at sign-in: suspended account, restoring an account within 30 days of deletion, and session expiry (All; Sections 3.2.2, 2.6, 4.2) — *Note: built to follow the wireframe*
- [x] **Wireframe D4**: Admin registration form, and the confirmation that the registration awaits Super Admin approval (Admin, Super Admin; Sections 4.2, 3.2.12) — *Note: built to follow the wireframe*
- [x] **Wireframe D5**: Admin and Super Admin sign-in with multi-factor authentication, and its error and lockout messages (Admin, Super Admin; Section 4.2) — *Note: built to follow the wireframe*
- [x] **Wireframe D6**: Contributor’s Page: STORIES (Trending, default) with the “Stories by” tabs, story frame, Rules and “+” icons and all engagement icons (Contributor; Section 3.2.3–3.2.4) — *Note: built to follow the wireframe*
- [x] **Wireframe D7**: Priority notifications: floating in the centre on sign-in, then pinned at the top until the user acts on them (All; Sections 3.1.7, 2.9) — *Note: built to follow the wireframe*
- [x] **Wireframe D8**: Location and Contributors tabs: real-time auto-complete, several matches, and the no-match messages (Contributor, Admin; Section 3.2.4) — *Note: built to follow the wireframe*
- [x] **Wireframe D9**: Following and Favorites tabs, with adding and removing a favorite and the empty states (Contributor, Admin; Sections 3.2.4, 3.2.13, 3.1.7) — *Note: built to follow the wireframe*
- [x] **Wireframe D10**: Map Explore and Timeline tabs: stories grouped on a map, and stories by decade and year of the event (Contributor, Admin; Section 3.2.14) — *Note: built to follow the wireframe*
- [x] **Wireframe D11**: Collections tab: curated collections, and a collection opened in the story frame (Contributor, Admin; Section 3.2.14) — *Note: built to follow the wireframe*
- [x] **Wireframe D12**: “Where It Happened”: the incident map opens in a frame the same size as the content area, with ✕ at the top centre to close it (Contributor, Admin; Section 3.2.4) — *Note: built to follow the wireframe*
- [x] **Wireframe D13**: Comments: sorting, threaded replies, tagging with suggestions, attachments and admin replies, plus the locked and hidden states (Contributor, Admin; Sections 3.2.4, 3.2.11) — *Note: built to follow the wireframe*
- [x] **Wireframe D14**: Share options on the website, Copy Link, and “Cite this story” with the permanent link (Contributor, Admin; Sections 3.2.4, 3.2.14) — *Note: built to follow the wireframe*
- [x] **Wireframe D15**: Download as ZIP (preparing and ready, or not offered when the contributor does not allow it) and Translate (Contributor, Admin; Sections 3.2.4, 3.1.5) — *Note: built to follow the wireframe*
- [x] **Wireframe D16**: Report a story or a Contributor: preset reasons and description, the confirmation and the validation message (Contributor, Admin; Sections 3.2.4, 2.8) — *Note: built to follow the wireframe*
- [x] **Wireframe D17**: Sensitive-story notice, the notice shown when an admin removes a story, and the “Ask Why” form with its confirmation (Contributor; Sections 3.2.4, 2.6; Appendix C) — *Note: built to follow the wireframe*
- [x] **Wireframe D18**: Rules frame: rules and netiquette and how moderation works; it replaces the story frame and closes back to the stories (Contributor, Admin; Section 3.2.4; Appendix A.3) — *Note: built to follow the wireframe*
- [x] **Wireframe D19**: Share-story frame (1 of 2): text, files with counters, and story details – place, date, category, vessel, tags and language (Contributor; Section 3.2.4) — *Note: built to follow the wireframe*
- [x] **Wireframe D20**: Share-story frame (2 of 2): posting as myself, “as told by” with consent, or anonymously; usage rights; sensitive content; and face blurring (Contributor; Sections 3.2.4, 4.4, 4.11) — *Note: built to follow the wireframe*
- [x] **Wireframe D21**: Share-story messages: draft saved, file limits, size and type errors, virus blocked, empty story, and offline sending (Contributor; Sections 3.2.4, 4.6, 8.3) — *Note: built to follow the wireframe*
- [x] **Wireframe D22**: After SEND / SUBMIT: AI review in progress, then the GREEN, YELLOW and RED outcomes (Contributor; Sections 3.2.4, 5.2) — *Note: built to follow the wireframe*
- [x] **Wireframe D23**: Another Contributor’s profile (opened from a username or picture): Follow, and the ⋯ menu to block, mute or report, with the block confirmation (Contributor, Admin; Sections 3.2.13, 3.2.4) — *Note: built to follow the wireframe*
- [x] **Wireframe D24**: MY PROFILE: My Stories with engagement and views, editing and deleting (with confirmation), adding a story, and Change my profile (Contributor; Section 3.2.5) — *Note: built to follow the wireframe*
- [x] **Wireframe D25**: Editing a posted story, the review after editing, and the edit history behind the “Edited” label (Contributor; Sections 3.2.5, 3.2.14) — *Note: built to follow the wireframe*
- [x] **Wireframe D26**: Reminders in MY PROFILE: list, new or edited reminder, saved message, and the reminder pop-up when due (Contributor, Admin; Sections 3.2.5, 3.2.11) — *Note: built to follow the wireframe*
- [x] **Wireframe D27**: Settings in MY PROFILE: theme, contrast, motion, text size, language, low-data mode, privacy, notification channels and quiet hours, and blocked or muted users (Contributor (admins see the same settings); Sections 3.2.5, 3.1.2–3.1.5, 8.2, 2.9) — *Note: built to follow the wireframe*
- [x] **Wireframe D28**: Download my data, Delete account (reason, warning and confirmation), and the feedback form (All; Sections 3.2.5, 2.6, 7.7, 11.9) — *Note: built to follow the wireframe*
- [x] **Wireframe D29**: ABOUT & RESOURCES – About: the archive, the project, contact details, links to all policies, and acknowledgement of the organisations behind the project (All, including visitors; Sections 3.2.6, 4.11) — *Note: built to follow the wireframe*
- [x] **Wireframe D30**: INBOX beside the blurred STORIES page: bubbles per sender or issue, unread counts, a conversation with attachments and read receipts, message requests, and offline sending (Contributor, Admin; Sections 3.2.7, 2.9, 8.3) — *Note: built to follow the wireframe*
- [x] **Wireframe D31**: ANNOUNCEMENTS: newest or most recently edited first, summaries, unread count, animated calendars, and the full description (All except Super Admin; Section 3.2.8) — *Note: built to follow the wireframe*
- [x] **Wireframe D32**: System states: offline and back-online banners, loading skeletons, low-data placeholders, empty states and the general error with Retry (All; Sections 3.1.7, 8.2, 8.6) — *Note: built to follow the wireframe*
- [x] **Wireframe D33**: Dark theme (selected, or automatic when the device is in dark mode): the STORIES page (All; Section 3.1.2) — *Note: built to follow the wireframe*
- [x] **Wireframe D34**: Admin page: the same icons plus MY RESPONSIBILITIES, the story with its ID and AI flag, and the administrative controls panel (Moderation tab) on half of the screen (Admin; Section 3.2.9–3.2.10) — *Note: built to follow the wireframe*
- [x] **Wireframe D35**: Admin story controls: delete story, lock comments and hide comments, each with a reason, and their confirmations (Admin; Sections 3.2.10, 2.6) — *Note: built to follow the wireframe*
- [x] **Wireframe D36**: Override AI ban: warning, required justification and approval progress; the override takes effect only when the approval rule is met (Admin; Sections 3.2.10, 2.7; Appendix A.4) — *Note: built to follow the wireframe*
- [x] **Wireframe D37**: Reports tab (controls expanded to full screen): reports queue with escalation, report details, internal notes, actions and the account holder’s progress (Admin; Sections 3.2.10, 2.8) — *Note: built to follow the wireframe*
- [x] **Wireframe D38**: Report actions: dismiss, warn, drop story, suspend for a set period, and propose permanent deletion (which needs approval), with confirmations (Admin; Sections 3.2.10, 2.7–2.8; Appendix C) — *Note: built to follow the wireframe*
- [x] **Wireframe D39**: MY RESPONSIBILITIES: pending approvals, reminders and notifications, and the approval decision with written justification (Admin; Sections 3.2.11, 2.7) — *Note: built to follow the wireframe*
- [x] **Wireframe D40**: Company stories and Collections: creating them, approval progress, and the decision buttons for other admins (Admin; Sections 3.2.10, 3.2.14, 2.7) — *Note: built to follow the wireframe*
- [x] **Wireframe D41**: Announcements management: creating, editing and deleting announcements, with dates for the animated calendar (Admin; Sections 3.2.10, 2.9) — *Note: built to follow the wireframe*
- [x] **Wireframe D42**: Live analytics (admins, and Super Admins in Figure D46): stories posted and RED, GREEN and YELLOW flags, active users, reports and engagement (Admin, Super Admin; Sections 2.10, 3.2.10) — *Note: built to follow the wireframe*
- [x] **Wireframe D43**: PDF reports: choosing the period and contents, generation in the background, and the finished report with preview (Admin, Super Admin; Sections 2.10, 5.4) — *Note: built to follow the wireframe*
- [x] **Wireframe D44**: Admin INBOX: replying to an “Ask Why” request; and admins commenting under their own admin names with the ADMIN badge (Admin; Sections 3.2.7, 3.2.11, 2.6) — *Note: built to follow the wireframe*
- [x] **Wireframe D45**: Admin MY PROFILE (email, password, MFA and devices; locked identity fields; delete account) and the admin’s own audit log (Admin; Sections 3.2.11, 4.2, 4.8) — *Note: built to follow the wireframe*
- [x] **Wireframe D46**: Super Admin: the four areas (MY PROFILE, LIVE ANALYTICS, REPORTS, MANAGE ADMINS) and the live analytics page; Super Admins do not moderate stories (Super Admin; Sections 3.2.12, 2.10) — *Note: built to follow the wireframe*
- [x] **Wireframe D47**: Super Admin REPORTS: generating PDF reports and the list of previous reports (Super Admin; Sections 3.2.12, 2.10, 11.9) — *Note: built to follow the wireframe*
- [x] **Wireframe D48**: MANAGE ADMINS: admins, pending registrations, Super Admins and the full audit log, with adding and removing admins and adding a Super Admin (Super Admin; Sections 3.2.12, 4.2, 4.8) — *Note: built to follow the wireframe*
- [x] **Wireframe D49**: Adding a Super Admin, and approvals that passed their deadline (shown only if the majority approval rule in Appendix B is chosen) (Super Admin; Sections 3.2.12, 2.7; Appendix B) — *Note: built to follow the wireframe*
- [x] **Wireframe D50**: Super Admin MY PROFILE, and DELETE ACCOUNT – blocked when they are the only Super Admin (Super Admin; Sections 3.2.12, 2.6) — *Note: built to follow the wireframe*
- [x] **Wireframe D51**: Visitor view (open access, no sign-in): the STORIES page with the visitor icons and tabs, and the sign-in prompt shown when a visitor tries an action that needs an account (Visitor; Sections 3.2.2, 4.3) — *Note: built to follow the wireframe*
- [x] **Wireframe D52**: Incidents tab: searchable list of incident records, and an incident page with its facts, map, sources and every linked testimony, story and historical record (Visitor, Contributor, Admin; Sections 3.2.4, 3.2.14) — *Note: built to follow the wireframe*
- [x] **Wireframe D53**: Story types in the story frame: a historical record with its source, reference, date and rights, and a validated testimony with the Listen player; both linked to an incident record (Visitor, Contributor, Admin; Sections 3.2.4, 3.2.14, 3.1.4) — *Note: built to follow the wireframe*
- [x] **Wireframe D54**: ABOUT & RESOURCES – Learning resources: policy briefs, learning summaries, educational materials, the handbook and online exhibitions, with a resource opened (All, including visitors; Sections 3.2.6, 11.6) — *Note: built to follow the wireframe*
- [x] **Wireframe D55**: ABOUT & RESOURCES – Report a safety concern: the emergency notice, the form (open to visitors) and its confirmation (All, including visitors; Section 3.2.6; Appendix C) — *Note: built to follow the wireframe*
- [x] **Wireframe D56**: Admin – Incidents: the list of incident records, incidents suggested by contributors, and creating or editing an incident and linking stories and records to it (Admin; Sections 3.2.10, 2.3) — *Note: built to follow the wireframe*
- [x] **Wireframe D57**: Admin – Import: bulk upload of collected materials with a metadata spreadsheet, the check of every row (consent, validation, place, incident), and submission of the batch for approval (Admin; Sections 3.2.10, 11.4) — *Note: built to follow the wireframe*
- [x] **Wireframe D58**: Admin – Safety concerns queue (acknowledge, notes, referral) and Resources (adding, editing and removing learning resources and online exhibitions) (Admin; Section 3.2.10; Appendix C) — *Note: built to follow the wireframe*

### 3.3 Front End – Installable Android and iOS App

#### 3.3.1 App Technology

- [x] The Android and iOS apps will be built with Flutter from one shared codebase, so features and fixes reach both platforms together.
- [x] The apps will use the same API, accounts and design system as the website.

#### 3.3.2 Mobile Layout

- [~] The five round icons sit at the top of the screen, with STORIES in the centre; admins also see MY RESP. — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] Stories are full-screen; swiping up moves to the next story. Engagement icons sit along the side of the story. — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] Comments, report forms and similar panels open as sheets sliding up from the bottom, with the story dimmed behind. — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] The admin controls panel opens at half screen and can be dragged or tapped to expand to full screen. — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*

#### 3.3.3 Native Capabilities

- [~] Native Google and Apple sign-in. — *Left: built; needs the Google and Apple client IDs set on the server*
- [~] Push notifications, including priority notifications. — *Left: notifications, counts and priority items work inside the app; phone push needs a Firebase project and its keys*
- [~] Camera and microphone: record audio, video and photos directly into a story. — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] Native share sheet for sharing stories to any installed app. — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] Deep links: a shared story link opens directly in the app if installed, otherwise on the website. — *Left: the app accepts story, incident, resource and contributor links; the website file that lets Android verify them is added at deployment*
- [~] Background uploads that continue while the app is closed, and offline drafts (Section 8). — *Left: drafts are saved to the account; uploads run while the app is open, not yet in the background*
- [ ] Optional fingerprint or face unlock for admin accounts.

#### 3.3.4 App Store Requirements

- [~] Apple App Store: Sign in with Apple (offered alongside Google); account deletion inside the app; reporting and blocking for user-generated content; a privacy policy and privacy labels. — *Left: sign-in with Apple and Google, account deletion, reporting and blocking are in the app; the store forms and labels are filled in when the app is submitted*
- [~] Google Play: the Data safety form; a current target Android version; user-generated content moderation, reporting and blocking; account deletion inside the app and on the web. — *Left: sign-in with Apple and Google, account deletion, reporting and blocking are in the app; the store forms and labels are filled in when the app is submitted*
- [ ] Both: store listings, screenshots, app icons and descriptions in English and Kiswahili at launch.

#### 3.3.5 Device Support

- [~] Android 8.0 or later and iOS 15 or later (Appendix B). — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] Smooth performance on low-end Android phones with 2 GB of memory; small install size; low battery use. — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] Phones and tablets, in portrait orientation (tablets may also use landscape). — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*

#### 3.3.6 Mobile App and Web App Wireframes

- [~] The wireframes below show the same screens on phones, for both the installable apps and the website on a phone. — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*

**Mobile app and web app wireframes – index**

- [~] **M1**: Sign-in on the app (Google or Apple only), with the link to browse without signing in, signing in, the failure message, and the links for admins | All | 3.2.2, 3.3.3, 4.2 — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **M2**: First-time profile setup on the app: username and picture, username checks, preferences and acceptance, and the saved message | Contributor | 3.2.2, 2.6 — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **M3**: Account messages on the app: suspended account, restoring a deleted account, session expired and app update required | All | 3.2.2, 2.6, 9.5 — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **M4**: Admin registration and sign-in with multi-factor authentication on the app, with the confirmation and error messages | Admin, Super Admin | 4.2 — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **M5**: Optional fingerprint or face unlock for admin accounts, and push notifications on the phone | Admin, All | 3.3.3, 2.9 — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **M6**: STORIES on the app: the Trending story full screen with Rules and “+”, side engagement icons, swiping to the next story, and tabs | Contributor, Admin | 3.2.3–3.2.4, 3.3.2 — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **M7**: Location and Contributors tabs on the app: auto-complete while typing, several matches, and the no-match messages | Contributor, Admin | 3.2.4 — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **M8**: Sharing on the app: the device’s share menu, Copy Link, “Cite this story”, and Download (ZIP) | Contributor, Admin | 3.2.4, 3.3.3, 3.2.14 — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **M9**: Favorites, Translate and “Where It Happened” on the app | Contributor, Admin | 3.2.4, 3.1.5 — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **M10**: Map Explore, Timeline and Collections tabs on the app | Contributor, Admin | 3.2.14 — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **M11**: Comments sheet on the app: sorting, threads, tagging, attachments, admin replies, and the locked, hidden and held states | Contributor, Admin | 3.2.4, 3.3.2 — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **M12**: Reporting a story or Contributor on the app, its confirmation and validation message, and the sensitive-story notice | Contributor, Admin | 3.2.4, Appendix C — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **M13**: Rules frame, the story-removed notice, the “Ask Why” form and its confirmation, on the app | Contributor | 3.2.4 — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **M14**: Share-story frame on the app: text and files (with in-app recording), story details, and posting options with consent, usage rights and sensitivity | Contributor | 3.2.4, 3.3.3 — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **M15**: Share-story messages on the app: face blurring, consent missing, draft saved, file limits, size, type and virus errors | Contributor | 3.2.4, 4.6 — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **M16**: Sending on the app: background upload notification, offline queueing, Wi-Fi-only waiting, and AI review in progress | Contributor | 3.3.3, 8.3–8.4, 5.2 — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **M17**: AI review outcomes on the app: GREEN (posted), YELLOW (posted with a warning) and RED (blocked and sent to admins) | Contributor | 3.2.4, 5.2 — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **M18**: Another Contributor’s profile on the app: Follow, the ⋯ menu (block, mute, report), block confirmation and messages | Contributor, Admin | 3.2.13 — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **M19**: MY PROFILE on the app: My Stories (engagement, views, edit, delete with confirmation, add) and Change my profile | Contributor | 3.2.5 — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **M20**: Editing a story and its edit history, and Reminders on the app (list, new reminder, and the reminder when due) | Contributor, Admin | 3.2.5, 3.2.14 — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **M21**: Settings on the app: appearance, language, data, privacy, notification channels and quiet hours, and blocked and muted users | Contributor (admins see the same settings) | 3.2.5, 3.1.2–3.1.5, 8.2, 2.9 — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **M22**: Download my data, Delete account and the feedback form on the app | All | 3.2.5, 7.7, 11.9 — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **M23**: ABOUT & RESOURCES (About) and INBOX on the app: bubbles per sender or issue, a conversation with attachments, read receipts and offline sending, and message requests | All (INBOX: Contributor, Admin) | 3.2.6–3.2.7 — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **M24**: ANNOUNCEMENTS on the app (list and full description), and system states: offline, back online, loading, low-data placeholder and error | All | 3.2.8, 3.1.7, 8.2, 8.6 — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **M25**: Dark theme on the app, an empty tab, and the installable web app (PWA) on a phone browser | All | 3.1.2, 3.1.7, 3.2.1 — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **M26**: Admin on the app: the story with ID and AI flag, the controls panel at half screen and full screen, and the delete-story dialog | Admin | 3.2.9–3.2.10, 3.3.2 — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **M27**: Admin on the app: lock and hide comments with reasons and their confirmations, and overriding an AI ban with its warning, justification and approvals | Admin | 3.2.10, 2.7 — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **M28**: Admin reports on the app: the queue with escalation, report details with notes and actions, suspension and proposed deletion | Admin | 3.2.10, 2.8, Appendix C — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **M29**: Admin MY RESPONSIBILITIES on the app: pending approvals, the approval decision with justification, and notifications | Admin | 3.2.11, 2.7 — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **M30**: Admin on the app: new company story, approval of a company story, new collection, and creating or editing an announcement | Admin | 3.2.10, 2.7, 2.9 — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **M31**: Admin analytics and PDF reports on the app: live charts, report options, generating and ready | Admin, Super Admin | 2.10 — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **M32**: Admin on the app: replying to “Ask Why”, admin identity in comments, admin MY PROFILE (with MFA) and the audit log | Admin | 3.2.7, 3.2.11, 4.2, 4.8 — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **M33**: Super Admin on the app: live analytics, REPORTS, MANAGE ADMINS (admins, pending registrations, Super Admins) and adding an admin | Super Admin | 3.2.12, 2.10, 4.2 — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **M34**: Super Admin on the app: removing an admin, adding a Super Admin, deciding approvals past their deadline (optional rule), MY PROFILE and the last-Super-Admin block | Super Admin | 3.2.12, 2.6–2.7, Appendix B — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **M35**: Open access on the app: the visitor view, the sign-in prompt, the Incidents tab and an incident page | Visitor, Contributor, Admin | 3.2.2, 3.2.4, 3.2.14 — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **M36**: Story types and resources on the app: a historical record, a validated testimony with the Listen player, the learning resources library and a resource opened | Visitor, Contributor, Admin | 3.2.4, 3.2.6, 3.2.14 — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **M37**: Report a safety concern on the app (form and confirmation), and voice-first sharing: telling a story by voice and checking the transcript | All (safety concern); Contributor (voice-first) | 3.2.6, Appendix C, 3.2.4, 3.1.4 — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **M38**: Admin on the app: incident records, bulk import results, the safety concerns queue and learning resources, with their confirmations | Admin | 3.2.10, Appendix C, 11.4 — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **Wireframe M1**: Sign-in on the app (Google or Apple only), with the link to browse without signing in, signing in, the failure message, and the links for admins (All; Sections 3.2.2, 3.3.3, 4.2) — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **Wireframe M2**: First-time profile setup on the app: username and picture, username checks, preferences and acceptance, and the saved message (Contributor; Sections 3.2.2, 2.6) — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **Wireframe M3**: Account messages on the app: suspended account, restoring a deleted account, session expired and app update required (All; Sections 3.2.2, 2.6, 9.5) — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **Wireframe M4**: Admin registration and sign-in with multi-factor authentication on the app, with the confirmation and error messages (Admin, Super Admin; Section 4.2) — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **Wireframe M5**: Optional fingerprint or face unlock for admin accounts, and push notifications on the phone (Admin, All; Sections 3.3.3, 2.9) — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **Wireframe M6**: STORIES on the app: the Trending story full screen with Rules and “+”, side engagement icons, swiping to the next story, and tabs (Contributor, Admin; Sections 3.2.3–3.2.4, 3.3.2) — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **Wireframe M7**: Location and Contributors tabs on the app: auto-complete while typing, several matches, and the no-match messages (Contributor, Admin; Section 3.2.4) — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **Wireframe M8**: Sharing on the app: the device’s share menu, Copy Link, “Cite this story”, and Download (ZIP) (Contributor, Admin; Sections 3.2.4, 3.3.3, 3.2.14) — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **Wireframe M9**: Favorites, Translate and “Where It Happened” on the app (Contributor, Admin; Sections 3.2.4, 3.1.5) — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **Wireframe M10**: Map Explore, Timeline and Collections tabs on the app (Contributor, Admin; Section 3.2.14) — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **Wireframe M11**: Comments sheet on the app: sorting, threads, tagging, attachments, admin replies, and the locked, hidden and held states (Contributor, Admin; Sections 3.2.4, 3.3.2) — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **Wireframe M12**: Reporting a story or Contributor on the app, its confirmation and validation message, and the sensitive-story notice (Contributor, Admin; Section 3.2.4; Appendix C) — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **Wireframe M13**: Rules frame, the story-removed notice, the “Ask Why” form and its confirmation, on the app (Contributor; Section 3.2.4) — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **Wireframe M14**: Share-story frame on the app: text and files (with in-app recording), story details, and posting options with consent, usage rights and sensitivity (Contributor; Sections 3.2.4, 3.3.3) — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **Wireframe M15**: Share-story messages on the app: face blurring, consent missing, draft saved, file limits, size, type and virus errors (Contributor; Sections 3.2.4, 4.6) — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **Wireframe M16**: Sending on the app: background upload notification, offline queueing, Wi-Fi-only waiting, and AI review in progress (Contributor; Sections 3.3.3, 8.3–8.4, 5.2) — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **Wireframe M17**: AI review outcomes on the app: GREEN (posted), YELLOW (posted with a warning) and RED (blocked and sent to admins) (Contributor; Sections 3.2.4, 5.2) — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **Wireframe M18**: Another Contributor’s profile on the app: Follow, the ⋯ menu (block, mute, report), block confirmation and messages (Contributor, Admin; Section 3.2.13) — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **Wireframe M19**: MY PROFILE on the app: My Stories (engagement, views, edit, delete with confirmation, add) and Change my profile (Contributor; Section 3.2.5) — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **Wireframe M20**: Editing a story and its edit history, and Reminders on the app (list, new reminder, and the reminder when due) (Contributor, Admin; Sections 3.2.5, 3.2.14) — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **Wireframe M21**: Settings on the app: appearance, language, data, privacy, notification channels and quiet hours, and blocked and muted users (Contributor (admins see the same settings); Sections 3.2.5, 3.1.2–3.1.5, 8.2, 2.9) — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **Wireframe M22**: Download my data, Delete account and the feedback form on the app (All; Sections 3.2.5, 7.7, 11.9) — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **Wireframe M23**: ABOUT & RESOURCES (About) and INBOX on the app: bubbles per sender or issue, a conversation with attachments, read receipts and offline sending, and message requests (All (INBOX: Contributor, Admin); Section 3.2.6–3.2.7) — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **Wireframe M24**: ANNOUNCEMENTS on the app (list and full description), and system states: offline, back online, loading, low-data placeholder and error (All; Sections 3.2.8, 3.1.7, 8.2, 8.6) — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **Wireframe M25**: Dark theme on the app, an empty tab, and the installable web app (PWA) on a phone browser (All; Sections 3.1.2, 3.1.7, 3.2.1) — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **Wireframe M26**: Admin on the app: the story with ID and AI flag, the controls panel at half screen and full screen, and the delete-story dialog (Admin; Sections 3.2.9–3.2.10, 3.3.2) — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **Wireframe M27**: Admin on the app: lock and hide comments with reasons and their confirmations, and overriding an AI ban with its warning, justification and approvals (Admin; Sections 3.2.10, 2.7) — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **Wireframe M28**: Admin reports on the app: the queue with escalation, report details with notes and actions, suspension and proposed deletion (Admin; Sections 3.2.10, 2.8; Appendix C) — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **Wireframe M29**: Admin MY RESPONSIBILITIES on the app: pending approvals, the approval decision with justification, and notifications (Admin; Sections 3.2.11, 2.7) — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **Wireframe M30**: Admin on the app: new company story, approval of a company story, new collection, and creating or editing an announcement (Admin; Sections 3.2.10, 2.7, 2.9) — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **Wireframe M31**: Admin analytics and PDF reports on the app: live charts, report options, generating and ready (Admin, Super Admin; Section 2.10) — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **Wireframe M32**: Admin on the app: replying to “Ask Why”, admin identity in comments, admin MY PROFILE (with MFA) and the audit log (Admin; Sections 3.2.7, 3.2.11, 4.2, 4.8) — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **Wireframe M33**: Super Admin on the app: live analytics, REPORTS, MANAGE ADMINS (admins, pending registrations, Super Admins) and adding an admin (Super Admin; Sections 3.2.12, 2.10, 4.2) — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **Wireframe M34**: Super Admin on the app: removing an admin, adding a Super Admin, deciding approvals past their deadline (optional rule), MY PROFILE and the last-Super-Admin block (Super Admin; Sections 3.2.12, 2.6–2.7; Appendix B) — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **Wireframe M35**: Open access on the app: the visitor view, the sign-in prompt, the Incidents tab and an incident page (Visitor, Contributor, Admin; Sections 3.2.2, 3.2.4, 3.2.14) — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **Wireframe M36**: Story types and resources on the app: a historical record, a validated testimony with the Listen player, the learning resources library and a resource opened (Visitor, Contributor, Admin; Sections 3.2.4, 3.2.6, 3.2.14) — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **Wireframe M37**: Report a safety concern on the app (form and confirmation), and voice-first sharing: telling a story by voice and checking the transcript (All (safety concern); Contributor (voice-first); Sections 3.2.6, 3.2.4, 3.1.4; Appendix C) — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*
- [~] **Wireframe M38**: Admin on the app: incident records, bulk import results, the safety concerns queue and learning resources, with their confirmations (Admin; Sections 3.2.10, 11.4; Appendix C) — *Left: written and built into an installable app by the automatic build; still to be tried on a real phone*

### 3.4 Tools and Technologies

- [ ] **UI design**: Figma | Final visual designs, prototypes and the design system
- [ ] **Design tokens**: Style Dictionary | One source of colours, type and spacing for web and apps
- [ ] **Website framework**: React, TypeScript, Vite | The website and web app
- [ ] **Web animation**: Framer Motion, Lottie | Animated icons, transitions and celebrations
- [ ] **Web state and data**: TanStack Query | Caching, optimistic updates, offline-friendly data fetching
- [ ] **PWA**: Workbox (service worker) | Installable web app, offline cache, push
- [ ] **Mobile apps**: Flutter, Dart | Android and iOS apps from one codebase
- [ ] **Mobile packages**: google_sign_in, sign_in_with_apple, firebase_messaging, video_player, record, camera, drift (offline store) | Native sign-in, push, media, recording, offline data
- [ ] **Maps**: Google Maps Platform (Maps JavaScript API, Google Maps SDK for Flutter) | “Where It Happened” and Map Explore
- [ ] **Charts**: Apache ECharts (web), fl_chart (apps) | Live analytics charts
- [ ] **Translations**: i18next (web), Flutter intl (apps), Weblate or Crowdin | Interface languages and translation management
- [ ] **Fonts and icons**: Noto font family, a shared icon set | All 20 languages’ scripts; consistent icons
- [ ] **Accessibility checks**: axe DevTools, Lighthouse, TalkBack, VoiceOver | WCAG 2.2 AA checks

## SECTION 4: CYBER SECURITY AND DATA SECURITY

### 4.1 Security Principles

- [x] Security by design: security is built into each feature from the start, not added at the end.
- [x] Least privilege: every user, admin, service and staff member gets only the access they need.
- [x] Defence in depth: several layers of protection, so one failure does not expose data.
- [x] Privacy by default: the most private settings are the default, and only necessary data is collected.

### 4.2 Authentication

- [x] Contributors: sign in with Google or Apple (OpenID Connect). The backend verifies each sign-in token directly with Google or Apple before creating a session.
- [~] Admins and Super Admins: register through a sign-up form (ID/passport number, staff number, email, phone and password), approved by a Super Admin. Multi-factor authentication is required, with verification codes to email and phone as specified. An authenticator app or passkey is recommended as the main second factor, with email and SMS as backup, to reduce SMS costs and SIM-swap risk. — *Left: registration, Super Admin approval, authenticator app and email codes are built and tested; SMS codes need an Africa’s Talking account; passkeys are not built*
- [x] Passwords: hashed with a strong, salted algorithm (scrypt or Argon2); never stored or logged in plain text; checked against lists of known breached passwords.
- [x] Sessions: short-lived access tokens (about 15 minutes) with refresh tokens that rotate on each use; reuse of an old refresh token signs out all sessions. Users can see and sign out their active devices.
- [x] Lockout: repeated failed attempts are slowed and then temporarily locked, with an alert to the account owner.

### 4.3 Authorisation and Roles

- [x] **View published stories, incident records, collections, map and learning resources**: Yes | Yes | Yes | View only
- [x] **Share links, cite, listen, translate, download where allowed**: Yes | Yes | Yes | No
- [x] **Report a safety concern**: Yes | Yes | Yes | No
- [x] **React, comment, message, favourite, follow, report content**: No (sign-in prompt) | Yes | Yes | No
- [x] **Share stories**: No | Yes | Yes (company stories via approval) | No
- [x] **Moderate stories and comments**: No | No | Yes | No
- [x] **Handle reports, safety concerns and account actions**: No | No | Yes | No
- [x] **Manage incident records, imports, resources and announcements**: No | No | Yes | No
- [x] **Live analytics and PDF reports**: No | No | Yes | Yes
- [x] **Add and remove admins**: No | No | No | Yes
- [x] **View full audit log**: No | No | Own actions | Yes
- [x] Open access applies to published content only: drafts, blocked and removed items, messages, reports, consent forms and personal data are never public.
- [x] Permissions are checked on the server on every request. Role changes and suspensions take effect immediately.

### 4.4 Data Protection and Legal Compliance

- [ ] Kenya Data Protection Act, 2019: the project’s data controller registers with the Office of the Data Protection Commissioner (ODPC) as required, and a data protection impact assessment (DPIA) will be completed before launch.
- [ ] Legal pages: a privacy policy, terms of use, rules and a cookie notice, linked from sign-in, ABOUT and the app stores, and accepted on first sign-in.
- [x] Data minimisation: only data needed for the platform is collected. Admin ID/passport numbers are collected only if strictly necessary, stored encrypted and separately, and visible only to Super Admins.
- [x] User rights: users can see, correct, download and delete their data (MY PROFILE).
- [~] Consent: stories told on behalf of others require a consent confirmation; faces can be blurred; anonymous posting is available for sensitive incidents. — *Left: consent confirmation and anonymous posting are enforced by the server; face blurring is a tool in the website and apps (stages 2 and 3)*
- [x] Consent records: for testimonies collected by the project, the consent form, the storyteller’s choices (for example anonymous, or no downloads) and the validation date are stored with the item, visible only to admins, so that participants keep control over how their stories are shared.
- [ ] Institutional policies: the platform’s rules and moderation are consistent with the project’s institutional policies on safeguarding, anti-bullying, and diversity and inclusion.
- [x] Age requirement: a minimum age is set and confirmed at first sign-in.
- [ ] Processors: contracts with hosting, AI, email and push providers must cover data protection, and AI providers must not use platform data to train their models.

### 4.5 Encryption

- [ ] In transit: HTTPS only, with automatic certificates and HSTS; apps refuse plain HTTP in store builds.
- [~] At rest: media files encrypted with AES-256; database on encrypted disks; sensitive fields (e.g. ID numbers, MFA secrets) encrypted separately. — *Left: media files are encrypted with AES-256 and sensitive fields separately; encrypted database disks depend on the production host (stage 5)*
- [ ] Backups: encrypted before they leave the server (Section 7.4).
- [x] File access: files are never public. Each file link is signed and expires (e.g. after one hour), and is issued only to users allowed to see the item.

### 4.6 Upload and Content Security

- [~] Every upload is scanned for viruses (ClamAV) before it is stored or shown. — *Left: the scanning step is built; the ClamAV service is switched on and tested on the production server in stage 5 (Deployment)*
- [x] File types are checked from their contents, not their names; dangerous types are refused; size limits apply per file type.
- [x] Hidden location and device data is removed from photos and videos automatically.
- [x] Documents are displayed in a safe viewer, never executed.

### 4.7 Application Security

- [x] Protection against the OWASP Top 10, including parameterised database queries (SQL injection), output escaping and a strict Content Security Policy (cross-site scripting), and protection against cross-site request forgery.
- [x] Security headers (e.g. Helmet), strict input validation, and rejection of unknown fields.
- [x] Rate limits on sign-in, posting, commenting, messaging and reporting, stricter for new accounts.
- [x] Public pages and forms: public read endpoints are rate-limited and cached; the safety-concern and feedback forms open to visitors are protected against automated abuse (for example with a human-verification check).
- [x] Secrets (keys, passwords, tokens) kept out of the source code and stored in the hosting provider’s secret store.
- [ ] Dependencies scanned automatically for known vulnerabilities on every change.

### 4.8 Audit Logging and Monitoring

- [x] A permanent, unchangeable audit log of every admin and Super Admin action: who, what, when, the reason and the IP address.
- [~] Security events (failed sign-ins, lockouts, permission errors, unusual activity) are logged and trigger alerts. — *Left: failed sign-ins, lockouts and permission errors are logged, and lockouts alert the owner and the Super Admins; alerts on unusual activity come with monitoring in stage 5*
- [x] Logs never contain passwords, tokens or full ID numbers.

### 4.9 Incident Response

- [ ] A written incident response plan: who is contacted, how a breach is contained, and how service is restored.
- [ ] Personal data breaches are reported to the Data Protection Commissioner within the time required by law (72 hours), and affected users are informed where required.
- [ ] After each incident, a review records the cause and the fix.

### 4.10 Security Testing

- [x] Automated security tests for sign-in, lockout, token reuse, permissions, signed links, encryption and file-type checks on every change.
- [ ] An independent penetration test before public launch, with all high and critical findings fixed before go-live.
- [ ] A security review at least once a year after launch.

### 4.11 Rights, Consent and Content Protection

##### Contributor Rights and Licences

- [ ] Contributors keep the copyright in their stories, and grant the platform permission to store, display and preserve them.
- [x] Contributors choose whether others may reuse their story, e.g. All rights reserved or a Creative Commons licence (Section 3.2.4).
- [~] Each story shows its rights and credits; media can be watermarked. — *Left: rights and credits are stored and returned with every story; watermarking is not built*

##### Consent

- [x] Stories about or told on behalf of other people require their informed consent, recorded with the story.
- [x] Storytellers can withdraw consent, and their story is then removed.
- [x] Consent forms used by the project team for oral histories will be stored securely and linked to the relevant items.

##### Children and Young People

- [x] A minimum age for accounts is set and confirmed at first sign-in.
- [ ] Identifiable images or stories of children require consent from a parent or guardian.

##### Ethical Handling of Traumatic Content

- [ ] The platform follows a “do no harm” approach: content notices on sensitive stories, no graphic images, and respectful moderation.
- [ ] Where stories involve loss, the platform can show information about where to find support.

##### Platform Policies

- [ ] **Terms of use**: The agreement between users and the platform
- [ ] **Privacy policy**: What personal data is collected, why, how it is protected, and users’ rights
- [ ] **Rules and netiquette**: What may be posted and how to behave (Appendix A.3)
- [ ] **Cookie notice**: What cookies and local storage are used
- [ ] **Copyright and takedown**: How to report copied or infringing content

##### Protecting the Original Archive

- [~] One official domain, verified in Google Search Console, with canonical tags marking the original. — *Left: canonical tags are on every public page; the domain and Search Console are set up at go-live*
- [~] Media watermarked and credited; bulk downloading and scraping rate-limited. — *Left: credits and rate limits are in place; watermarking is not built*
- [ ] Monitoring for copies, with takedown requests for duplicates; a copyright and licence notice on every page.
- [ ] No public website can be made impossible to copy; the aim is to make copying hard, easy to detect and quick to remove.

### 4.12 Tools and Technologies

- [x] **Sign-in**: Google Identity (OpenID Connect), Sign in with Apple | Contributor sign-in
- [~] **MFA**: TOTP authenticator apps, WebAuthn passkeys, email and SMS codes (e.g. Africa’s Talking) | Admin second factor — *Left: authenticator apps and email codes built; SMS needs an Africa’s Talking account; passkeys not built*
- [x] **Password hashing**: scrypt or Argon2id | Salted password storage
- [x] **Web security**: Helmet, NestJS Throttler, class-validator | Security headers, rate limits, input validation
- [~] **Virus scanning**: ClamAV | Scan every upload — *Left: ClamAV is switched on and tested on the production server in stage 5 (Deployment)*
- [ ] **Code and dependency scanning**: GitHub Dependabot, npm audit, GitHub secret scanning, CodeQL | Find vulnerable packages, leaked secrets and code flaws
- [ ] **Security testing**: OWASP ZAP | Automated web vulnerability scans
- [ ] **Edge protection**: Cloudflare (firewall, DDoS protection, bot control) | Block attacks and scraping
- [ ] **Search ownership**: Google Search Console, canonical tags | Prove the official site and detect copies

## SECTION 5: AI IMPLEMENTATION, USAGE AND PURPOSE

### 5.1 Purpose of AI on the Platform

- [x] AI will help a small team of admins keep a growing, multilingual archive safe, searchable and accessible. AI supports human decisions; it never has the final say on removing a person’s account, and every AI decision can be reviewed by an admin.
- [x] **Content review**: Flag stories, comments, messages and images that may break the rules (GREEN / YELLOW / RED).
- [~] **Transcription**: Turn audio and video oral histories into searchable text and captions. — *Left: built behind the AI gateway; needs an AI provider key to switch on and test with real content*
- [~] **Translation**: Translate the interface and, on demand, stories, comments and transcripts. — *Left: built behind the AI gateway; needs an AI provider key to switch on and test with real content*
- [~] **Accessibility**: Suggest alt text for images. — *Left: built behind the AI gateway; needs an AI provider key to switch on and test with real content*
- [~] **Report narratives**: Write the trend explanation in PDF analytics reports. — *Left: built behind the AI gateway; needs an AI provider key to switch on and test with real content*
- [x] **Organisation**: Suggest a category, tags and location for a story, which the contributor confirms.
- [x] **Spam detection**: Spot repeated, automated or scam content.
- [x] **Incident matching**: Suggest the incident record a story or historical record may belong to, for the contributor or admin to confirm.
- [ ] **Read aloud**: Turn story text into speech for the Listen button.

### 5.2 AI Content Review

- [x] Trigger: when a story is submitted or edited, and when a comment or message is sent.
- [x] Guidelines checked: safety, privacy (personal data shared without consent), harassment and hate speech, misinformation and conspiracy theories, political bias or campaigning, spam, scams and impersonation, and inappropriate content, in line with the rules (Appendix A).
- [x] Scoring: the AI scores the item against each guideline and returns an overall violation score with an explanation per guideline. GREEN: up to 20%; YELLOW: above 20% and below 70%; RED: 70% or above.
- [x] Outcomes: GREEN is posted; YELLOW is posted with a warning explaining what to avoid; RED is blocked, explained to the user, and sent to admins (Section 2.8).
- [~] Media: images and video frames are checked for inappropriate content; audio and video are reviewed through their transcripts. — *Left: photos and a frame of each video are sent with the text, and transcripts are reviewed when present; this needs a provider that reads images*
- [~] Speed: review must complete within 3 minutes, and near-instantly for text. Video length and size limits (e.g. 5 minutes, 200 MB) keep long media within this limit. — *Left: the limits and time-outs are built (5 minutes and 200 MB per video); real timings are measured once the provider is chosen*
- [~] Languages: review must work in all supported languages and recognise local languages and dialects, so that stories in Kiswahili or Giriama are not unfairly flagged. — *Left: the instructions tell the AI to judge by meaning in any language; accuracy in Kiswahili, Dholuo and local languages is measured when the provider is chosen*
- [x] Context: the AI is told that this is a maritime safety archive, so accounts of drownings, accidents and disasters are not wrongly treated as harmful content.

### 5.3 Learning from Admin Decisions

- [x] Every admin decision (approving, overriding or deleting) is stored with its justification.
- [x] Approved decisions become examples given to the AI with future reviews, so it follows the platform’s own standards.
- [~] The flag thresholds and guidance are reviewed and recalibrated on a schedule (e.g. monthly), using the record of admin decisions. Models are not retrained after each single decision; the override warning text will reflect this. — *Left: Super Admins can change the thresholds and see the quality figures; the monthly review itself is a team routine*
- [~] Overrides are tracked: a high override rate on a guideline signals that the guidance needs adjusting. — *Left: the override rate is tracked overall, not yet per guideline*

### 5.4 Other AI Uses

- [~] Transcription: automatic transcripts for audio and video, with timestamps for captions; contributors can correct them. — *Left: built behind the AI gateway; needs an AI provider key to switch on and test with real content*
- [~] Translation: interface translations prepared in advance; content translations on demand and cached so each item is translated only once per language. — *Left: built behind the AI gateway; needs an AI provider key to switch on and test with real content*
- [~] Report narratives: the AI writes the trend explanation for PDF reports from the actual figures only; the figures in the text are checked against the data before the report is produced. — *Left: built behind the AI gateway; needs an AI provider key to switch on and test with real content*
- [~] Suggestions: suggested category, tags, alt text and place, always confirmed by the user. — *Left: category, tags and language are suggested now; alt text and place need the AI provider*
- [x] Incident matching: when a story names a place, date or vessel that matches an incident record, the link is suggested and must be confirmed by a person.
- [ ] Read aloud: the Listen button uses the device’s own speech voices where one exists for the language, and a cloud voice otherwise. Where no suitable voice exists for a language, the storyteller’s original audio recording is offered instead.
- [x] Bulk import checks: imported items pass the same AI review as other stories before the batch is approved.

### 5.5 Implementation Architecture

- [x] AI gateway: all AI calls go through one backend module, so providers can be changed without changing the rest of the platform.
- [x] Background processing: AI tasks run as background jobs with retries and time limits.
- [x] Structured results: the AI returns structured data (scores, flags, explanations), validated before it is used.
- [x] Fallback: if the AI service is unavailable, items are held as “Pending review” and processed when it returns; nothing is published unchecked.
- [x] Record keeping: each decision stores the model and guidance version used, for accountability.
- [x] Cost control: limits per day, caching, and choosing smaller, cheaper models for simple tasks.

### 5.6 Human Oversight, Transparency and Fairness

- [x] Admins make the final decision on every RED item and every account action.
- [x] Users are always told why an item was flagged, and can use “Ask Why” or contact admins.
- [ ] The rules frame explains clearly that AI review is used.
- [x] Flag rates are monitored by language and region to detect unfair treatment of particular groups.
- [~] Personal data sent to AI providers is kept to the minimum needed, under contracts that forbid training on platform data. — *Left: only the content under review is sent, never account details; the contract with the provider is for the project to sign*

### 5.7 AI Quality Measures

- [ ] **Agreement with admin decisions on RED items**: At least 90% after the first three months
- [ ] **Wrongly blocked stories (overridden by admins)**: Below 5% of RED items
- [ ] **Review time**: Text under 10 seconds; all items under 3 minutes
- [ ] **Transcription accuracy**: Reviewed on sample stories in English and Kiswahili each quarter

### 5.8 Tools and Technologies

- [ ] The provider will be chosen in the discovery stage by comparing accuracy on sample stories (including Kiswahili), price, speed and data-protection terms. The AI gateway (Section 5.5) allows the provider to be changed later.
- [~] **Language model (review, reports)**: A leading large language model through its API, e.g. Anthropic Claude, OpenAI GPT or Google Gemini | Content review, explanations, report narratives, suggestions — *Left: connectors are built; the provider and its key are still to be chosen*
- [~] **Image moderation**: The chosen model’s image input, or a dedicated moderation service | Checking images and video frames — *Left: connectors are built; the provider and its key are still to be chosen*
- [~] **Transcription**: A speech-to-text service, e.g. OpenAI Whisper or Google Speech-to-Text | Transcripts and captions — *Left: connectors are built; the provider and its key are still to be chosen*
- [~] **Translation**: A machine translation service, e.g. Google Cloud Translation or DeepL, or the language model | Interface and content translation — *Left: connectors are built; the provider and its key are still to be chosen*
- [ ] **Text to speech**: The device’s built-in speech voices; a cloud text-to-speech service where a language needs it | The Listen button
- [ ] **Evaluation**: A test set of sample stories with agreed admin decisions | Measuring AI accuracy before and after changes

## SECTION 6: SYSTEM OPTIMIZATION FOR FAST RESPONSE AND LOAD HANDLING

### 6.1 Performance Targets

- [ ] **API response time (95% of requests)**: Under 300 milliseconds
- [ ] **First story visible after opening (4G)**: Under 2 seconds
- [ ] **First story visible after opening (3G)**: Under 5 seconds
- [ ] **Next story after swiping**: Instant (pre-loaded)
- [ ] **Website performance score (Lighthouse, mobile)**: 90 or higher
- [ ] **App start time on a low-end Android phone**: Under 3 seconds
- [ ] **Availability**: 99.5% or higher per month
- [ ] **Concurrent users at launch**: At least 1,000, scalable to 10,000+

### 6.2 Front End Performance

- [ ] Pre-loading: the next two stories in the current tab are loaded in the background, so swiping feels instant.
- [ ] Lazy loading: images, videos and comments load only when about to be seen.
- [ ] Code splitting: each page of the website loads only the code it needs.
- [ ] Caching: viewed stories, profile images and interface text are cached on the device.
- [ ] Optimistic updates: reactions, favourites and comments appear instantly and are confirmed by the server in the background.

### 6.3 Media Delivery

- [ ] All media is served through a CDN close to the user.
- [x] Images are stored in several sizes and modern formats (WebP/AVIF); each device receives the size it needs. — *Note: WebP sizes for images; two HLS renditions plus an MP4 for video*
- [x] Videos are converted to adaptive streaming (HLS), so quality adjusts to the connection. — *Note: WebP sizes for images; two HLS renditions plus an MP4 for video*
- [ ] Each uploaded file is compressed individually before it is sent, reducing upload time and data use.

### 6.4 Backend and Database Performance

- [~] Indexes on all frequently searched and sorted fields; slow queries are monitored and fixed. — *Left: indexes are in place; slow-query monitoring is set up in stage 5*
- [~] Cursor pagination everywhere, so large lists stay fast. — *Left: feeds, messages and the audit log use cursors; comments and the shorter lists are capped instead*
- [x] Caching in Redis for the trending feed, counts, sessions and frequently read data.
- [x] The trending ranking and analytics totals are calculated in the background, not when a user opens a page.
- [x] Connection pooling to the database.
- [~] Public pages (stories, incident records, learning resources) are cached at the CDN and refreshed when their content changes, so open access for visitors does not load the API servers. — *Left: pages are sent with caching headers; the CDN is set up in stage 5*

### 6.5 Load Handling and Scaling

- [x] Stateless API servers: more copies can be added behind the proxy during busy periods.
- [x] Background workers scale separately from the API, so heavy media processing never slows browsing.
- [x] WebSocket connections are shared across servers through Redis.
- [ ] A database read replica can be added when read traffic grows.
- [ ] Graceful degradation: under extreme load, non-essential features (e.g. live chart updates) slow down first, while browsing and posting keep working.
- [x] Rate limits protect the platform from abuse and accidental overload.

### 6.6 Load and Performance Testing

- [ ] Load tests (e.g. with k6) before each release, simulating typical days and peaks such as a “Heritage Week” call for stories or a story going viral.
- [ ] Tests cover browsing, posting with media, comments, messaging and live analytics.
- [ ] Results are compared with the targets in Section 6.1; releases do not go live if targets are missed.

### 6.7 Performance Monitoring

- [ ] Application performance monitoring tracks response times, errors and slow queries in production.
- [ ] Real-user monitoring measures load times on users’ actual devices and networks.
- [ ] Alerts are sent when targets are breached.

### 6.8 Tools and Technologies

- [ ] **Load testing**: k6 | Simulating many users before each release
- [ ] **Web performance**: Lighthouse, WebPageTest | Load-time measurement and improvement
- [ ] **App performance**: Flutter DevTools, Firebase Performance Monitoring | Smooth scrolling and app start times
- [ ] **Monitoring**: Sentry (errors and performance), Prometheus and Grafana (server metrics) | Production performance and alerts
- [ ] **Database**: pg_stat_statements, EXPLAIN ANALYZE | Finding and fixing slow queries
- [ ] **CDN and caching**: Cloudflare CDN, Redis | Fast delivery and caching

## SECTION 7: DATA STORAGE AND BACKUP

### 7.1 What Is Stored Where

- [~] **Accounts, stories, comments, messages, moderation, approvals**: PostgreSQL | Encrypted disks; sensitive fields encrypted separately — *Left: sensitive fields are encrypted; encrypted disks depend on the production host (stage 5)*
- [~] **Media (originals and processed versions)**: S3-compatible object storage | Encrypted; served through CDN with signed links — *Left: encrypted and served with signed links; object storage and the CDN are switched on and tested on the production server in stage 5 (Deployment)*
- [~] **Sessions, cache, job queue**: Redis | Temporary data only; can be rebuilt — *Left: cache and job queue use Redis; sign-in sessions are kept (hashed) in PostgreSQL so they survive a Redis restart*
- [x] **Analytics events**: Separate PostgreSQL tables (later a separate analytics database) | Pseudonymised user references
- [x] **Audit log**: PostgreSQL (append-only) | Cannot be edited or deleted
- [ ] **Backups**: Separate off-site storage provider | Encrypted

### 7.2 Media Storage

- [x] Originals: the original full-quality file of every upload is kept alongside the compressed copies used for display, so the archive never loses quality.
- [x] Processed versions: image sizes, HLS video, audio versions, thumbnails and transcripts.
- [x] Integrity: each file has a checksum, checked regularly to detect damage.
- [x] Storage growth: usage is monitored, with alerts before limits are reached.

### 7.3 Data Retention and Deletion

- [x] **Deleted stories and accounts**: Hidden at once; recoverable for 30 days; then permanently erased (including media)
- [x] **Stories removed by admins**: Kept hidden for the moderation record for a set period (e.g. 1 year), then erased
- [x] **Reports and moderation decisions**: Kept while the account exists, then anonymised
- [x] **Audit log**: At least 5 years
- [ ] **Server logs**: 90 days
- [ ] **Backups**: Daily for 30 days, weekly for 3 months, monthly for 1 year

### 7.4 Backup Strategy

- [ ] Database: continuous backup with point-in-time recovery, plus a full encrypted backup every day.
- [ ] Media: daily encrypted backup of new and changed files.
- [ ] 3-2-1 rule: three copies of the data, on two different types of storage, with one copy off-site at a different provider.
- [ ] Backups are encrypted before they leave the server, and checked with checksums.
- [ ] **Maximum data loss (RPO)**: 15 minutes for the database; 24 hours for media
- [ ] **Maximum time to restore service (RTO)**: 4 hours

### 7.5 Restore Testing and Disaster Recovery

- [ ] A full restore to a test server is carried out every quarter and timed, to prove that backups work.
- [ ] A written disaster recovery plan covers server loss, storage loss, accidental deletion and a security breach.

### 7.6 Long-Term Preservation

- [~] Media is preserved in open, widely supported formats (e.g. PDF/A for documents, standard audio and video formats). — *Left: web copies are standard MP4, M4A and WebP and originals are kept as uploaded; documents are not converted to PDF/A*
- [x] Every story carries descriptive metadata (title, contributor, place, date, category, language, rights) following a recognised archive standard such as Dublin Core, so the collection can be shared with libraries and museums in future.
- [x] Historical records keep their provenance: holding institution or publication, archive reference, original date, creator and rights statement, so that content is “organized using clear documentation standards and metadata” and stays searchable and preserved for long-term use.
- [x] Incident records form a structured dataset (date, place, water body, vessel, type, outcome, sources) that can be exported for research and policy work.
- [x] The whole archive can be exported in a standard format for transfer to a future system or partner institution.

### 7.7 User Data Portability

- [x] Users can download a copy of all their own data (stories, media, comments, profile) from MY PROFILE, prepared in the background and delivered as a ZIP file.

### 7.8 Tools and Technologies

- [ ] **Database**: PostgreSQL with PostGIS | Structured data
- [ ] **Object storage**: Cloudflare R2, Backblaze B2, AWS S3 or similar (with an archive tier for originals) | Media files
- [ ] **Database backups**: WAL-G or pgBackRest | Continuous backup and point-in-time recovery
- [ ] **File backups**: restic or rclone (encrypted) | Media backups to a second provider
- [x] **Integrity**: SHA-256 checksums | Detecting damaged files
- [x] **Metadata standard**: Dublin Core | Archive-standard descriptions of each story

## SECTION 8: NETWORK AND INTERNET SUPPORT AND BEHAVIOR

### 8.1 Design Assumptions

- [ ] Many of the project’s beneficiaries will be in coastal villages, on islands, on boats or around Lake Victoria, with weak or intermittent mobile coverage, expensive data and low-end phones. The platform must stay usable in these conditions and never lose a user’s work because the connection dropped.

### 8.2 Low-Data Mode

- [ ] Available in MY PROFILE, and suggested automatically when a slow connection is detected.
- [ ] No autoplay; compressed previews only; media loads only when tapped; lower video quality by default.
- [ ] Shows the approximate size of large media before it loads.

### 8.3 Offline Behaviour

- [ ] **Stories already viewed**: Remain viewable from the device cache
- [ ] **Favourites**: Recently viewed favourites remain available
- [ ] **Writing a story**: Saved as a draft on the device; sent automatically when online, with the user’s confirmation
- [ ] **Reactions, favourites, comments**: Queued and sent when the connection returns
- [ ] **Messages**: Queued with a “waiting to send” label
- [ ] **Announcements and INBOX**: Last loaded content remains readable
- [ ] **Admin actions**: Not queued: moderation and approvals require a live connection, to avoid acting on outdated information

### 8.4 Uploads on Unstable Networks

- [~] Resumable uploads: large files are sent in pieces and continue from where they stopped if the network drops. — *Left: the server side (tus protocol) is built and tested; the website and apps use it in stages 2 and 3*
- [ ] Background uploads continue while the user browses or closes the app, with progress shown in a notification.
- [ ] Users can pause, resume or cancel uploads, and can choose to upload only on Wi-Fi.

### 8.5 Adaptive Media

- [~] Video quality adjusts automatically to the connection speed (HLS). — *Left: the server produces the HLS renditions and image sizes; the players are in the website and apps (stages 2 and 3)*
- [~] Images are delivered at the size the screen needs. — *Left: the server produces the HLS renditions and image sizes; the players are in the website and apps (stages 2 and 3)*

### 8.6 Connectivity Feedback

- [ ] A clear banner shows when the user is offline, and when the connection returns.
- [ ] Queued actions are labelled, so users know what has not yet been sent.
- [ ] Error messages are friendly and explain what to do next.

### 8.7 Real-Time Connection Handling

- [ ] The live connection (WebSocket) reconnects automatically after drops, and fetches anything missed while disconnected.
- [ ] If live connections are blocked by a network, the app falls back to checking for updates at intervals.

### 8.8 Timeouts and Retries

- [ ] Requests that fail because of the network are retried automatically with increasing waits.
- [x] Retried submissions never create duplicates (Section 2.5).
- [~] Long operations (AI review, PDF reports, ZIP downloads) report progress and notify the user when complete, rather than keeping a request open. — *Left: the server reports progress and notifies when AI review, PDF reports and ZIP downloads are ready; the screens for it are in stages 2 and 3*

### 8.9 Tools and Technologies

- [~] **Resumable uploads**: tus protocol (tus server, tus-js-client, Uppy, tus client for Flutter) | Uploads that survive dropped connections — *Left: server side built; client side in stages 2 and 3*
- [ ] **Offline web**: Workbox, IndexedDB | Offline cache, queued actions and drafts on the website
- [ ] **Offline apps**: drift (SQLite), connectivity_plus, workmanager | Offline data, connection detection, background tasks
- [ ] **Network handling**: dio with retry (apps), fetch with retry and backoff (web) | Automatic retries
- [~] **Streaming**: HLS (FFmpeg, hls.js on web, native players in apps) | Adaptive video — *Left: server side built; client side in stages 2 and 3*
- [ ] **Network testing**: Chrome DevTools network throttling, Android emulator network profiles | Testing on slow and unstable connections

## SECTION 9: DEPLOYMENT

### 9.1 Environments

- [ ] **Local**: Each developer’s computer, with a demo database and sample content.
- [ ] **Staging**: A copy of production with test data, where every change is checked and demos are reviewed before release.
- [ ] **Production**: The live platform used by the public.

### 9.2 Test Hosting (During Development)

- [ ] During development, the website and API will run on free hosting (Render) for testing, with a free PostgreSQL database, configured from the repository so nothing is set up by hand.
- [ ] The Android app will be tested by installing test builds (APK) and through Google Play internal testing. iOS testing will begin once a Mac build environment and an Apple Developer account are available.
- [ ] Free hosting limits to plan around: the service sleeps after a period without visitors and takes about a minute to wake; the free database is small and expires unless upgraded; there is no virus scanner; email must be sent through a relay. Test hosting is never used for real user data.

### 9.3 Production Hosting

- [ ] Before content import and go-live, the platform moves to a paid production server, with the domain and SSL certificate in place.
- [ ] Production will run in Docker containers on a Linux server (any provider, e.g. DigitalOcean, Hetzner, AWS Lightsail, Azure or a Kenyan host): the API and website, PostgreSQL, Redis, background workers, ClamAV, Caddy (HTTPS) and the backup service.
- [ ] A CDN (e.g. Cloudflare) in front for media, static files and protection against attacks.
- [ ] Managed services may replace self-hosted ones as the platform grows (e.g. managed PostgreSQL).

### 9.4 Continuous Integration and Delivery (CI/CD)

- [ ] Source code in a private GitHub repository; every change is committed and pushed.
- [ ] On every push, GitHub Actions will run all tests and security checks, and build the server image, the Android APK and Play bundle, and the iOS build.
- [ ] Changes that pass are deployed automatically to staging. Production releases are approved manually and can be rolled back in minutes.
- [ ] Database changes use versioned migrations, tested on staging first.

### 9.5 Mobile App Release

- [ ] Android: internal testing, then closed testing with selected users, then production release on Google Play.
- [ ] iOS: TestFlight testing, then App Store review and release.
- [ ] App versions are numbered and the API keeps supporting older versions until users have updated; the app prompts users to update when a version is retired.

### 9.6 Domain, SSL and Email

- [ ] A dedicated domain (e.g. a .co.ke or .org domain), with automatic SSL certificates (or a paid certificate if required).
- [ ] Professional email from the domain for notices and verification codes, with SPF, DKIM and DMARC set up so emails are not marked as spam.

### 9.7 Go-Live Checklist

- [ ] All Phase 1 features accepted on staging against this plan.
- [ ] Penetration test passed and findings fixed (Section 4.10).
- [ ] Load test targets met (Section 6).
- [ ] Backups running and a restore test completed (Section 7.5).
- [ ] Privacy policy, terms and rules published; ODPC registration and DPIA complete.
- [ ] Monitoring, alerts and status page active.
- [ ] Admin and Super Admin accounts created; admins trained.
- [ ] App store listings approved.
- [ ] Project content imported, validated with storytellers and published (Section 11.4).
- [ ] Learning resources area ready to receive the project’s policy briefs, learning summaries and exhibition content (Section 3.2.6).
- [ ] Go-live makes the archive operational and publicly accessible. The project’s official public launch event follows go-live; the dates of both are in Appendix D.

### 9.8 After Launch

- [ ] Monitoring of errors, uptime and performance, with alerts to the support team.
- [ ] Regular updates: security patches promptly; feature releases on a planned schedule.
- [ ] A public status page linked to “Scheduled maintenance” announcements.
- [ ] Quarterly reviews of performance, AI quality, security and costs.

### 9.9 Tools and Technologies

- [ ] **Containers**: Docker, Docker Compose | Packaging and running every service
- [ ] **Reverse proxy and HTTPS**: Caddy | Automatic certificates and HTTPS
- [ ] **Test hosting**: Render (free plan) | Testing during development
- [ ] **Production hosting**: A Linux cloud server, e.g. DigitalOcean, Hetzner, AWS Lightsail or Azure | The live platform
- [ ] **CDN and DNS**: Cloudflare | Domain records, CDN and protection
- [ ] **CI/CD**: GitHub Actions | Automatic tests, builds and deployments
- [ ] **App builds and release**: Gradle, Xcode, Fastlane; Codemagic for cloud iOS builds without a Mac | Building and publishing the apps
- [ ] **App distribution**: Google Play Console, App Store Connect, TestFlight | Testing and store release
- [ ] **Email**: A transactional email service (e.g. Brevo, Postmark or Amazon SES) | Codes and notices
- [ ] **Status page**: e.g. UptimeRobot or Better Stack | Uptime checks and public status page

## SECTION 10: TESTING AND QUALITY ASSURANCE

### 10.1 Testing Approach

- [ ] Testing will run throughout development, not only at the end, with phased testing and regular feedback from users. Every change is tested automatically before it is merged; each stage ends with a demo on staging; and the finished platform is confirmed through user acceptance testing (UAT) with partners and selected users before go-live.

### 10.2 Types of Testing

- [ ] **Unit tests**: Business rules, calculations (e.g. trending, AI flag thresholds), helpers | Every change
- [ ] **API end-to-end tests**: Every endpoint, permissions per role, approval workflows, account deletion, last-Super-Admin rule | Every change
- [ ] **Web interface tests**: Key journeys in a real browser: sign-in, posting a story, commenting, moderation, approvals | Every change to the website
- [ ] **App tests**: Widget and integration tests of the Flutter apps; tests on real Android and iOS devices | Every change to the apps; each release
- [ ] **Accessibility tests**: WCAG 2.2 AA: automated checks plus manual screen-reader and keyboard tests | Each release
- [ ] **Language tests**: Every interface language, right-to-left Arabic, long translations, all scripts | Each release
- [ ] **Network tests**: Slow, unstable and offline conditions (Section 8) | Each release
- [ ] **Performance and load tests**: Targets in Section 6.1 | Each release
- [ ] **Security tests**: Automated scans every change; penetration test before launch (Section 4.10) | Continuous; before launch
- [ ] **AI evaluation**: AI review accuracy on a fixed set of sample stories (Section 5.7) | Before launch; after any AI change
- [ ] **User acceptance testing**: Partners and selected users check the platform against this plan | Before launch

### 10.3 Test Devices

- [ ] Android: at least one low-end phone (2 GB memory), one mid-range phone and one tablet, on Android 8 to the latest version.
- [ ] iOS: at least one older supported iPhone, one current iPhone and one iPad.
- [ ] Browsers: Chrome, Edge, Firefox and Safari on computers; Chrome and Safari on phones.

### 10.4 Quality Gates

- [ ] No change is merged unless all automated tests pass and the code has been reviewed.
- [ ] No release goes live with any open critical or high-severity defect.
- [ ] Each release meets the performance targets (Section 6.1) and accessibility standard (Section 3.1.4).

### 10.5 Defect Management

- [ ] **Critical**: Data loss, security breach, or the platform cannot be used | Yes, immediately
- [ ] **High**: A main feature does not work and there is no workaround | Yes
- [ ] **Medium**: A feature works incorrectly but there is a workaround | Agreed case by case
- [ ] **Low**: Cosmetic issue or minor inconvenience | May be scheduled for a later release
- [ ] Defects are recorded in the project issue tracker (GitHub Issues), with steps to reproduce, severity, and status.

### 10.6 Testing Tools

- [ ] **Backend**: Jest, Supertest | Unit and API end-to-end tests
- [ ] **Website**: Vitest, React Testing Library, Playwright | Component and browser tests
- [ ] **Apps**: flutter_test, integration_test, Firebase Test Lab | Widget, integration and device tests
- [ ] **Accessibility**: axe-core, Lighthouse, TalkBack, VoiceOver | Automated and manual checks
- [ ] **Load**: k6 | Load and stress tests
- [ ] **Security**: OWASP ZAP, Dependabot, CodeQL | Vulnerability scans
- [ ] **Tracking**: GitHub Issues and GitHub Projects | Defects and test progress

## SECTION 11: DELIVERY PLAN AND SUPPORTING DELIVERABLES

- [ ] This section sets out the order of delivery and the deliverables that surround the platform itself. It gives no dates: the schedule and Gantt chart are in Appendix D.

### 11.1 Delivery Phases

- [ ] **Phase 1 – Core platform (launch)**: Backend core modules; Google and Apple sign-in; admin registration with MFA; STORIES with all tabs, story frame, engagement icons, comments, sharing and the share-story frame; AI content review; MY PROFILE, ABOUT, INBOX, ANNOUNCEMENTS; admin controls, approvals, reports and live analytics; Super Admin; Light/Dark/Auto themes and reduced motion; accessibility basics; English, Kiswahili and Dholuo; open access for visitors; incident records and the incident map layer; historical records; bulk import; the learning resources area with online exhibitions; safety concerns; block and mute; notification settings and push; photo location removal; background jobs, media storage and CDN; backups and monitoring; legal pages and data protection compliance; website, Android and iOS apps.
- [ ] **Phase 2 – Reach and richness**: Remaining 17 languages with Translate button and right-to-left layout; transcription and captions; Map Explore; story details; drafts and resumable uploads; Follow and message requests; posting on behalf of others; anonymous posting; the Listen button and voice-first sharing; PDF reports with AI narratives.
- [ ] **Phase 3 – Archive depth**: Collections; Timeline; usage rights and citation; Download my data; full archive export; dedicated search engine; native-speaker review of translations.

### 11.2 Development Stages

- [ ] All dates are kept in one place: the project schedule and Gantt chart in Appendix D. Development takes place within the project’s milestone “Digital archive development”; inside that window the sequencing below is flexible, provided the platform is delivered on time.
- [ ] **1. Discovery and design**: Confirm requirements and the decisions in Appendix B; confirm archive structure, documentation standards and metadata; choose the AI provider; final visual designs and design system in Figma; clickable prototype; sign-off.
- [ ] **2. Build**: Backend core modules and approval engine; website and web app; Android and iOS apps; AI review integration; test hosting; production hosting, domain, SSL and backups set up; regular demos on staging.
- [ ] **3. Content and testing**: Bulk import of the project’s collected materials; validation with storytellers; functional, mobile, accessibility, language, network, load and security testing; penetration test; testing with partners and selected users; user acceptance testing; fixes.
- [ ] **4. Go-live and handover**: Move to production; app store releases; archive operational and publicly accessible; admin and Super Admin training; final handbook, user guide and documentation; handover of source code, credentials and accounts.
- [ ] **5. Dissemination and launch support**: Publishing the project’s policy briefs, learning summaries and online exhibition in the resources area; user guidance and basic access support; support for the official public launch event.

### 11.3 Prototype, Handbook and Orientation Support

- [ ] The project runs a basic archive documentation and digital platform orientation for partners, researchers and community representatives, covering how to upload materials, how to document stories and how to use the archive.
- [ ] Because this orientation comes before the platform is built, it will use the clickable prototype, which shows how the finished website and app will look and behave, together with a draft handbook.
- [ ] The handbook (“how to upload materials” and “navigation and use of the digital archive”) is finalised at go-live with screenshots of the real platform and published in the learning resources area.

### 11.4 Metadata Template, Cataloguing, Validation and Import

- [ ] Community meetings and storytelling sessions in coastal communities and communities around Lake Victoria record testimonies and oral histories; the team also gathers historical records, photographs, newspaper articles and reports.
- [ ] So that everything collected can be imported cleanly, the developer supplies a metadata spreadsheet template and the matching consent fields before collection starts, aligned with the project’s interview guides, consent forms and data collection templates.
- [ ] Recording guidance (file formats, naming, minimum quality) is included in the handbook.
- [ ] Priority themes and stories identified with communities become the archive’s categories, collections and incident records.
- [ ] The project’s collected oral histories, photographs, historical records, reports and testimonies are catalogued with metadata (Section 7.6), consent and rights records, and uploaded through bulk import (Section 3.2.10).
- [ ] Each item records who told or created it, where and when, its language, its incident (where there is one), consent status and usage rights.
- [ ] Validation: before a testimony is published, the storyteller confirms how their contribution is represented, in the project’s feedback and validation meetings; the item is then marked as validated.
- [ ] Narrators who wish to remain anonymous are published anonymously.
- [ ] The platform should go live with a strong set of stories, so that the first visitors find a living archive rather than an empty feed.
- [ ] Suggested target: at least 100 published items at go-live, covering the coast, islands, Lake Victoria and rivers, including the major documented incidents.

### 11.5 In-Platform Onboarding

- [ ] Guided on-screen hints on first use: how to browse, react, comment and share a first story.
- [ ] A short welcome explaining the rules and how moderation works.
- [ ] Encouraging messages after the first story and first reactions.

### 11.6 Learning Resources, Online Exhibition and Launch Support

- [ ] The project’s policy briefs, learning summaries and educational materials are published in the learning resources area, where they can be read, downloaded, cited and shared.
- [ ] An online exhibition presents the stories, photographs and archival materials shown in the project’s public exhibition, so that it reaches people who cannot attend.
- [ ] Shareable links and link previews carry findings and safety messages through partner networks, social media and WhatsApp.
- [ ] Stakeholder feedback is collected through the feedback form and reported to the project team.
- [ ] The official public launch introduces and demonstrates the archive to stakeholders, partner institutions, community representatives, researchers, policymakers and the wider public.
- [ ] The developer supports the launch event with a live demonstration, a launch announcement on the platform, and a call for contributions that encourages institutions, researchers and communities to add materials.
- [ ] A launch campaign on the project’s channels, social media and WhatsApp uses shareable story links.

### 11.7 Documentation and Handover Package

- [ ] User documentation: public user guide (stories, search, map, sharing), admin manual (moderation, reports, approvals, company stories, analytics), Super Admin guide.
- [ ] Technical documentation: architecture, API reference, set-up, deployment, security, backup and restore guides, and metadata and cataloguing standards.
- [ ] Full source code in a repository the project owns, with its history.
- [ ] Admin access and all credentials, handed over securely.
- [ ] Hosting, domain, app store, Google Cloud, Apple and AI provider accounts in the project’s name.
- [ ] Transfer of ownership rights and licences.

### 11.8 Maintenance and Continuity

- [ ] Security updates to the server, packages and apps, applied promptly.
- [ ] Regular updates of frameworks and libraries, at least every quarter.
- [ ] Yearly app updates to meet new Android and iOS requirements.
- [ ] Renewals: domain, SSL certificate (if paid), hosting, Apple Developer Program and other subscriptions.
- [ ] Quarterly restore tests and security reviews (Sections 4.10 and 7.5).

The project will produce an archive sustainability plan and a long-term continuity framework, so that the archive remains “a living resource” after the project ends. The platform contributes the following inputs:

- [ ] Governance: the admin and Super Admin roles, the approval rules and the audit log give a ready structure for long-term management.
- [ ] Institutional responsibilities: a named team of admins, with the moderation policy and response times in Appendix C.
- [ ] Resource requirements: the yearly running costs in Appendix G and the maintenance tasks in Section 11.8, for inclusion in the sustainability plan.
- [ ] Ongoing content and engagement: trained contributors and community champions continue to add stories; collections, announcements and exhibitions keep the archive active.
- [ ] Technical continuity: full documentation, open formats, standard metadata and a complete export (Section 7.6), so the archive can be moved or handed to another institution without loss.
- [ ] Scaling: the platform is documented and multilingual, so it can serve as a model for similar archives in other coastal and inland-water countries.

### 11.9 Measures the Platform Must Report

- [x] The analytics module (Section 2.10) must be able to report the following measures. The targets are suggestions.
- [x] **Published stories**: 500 | 1,500 | Platform analytics
- [x] **Registered contributors**: 1,000 | 3,000 | Platform analytics
- [x] **Monthly active users**: 500 | 1,500 | Platform analytics
- [x] **Beneficiary counties with stories (Mombasa and the coast; Kisumu, Homa Bay, Migori, Busia and Siaya)**: All named counties | All named, plus others | Story locations
- [x] **Incident records documented and mapped**: 30 | 60 | Incident records
- [x] **Testimonies and historical records from the project’s collection archived**: All collected items | Growing | Import and story records
- [x] **Learning resources published; views and downloads**: Tracked | Tracked | Resources area
- [x] **Active trained contributors**: Tracked | Tracked | Platform analytics
- [x] **Stories in languages other than English**: 30% | 40% | Story language tags
- [x] **Audio and video oral histories**: 100 | 300 | Media records
- [x] **RED items reviewed within 24 hours**: 95% | 95% | Moderation records
- [ ] **Platform availability**: 99.5% | 99.5% | Uptime monitoring
- [~] **Research and education uses (citations, downloads, class use)**: Tracked | Tracked | Downloads, citations, partner reports — *Left: citations and downloads are counted; class use comes from partner reports*

### 11.10 Conclusion

- [ ] The two source documents ask for a user-friendly, open-access digital archive that brings together oral histories, photographs, historical records, reports and testimonies, organised with clear documentation standards and metadata, and that stays accessible and growing after the project ends. This plan turns that into a buildable system: what each part does, the standard it must meet, the tools to use, how it is tested and deployed, and the order in which it is delivered. Development can proceed section by section against it, with Appendix E as the checklist that every requirement from the two documents has been met.

## Appendices

### Appendix A: Preset Lists and Standard Texts

##### A.1 Report reasons (pick one or more)

- [x] Inappropriate or offensive content
- [x] False information or misinformation
- [x] Harassment, hate speech, or bullying
- [x] Privacy violation (personal data shared without consent)
- [x] Spam, scam, or impersonation

##### A.2 Account deletion reasons (pick one, plus optional text)

- [x] I no longer use the platform
- [x] Privacy concerns
- [x] I receive too many notifications
- [x] I have another account
- [x] I did not find the content useful

##### A.3 Rules and netiquette

- [x] Share genuine experiences and accurate information related to maritime heritage. — *Note: served in English and Kiswahili*
- [x] Be respectful: no harassment, hate speech, threats or personal attacks. — *Note: served in English and Kiswahili*
- [x] Protect privacy: do not share other people’s personal data, contact details or images without their consent. — *Note: served in English and Kiswahili*
- [x] No misinformation, conspiracy theories or political campaigning. — *Note: served in English and Kiswahili*
- [x] Only post content you own or have permission to share, and credit sources where possible. — *Note: served in English and Kiswahili*

##### A.4 Standard system messages

- [ ] Examples in the messages (names, dates, story IDs, email addresses) are filled in by the system.
- [ ] **Sign-in cancelled or failed**: Sign-in was cancelled or could not be completed. Please try again.
- [ ] **Username available**: Username available
- [ ] **Username taken**: This username is taken. Try another.
- [ ] **Reserved username**: This name is reserved and cannot be used.
- [ ] **Profile saved**: Profile saved.
- [ ] **Suspended account at sign-in**: Your account is suspended until 12 December 2026.
- [ ] **Deleted account signs in within 30 days**: Your account is scheduled for permanent deletion on 19 December 2026. Do you want to restore it?
- [ ] **Account restored**: Welcome back! Your account has been restored.
- [ ] **Session expired**: Your session has expired. Please sign in again.
- [ ] **Admin registration sent**: Registration sent. A Super Admin will review it, and you will be notified by email.
- [ ] **Wrong or expired MFA code**: That code is incorrect or has expired. Try again.
- [ ] **Too many sign-in attempts**: Too many attempts. Sign-in is locked for 15 minutes, and the account owner has been alerted.
- [ ] **Location search, no match**: No stories for this location.
- [ ] **Contributor search, no match**: No Contributor with this username has posted a story, or their stories may have been deleted.
- [ ] **Favorite added**: Added to Favorites.
- [ ] **Favorite removed**: Removed from Favorites.
- [ ] **Link copied**: Link copied.
- [ ] **Citation copied**: Citation copied.
- [ ] **Preparing a ZIP download**: Preparing your download…
- [ ] **ZIP download ready**: Your download is ready.
- [ ] **Translated story label**: Machine-translated from Kiswahili · Show original
- [ ] **Report sent**: Report sent. You will receive a confirmation in INBOX.
- [ ] **Report with nothing selected**: Pick at least one reason or describe the issue.
- [ ] **Comments locked (with the admin’s reason)**: Comments and replies have been locked by an admin.
- [ ] **Comments hidden (with the admin’s reason)**: Comments have been hidden by an admin.
- [ ] **Sensitive-story notice**: This story describes loss of life and may be distressing.
- [ ] **Story removed by an admin**: Your story MS-2026-00877 was removed by an admin.
- [ ] **“Ask Why” sent**: Your request has been sent to the admins. You will receive a reply in INBOX.
- [ ] **Draft saved**: Draft saved.
- [ ] **File limit reached**: You can add up to 20 images.
- [ ] **File too large**: This file is too large. The maximum for a video is 200 MB.
- [ ] **Unsupported file type**: This file type is not supported.
- [ ] **File blocked by the virus scan**: This file was blocked because it may be harmful.
- [ ] **Empty story**: Add text or at least one file before sending.
- [ ] **Story queued while offline**: You are offline. Your story will be sent when you are back online.
- [ ] **AI review in progress**: Checking your story… This takes up to 3 minutes.
- [ ] **GREEN outcome**: Your story is live!
- [ ] **YELLOW outcome (followed by the explanation)**: Your story is live, with a warning.
- [ ] **RED outcome (followed by the explanation)**: Your story was not posted.
- [ ] **User blocked**: @mzee_omari is blocked.
- [ ] **User muted**: @mzee_omari is muted.
- [ ] **Delete a story**: Delete this story? This cannot be undone.
- [ ] **Story deleted**: Story deleted.
- [ ] **Edited story under review**: Your changes are being checked. The story will update when the review is complete.
- [ ] **Reminder saved**: Reminder saved.
- [ ] **Settings saved**: Settings saved.
- [ ] **Preparing “Download my data”**: We are preparing your data. You will be notified when it is ready.
- [ ] **“Download my data” ready**: Your data is ready to download.
- [ ] **Delete account warning**: Your account and content will be removed at once and permanently erased after 30 days. To restore it, sign in again within 30 days.
- [ ] **Account deleted**: Your account has been deleted. Sign in within 30 days if you change your mind.
- [ ] **Feedback sent**: Thank you for your feedback.
- [ ] **Message queued while offline**: Waiting to send
- [ ] **Offline banner**: You are offline. Some features are unavailable.
- [ ] **Back online**: Back online.
- [ ] **General error (with Retry)**: Something went wrong. Please try again.
- [ ] **Following tab, empty**: You are not following anyone yet. Follow contributors to see their stories here.
- [ ] **Favorites tab, empty**: No favorites yet. Select ☆ on a story to save it here.
- [ ] **App update required**: A new version of the app is available. Please update to continue.
- [ ] **Admin deleted a story**: Story deleted. The Contributor has been notified.
- [ ] **Admin locked comments**: Comments locked.
- [ ] **Admin hid comments**: Comments hidden.
- [ ] **AI override warning**: Overrides are irreversible, feed into the AI review guidance and may weaken it. Override only when certain.
- [ ] **AI override submitted**: Override submitted for approval.
- [ ] **Approval decision recorded**: Your decision has been recorded.
- [ ] **Warning sent**: Warning sent to @user_2210.
- [ ] **Account suspended**: Account suspended for 7 days. The account holder has been notified.
- [ ] **Account deletion proposed**: Deletion proposed. It takes effect when the approval rule is met.
- [ ] **Report dismissed**: Report dismissed. The reporter has been notified.
- [ ] **Story dropped**: Story dropped. The Contributor has been notified.
- [ ] **Company story or collection submitted**: Submitted for approval.
- [ ] **Announcement published**: Announcement published.
- [ ] **PDF report generating**: Generating report…
- [ ] **PDF report ready**: Your report is ready.
- [ ] **Admin invitation sent**: Invitation sent to lucy.a@rememberingthewaters.org.
- [ ] **Admin registration approved**: Registration approved. The admin has been notified.
- [ ] **Remove an admin (confirmation)**: Remove Admin – Peter? They will lose access immediately.
- [ ] **Admin removed**: Admin – Peter has been removed.
- [ ] **Last Super Admin tries to delete their account**: You are the only Super Admin. The system must always have at least one Super Admin. Add another Super Admin first.
- [ ] **Super Admin added**: Super Admin added.
- [ ] **Password changed**: Password changed.
- [ ] **Authenticator app added**: Authenticator app added.
- [ ] **Visitor tries an action that needs an account**: Sign in to react, comment, save favourites or share your own story.
- [ ] **Safety concern form notice**: This is not an emergency service. In an emergency, call 999 or 112.
- [ ] **Safety concern sent**: Thank you. Your safety concern has been sent to the project team.
- [ ] **Bulk import checked**: 48 of 50 items are ready. 2 need attention.
- [ ] **Bulk import submitted**: Batch submitted for approval.
- [ ] **Incident record saved**: Incident record saved.
- [ ] **Learning resource published**: Resource published.
- [ ] **Admin registration awaiting approval**: Your registration is awaiting Super Admin approval.
- [ ] **Wrong admin email or password**: Incorrect email or password.
- [ ] **“As told by” story without consent confirmed**: Confirm the storyteller’s consent before sending.
- [ ] **More files than allowed**: You can add 1 video, 1 audio file and up to 4 documents.
- [ ] **Comment held by AI review**: Your comment was not posted because it may break the rules. An admin will review it.
- [ ] **Upload waiting for Wi-Fi**: Waiting for Wi-Fi to upload. Upload now
- [ ] **Pending action completed**: Done – removed from your pending actions.
- [ ] **AI override approved**: Override approved. Story MS-2026-00918 is now published.
- [ ] **Safety concern with no description**: Describe the concern before sending.
- [ ] **Safety concern acknowledged by an admin**: Concern acknowledged. The sender has been notified.

### Appendix B: Open Technical Decisions

- [ ] These points must be settled during discovery and design. Each has a recommended default, which this plan assumes until decided otherwise.
- [~] **Approval of overrides, company stories and terminal actions**: Approval by ALL admins, or by a set majority | A two-thirds majority of active admins, with a deadline after which the Super Admin decides, so one absent admin cannot block decisions — *Left: the recommended default is built; it can be changed with one setting once you decide*
- [~] **Admin second factor**: Codes by email and SMS, or authenticator app / passkey | Authenticator app or passkey as the main factor, with email and SMS as backup (Section 4.2) — *Left: the recommended default is built; it can be changed with one setting once you decide*
- [~] **Video limits**: No limit, or a maximum length and size | A maximum of about 5 minutes and 200 MB per video, so AI review completes within 3 minutes — *Left: the recommended default is built; it can be changed with one setting once you decide*
- [ ] **Sharing targets**: Named apps (WhatsApp, TikTok, Instagram, Facebook, Gmail), or the device share menu | The device share menu on phones (TikTok and Instagram do not accept shared web links directly); WhatsApp, Facebook, X, email and Copy Link on the website
- [~] **Who adds Super Admins**: An existing Super Admin, or a manual database step | An existing Super Admin, with confirmation — *Left: the recommended default is built; it can be changed with one setting once you decide*
- [ ] **AI provider**: Candidates in Section 5.8 | Chosen after a comparison on sample stories, including Kiswahili and Dholuo
- [ ] **Schedule basis**: The Application Questions describes a 12-month delivery; the Milestones and Deliverables describes 18 months | Follow the Milestones and Deliverables, as this plan does (Appendix D)
- [~] **Safety concerns: numbers shown**: Which emergency numbers the form shows | 999 and 112 as placeholders until confirmed — *Left: the recommended default is built; it can be changed with one setting once you decide*
- [~] **Minimum age for contributor accounts**: 13, 16 or 18 | 18 — *Left: the recommended default is built; it can be changed with one setting once you decide*
- [ ] **Android and iOS minimum versions**: Section 3.3.5 | Android 8.0 and iOS 15

### Appendix C: Moderation Rules to Implement

- [ ] The rules below define what the AI review (Section 5.2), the moderation queues (Section 2.8) and the admin tools (Section 3.2.10) must enforce.

##### C.1 Purpose and Principles

- [x] This policy guides admins and the AI review in deciding what may be published. It protects the people in the stories and the people who tell them, while keeping the archive open to honest accounts of difficult events.
- [x] Heritage value: genuine experiences, including painful ones such as drownings and disasters, belong in the archive.
- [x] Dignity: the dead, the bereaved and survivors are treated with respect.
- [x] Safety: content must not put anyone at risk, and safety advice must be accurate.
- [x] Fairness: rules apply equally to every contributor, language and community.
- [x] Transparency: every decision is explained, and every decision can be questioned.

##### C.2 What Is and Is Not Allowed

- [x] **Personal and family experiences on and near the water**: Harassment, hate speech, threats or personal attacks — *Note: these are the rules given to the AI review and shown to users*
- [x] **Accounts of accidents, rescues, losses and disasters**: Graphic images of injured or dead people — *Note: these are the rules given to the AI review and shown to users*
- [x] **Traditions, boat-building, fishing, trade and port life**: Personal data of others without consent (phone numbers, addresses, ID numbers) — *Note: these are the rules given to the AI review and shown to users*
- [x] **Historical photographs, records and documents the contributor may share**: Misinformation, conspiracy theories or political campaigning — *Note: these are the rules given to the AI review and shown to users*
- [x] **Respectful discussion and disagreement**: Spam, scams, advertising or impersonation — *Note: these are the rules given to the AI review and shown to users*
- [x] **Safety lessons and advice**: Dangerous or false safety advice — *Note: these are the rules given to the AI review and shown to users*

##### C.3 Sensitive Stories

- [~] Contributors can mark a story as sensitive (e.g. involving death or injury); it then shows a content notice before opening. — *Left: the mark is stored and returned; the notice before opening is shown by the website and apps (stages 2 and 3)*
- [~] Families may ask for a story about a relative to be reviewed or removed; such requests are handled with priority and care. — *Left: such requests come in as urgent reports or INBOX messages and are put first; there is no separate form for families*
- [~] Stories about missing persons or recent incidents are checked so that they do not interfere with official searches or investigations. — *Left: the AI is instructed to flag these; it needs the AI provider to take effect*
- [x] Testimonies collected by the project are published only after the storyteller has confirmed how their contribution is represented, and can be withdrawn at their request.

##### C.4 Moderation Response Times

- [~] **Urgent reports (safety risk, private data exposed)**: Within 4 hours — *Left: the platform puts urgent reports first, escalates reports open for more than 48 hours, flags safety concerns older than 24 hours and measures RED reviews within 24 hours; meeting the times is for the admin team*
- [~] **RED-flagged stories awaiting review**: Within 24 hours — *Left: the platform puts urgent reports first, escalates reports open for more than 48 hours, flags safety concerns older than 24 hours and measures RED reviews within 24 hours; meeting the times is for the admin team*
- [~] **Other reports**: Within 48 hours — *Left: the platform puts urgent reports first, escalates reports open for more than 48 hours, flags safety concerns older than 24 hours and measures RED reviews within 24 hours; meeting the times is for the admin team*
- [~] **“Ask Why” requests**: Within 3 working days — *Left: the platform puts urgent reports first, escalates reports open for more than 48 hours, flags safety concerns older than 24 hours and measures RED reviews within 24 hours; meeting the times is for the admin team*
- [~] **Safety concerns**: Acknowledged within 24 hours — *Left: the platform puts urgent reports first, escalates reports open for more than 48 hours, flags safety concerns older than 24 hours and measures RED reviews within 24 hours; meeting the times is for the admin team*

##### C.5 Enforcement Steps

- [x] **1**: Warning | First minor breach; YELLOW-flagged behaviour repeated
- [x] **2**: Content removed | A story or comment breaks the rules
- [x] **3**: Suspension (7 or 30 days) | Repeated breaches after a warning
- [x] **4**: Permanent ban | Serious or repeated breaches; requires admin approval (Section 2.7)

##### C.6 Appeals

- [x] A contributor can use “Ask Why” on any removal, and can ask for a second review.
- [x] The second review is done by a different admin from the one who made the first decision.

##### C.7 Company Stories and Collections

- [x] Company stories and collections represent the project team, so facts are checked, sources credited and consent confirmed before approval. — *Note: both go through the approval engine before publication*
- [ ] Safety information in company stories follows official guidance from the relevant authorities.

##### C.8 Safety-Critical Information

- [x] Where a story or comment contains incorrect safety advice, admins may add a correction note linking to official guidance, or remove the advice if it could put people at risk.

##### C.9 Safety Concerns

- [ ] Users and visitors can report a current safety concern on the water (Section 3.2.6), so that the archive stays “responsive and relevant” and emerging risks are heard.
- [x] The form states that the platform is not an emergency service and shows the emergency numbers to call.
- [x] Admins acknowledge each concern, record notes, and where appropriate refer it to the responsible authority through the project’s partners; the referral is recorded.
- [x] Concerns are personal data: the reporter’s identity is not published and is shared with an authority only with their agreement.
- [x] Patterns in the concerns received are summarised in the analytics and can inform policy briefs.

### Appendix D: Project Schedule and Gantt Chart

- [ ] This appendix is the only place in the plan where dates appear. It follows the project’s 18-month milestone table and Gantt chart. The Application Questions describes a 12-month delivery; where the two differ, this plan follows the Milestones and Deliverables (Appendix B). Months are project months counted from the project start date; the proposed start date is 1 September 2026.

##### D.1 Project milestones and what the platform contributes

- [ ] **1–2**: Partner engagement | None required. This plan is available to partners for review.
- [ ] **3**: Inception and stakeholder workshop | Plan presented for validation. Metadata template and consent fields aligned with the project’s interview guides, consent forms and data collection templates.
- [ ] **4–5**: Partner training implementation | Clickable prototype and draft handbook used for the orientation on uploading materials, documenting stories and using the archive.
- [ ] **6–7**: Community mobilisation and stakeholder engagement | Prototype available for community demonstrations; plain-language explanation of how stories are shown and the storyteller’s choices.
- [ ] **8–11**: Data collection (stories and records) | Metadata spreadsheet template and recording guidance in use, so that collected materials are ready for import.
- [ ] **12–16**: Digital archive development | Design, build, content import, testing, go-live and handover of the platform (D.2).
- [ ] **16–17**: Dissemination and knowledge sharing | Policy briefs, learning summaries and the online exhibition published in the learning resources area; user guidance and basic access support.
- [ ] **18**: Archive launch and public engagement | Live demonstration and support at the official public launch; launch announcement and call for contributions on the platform.
- [ ] **18**: Final reporting, sustainability planning and project closure | Analytics figures for the final report; inputs to the sustainability plan (Section 11.8); close of the support period.

##### D.2 Platform development schedule

- [ ] The months below are planned, not fixed: the work may be re-sequenced within months 12 to 16, provided the archive is operational and accessible by the end of month 16.
- [ ] **12**: 1\. Discovery and design | M1 – Plan and prototype approved
- [ ] **13–14**: 2\. Build | M2 – Build complete (end of month 14)
- [ ] **14–15**: 3\. Content and testing | M3 – Content, testing and UAT complete
- [ ] **16**: 4\. Go-live and handover | M4 – Go-live and handover
- [ ] **16–18**: 5\. Dissemination and launch support | Resources published; official launch supported; support period closes

##### D.3 Gantt chart

- [ ] Key: blue cells are project milestones; green cells are platform work under this plan. Columns are project months 1 to 18.

### Appendix E: Alignment with the Source Documents

- [ ] The table lists the technical requirements the two source documents place on the digital archive and where this plan meets each requirement.
- [ ] **An open-access digital archive, freely accessible online without financial or institutional barriers**: Application Questions, “Activities”, item 3, p. 4; Application Questions, “How will you ensure that results and learning are shared…?”, pp. 10–11; Milestones and Deliverables, milestone “Digital archive development”, p. 3 | Sections 1.5, 3.2.1, 3.2.2 and 4.3
- [ ] **Brings together oral histories, archival materials, photographs and mapped incident data**: Application Questions, “Activities”, item 3, p. 4 | Sections 2.3, 2.4 and 3.2.14
- [ ] **Major incidents documented and mapped; an organised repository of incidents, records and materials**: Application Questions, “Activities”, item 1, p. 3; Application Questions, “Key deliverables and when they will be achieved”, pp. 11–12 | Sections 2.3, 2.4, 3.2.10 and 3.2.14
- [ ] **Testimonies recorded with consent; participants keep control over how their stories are shared**: Application Questions, “How will you engage with your beneficiaries…?”, pp. 8–9; Application Questions, “Risks and how they will be managed”, p. 13 | Sections 2.6, 3.2.4, 4.4, 11.4 and 4.11
- [ ] **Validation with participants of how contributions are represented**: Application Questions, “How will you engage with your beneficiaries…?”, pp. 8–9; Milestones and Deliverables, milestone “Data Collection”, pp. 2–3 | Sections 2.6 and 11.4 and Appendix C
- [ ] **Ongoing contributions from communities and institutions**: Application Questions, “How will you engage with your beneficiaries…?”, pp. 8–9 | Sections 3.2.4, 3.2.10 and 11.4
- [ ] **Feedback mechanisms: suggest improvements and highlight emerging safety concerns**: Application Questions, “How will you engage with your beneficiaries…?”, pp. 8–9; Application Questions, “How will you ensure that results and learning are shared…?”, pp. 10–11 | Sections 2.8 and 3.2.6 and Appendix C
- [ ] **Under-represented voices included: women in fishing communities, youth, informal transport workers**: Application Questions, “Who is it for?”, pp. 2–3; Application Questions, “How will you engage with your beneficiaries…?”, pp. 8–9 | Sections 1.6, 3.1.4 and 3.1.5
- [ ] **Beneficiaries on the coast (Mombasa, Likoni) and around Lake Victoria (Kisumu, Homa Bay, Migori, Busia, Siaya)**: Application Questions, “Where are your beneficiaries based?”, pp. 9–10 | Sections 1.6, 3.1.5, 8.1 and 11.9
- [ ] **User-friendly navigation, clear language and multimedia content for specialists and the public**: Application Questions, “How will you ensure that results and learning are shared…?”, pp. 10–11; Milestones and Deliverables, milestone “Digital archive development”, p. 3 | Sections 3.1 and 3.2
- [ ] **Policy briefs, learning summaries and educational materials shared in accessible formats**: Application Questions, “Activities”, item 5, p. 4; Application Questions, “How will you ensure that results and learning are shared…?”, pp. 10–11; Milestones and Deliverables, milestone “Dissemination and Knowledge Sharing”, pp. 3–4 | Sections 3.2.6 and 11.6
- [ ] **Public exhibitions of stories, photographs and archival materials**: Milestones and Deliverables, milestone “Dissemination and Knowledge Sharing”, pp. 3–4 | Sections 3.2.6, 3.2.14 and 11.6
- [ ] **Orientation and handbook: how to upload materials and use the archive**: Milestones and Deliverables, milestone “Partner Training Implementation”, p. 1; Application Questions, “Activities”, item 4, p. 4 | Section 11.3
- [ ] **Content organised with clear documentation standards and metadata; searchable; preserved for long-term use**: Milestones and Deliverables, milestone “Digital archive development”, p. 3 | Sections 2.3, 7.2 and 7.6
- [ ] **Collected materials catalogued and uploaded**: Milestones and Deliverables, milestone “Digital archive development”, p. 3; Milestones and Deliverables, milestone “Data Collection”, pp. 2–3 | Sections 3.2.10 and 11.4
- [ ] **User guidance and basic access support**: Milestones and Deliverables, milestone “Digital archive development”, p. 3 | Sections 11.5 and 11.8
- [ ] **Testing and refinement with partners and selected users; phased testing and regular user feedback**: Application Questions, “Key deliverables and when they will be achieved”, pp. 11–12; Application Questions, “Risks and how they will be managed”, p. 13 | Sections 1.8 and 10
- [ ] **Official public launch of the archive**: Milestones and Deliverables, milestone “Archive Launch and Public Engagement”, p. 4 | Section 11.6 and Appendix D
- [ ] **Final report, sustainability plan and continuity framework**: Milestones and Deliverables, milestone “Final Reporting, Sustainability Planning & Project closure”, pp. 4–5; Application Questions, “Changes expected after the project ends”, p. 8 | Sections 11.9 and 11.8
- [ ] **A pilot model for other countries**: Application Questions, “Short summary of your project”, p. 1; Application Questions, “What do you expect to change…?”, pp. 6–8 | Sections 3.1.5 and 11.8
- [ ] **Project schedule**: Milestones and Deliverables, Gantt chart, p. 5 | Appendix D

### Appendix F: Technical Risk Register

- [ ] **T1**: The scope does not fit the development window (Appendix D) | High | High | Phased delivery with Phase 1 first (Section 11.1); feature flags; weekly tracking against the stages
- [ ] **T2**: Collected content arrives late or in inconsistent formats | Medium | High | Metadata template and recording guidance issued before collection; bulk import accepts batches as they arrive and reports errors row by row
- [ ] **T3**: Technical problems in platform development | Medium | High | Phased testing and regular feedback from users; automated tests and quality gates (Section 10); staging before production
- [ ] **T4**: AI wrongly blocks or allows content, especially in Kiswahili, Dholuo and local languages | Medium | Medium | Human review of RED items; evaluation set in the main languages; monthly recalibration; provider can be changed through the AI gateway (Section 5)
- [ ] **T5**: Security breach or data leak | Low | High | Controls in Section 4; penetration test before go-live; incident response plan
- [ ] **T6**: Sensitive testimony published without valid consent or validation | Low | High | Consent record and validation flag enforced by the backend before publication (Section 2.6); withdrawal supported
- [ ] **T7**: Running costs for AI, storage or hosting grow faster than the budget | Medium | Medium | Spending limits and alerts, caching, free tiers, archive storage tier (Appendix G)
- [ ] **T8**: Free test hosting limits or expiry interrupt testing | High | Low | No real data on test hosting; move to production hosting before content import (Section 9)
- [ ] **T9**: App store rejection or delay | Medium | Medium | Store rules built in from the start (Section 3.3.4); early test submissions; the web app is available regardless
- [ ] **T10**: iOS builds without a Mac | Medium | Medium | Cloud build service (Section 9.9); early TestFlight build
- [ ] **T11**: Weak connectivity and low-end phones in the beneficiary regions | High | Medium | Low-data mode, offline drafts, resumable uploads, adaptive media (Section 8); tests on real low-end devices
- [ ] **T12**: Machine translation, transcription or speech voices are poor or missing for Dholuo and other languages | High | Medium | Human translation for English, Kiswahili and Dholuo interface text; transcripts editable; original recordings always available
- [ ] **T13**: Orientation on uploading and using the archive is needed before the platform exists | High | Low | Clickable prototype and draft handbook; final handbook at go-live (Section 11.3)
- [ ] **T14**: A third-party service changes its terms, price or availability (maps, AI, sign-in, push) | Medium | Medium | Each service sits behind its own module; alternatives named in the tools tables
- [ ] **T15**: Data loss | Low | High | 3-2-1 backups, point-in-time recovery, quarterly restore tests (Section 7)
- [ ] **T16**: Dependence on a single developer | Medium | High | Documentation, clean code, automated tests and the handover package (Section 11.7)
- [ ] **T17**: A safety concern is treated by its sender as an emergency call | Low | High | Clear notice and emergency numbers on the form; acknowledgement target (Appendix C)

### Appendix G: Project Cost and Running Costs

- [ ] The total project cost is KES 550,000. It covers all the work in this plan, across all three delivery phases: professional labour, external costs for the first 12 months, and the Android and iOS apps.

##### G.1 Project cost

- [ ] **A1**: Project management and coordination | 10 | 5,000 | 50,000
- [ ] **A2**: Archive structure and metadata design | 8 | 5,000 | 40,000
- [ ] **A3**: UI/UX and accessibility design | 10 | 5,000 | 50,000
- [ ] **A4**: Back-end development | 25 | 6,000 | 150,000
- [ ] **A5**: Front-end development | 12 | 5,000 | 60,000
- [ ] **A6**: Content cataloguing and upload | 20 | 2,500 | 50,000
- [ ] **A7**: Testing, security and accessibility checks | 6 | 5,000 | 30,000
- [ ] **A8**: Training, user guides and launch support | 4 | 5,000 | 20,000
- [ ] **Subtotal A: Professional labour**: 450,000
- [ ] **B1**: Web hosting and storage (12 months) | 15,000
- [ ] **B2**: SSL certificate | 3,500
- [ ] **B3**: Domain name registration | 1,500
- [ ] **B4**: Automated backups and CDN | 4,000
- [ ] **B5**: Security and uptime monitoring | 2,500
- [ ] **B6**: Contingency | 2,000
- [ ] **Subtotal B: External costs (12 months)**: 28,500
- [ ] **C1**: Hybrid mobile app (Android and iOS) | 71,500
- [ ] **Subtotal C: Hybrid mobile app**: 71,500
- [ ] **Total project cost (A + B + C)**: 550,000

##### G.2 Yearly running costs

- [ ] **Web hosting and storage**: Server, database and media storage | 15,000
- [ ] **SSL certificate**: Secure HTTPS on the archive domain | 3,500
- [ ] **Domain name**: Yearly renewal of the web address | 1,500
- [ ] **Backups and CDN**: Daily backups; fast loading worldwide | 4,000
- [ ] **Security and uptime monitoring**: Malware scans and downtime alerts | 2,500
- [ ] **Contingency**: Price changes or extra storage | 2,000
- [ ] **Total per year**: 28,500
- [ ] The first 12 months are paid from budget B. From year 2, the project owners pay these costs directly to the providers. If the apps are published under the project’s own store accounts, the Apple Developer Program costs USD 99 a year (about KES 13,000) and Google Play costs USD 25 once.

##### G.3 Cost control

All work and services in this plan are delivered within the KES 550,000 budget. To keep it that way:

- [ ] Services such as AI review, transcription, translation, maps and SMS codes will use free tiers where available, and otherwise be paid from the external costs (B) and contingency, with spending limits.
- [ ] Monthly spending limits and alerts on the AI, maps and storage accounts.
- [ ] Use of free tiers and free test hosting during development.
- [ ] Caching of AI results, translations and maps, so each is paid for once.
- [ ] Lifecycle rules that move original media files to low-cost archive storage automatically.
- [ ] A quarterly cost review (Section 9.8).
