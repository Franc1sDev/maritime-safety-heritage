"""Stage 3 (Android app): what is done, what is partly done and why. Run from the project folder: python scripts/progress/stage3_android.py"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from checklist_lib import Checklist

c = Checklist()
PHONE = 'written and built into an installable app by the automatic build; still to be tried on a real phone'
c.mark('3.3.1 App Technology', 'x')
c.mark('3.3.2 Mobile Layout', '~', note=PHONE)
c.mark('3.3.3 Native Capabilities', '~', only=['Native Google and Apple sign-in'], note='built; needs the Google and Apple client IDs set on the server')
c.mark('3.3.3 Native Capabilities', '~', only=['Push notifications'], note='notifications, counts and priority items work inside the app; phone push needs a Firebase project and its keys')
c.mark('3.3.3 Native Capabilities', '~', only=['Camera and microphone', 'Native share sheet'], note=PHONE)
c.mark('3.3.3 Native Capabilities', '~', only=['Deep links'], note='the app accepts story, incident, resource and contributor links; the website file that lets Android verify them is added at deployment')
c.mark('3.3.3 Native Capabilities', '~', only=['Background uploads'], note='drafts are saved to the account; uploads run while the app is open, not yet in the background')
c.mark('3.3.4 App Store Requirements', '~', only=['Apple App Store', 'Google Play'], note='sign-in with Apple and Google, account deletion, reporting and blocking are in the app; the store forms and labels are filled in when the app is submitted')
c.mark('3.3.5 Device Support', '~', note=PHONE)
c.mark('3.3.6 Mobile App and Web App Wireframes', '~', note=PHONE)
c.mark('3.1.6 Cross-Platform Consistency', 'x', only=['All text comes from one shared translation source'], note='the apps copy their text from the website (scripts/sync-translations.mjs)')
c.save()
