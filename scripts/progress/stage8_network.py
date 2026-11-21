"""Section 8 (weak and missing connections) and Appendix A.4 (standard messages), after the offline work.
Run from the project folder: python scripts/progress/stage8_network.py"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from checklist_lib import Checklist

c = Checklist()
PHONE = 'in the app still to be tried on a real phone'
c.mark('8.1 Design Assumptions', 'x', note=f'retries, offline reading, an offline queue, drafts kept on the device and uploads that continue; {PHONE}')
c.mark('8.2 Low-Data Mode', 'x', only=['Available in MY PROFILE'], note='the website turns it on by itself on a slow connection and says so; the app asks')
c.mark('8.2 Low-Data Mode', '~', only=['No autoplay'], note='no autoplay and nothing loads until selected on both; the website starts video at the lowest quality, in the app the phone’s player picks the quality')
c.mark('8.2 Low-Data Mode', 'x', only=['Shows the approximate size'])
c.mark('8.3 Offline Behaviour', 'x', only=['**Stories already viewed**', '**Favourites**', '**Reactions, favourites, comments**', '**Messages**', '**Announcements and INBOX**', '**Admin actions**'], note=f'website and app; {PHONE}')
c.mark('8.3 Offline Behaviour', 'x', only=['**Writing a story**'], note='the words and details are kept on the device and offered for sending when the connection returns; files are added again')
c.mark('8.5 Adaptive Media', 'x', note=f'{PHONE}')
c.mark('8.6 Connectivity Feedback', 'x', note=f'website and app; {PHONE}')
c.mark('8.7 Real-Time Connection Handling', '~', note='the website holds a live connection, reconnects and falls back to checking at intervals; the app checks every 40 seconds instead of holding a live connection')
c.mark('8.8 Timeouts and Retries', 'x', only=['Requests that fail because of the network'], note='website and app, covered by automatic tests')
c.mark('8.9 Tools and Technologies', 'x', only=['**Offline web**'])
c.mark('8.9 Tools and Technologies', '~', only=['**Offline apps**'], note='built with files on the phone, shared_preferences and connectivity_plus; drift and workmanager were not needed for what is built')
c.mark('8.9 Tools and Technologies', 'x', only=['**Network handling**'], note='the http package with its own retry in the app, fetch with retry on the website')
c.mark('8.9 Tools and Technologies', 'x', only=['**Streaming**'])
c.mark('A.4 Standard system messages', 'x', note=None)
c.save()
