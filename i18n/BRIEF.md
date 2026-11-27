# Translation brief

You are translating the interface text of **Remembering the Waters**, Kenya's public archive of maritime and inland-water safety heritage (website and phone app). People read, listen to and watch stories, testimonies and historical records about safety on Kenya's ocean, lakes and rivers, many about drownings and ferry or boat accidents. Signed-in "Contributors" share their own stories; "admins" moderate; "Super Admins" manage admins.

## The job

For your target language (given in your task), translate every phrase in `i18n/source/part1.json` … `part6.json` (each is a JSON array of English phrases; about 1,300 in all). For each source file write `i18n/out/<code>/partN.json`: one JSON object whose keys are the English phrases **exactly as given, character for character** and whose values are the translations. Work one part at a time: Read the source part, then Write the output part. Do not skip, merge, reorder or add keys.

When all six are written, run `node i18n/validate.mjs <code>` from `/home/claude/prototype` and fix every problem it reports until it says `0 problem(s)`. Then report the final line of the checker and anything you were unsure about.

## Rules

1. Natural, plain, respectful language that an ordinary adult reader understands, as a careful professional translator native in the language would write for a public service. Not word-for-word. Many readers use phones; keep button and tab labels short.
2. **Placeholders** in curly brackets, such as `{n}`, `{name}`, `{minutes}`, must appear unchanged in the translation (same names, same count); move them where the grammar needs. Keep line breaks (`\n`) in the same number.
3. Do **not** translate: `Remembering the Waters`, Google, Apple, WhatsApp, Facebook, X, Gmail, TikTok, Instagram, YouTube, AI, PDF, CSV, Excel, ZIP, MP3, MP4, URL, email addresses, web addresses, file names, format names (JPEG, PNG…), phone numbers (999, 112, 1199), licence names (CC BY-NC 4.0 etc.), `Kenya Red Cross`, place names in Kenya.
4. Phrases in ALL CAPITALS are tab or button names: translate them, and keep them in capitals where the script has capitals.
5. Keep these terms consistent throughout your language: story, testimony, historical record, incident (an accident or event on the water), Contributor (capitalised: a member of the public who shares stories), admin, Super Admin, moderation, report (flagging content to the admins; also "PDF report" for analytics, a different sense), favourites, collection, draft, consent, safety concern, feedback, sign in / sign out, GREEN / YELLOW / RED (the AI review flags: translate as colour words, in capitals).
6. Keep punctuation style natural for the language, including its own quotation marks. Keep leading or trailing spaces, colons and ellipses as in the English. Keep emoji and symbols (›, ·, →, ©) as they are.
7. Short ambiguous words: "Share" = send or publish a story or link; "Post" = publish; "Save" = keep; "Report" = flag to admins; "Flag" = the AI's colour mark; "Hide" = remove from public view; "Lock" = stop further comments; "Record" = make an audio or video recording (verb) or a historical record (noun), judge from the phrase; "Following" = people one follows; "Trending" = popular now.
8. Stories here often concern death and loss. Wording about loss, consent, anonymity, children and emergencies must be accurate and gentle; never joking or casual.
9. Use the standard, widely understood form of the language (for Chinese: Simplified; Portuguese: neutral, understood in Mozambique and Portugal; Arabic: Modern Standard; Spanish and French: international standard; Filipino: standard Filipino, keeping common English loanwords where Filipinos naturally use them; Hindi, Bengali, Gujarati: everyday register in their own scripts, with common English tech words where natural).
10. Output must be valid JSON in UTF-8. Escape double quotes inside values. Do not write anything except the six output files; do not edit any other file.
