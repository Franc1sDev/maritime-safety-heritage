# Maritime Heritage: the Android and iOS app (Flutter)

One app for Android and iOS phones and tablets. It uses the same secure API, accounts and archive as the website, so content is managed once.

It covers search, browse and filter, the incident map, oral histories with synced transcripts, video, photographs and documents. People can share stories with the phone camera and manage their account, including closing it. Editors and admins can catalogue, publish and review submissions; admins also manage users, messages and reports.

## Build

You need Flutter 3.50 or later. Android builds also need Android Studio (SDK); iOS builds need a Mac with Xcode.

```bash
flutter pub get
flutter analyze && flutter test

# Android: APK for direct install, App Bundle for Google Play
flutter build apk --release --dart-define=API_URL=https://archive.example.org
flutter build appbundle --release --dart-define=API_URL=https://archive.example.org

# iOS (on a Mac)
flutter build ipa --release --dart-define=API_URL=https://archive.example.org
```

`API_URL` is the archive's address. People can also change it in the app under **More options, Server address**, which is useful for testing against a computer on the local network (for example `http://192.168.1.20:4000`).

## Signing

**Android.** Release builds are signed with the upload key named in `android/key.properties`, which is never committed. Without that file, builds fall back to the debug key, which Google Play does not accept. Keep the keystore and its password safe: every future update must be signed with the same key. Google Play App Signing keeps the final signing key on Google's side.

**iOS.** Open `ios/Runner.xcworkspace` in Xcode, choose the project's Apple Developer team under *Signing & Capabilities*, then use *Product, Archive* to upload to App Store Connect.

Plain `http://` addresses are allowed for local testing. Store builds should use the archive's `https://` address; pass `-PstoreRelease` to the Android build to turn off plain HTTP entirely.

## Publishing to the stores

See [`../docs/STORE-RELEASE.md`](../docs/STORE-RELEASE.md) for the step-by-step guide, listing text and the privacy answers both stores ask for.

| | Android | iOS |
|---|---|---|
| App name | Maritime Heritage | Maritime Heritage |
| Package / bundle ID | `ke.rememberingthewaters.maritime_heritage` | `ke.rememberingthewaters.maritimeHeritage` |
| Version | `version:` in `pubspec.yaml` (name+build number) | same |

## Code layout

- `lib/api.dart`: HTTP client, secure token storage, refresh and uploads with progress
- `lib/state.dart`: data models and app state (signed-in user, vocabularies, counts, settings)
- `lib/ui.dart`: theme, round option buttons, backgrounds and shared widgets
- `lib/main.dart`: app shell, bottom tabs and the side menu
- `lib/screens_public.dart`: landing page, sign in, about, contact, server address
- `lib/screens_main.dart`: welcome, browse, item pages and players, map, sharing, my account
- `lib/screens_admin.dart`: dashboard, records, cataloguing, submissions, users, messages, reports

Icons: Material Symbols. Footage: Mixkit free licence. Map tiles: © OpenStreetMap contributors © CARTO.
