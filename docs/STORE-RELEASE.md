# Publishing the app on Google Play and the App Store

The app is ready for both stores: release signing, store app IDs, icons, in-app account deletion, and privacy and terms pages are all in place. This guide covers the accounts, the listing and the privacy questions the stores ask.

## Before you start

- The archive must be live at its official `https://` address ([DEPLOYMENT.md](DEPLOYMENT.md)). Store reviewers sign in and try it.
- Create a **reviewer account** (a normal member) for each store and give its email and password in the review notes.
- Build with that address:

  ```bash
  flutter build appbundle --release --dart-define=API_URL=https://<your domain> -PstoreRelease
  ```

  On iOS, use `flutter build ipa --release --dart-define=API_URL=https://<your domain>`.
- Raise `version:` in `mobile-app/pubspec.yaml` for every upload (for example `1.1.0+2` to `1.2.0+3`).

## Google Play

1. Create a Google Play developer account in the project's name (USD 25, one-off). Organisations need a D-U-N-S number.
2. **Create app:** name *Remembering the Waters*, default language English, app, free.
3. **App signing:** accept Play App Signing and upload the `.aab`. The upload key on the project PC (`mobile-app/keys/`) signs every future update, so keep it and its password safe.
4. **Store listing:** use the text below, the icon (`android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png`, export a 512×512 version), a 1024×500 feature graphic and at least 4 phone screenshots.
5. **App content:**
   - Privacy policy: `https://<your domain>/#/privacy`
   - App access: *All or some functionality is restricted*. Add the reviewer account.
   - Ads: none. Target audience: 18 and over (or 13+ if the team prefers; the archive holds adult testimonies).
   - **Data safety:** see the answers below.
   - Account deletion: in the app at *MY PROFILE › Delete account*. Web link for people without the app: `https://<your domain>/profile` (sign in, then *Delete account*), or the feedback form.
6. Release to **Internal testing** first, then **Closed testing** with at least 12 testers for 14 days (Google requires this for new personal accounts), then **Production**.

## Apple App Store

1. Enrol in the Apple Developer Program (USD 99 a year) as an organisation.
2. In App Store Connect create the app with bundle ID `ke.rememberingthewaters.maritimeHeritage`.
3. On a Mac, open `mobile-app/ios/Runner.xcworkspace`, set the team under *Signing & Capabilities*, then *Product, Archive, Distribute App*.
4. Fill in the listing (text below), screenshots for 6.7" and 6.5" iPhones and 13" iPad, privacy policy URL, and the reviewer account under *App Review Information*.
5. **App Privacy:** answer as in the table below.
6. Send to TestFlight, test, then submit for review.

## Listing text

Give both languages in each store: Google Play Console › *Store listing* › *Manage translations* (Swahili, `sw`); App Store Connect › *App information* › *Localizable information* (Swahili). Have a native speaker read the Kiswahili before publishing.

### English

**Name (30 characters):** Remembering the Waters

**Subtitle, iOS (30 characters):** Kenya's water safety stories

**Short description, Android (80 characters):** Stories, testimonies and records of safety on Kenya's ocean, lakes and rivers.

**Full description:**

> Remembering the Waters is Kenya's maritime and inland-water safety heritage archive. It keeps the stories of people who live and work on the Indian Ocean coast, Lake Victoria, Lake Turkana, Lake Naivasha and Kenya's rivers: fishers, ferry crews, rescuers, families and communities, so that their experience and its lessons are not lost.
>
> • Read, listen to and watch stories, oral testimonies and historical records, one at a time
> • Browse by place, incident, Contributor, collection, map and timeline, or search the whole archive
> • Listen with transcripts, and translate a story into your language
> • Share your own story in writing, by voice or on video, by name or anonymously
> • React, comment, save favourites and follow Contributors
> • Report a safety concern, and find learning resources and policy briefs
> • English and Kiswahili, larger text, dark theme and a low-data mode for slow connections; stories you open stay readable offline
>
> Free to read without an account. Sign in with Google or Apple to share a story, comment or send messages. Every story is checked before it is published.
>
> In an emergency on the water, call 999 or 112. The archive is not an emergency service.

