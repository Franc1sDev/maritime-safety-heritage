# Metadata and cataloguing standard

How every item in **Remembering the Waters** is described, so that the collection is consistent, searchable, and can be shared with libraries, museums and partner institutions. It covers Sections 7.6 and 11.4 of the master plan.

The spreadsheet template is [metadata-template.csv](metadata-template.csv). It is the same file admins download from **ADMINISTRATIVE CONTROLS › Import › Download the template**. How to fill it and upload it is in the [Handbook](HANDBOOK.md).

## Kinds of item

| Kind | In the spreadsheet | What it is | Published when |
|---|---|---|---|
| **Community story** | `community` | A story shared by a Contributor | The automatic review passes it |
| **Testimony collected by the project** | `testimony` | An oral history or testimony recorded by the project team | The other admins approve it, its consent record is complete, and the storyteller has confirmed how it is represented |
| **Historical record** | `record` | A photograph, document, report or other record from an institution or publication | The other admins approve it; it must name its source |
| **Company story** | — | Written by the project team in the platform | The other admins approve it |

Each item can hold text and up to 1 video (200 MB, 5 minutes), 1 audio file (100 MB), 4 documents (25 MB each) and 20 images (25 MB each). It must contain at least one of these.

## Identifiers

| | Form | Example |
|---|---|---|
| Story, testimony or record | `MS-` year `-` five digits | `MS-2026-00042` |
| Incident record | `INC-` four digits | `INC-0003` |
| Admin | `ADM-` four digits | `ADM-0007` |

Identifiers are given by the database and never reused. Each published item also has a permanent link, which is what citations use.

## Fields of an item

| Field | Spreadsheet column | Dublin Core | Notes |
|---|---|---|---|
| Identifier | — | `dc:identifier` | Automatic |
| Title | `title` | `dc:title` | Optional for community stories |
| Kind of item | `type` | `dc:type` | `testimony`, `record` or `community` |
| Text | `text` | — | The story, summary or description |
| When it happened | `date`, `date_approximate` | `dc:date` | `YYYY-MM-DD`, or just the year. Put `yes` in `date_approximate` when it is an estimate |
| Date published | — | `dcterms:issued` | Automatic |
| Where it happened | `place` | `dc:coverage` | A name from the places list; the place carries its county and water body. Admins add missing places |
| Linked incident | `incident` | `dc:relation` | Incident name or code, if the item belongs to one |
| Language | `language` | `dc:language` | A language code: `en`, `sw`, `luo`, … |
| Category | `category` | `dc:subject` | One of the categories below |
| Tags | `tags` | `dc:subject` | Separated by `;`. At most 10 are kept |
| Vessel | `vessel` | — | Vessel name, if any |
| Storyteller or creator | `storyteller` | `dc:creator` | Who told or created it |
| Published anonymously | `anonymous` | — | `yes` to publish without the name. The name stays private |
| Who added it | — | `dc:contributor` | Automatic |
| Usage rights | `rights` | `dc:rights` | One of the rights statements below |
| Files | `files` | `dc:format` | File names separated by `;`. The file types are recorded automatically |
| Source (records) | `source_institution`, `source_reference` | `dc:source` | Holding institution or publication, and its archive reference |
| Source details (records) | `source_original_date`, `source_creator`, `source_rights`, `source_obtained` | — | Original date, creator, rights statement, and how it was obtained |
| Publisher | — | `dc:publisher` | Always the archive's name |

### Consent record (testimonies)

| Field | Spreadsheet column | Notes |
|---|---|---|
| Storyteller | `storyteller` | Required |
| Type of consent | `consent_type` | Required. For example “Signed form” or “Recorded verbal consent” |
| Date of consent | `consent_date` | `YYYY-MM-DD` |
| Consent form | `consent_form` | File name of the signed form. It is kept private and never published |
| Downloads | `no_downloads` | `yes` if the storyteller does not allow downloads |
| Validated | `validated` | `yes` when the storyteller has confirmed how their contribution is represented. Required before a testimony can be imported |

For anyone under 18, a parent or guardian gives consent and is named in the consent record.

A storyteller can withdraw consent at any time; the item is then removed from public view at once.

## Controlled lists

**Categories:** Ferry and passenger transport · Fishing life · Rescue and survival · Accidents and disasters · Storms and weather · Boat-building and vessels · Trade and port life · Traditions and culture · Safety lessons · Rivers and floods · Women on the water · Youth and learning · Wildlife and environment.

Priority themes identified with communities during collection become categories, collections and incident records. A new category is a small change to the platform's code; collections and incident records are added by admins at any time.

**Rights statements:** All rights reserved · CC BY 4.0 · CC BY-SA 4.0 · CC BY-NC 4.0 · CC BY-NC-SA 4.0 · CC BY-NC-ND 4.0 · Public domain (CC0). A value that is not on this list is stored as “All rights reserved”.

**Places:** a list of landing sites, crossings, beaches, towns and islands, each with other names, county, water body, kind of place and map position.

**Incident records:** name, date, place, vessel, type, summary, outcome and sources.

## Files

- Every uploaded file is kept unchanged as the **original**, for preservation. It is never served to the public.
- Web copies are made for viewing: MP4 video, M4A audio and WebP images.
- Each file's real type is checked from its contents, it is scanned for viruses, and a **SHA-256 checksum** is stored so that later checks can show it has not changed.
- Files are encrypted in storage and served through signed links that expire.
- Audio and video can carry a transcript. It is prepared automatically where the project has turned the transcription service on, and the person who added the item can type or correct it.

Recording guidance (formats, naming and minimum quality) is in the [Handbook](HANDBOOK.md).

## Bulk import rules

- One row per item; at most 2,000 rows per batch.
- The first row holds the column names. The second row of the template explains each column and may be left in or removed. Remove the example row.
- A row needs a title, text, or at least one file.
- A testimony needs the storyteller, the type of consent, and `validated` = yes.
- A historical record needs its source institution or its archive reference.
- Upload the files first; the `files` and `consent_form` columns must match the file names exactly (upper and lower case do not matter).
- Every row is checked before anything is created, and the whole batch is then approved by the other admins as one request.

## Full export

**ADMINISTRATIVE CONTROLS › Import › Export the archive** produces a ZIP file in open formats:

| File | Contents |
|---|---|
| `stories.json` | Every published item with its Dublin Core fields (`dc:` and `dcterms:`), its full record and its consent record |
| `incidents.csv` | The incident records |
| `resources.json` | Learning resources |
| `collections.json` | Collections and exhibitions, with the identifiers of their items |
| `places.json` | The places list |
| `media/<item identifier>/` | The original files as uploaded (optional) |

With this export the archive can be moved to another system or handed to another institution without loss.

## Citation

Each item offers a suggested citation built from these fields, in this form:

> Storyteller or creator. (Year). *Title* [kind of item, identifier]. Remembering the Waters: Kenya's Maritime and Inland-Water Safety Heritage Archive. Permanent link
