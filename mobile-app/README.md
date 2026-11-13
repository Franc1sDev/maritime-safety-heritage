# Maritime Heritage: Android app prototype (Flutter)

The mobile version of the Maritime Safety Heritage Archive prototype: the same screens, round options, sea video welcome page, incident map, sample content and admin tools as the website prototype, rebuilt as a native Flutter app.

**Install on an Android phone:** download https://franc1sdev.github.io/maritime-safety-heritage/downloads/Maritime-Heritage-prototype.apk on the phone, open it and allow installing from this source when asked.

Sample content only. Data is stored on the phone; the full build connects to the archive's secure API.

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Researcher (user) | researcher@demo.ke | demo1234 |
| Admin | admin@demo.ke | admin1234 |

## Build it yourself

Requires Flutter 3.50+ and the Android SDK.

```bash
flutter pub get
flutter build apk --release
```

Release builds are signed with the project's upload key when `android/key.properties` is present (kept out of git); otherwise they fall back to the debug key.

## Code layout

- `lib/main.dart`: app shell, top bar, bottom tabs and the "See more" side menu
- `lib/ui.dart`: theme, round orbs with zoom and description, sea video slideshow, page backgrounds
- `lib/screens_public.dart`: landing, sign in, about, contact
- `lib/screens_main.dart`: welcome, browse, item pages, map, share a story, my account
- `lib/screens_admin.dart`: dashboard, records, upload and catalogue, submissions, users, messages, reports
- `lib/state.dart`, `lib/seed.dart`: data model and sample data

Icons: Material Symbols. Footage: Mixkit free licence. Map tiles: © OpenStreetMap contributors © CARTO.
