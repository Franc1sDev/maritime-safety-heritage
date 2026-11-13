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
2. **Create app:** name *Maritime Heritage*, default language English, app, free.
3. **App signing:** accept Play App Signing and upload the `.aab`. The upload key on the project PC (`mobile-app/keys/`) signs every future update, so keep it and its password safe.
4. **Store listing:** use the text below, the icon (`android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png`, export a 512×512 version), a 1024×500 feature graphic and at least 4 phone screenshots.
5. **App content:**
   - Privacy policy: `https://<your domain>/#/privacy`
   - App access: *All or some functionality is restricted*. Add the reviewer account.
   - Ads: none. Target audience: 18 and over (or 13+ if the team prefers; the archive holds adult testimonies).
   - **Data safety:** see the answers below.
   - Account deletion: in-app at *My account, Close account*. Web link for people without the app: `https://<your domain>/#/profile` (sign in, then *Close account*), or the contact form.
6. Release to **Internal testing** first, then **Closed testing** with at least 12 testers for 14 days (Google requires this for new personal accounts), then **Production**.

## Apple App Store

1. Enrol in the Apple Developer Program (USD 99 a year) as an organisation.
2. In App Store Connect create the app with bundle ID `ke.rememberingthewaters.maritimeHeritage`.
3. On a Mac, open `mobile-app/ios/Runner.xcworkspace`, set the team under *Signing & Capabilities*, then *Product, Archive, Distribute App*.
4. Fill in the listing (text below), screenshots for 6.7" and 6.5" iPhones and 13" iPad, privacy policy URL, and the reviewer account under *App Review Information*.
5. **App Privacy:** answer as in the table below.
6. Send to TestFlight, test, then submit for review.

## Listing text

**Name:** Maritime Heritage

**Short description (80 characters):** Kenya's maritime and inland-water safety heritage: stories, photos and records.

**Full description:**

> The Maritime Safety Heritage Archive gathers oral histories, photographs, historical records and testimonies about safety on Kenya's ocean, lakes and rivers, so their lessons are not lost.
>
> • Search everything, including the words spoken in oral histories
> • Browse by type, water body, decade and county
> • See where each story happened on the incident map
> • Listen to oral histories with transcripts that follow along
> • Share your own story, photo or document with the research team
> • Light mode for slow connections, and larger text
>
> Built by the Remembering the Waters research team. Free to use with an account.

**Category:** Education (Android), Education or Reference (iOS). **Keywords (iOS):** maritime, Kenya, safety, heritage, oral history, Lake Victoria, ferry, fishing, archive.

## Privacy answers for both stores

| Data | Collected | Why | Shared | Optional |
|---|---|---|---|---|
| Name, email address | Yes | Account | No | No |
| Organisation | Yes | Account | No | Yes |
| Photos, videos, audio, files | Yes, only what the user chooses to share | App functionality (submissions) | No | Yes |
| Location | No | | | |
| App interactions (which items are opened) | Yes | Analytics shown to the research team in totals | No | No |
| IP address in the sign-in log | Yes | Security, fraud prevention | No | No |

- Data is encrypted in transit: **yes**.
- Users can ask for their data to be deleted: **yes**, in the app (*Close account*).
- No ads, no tracking across other companies' apps, no data sold.
