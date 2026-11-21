# How the project folder on the PC differs from the repository

`D:\Projects\Maritime Safety Heritage` holds the same code as GitHub, with these differences. Anyone (or any tool) copying
files between the two must keep them in mind.

| On GitHub | On the PC | Note |
|---|---|---|
| `mobile-app/` (the Flutter project) | `mobile-app\maritime_heritage\` | On the PC, `mobile-app\` itself holds the helper scripts (`1-SETUP.bat` … `4-RUN-ON-PHONE.bat`), `SERVER-ADDRESS.txt`, `builds\` and `keys\`. |
| not stored | `mobile-app\keys\`, `mobile-app\maritime_heritage\android\key.properties` | The release signing key and its password. Never copied to GitHub, never deleted. |
| not stored | `mobile-app\builds\` | Built apps (APK files). |
| not stored | `ACCESS-CREDENTIALS.txt`, `LOCAL-DEV-CREDENTIALS.txt`, `backend\.env` | Private. |
| `web/dist` is built, not stored | `web\dist\` is copied in | So the site runs on the PC without building. |

**Rule for copying to the PC:** never mirror-with-delete into `mobile-app\`. Copy the Flutter project into
`mobile-app\maritime_heritage\` without deleting what is already there.
(On 21 Nov 2026 a mirror-with-delete into `mobile-app\` removed the older helper scripts, logs and old APK files; the scripts were rewritten.)
