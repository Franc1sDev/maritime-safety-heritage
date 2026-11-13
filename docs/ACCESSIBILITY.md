# Accessibility

The archive aims to meet WCAG 2.2 level AA on the website and to follow the platform accessibility guidelines in the app.

## What is built in

- **Keyboard:** every control can be reached and used with the keyboard, in a logical order, and shows a visible focus outline. A **Skip to content** link comes first on every page. Pop-ups trap focus and close with Escape.
- **Screen readers:** pages have one main heading and a clear heading order. Controls and form fields have names and labels, and errors are announced. Status messages use live regions, and decorative icons are hidden.
- **Media:** oral histories and videos have full transcripts that follow along and can be searched. Photographs have text descriptions taken from their catalogue summary.
- **Contrast:** text meets 4.5:1 against its background (3:1 for large text).
- **Text size:** the **Larger text** option enlarges all text, and pages also reflow when the browser zooms to 200%. The app follows the phone's text size.
- **Motion:** background video and animations stop when the device asks for reduced motion. **Light mode** removes video and pictures entirely.
- **Low bandwidth:** Light mode, lazy loading and compressed web copies of media keep pages usable on slow mobile connections.
- **Phones and tablets:** layouts adapt down to 320 px wide without sideways scrolling, and touch targets are at least 44 px.

## How it was tested (November 2026)

An automated audit ran on every page of the website, signed out and signed in as an admin: welcome, about, contact, sign-in, privacy, terms, browse, item, map, share, account, dashboard, records, upload, submissions, users, messages and reports. It checked:

- page language;
- images without text alternatives;
- buttons and links without a name;
- form fields without a label;
- duplicate IDs;
- text contrast (WCAG formula);
- a main heading on every page;
- visible keyboard focus.

**Result:** no failures after one fix (the map page gained a heading for screen readers). Two contrast warnings were false positives on visually hidden labels.

## Still to check before launch

- A manual pass with NVDA (Windows) and TalkBack (Android) or VoiceOver (iPhone) by someone who uses them daily.
- New content: every photograph needs a meaningful summary, and every recording a transcript. The cataloguing guide asks for both.

## Reporting a problem

Use **Contact the team** and describe the page and what went wrong. The team aims to reply within five working days.
