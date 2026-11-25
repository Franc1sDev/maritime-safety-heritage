"""Performance monitoring, busy mode, photo credit, the AI evaluation set and the store listings (25 November 2026).
Run from the project folder: python scripts/progress/stage12_monitoring_and_ai_eval.py"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from checklist_lib import Checklist

c = Checklist()
c.mark('3.3.4 App Store Requirements', '~', only=['Both: store listings'], note='name, descriptions and keywords in English and Kiswahili are in docs/STORE-RELEASE.md, with the app icons; the Kiswahili needs a native speaker’s reading, and the screenshots need the release builds on real devices')
c.mark('Contributor Rights and Licences', 'x', only=['Each story shows its rights and credits'], note='rights and credits are shown with every story; the web copies of photographs carry a visible credit (MEDIA_WATERMARK), originals unchanged')
c.mark('Protecting the Original Archive', 'x', only=['Media watermarked and credited'], note='visible photo credit on web copies, credits with every item, rate limits on downloads and the catalogue')
c.mark('Protecting the Original Archive', '~', only=['Monitoring for copies'], note='a copyright and licence notice with a link to the takedown terms is on every page of the website and in the app; watching the web for copies (for example Google Alerts on story titles) is for the team to set up')
c.mark('5.7 AI Quality Measures', '~', only=['**Review time**'], note='measured for every story from SEND to the AI result and shown in Analytics (AI reviews within 3 minutes, average time) and the PDF reports; the built-in check takes milliseconds; the chosen provider’s time per item is measured by npm run ai:eval')
c.mark('5.8 Tools and Technologies', '~', only=['**Evaluation**'], note='38 labelled samples in English, Kiswahili and Dholuo (tests/ai-eval) with a scoring script and an automatic regression test; the admins still need to agree the labels, and a native speaker to check the Dholuo')
c.mark('6.4 Backend and Database Performance', 'x', only=['Indexes on all frequently searched'], note='indexes are in place; every query is timed and slow ones are logged and listed in SUPER ADMIN › System › Performance, with pg_stat_statements; none over 500 ms in the load tests')
c.mark('6.5 Load Handling and Scaling', 'x', only=['Graceful degradation'], note='when the event loop lags or responses slow down, live analytics are sent every 10 seconds, exports, imports, reports and transcription wait, and other jobs run one at a time; unit tested')
c.mark('6.7 Performance Monitoring', 'x', only=['Application performance monitoring'], note='response times, errors and slow queries per route, in SUPER ADMIN › System › Performance and as Prometheus metrics; running on the test site, and on the production server once it is set up')
c.mark('6.7 Performance Monitoring', 'x', only=['Real-user monitoring'], note='the website reports LCP, CLS, INP, FCP and TTFB from visitors’ browsers, by kind of page and connection type, with no personal data; p75 over 7 days in the Performance panel')
c.mark('6.7 Performance Monitoring', 'x', only=['Alerts are sent'], note='the Super Admins are notified when 95% of responses take over 300 ms or more than 5% are errors (at most hourly); uptime alerts come from the outside uptime monitor')
c.mark('6.8 Tools and Technologies', '~', only=['**Monitoring**'], note='built-in monitoring with a Prometheus endpoint (METRICS_TOKEN) ready for Grafana; Sentry and Grafana need accounts')
c.mark('6.8 Tools and Technologies', 'x', only=['**Database**'], note='pg_stat_statements preloaded in deploy/docker-compose.yml, shown in the Performance panel; EXPLAIN ANALYZE for fixing, described in docs/MAINTENANCE.md')
c.mark('9.8 After Launch', '~', only=['Monitoring of errors, uptime and performance'], note='error and performance alerts to the Super Admins are built; the uptime monitor needs the production address and an account')
c.mark('10.2 Types of Testing', '~', only=['**AI evaluation**'], note='the fixed set and npm run ai:eval are built and run in every automatic build with the built-in check; to be run with the chosen provider before launch')
c.mark('Appendix F: Technical Risk Register', '~', only=['**T4**'], note='human review of RED items, the evaluation set in English, Kiswahili and Dholuo, recalibration and a changeable provider are built; the provider comparison is still to run')
c.save()
