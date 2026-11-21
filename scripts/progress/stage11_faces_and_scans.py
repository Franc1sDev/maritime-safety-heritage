"""Face blurring in the app, the OWASP ZAP scan and the Permissions-Policy header (21 November 2026).
Run from the project folder: python scripts/progress/stage11_faces_and_scans.py"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from checklist_lib import Checklist

c = Checklist()
c.mark('4.4 Data Protection and Legal Compliance', '~', only=['Consent: stories told on behalf of others'], note='consent confirmation and anonymous posting are enforced by the server; faces can be blurred on the phone before sending (the app uses the phone’s own face finder; the website does it where the browser can find faces); face blurring still to be tried on real phones')
c.mark('4.5 Encryption', 'x', only=['In transit'], note='HSTS in production; Caddy issues certificates; store builds of the Android app (-PstoreRelease) and the iPhone app allow HTTPS only')
c.mark('4.12 Tools and Technologies', 'x', only=['**Security testing**'], note='OWASP ZAP baseline scan of the running site in every automatic build; findings and decisions in docs/SECURITY.md')
c.mark('10.6 Testing Tools', '~', only=['**Apps**'], note='flutter_test (network layer, helpers, face blurring) and Android and iOS builds on every change; integration tests and devices still to come')
c.mark('10.6 Testing Tools', '~', only=['**Load**'], note='a Node load test on every change; the k6 script with the same journeys is in tests/load for larger runs')
c.mark('10.6 Testing Tools', 'x', only=['**Security**'], note='OWASP ZAP, npm audit, Dependabot and CodeQL, all automatic')
c.mark('10.6 Testing Tools', '~', only=['**Tracking**'], note='GitHub Issues named for defects in docs/TESTING.md; in use from user acceptance testing')
c.save()
