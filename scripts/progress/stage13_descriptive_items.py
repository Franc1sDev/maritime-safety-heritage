"""Descriptive items in Sections 1, 2.13, 3.4, 5, 6, 7.8, 11 and Appendices C, F and G, checked against the build (25 November 2026).
Run from the project folder: python scripts/progress/stage13_descriptive_items.py"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from checklist_lib import Checklist

c = Checklist()
S = '1.2.2 Specific Objectives'
c.mark(S, 'x', only=['To build an open-access archive'], note='stories, testimonies, historical records, photographs and mapped incidents, open to visitors without an account')
c.mark(S, 'x', only=['To protect storytellers'], note='recorded consent, AI review, human moderation with the audit log and approvals, reporting and safety concerns')
c.mark(S, '~', only=['To make the archive accessible'], note='low-data mode, offline reading and WCAG checks are built; English and Kiswahili are complete, the other 18 languages need translators')
S = '1.3 Project Deliverables'
c.mark(S, 'x', only=['**2. Website and web app**'], note='the full platform on the website, installable with an offline shell and push notifications')
c.mark(S, '~', only=['**3. Android app**'], note='built and tested in every automatic build; publishing on Google Play needs the Play Console account')
c.mark(S, '~', only=['**4. iOS app**'], note='built (unsigned) in every automatic build; publishing needs the Apple Developer account and signing')
for k, n in [('**5. Admin and Super Admin tools**', 'administrative controls, moderation, reports queue, live analytics and PDF reports'),
             ('**6. Incident records and national mapping**', 'incident catalogue with its map and linked items'),
             ('**7. Bulk import and cataloguing tools**', 'spreadsheet import with checking, approval and the metadata template'),
             ('**8. Learning resources area**', 'policy briefs, learning summaries, materials, the handbook and exhibitions'),
             ('**9. AI services**', 'review, transcription, translation and report narratives through one gateway')]:
    c.mark(S, 'x', only=[k], note=n)
S = '1.4 User Platforms'
c.mark(S, '~', only=['**Website**'], note='Contributor, admin and Super Admin areas are all on the website and tested in Chromium; Edge, Firefox and Safari still to be tried by hand (docs/GO-LIVE.md)')
c.mark(S, 'x', only=['**Web app (PWA)**'], note='Workbox service worker, app icon, web push and an offline shell')
c.mark(S, '~', only=['**Android app**'], note='built from the shared Flutter code for Android 8.0 and later; not yet on Google Play or tried on a low-end phone')
c.mark(S, '~', only=['**iOS app**'], note='built for iPhone and iPad from the same code; not yet on the App Store')
S = '1.5 User Roles'
for k in ['**Visitor**', '**Contributor**', '**Admin**', '**Super Admin**']:
    c.mark(S, 'x', only=[k], note='enforced by the server for every route and checked by the access test in every automatic build')
S = '1.6 Beneficiaries and Regions'
c.mark(S, 'x', only=['**Coastal communities**', '**Lake Victoria communities**'], note='the counties, crossings and water bodies are in the preset places list (Appendix A)')
c.mark(S, 'x', only=['**People affected by incidents**', '**Under-represented voices**', '**Institutions**', '**Wider audience**'], note='served by anonymous and “as told by” posting, the incident records, citations and exports, and the multilingual design')
S = '1.7 How the Platform Supports the Project’s Activities'
c.mark(S, 'x', only=['**1. Researching and documenting'], note='incident records and map, historical records with source, bulk import')
c.mark(S, 'x', only=['**2. Co-creating community histories'], note='own-language posting, “as told by” and anonymous posting, consent, validation and transcripts')
c.mark(S, '~', only=['**3. Developing an open-access digital archive**'], note='website and web app open to visitors; the apps are built but not yet in the stores')
c.mark(S, '~', only=['**4. Building capacity'], note='the handbook draft and the on-screen hints are built; training sessions are planned in docs/HANDOVER.md')
c.mark(S, 'x', only=['**5. Translating heritage into policy'], note='learning resources, exhibitions, collections and analytics for reporting')
S = '1.8 Development Approach'
c.mark(S, '~', only=['Schedule:', 'Stages:', 'Phased delivery:', 'Stage review:', 'Testing with users:'], note='followed in the build so far; the content, user testing and go-live stages need the project team')
c.mark(S, 'x', only=['Build order:'], note='backend, then website and web app, then the Android and iOS apps')
c.mark(S, '~', only=['Version control:'], note='every change is committed, pushed and tested automatically on GitHub; the repository is still public and must be made private by its owner')
c.mark(S, 'x', only=['Test hosting first:'], note='free test hosting on Render; production hosting comes before content import (docs/GO-LIVE.md)')
c.mark('1.9 Structure of this Plan', 'x', only=['Sections 1 to 10', 'Section 11', 'Appendices'], note='describes the plan itself; this checklist follows the same structure')
S = '2.13 Tools and Technologies'
c.mark(S, '~', only=['**Editor and source control**'], note='Git and GitHub; the repository is to be made private by its owner')
c.mark(S, 'x', only=['**Local environment**'], note='Docker Compose for the full stack, embedded PostgreSQL for demos and tests')
S = '3.4 Tools and Technologies'
c.mark(S, 'x', only=['**Website framework**', '**Web state and data**', '**PWA**', '**Mobile apps**'], note='in use')
c.mark(S, '~', only=['**Web animation**'], note='Framer Motion; animated icons are CSS and SVG, without Lottie')
c.mark(S, '~', only=['**Mobile packages**'], note='google_sign_in, sign_in_with_apple, video_player, record and image_picker are used; push through Firebase, the camera plugin and the drift offline store are not (offline data is kept with the app’s own cache)')
c.mark(S, '~', only=['**Maps**'], note='Google Maps on the website when a key is set, with a built-in map otherwise; the apps use OpenStreetMap tiles')
c.mark(S, '~', only=['**Charts**'], note='Apache ECharts on the website; the apps draw their charts without fl_chart')
c.mark(S, '~', only=['**Translations**'], note='i18next on the website and shared translation files in the apps; Weblate or Crowdin to be set up with the translators')
c.mark(S, '~', only=['**Accessibility checks**'], note='axe and Lighthouse in every automatic build; TalkBack and VoiceOver need real devices')
c.mark('5.1 Purpose of AI on the Platform', '~', only=['**Read aloud**'], note='the Listen button reads story text with the device’s speech voices; no cloud voice yet')
c.mark('5.4 Other AI Uses', '~', only=['Read aloud:'], note='the Listen button uses the device’s speech voices on the website and in the apps; no cloud voice yet')
c.mark('5.8 Tools and Technologies', '~', only=['**Text to speech**'], note='device voices on web and apps; a cloud voice is not set up')
c.mark('6.5 Load Handling and Scaling', '~', only=['A database read replica'], note='documented in docs/ARCHITECTURE.md (Growing); reads would need a small change to use it')
c.mark('7.8 Tools and Technologies', '~', only=['**Database**'], note='PostgreSQL 17; PostGIS is turned on where the server has it, and places use latitude and longitude otherwise')
c.mark('7.8 Tools and Technologies', '~', only=['**Object storage**'], note='any S3-compatible storage through MEDIA_STORAGE=s3; the archive tier needs the provider’s lifecycle rule')
c.mark('Appendix C: Moderation Rules to Implement', 'x', only=['The rules below define'], note='introduction; the rules themselves are ticked one by one below')
S = 'Appendix F: Technical Risk Register'
c.mark(S, '~', only=['**T1**', '**T9**', '**T10**', '**T12**'], note='the build’s part is done (phased delivery, store rules, cloud iOS build, human translation paths); the rest happens at release')
c.mark(S, '~', only=['**T7**'], note='AI daily limit, caching of AI results and translations, free tiers; spending alerts on the provider accounts still to set')
c.mark(S, 'x', only=['**T8**'], note='only sample data on the test site; production comes before content import')
c.mark(S, 'x', only=['**T14**'], note='each outside service sits behind one module and one setting (docs/MAINTENANCE.md, No lock-in)')
S = 'G.3 Cost control'
c.mark(S, 'x', only=['Use of free tiers and free test hosting'], note='free Render hosting, free CI, free tiers of each service')
c.mark(S, 'x', only=['Caching of AI results, translations and maps'], note='AI results and translations are stored once; map tiles are cached by the browser and the app')
c.save()
