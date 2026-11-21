"""After stage 5: Translate on comments and the guided first-use hints, on the website and in the app.
Run from the project folder: python scripts/progress/stage6_hints_and_translate.py"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from checklist_lib import Checklist

c = Checklist()
c.mark('Language requirements', 'x', only=['Translate button'], note='on stories, transcripts and each comment, on the website and in the app; the translation itself needs an AI key on the server')
c.mark('3.1.3 Animation, Focus Mode and Reduced Motion', 'x', only=['Animation'], note='includes the guided hints on first use; in the app they are still to be seen on a real phone')
c.mark('11.5 In-Platform Onboarding', 'x', only=['Guided on-screen hints'], note='four hints on the STORIES page, shown once and again from Settings, on the website and in the app; in the app still to be seen on a real phone')
c.save()
