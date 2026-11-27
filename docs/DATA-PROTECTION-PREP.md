# Data protection: preparation for registration and agreements

Preparation for the project's legal adviser and data protection contact ([GO-LIVE.md](GO-LIVE.md), section 4). **This is not legal advice.** It gathers what the platform does with personal data, and what the Office of the Data Protection Commissioner (ODPC) says it asks for, so the adviser can complete the registration and the agreements. Facts about the ODPC are from its website on 27 November 2026; check them again when applying.

## 1. Registration with the ODPC

- **Who registers:** the institution that decides why and how the data is used (the **data controller**). For this archive that is the lead institution. Education is one of the sectors that must register whatever their size. Ask the institution first whether it already holds a certificate, and whether the archive should be added to its registered particulars; changes must be reported within 14 days.
- **Controller and processor:** an organisation acting as both needs two applications and two fees. The adviser decides whether that applies.
- **Where:** online, on the ODPC's portal.
- **Fee (one-time):** KES 4,000 for micro and small organisations, public entities and charities; KES 16,000 medium; KES 40,000 large. Paid by M-Pesa, card, bank transfer or cheque.
- **Validity:** 24 months; renew at least 30 days before it ends (KES 2,000, 9,000 or 25,000).
- **Timing:** the certificate is issued within 14 days of approval; a refusal is explained within 21 days.

### What the application asks for, and the answers the platform gives

| The ODPC asks for | For this archive |
|---|---|
| Establishment documents; name and contact details | From the lead institution |
| Previous annual turnover | From the lead institution |
| Purposes of processing | Running a public heritage archive: accounts for Contributors; publishing stories and testimonies with consent; moderation and safety; replying to reports and safety concerns; anonymous statistics for reporting |
| Categories of data subjects | Contributors (members of the public, 18 and over); storytellers whose testimonies the project records; the project's admins; people named in stories |
| Categories of personal data | Name, email address and profile picture from Google or Apple sign-in; username and optional bio; stories, photographs, audio, video and documents the person chooses to share; comments and messages; consent records for testimonies; for admins: work email, staff number, phone number and ID or passport number (shown only on request, with each viewing recorded); IP address in the sign-in and audit logs; push-notification token |
| Sensitive data | Stories may describe deaths, injuries and bereavement, and may reveal health information or beliefs when the storyteller chooses to tell them. Stories that identify a child need a parent's or guardian's consent |
| Recipients | The public, for published items only; the project's admins; the service providers in section 3. No data is sold or used for advertising |
| Transfers outside Kenya | Yes: hosting and storage are outside Kenya (the test site is in Frankfurt, Germany). The adviser confirms the legal basis and safeguards for each provider |
| Risks and safeguards | See [SECURITY.md](SECURITY.md): encryption in transit and of stored media; two-step sign-in for admins; roles and approvals; audit log; AI and human moderation; anonymous posting; rate limits; backups; incident plan ([INCIDENT-RESPONSE.md](INCIDENT-RESPONSE.md)) |

### How long data is kept (as built)

| Data | Kept |
|---|---|
| A deleted account or story | Erased 30 days after deletion |
| A story removed by the admins | Erased after 1 year |
| Page-speed measurements (no personal data) | 90 days |
| Backups | 30 days daily, 3 months weekly, 1 year monthly |
| Audit log | Kept; cannot be edited or deleted |

People can download their data and delete their account themselves in **MY PROFILE**.

## 2. Questions for the legal adviser

1. Does the lead institution's existing registration cover the archive, or is a new or amended registration needed?
2. Is a **data protection impact assessment** required before launch, given the testimonies about loss of life and the possible health information? The platform's facts for it are in this document and in SECURITY.md.
3. What is the lawful basis for each purpose (consent for stories and testimonies; legitimate interest or public interest for moderation, security logs and archiving)?
4. Are the consent wording in the [Handbook](HANDBOOK.md), the privacy policy and the terms in the archive correct and complete? They were written for the build and have had no legal review.
5. Which safeguards are needed for transfers outside Kenya, for each provider?
6. Who is the named data protection contact, and who reports a breach to the Commissioner? The incident plan follows the 72-hour reporting period in the Data Protection Act; confirm it.
7. How are requests from people about their data (access, correction, deletion, objection) received and answered within the legal time?

## 3. Processing agreements to sign

One with each provider that handles personal data for the archive. Most publish a standard agreement to accept online.

| Provider | Handles | Needed when |
|---|---|---|
| Hosting and database (Render at present) | Everything | Before real data |
| Media storage (Cloudflare R2 planned) | Encrypted photographs, audio, video and documents | When it is switched on |
| Off-site backup storage | Encrypted backups | Production |
| Email sending | Email addresses; sign-in codes and notices | Production |
| SMS (optional) | Phone numbers of admins | If used |
| AI review, transcription and translation | The text, audio and video of stories, comments and messages | Before a provider is switched on |
| Google and Apple sign-in | Name, email, picture at sign-in | Already used; governed by their terms |
| Firebase (push notifications, optional) | Device tokens | If used |

Each agreement should cover: processing only on the project's instructions; confidentiality; security measures; no use of the data to train the provider's models (important for the AI provider); sub-processors; where the data is kept; help with people's requests; **notice of a breach to the project within 48 hours**; return or deletion of the data at the end; and the right to audit.

## Sources

- [ODPC: frequently asked questions](https://www.odpc.go.ke/faqs/)
- [The Data Protection (Registration of Data Controllers and Data Processors) Regulations, 2021](https://new.kenyalaw.org/akn/ke/act/ln/2021/265/eng@2022-12-31)
