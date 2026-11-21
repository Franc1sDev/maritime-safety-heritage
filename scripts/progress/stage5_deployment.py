"""Stage 5 (deployment): what is done on the free test hosting, and what waits for the paid server, domain and store accounts.
Run from the project folder: python scripts/progress/stage5_deployment.py"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from checklist_lib import Checklist

c = Checklist()
PAID = 'prepared in deploy/ (Docker Compose with Caddy, Redis, virus scanning and backups); waits for the paid server and domain'
c.mark('9.1 Environments', 'x', only=['**Local**'])
c.mark('9.1 Environments', '~', only=['**Staging**'], note='the free Render site serves as the test and review site for now')
c.mark('9.2 Test Hosting (During Development)', 'x', only=['During development', 'Free hosting limits'])
c.mark('9.2 Test Hosting (During Development)', '~', only=['The Android app will be tested'], note='a test APK is built on every change; Google Play internal testing needs the Play Console account; iOS needs the Apple account')
c.mark('9.3 Production Hosting', '~', only=['Production will run in Docker'], note=PAID)
c.mark('9.4 Continuous Integration and Delivery (CI/CD)', 'x', only=['On every push', 'Database changes use versioned migrations'])
c.mark('9.4 Continuous Integration and Delivery (CI/CD)', '~', only=['Source code in a private GitHub repository'], note='every change is committed and pushed; the repository is currently public and can be made private in its settings')
c.mark('9.4 Continuous Integration and Delivery (CI/CD)', '~', only=['Changes that pass are deployed automatically'], note='the test site deploys from the main branch; a separate production with manual approval comes with the paid server')
c.mark('9.5 Mobile App Release', '~', only=['App versions are numbered'], note='the app sends its version and shows an update notice when the server requires a newer one')
c.mark('9.9 Tools and Technologies', 'x', only=['**Containers**', '**Reverse proxy and HTTPS**', '**Test hosting**', '**CI/CD**'])
c.mark('9.9 Tools and Technologies', '~', only=['**App builds and release**'], note='Gradle and Xcode builds run in GitHub Actions; Fastlane or Codemagic are set up with the store accounts')
c.save()
