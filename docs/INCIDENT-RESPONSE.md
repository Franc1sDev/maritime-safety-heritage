# Incident response plan

What the team does when something goes seriously wrong with the archive: a security breach, exposed personal data, or the platform going down. It covers Section 4.9 of the master plan.

**Before go-live, fill in the names and contact details marked “to be named”.** A plan nobody can reach is no plan. Keep a printed copy with the Super Admins.

## Who does what

| Role | Who | Does |
|---|---|---|
| **Incident lead** | A Super Admin (to be named, with a deputy) | Decides, coordinates, and is the one voice to partners and the public |
| **Technical lead** | The developer or maintenance provider (to be named) | Contains the problem, restores service, finds the cause |
| **Data protection contact** | The person named in the project's registration with the Office of the Data Protection Commissioner (to be named) | Decides whether the breach must be reported, and reports it |
| **Moderation lead** | An admin (to be named) | Answers Contributors in the INBOX and posts announcements |

Contact list (keep phone numbers here, in the password manager and on paper): *to be completed by the project.*

## How serious is it?

| Level | Examples | Start work within |
|---|---|---|
| **Critical** | Personal data exposed or stolen; an admin account taken over; the database or media changed by an outsider; data lost; the platform down for everyone | Immediately, any hour |
| **High** | A main feature is broken with no way round it; sign-in fails for many; the AI review is down so every story waits | 4 hours |
| **Medium** | Something works wrongly but there is a way round it | Next working day |
| **Low** | Cosmetic | Planned work |

These are the same levels used for defects in [TESTING.md](TESTING.md).

## The steps

### 1. Notice and record (first 15 minutes)

- Signs: an alert from the uptime monitor; many failed sign-ins or lockouts in the audit log; a report from a Contributor; content nobody on the team posted; a message from the hosting provider.
- Whoever notices tells the incident lead by phone.
- Start a written timeline at once: what was seen, when, by whom. Add every action as it is taken. Do not delete anything.

### 2. Contain (first hour)

Stop the damage before looking for the cause.

| If | Do |
|---|---|
| An admin or Super Admin account may be taken over | A Super Admin removes that account in **MANAGE ADMINS** (access ends at once). The person changes their email password too |
| A Contributor account is posting harm | An admin suspends it from **Account actions** and removes the content |
| A secret may have leaked (`.env`, a key, a token) | Change it on the server and restart ([SECURITY.md](SECURITY.md), “Secrets”). Changing the sign-in secrets signs everyone out |
| The server itself may be compromised | Take it off the internet (the provider's firewall or “pause”), keep its disk for evidence, and prepare a clean server |
| The attack is traffic (too many requests) | Turn on the CDN's “under attack” mode; the platform's rate limits stay on |
| A harmful file got through | Remove the story; the file leaves public view at once |

Tell people early: an admin posts an announcement (for example titled “Scheduled maintenance”) saying the team is working on a problem. Say only what is known.

### 3. Assess: was personal data involved? (first 24 hours)

The data protection contact answers, in writing, in the timeline:

- What data? (emails, phone numbers, ID or passport numbers of admins, messages, private consent forms, safety concern reports)
- Whose, and how many people?
- Was it only at risk, or actually seen, copied or changed?
- Was it encrypted? (Media files and admins' ID or passport numbers are encrypted in storage. Passwords are stored only as salted hashes. Emails, phone numbers and messages are protected by access to the database, not encrypted one by one.)

### 4. Report a personal data breach (within 72 hours)

Under Kenya's Data Protection Act, 2019 (section 43), a breach with a real risk of harm to the people concerned must be reported to the **Data Protection Commissioner within 72 hours** of the project becoming aware of it. The people affected must also be told, in writing, unless their identity cannot be established.

- The report says what happened, the kind and amount of data, the likely consequences, what has been done, and who to contact.
- If the full facts are not known within 72 hours, report what is known and say more will follow. Give reasons for any delay.
- Tell the people affected in plain words: what happened, what it means for them, what they should do (for example watch for false messages), and how to reach the team. Use email and the INBOX.
- If a company that processes data for the project (the hosting or email provider) discovers the breach, it must tell the project within 48 hours. Check that the contracts say so.

Confirm the current reporting form and address on the Commissioner's website (odpc.go.ke), and take advice from the project's legal adviser before sending. This plan is not legal advice.

### 5. Restore service

- Fix the cause (a patch, a changed setting, a removed account) before bringing the service back.
- If data was changed or lost, restore from the last good backup: [DISASTER-RECOVERY.md](DISASTER-RECOVERY.md).
- Check before reopening: the home page opens, sign-in works, a story can be posted and is reviewed, and the audit log shows nothing unexpected.
- Post an announcement that the problem is fixed.

### 6. Review (within 5 working days)

After every critical or high incident, the incident lead holds a short review and writes a record:

| Field | |
|---|---|
| Date and time noticed, contained and fixed | |
| What happened, in plain words | |
| Cause | |
| What data or people were affected | |
| Reported to the Commissioner? When? Reference | |
| What was fixed | |
| What will stop it happening again, who will do it, by when | |

Keep the records in the project's shared folder. Enter technical follow-up work in the issue tracker (GitHub Issues), labelled “incident”.

## What the platform gives the team during an incident

- **Audit log:** every sign-in and every admin action, which cannot be edited or deleted. Super Admins see all of it; each admin sees their own.
- **Removing an admin** takes effect at once.
- **Sign out everywhere else** in each person's Settings; reusing an old sign-in token signs that account out on every device automatically.
- **Lockout:** an admin account locks for a time after repeated wrong passwords; its owner is emailed and the Super Admins are notified.
- **Health check:** `/api/v1/health` for the uptime monitor.
- **Background work** page (Super Admin): failed jobs, such as reviews or emails that could not be sent.

## Practise

Once a year, with the yearly security review, the team walks through one made-up incident using this plan and corrects whatever did not work, including the contact list.
