# Releasing the iPhone and iPad app

The iOS app is the same Flutter code as the Android app (`mobile-app/`). Every change is built for iOS, unsigned, by the
automatic build on GitHub ("iOS app (unsigned build)"), so the code is known to compile. Putting it on a phone or in the
App Store needs things only the project owner can provide.

## What is needed

1. **An Apple Developer Program membership** (paid yearly to Apple) in the name of the person or organisation publishing the app.
2. **A Mac with Xcode**, or a cloud Mac build service, to sign the app.

## Steps (once the membership exists)

1. In the Apple Developer site, register the app ID `ke.rememberingthewaters.maritimeHeritage` (or the ID shown in Xcode under Runner › General) and turn on **Sign in with Apple** and **Associated Domains**.
2. On the Mac: `cd mobile-app && flutter pub get && open ios/Runner.xcworkspace`.
3. In Xcode, Runner › Signing & Capabilities: choose the team, then add the capabilities **Sign in with Apple** and **Associated Domains**. Point "Code Signing Entitlements" at `Runner/Runner.entitlements` (already in the project folder).
4. For Google sign-in on iOS, create an iOS OAuth client ID in Google Cloud and add `GIDClientID` and its reversed URL scheme to `Info.plist`. Until then the app offers Sign in with Apple on iOS, which Apple requires anyway.
5. Build and upload: `flutter build ipa --release --dart-define=API_URL=https://<the live address>` then upload with Xcode or Transporter to TestFlight.
6. On the server, publish `/.well-known/apple-app-site-association` with the team ID and app ID so shared story links open in the app.
7. App Store Connect: privacy labels (account data, user content, identifiers; no tracking), the privacy policy link (`/privacy`), screenshots and descriptions in English and Kiswahili, and a test account for the reviewer.

## What Apple checks that the app already has

- Sign in with Apple offered alongside Google.
- Account deletion inside the app (MY PROFILE › Delete account).
- Reporting and blocking for user content (Report on stories, comments and profiles; Block on profiles and in conversations).
- A privacy policy and terms inside the app.

## Not yet in the app

- Push notifications on iPhone (needs the Apple push key added to a Firebase project).
- Face ID unlock for admin accounts.
