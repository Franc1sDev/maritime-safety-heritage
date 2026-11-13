# Research team guide: editors and admins

How the Remembering the Waters team runs the archive day to day. Everything here works on the website and in the app. Read [USER-GUIDE.md](USER-GUIDE.md) first.

## Roles

| Role | Can do |
|---|---|
| **Member** | Search, browse, map, play media, share material, manage their own account |
| **Editor** | Everything a member does, plus: upload and catalogue, edit, publish, unpublish, delete and restore items; review submissions; manage subject terms; see the dashboard |
| **Admin** | Everything an editor does, plus: create accounts and change roles, reset passwords, suspend accounts; read contact messages; reports, audit log and CSV exports |

Give people the lowest role they need. Keep at least two admins, so one can always help the other; the archive never lets the last admin lose admin access.

Signed in as an editor or admin, the **Team** tab (app) or the **Research team** section under **See more** (website) holds these tools.

## Cataloguing an item

1. Open **Upload and catalogue**.
2. Choose the type (oral history, photograph, record, testimony) and format (audio, video, image, document, text).
3. Fill in the catalogue record. [METADATA.md](METADATA.md) explains every field. At minimum, add:
   - a clear **title**;
   - a **summary** of one or two sentences, which search engines show on the public catalogue page;
   - **date**: the year, ticking *approximate* if unsure;
   - **place**: place, county and water body, with latitude and longitude so it appears on the map;
   - **people**: narrator, interviewer, photographer or creator. Write "Anonymous" when someone asked not to be named;
   - **language**, **rights** (for example CC BY-NC 4.0) and **consent** (for example "Recorded consent, 12 March 2026, public access");
   - **subjects**: choose existing terms where possible, so search and "related items" stay consistent.
4. Attach the file. The original is kept exactly as uploaded, with a SHA-256 checksum, and is encrypted on the server.
5. For oral histories and videos, add the **transcript** with start times (mm:ss). It is searched and follows the player.
6. **Save** keeps it as a draft that only the team can see. **Publish** makes it visible to everyone signed in, and its title and summary appear on the public catalogue page at `/items/MSH-xxxx`.

An item can't be published without a summary, rights and consent.

### Large videos

Upload the original master. If it is very large (over 500 MB) or plays slowly on phones, also upload a smaller web copy with the role **web**. A typical conversion with the free tool ffmpeg is:

```
ffmpeg -i master.mov -c:v libx264 -preset veryfast -crf 26 -vf "scale='min(1280,iw)':-2" -c:a aac -b:a 128k -movflags +faststart web.mp4
```

## Reviewing submissions

**Submissions** lists material sent in by the public, newest pending first.

- Open one to see the description, the files and who sent it.
- Check the consent box was ticked, the material is genuine and nobody in it is put at risk.
- **Approve** creates a draft item with the files attached. It is not public yet: finish the catalogue record, then publish.
- **Decline** with a short, kind note. The contributor sees the note and gets an email.

## Editing, unpublishing and deleting

- **Records** lists every item with its status. Filter by status or search by title or identifier.
- **Unpublish** hides an item immediately (for example when consent is withdrawn) without losing it.
- **Delete** moves an item to *Deleted*, from where it can be restored. Removing a file from an item deletes that file permanently.

## Accounts (admins)

- **Create user** gives a one-time password to pass on privately. Ask them to change it from My account.
- **Change role** or **Suspend** ends the person's sessions at once, so it takes effect immediately.
- **Reset password** gives a new one-time password and signs them out everywhere. People can also reset their own password by email.
- Accounts people closed themselves are hidden from the list. Their past actions stay in the audit log as "Deleted account".

## Messages (admins)

Messages from the contact form arrive in **Messages**, newest first. Reply by email from the message, then mark it read. Obvious spam is dropped automatically.

## Reports and the audit log (admins)

- **Dashboard:** items, drafts, submissions waiting, accounts, views per month and recent activity. It also shows media storage use when a storage alert level is set.
- **Reports and logs:** collection health by type and water body, the most viewed items, and the full **audit log** of sign-ins, failed sign-ins, lockouts and every staff action, with the network address.
- **Export CSV:** download the catalogue, submissions or the audit log for spreadsheets or funders' reports.

## When someone copies archive material

1. Note where it appears, with screenshots and the date.
2. Check the audit log and reports for unusual bulk access.
3. Send a takedown request to the site owner or host. The terms of use, the copyright notice on every page and the item identifiers support the request. For Google results, use Google's copyright removal form.
4. Unpublish the item while you deal with it if the people in it are at risk.

## Storage alerts

When media storage passes 80% of the alert level set on the server, the addresses in `ALERT_EMAILS` get an email once a day. Ask whoever manages hosting to add storage, or to move older masters to a cheaper archive tier (see [DEPLOYMENT.md](DEPLOYMENT.md)).