**Keywords, iOS (100 characters):** maritime,Kenya,water safety,heritage,oral history,Lake Victoria,ferry,fishing,archive,stories

### Kiswahili

**Jina:** Remembering the Waters

**Kichwa kidogo, iOS:** Hadithi za usalama majini Kenya

**Maelezo mafupi, Android:** Hadithi, ushuhuda na kumbukumbu za usalama baharini, maziwani na mitoni Kenya.

**Maelezo kamili:**

> Remembering the Waters ni hifadhi ya urithi wa usalama wa baharini na majini nchini Kenya. Inahifadhi hadithi za watu wanaoishi na kufanya kazi kando ya pwani ya Bahari Hindi, Ziwa Viktoria, Ziwa Turkana, Ziwa Naivasha na mito ya Kenya: wavuvi, wafanyakazi wa feri, waokoaji, familia na jamii, ili uzoefu wao na mafunzo yake yasipotee.
>
> • Soma, sikiliza na tazama hadithi, ushuhuda wa mdomo na kumbukumbu za kihistoria, moja baada ya nyingine
> • Vinjari kwa mahali, tukio, Mchangiaji, mkusanyiko, ramani na mfuatano wa wakati, au tafuta katika hifadhi yote
> • Sikiliza pamoja na manukuu, na tafsiri hadithi kwa lugha yako
> • Shiriki hadithi yako kwa maandishi, kwa sauti au kwa video, kwa jina lako au bila jina
> • Onyesha hisia, toa maoni, hifadhi unazozipenda na fuata Wachangiaji
> • Ripoti hatari ya usalama, na pata nyenzo za kujifunzia na muhtasari wa sera
> • Kiingereza na Kiswahili, maandishi makubwa, mandhari meusi na hali ya data kidogo kwa mtandao wa polepole; hadithi ulizofungua zinasomeka hata bila mtandao
>
> Ni bure kusoma bila akaunti. Ingia kwa Google au Apple ili kushiriki hadithi, kutoa maoni au kutuma ujumbe. Kila hadithi hukaguliwa kabla ya kuchapishwa.
>
> Katika dharura majini, piga 999 au 112. Hifadhi hii si huduma ya dharura.

**Maneno muhimu, iOS:** bahari,Kenya,usalama majini,urithi,historia simulizi,Ziwa Viktoria,feri,uvuvi,hifadhi,hadithi

**Category:** Education (Android); Education, with Reference as the second category (iOS). **Content rating:** answer the questionnaire truthfully: user-generated content with moderation and reporting, users can interact, no ads. Stories may describe accidents and loss of life, with a notice before distressing ones. Expect *Teen* / *12+*.

**Support address:** the project's support email. **Privacy policy URL:** `https://<the archive's domain>/privacy`.

## Privacy answers for both stores

| Data | Collected | Why | Shared | Optional |
|---|---|---|---|---|
| Name and email address (from Google or Apple) | Yes | Account | No | Only for those who sign in |
| Username, profile picture, short bio | Yes | Shown on the person's profile and stories | No | Picture and bio are optional |
| Stories, photos, videos, audio, files, comments, messages | Yes, only what the person chooses to share | App functionality | No | Yes |
| Location | No. Places are typed or chosen from a list; the app does not read the phone's location | | | |
| App interactions (stories opened, reactions) | Yes, with pseudonymised references | Analytics shown to the project team in totals | No | No |
| Device ID: push-notification token | Yes, if notifications are allowed | Sending notifications | Firebase (Google), as service provider | Yes |
| IP address in the sign-in log | Yes | Security, fraud prevention | No | No |

- Data is encrypted in transit: **yes**.
- Users can ask for their data to be deleted: **yes**, in the app (*MY PROFILE › Delete account*); erased after 30 days.
- No ads, no tracking across other companies' apps, no data sold.
