"""The handbook completed with screenshots and a print-ready PDF (27 November 2026).
Run from the project folder: python scripts/progress/stage14_handbook.py"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from checklist_lib import Checklist

c = Checklist()
c.mark('11.3 Prototype, Handbook and Orientation Support', '~', only=['The handbook (“how to upload materials”'], note='completed with screenshots of the platform (docs/HANDBOOK.md and the PDF “Handbook - Remembering the Waters.pdf”); an admin still publishes it in Learning resources on the production archive at go-live')
c.mark('1.7 How the Platform Supports the Project’s Activities', '~', only=['**4. Building capacity'], note='the handbook with screenshots (also as a PDF) and the on-screen hints are built; the training sessions are planned in docs/HANDOVER.md and need the team')
c.mark('Appendix E: Alignment with the Source Documents', '~', only=['**Orientation and handbook'], note='the handbook is written with screenshots and a PDF; the orientation sessions themselves need the team and partners')
c.save()
