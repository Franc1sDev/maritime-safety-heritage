"""Fifteen more interface languages, the language menu at the top, and captions with an on/off button (27 November 2026).
Run from the project folder: python scripts/progress/stage15_languages_and_captions.py"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from checklist_lib import Checklist

c = Checklist()
SECTION = '3.1.5 Languages'
note = 'the whole interface is translated (website, apps and the server’s own texts) and offered in the language menu; machine-translated and not yet reviewed by a native speaker'
c.mark(SECTION, '~', only=[f'**{n}**' for n in (4, 5, 6, 7, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20)], note=note)
c.mark('Language requirements', '~', only=['Translation quality:'], note='English and Kiswahili are complete; 15 more languages are machine-translated and unreviewed; Dholuo, Somali and Malagasy wait for native speakers and fall back to English')
c.mark('1.2.2 Specific Objectives', '~', only=['To make the archive accessible'], note='low-data mode, offline reading and WCAG checks are built; 17 of the 20 languages are in the interface (15 of them machine-translated, unreviewed); Dholuo, Somali and Malagasy need native speakers')
c.mark('3.1.4 Accessibility', '~', only=['Captions for videos'], note='captions show on the video or audio itself with a CC button to turn them on and off, in the reader’s language where the translation service is set up; they come from the transcript, so they need transcription (an AI provider key) or a typed transcript; the prompt for alt text when adding a photo is not yet on the share form')
c.save()
