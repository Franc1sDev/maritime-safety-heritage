"""After stage 5: the welcome, the admin app lock, and uploads in pieces with pause, resume, cancel and Wi-Fi only.
Run from the project folder: python scripts/progress/stage7_welcome_lock_uploads.py"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from checklist_lib import Checklist

c = Checklist()
PHONE = 'still to be tried on a real phone'
c.mark('11.5 In-Platform Onboarding', 'x', only=['A short welcome'], note='shown once after a first profile is set up, on the website and in the app')
c.mark('3.3.3 Native Capabilities', '~', only=['Optional fingerprint or face unlock'], note=f'built: admins turn it on in Settings, and it is asked when the app opens and after a minute away; {PHONE}')
c.mark('3.3.3 Native Capabilities', '~', only=['Background uploads that continue'], note=f'uploads carry on while browsing and, on Android, in the background with a progress notification; if the app is closed completely the story stays in drafts and its files are added again; {PHONE}')
c.mark('8.4 Uploads on Unstable Networks', 'x', only=['Resumable uploads'], note='on the website and in the app')
c.mark('8.4 Uploads on Unstable Networks', '~', only=['Background uploads continue'], note=f'in the app: while browsing, and on Android in the background with a notification; not after the app is closed completely, and no notification on iPhone; {PHONE}')
c.mark('8.4 Uploads on Unstable Networks', '~', only=['Users can pause, resume or cancel'], note=f'pause, resume and cancel on the website and in the app, Wi-Fi only in the app; {PHONE}')
c.mark('8.9 Tools and Technologies', 'x', only=['**Resumable uploads**'], note='tus server, tus-js-client on the website, and a small tus client written for the app')
c.save()
