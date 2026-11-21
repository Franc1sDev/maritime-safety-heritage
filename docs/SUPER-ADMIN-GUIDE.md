# Super Admin guide

For the senior members of the project team who hold the **Super Admin** role.

A Super Admin manages the admins, sees all analytics and the full audit log, decides approval requests that passed their deadline, and watches the platform's background work. **Super Admins do not moderate stories**; that is the admins' work ([ADMIN-GUIDE.md](ADMIN-GUIDE.md)).

**There must always be at least one Super Admin.** The platform refuses to remove, or let delete their own account, the only Super Admin. Keep at least two, so that one person's absence or lost phone never locks the project out.

## Signing in

Sign in like an admin: **Project team** on the sign-in page, your work email and password, then a 6-digit code from your authenticator app, your email or your phone. Set up an authenticator app in **Settings › Sign-in and security**; it is quicker and works without a connection.

Your round icons include **MANAGE ADMINS**, **LIVE ANALYTICS** and **REPORTS**.

## Manage admins

### Approve a registration

People who registered from **Admin registration** appear under **Registrations waiting for approval**, with their name, work email, staff number and phone.

- Check that the person is on the project team and that the staff number is theirs.
- To see their ID or passport number, choose **Show**. Each viewing is recorded in the audit log.
- **Approve** lets them sign in. **Decline** needs a reason.

### Add an admin by invitation

Enter the person's **work email** (and their full name if you wish) and **Send invitation**. They complete the registration and set up their second sign-in step. The link works for 7 days.

### Remove an admin

**Remove** next to the admin's name, with a reason. **They lose access immediately.** Do this on the day someone leaves the team, and at once if an account may have been taken over ([INCIDENT-RESPONSE.md](INCIDENT-RESPONSE.md)).

### Make a Super Admin

**Make Super Admin** next to an admin's name. Remember that Super Admins do not moderate, so the admin team becomes one smaller.

### Watching the team

For each admin the list shows when they last signed in, how they receive their sign-in code (authenticator app or email codes), and their number of actions in the last 30 days. Someone who **has not signed in yet** after several days may need a reminder.

## Overdue approvals

Admins approve company stories, collections, bulk imports, AI overrides and permanent account deletions among themselves, by a two-thirds majority within 7 days. **Requests that passed their deadline without a decision come to you.** Open each one, read the proposal and the votes cast so far, and **Approve** or **Decline** with a written reason.

If requests often go overdue, the team may be too small or the notifications are being missed.

## Live analytics and PDF reports

**LIVE ANALYTICS** shows the same figures the admins see, updated live: published stories, testimonies and historical records, counties and water bodies represented, Contributors and active users, visitors, safety concerns, resource views and downloads, citations, and the quality of the AI review.

Use the **AI quality** figures at the quarterly review:

| Figure | What to look for |
|---|---|
| **RED items reviewed within 24 h** | Should be all of them |
| **AI override rate** and **Wrongly blocked (overridden)** | A rising rate means the AI is blocking too much |
| **Admins agreed with RED flags** | A falling share means the same |
| **AI flags by language** | No language should be flagged much more than the others |
| **Overrides by guideline** | A high share overridden on one guideline means its guidance needs adjusting |

**Recalibrate** changes the scores at which a story becomes YELLOW or RED (20% and 70% by default). Change them only after a review, by small steps, and note the reason in the review record.

**REPORTS**: choose a period and the charts to include, and **Generate PDF report**. A monthly report is generated automatically on the first day of each month. These reports carry the measures the project reports to its funder.

## Audit log

You see every recorded action by every admin and Super Admin: sign-ins, failed sign-ins and lockouts, moderation decisions, approvals and votes, account actions, and viewings of ID numbers. The log cannot be edited or deleted, by anyone.

Look through it every week for failed sign-ins and lockouts, and whenever something seems wrong.

## System

**Background work** shows the jobs the platform runs behind the scenes: media processing, AI review, notifications, exports and reports. The counts are **Waiting**, **Working**, **Completed** and **Failed**.

- A few failures are normal (for example an email address that does not exist).
- Many jobs waiting for a long time, or the same failure repeating under **Recent failures**, means something is wrong: tell the technical contact.

## Your regular duties

| When | What |
|---|---|
| Every week | Read the audit log for failed sign-ins and lockouts. Clear overdue approvals |
| The day someone joins or leaves | Invite or remove their admin account |
| Every month | Read the automatic monthly report. Check Background work |
| Every quarter | Review performance, AI quality, security and costs. Confirm that a restore test was done ([DISASTER-RECOVERY.md](DISASTER-RECOVERY.md)) |
| Every year | Security review and incident practice. Renewals: domain, hosting, Apple Developer Program ([MAINTENANCE.md](MAINTENANCE.md)) |

## If you are the incident lead

A Super Admin leads the response to a breach or an outage. The steps, including the 72-hour report to the Data Protection Commissioner, are in [INCIDENT-RESPONSE.md](INCIDENT-RESPONSE.md). Read it before you need it.
