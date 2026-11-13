# Metadata schema (Phase 1)

How every item in the Maritime Safety Heritage Archive is described. The backend database (`backend/src/database/migrations/001_initial.sql`) follows this schema. Each field maps to Dublin Core so records can be shared with other archives later.

## Item types

| Type | Typical format | Examples |
|---|---|---|
| `oral` Oral history | audio, video | Recorded interviews with crews, fishers, survivors, rescuers |
| `photo` Photograph | image | Family and studio photographs, press photographs |
| `record` Record or report | document | Regulations, checklists, inquiry reports, notices |
| `testimony` Testimony | text | Written accounts and translated statements |

Formats: `audio`, `video`, `image`, `document`, `text`.

## Record fields

| Field | Required | Dublin Core | Notes |
|---|---|---|---|
| Identifier | auto | `dc:identifier` | `MSH-0001` onwards, assigned by the database and never reused |
| Type | yes | `dc:type` | One of the four item types |
| Format | yes | `dc:format` | One of the five formats; the file's MIME type is stored with each media file |
| Title | yes | `dc:title` | Up to 300 characters |
| Summary | yes, to publish | `dc:description` | Two or three sentences for search results |
| Body | no | `dc:description` | Full text of a testimony, or the transcribed pages of a document |
| Year | no | `dc:date` | 1800 to 2200; tick "approximate" when the year is estimated |
| Water body | no | `dc:coverage` | From the water bodies list below |
| County, place | no | `dc:coverage` | Free text, for example "Mombasa", "Likoni crossing" |
| Latitude, longitude | no | `dc:coverage` | Decimal degrees; places the item on the incident map |
| Subjects | no | `dc:subject` | From the subject list; new subjects are added by admins |
| Creator | no | `dc:creator` | Person or body that made the item |
| Narrator, interviewer, photographer | no | `dc:contributor` | Use "(anonymised)" where consent requires it |
| Language | no | `dc:language` | For example "Kiswahili, English transcript" |
| Rights | yes, to publish | `dc:rights` | Licence or permission, for example "CC BY-NC 4.0" |
| Consent | yes, to publish | none | How consent was recorded, for example "Signed consent form on file" |
| Duration | no | `dc:extent` | Seconds, for audio and video |
| Transcript | no | none | Time-coded segments (start second plus text) for oral histories |
| Status | auto | none | `draft`, `published` or `unpublished`; only published items are visible to normal users |

Every record also stores who created and last changed it, when it was published, and a deletion date (deleted records are hidden, not erased).

## Controlled vocabularies

**Water bodies:** Indian Ocean coast, Lake Victoria, Lake Turkana, Lake Naivasha, Lake Baringo, Rivers. Each has a type (ocean, lake, river) and a centre point for the map.

**Subjects:** short lower-case headings such as *ferry*, *life jackets*, *search and rescue*, *weather*, *traditional knowledge*. Each has a fixed slug (`life-jackets`) and a label that can be corrected later without breaking links.

## Media files

Every uploaded file is kept as the original. Web copies and thumbnails can be stored alongside it.

| Field | Notes |
|---|---|
| Role | `original`, `web` or `thumbnail` |
| Original name, MIME type, size | Taken from the upload; the type is checked against the file's contents |
| SHA-256 | Fixity checksum, to show the file has not changed |
| Storage key | Location in storage (local disk or an S3-compatible bucket) |

Files are never public. They are served through signed links that expire after an hour.

## Submissions from the public

| Field | Required | Notes |
|---|---|---|
| Reference | auto | `SUB-0001` onwards |
| Type, title, description | yes | |
| Year, water body, place | no | |
| Consent confirmed | yes | The contributor confirms they have the right to share the item |
| Files | no | Up to 5 files per submission |
| Status | auto | `pending`, `approved` (a draft record is created) or `rejected` (with a note to the contributor) |

## Search

Search covers the title (strongest weight), summary, then body, place, county, subjects, people, water body and transcript. It uses language-neutral matching so English, Kiswahili and other community languages are all searchable.
