# Store listing: More Settings for YouTube

Copy these into the fields on addons.mozilla.org when you submit.

## Name
More Settings for YouTube

## Summary (max 250 characters)
One-click transcript copy, speed past 2×, keyboard fixes, a bigger theater mode, less clutter and a lighter YouTube. Turn on only what you want.

## Description
(AMO joins plain lines into one paragraph, so the list uses Markdown "- " bullets with blank lines around it.)

The YouTube settings you wish it had. Turn on only what you want.

- **Copy any transcript** in one click
- **Speed past 2×**, beyond YouTube's limit
- **Keyboard fixes**, like number keys no longer skipping around
- **Bigger theater mode** that fills the window
- **Hide clutter** like Shorts and buttons you never use
- **Lighter YouTube** with fewer effects to draw

No data collected. Not affiliated with YouTube or Google.

## Categories
Appearance, Photos, Music & Videos

## Tags
youtube, transcript, playback speed, keyboard shortcuts, theater mode, shorts

## Support
Email or website: add your own if you want people to be able to reach you.

## Privacy
This add-on collects no data. Settings are stored in Firefox on your own computer. The only network requests are to youtube.com, made when you copy a transcript, to fetch that video's transcript.

(In the submission form, answer that it does not collect or transmit personal data. The manifest already declares `data_collection_permissions: none`.)

## Notes for the reviewer
- No build step and no minified code. The files you upload are the source.
- `page.js` runs in YouTube's page (manifest `world: "MAIN"`) so it can use the player's own controls (speed, captions, volume) and YouTube's transcript API. It builds all its UI with DOM methods, with no innerHTML.
- To fetch a transcript, `page.js` reads YouTube's SAPISID cookie and builds the same SAPISIDHASH header YouTube's own page sends to `/youtubei/v1/`. The cookie and header only go to www.youtube.com, nowhere else.
- `content.js` keeps the settings in `storage.local` and writes to the clipboard when you copy a transcript with Alt+Shift+T.
- `background.js` only handles the Alt+Shift+T shortcut.
- Permissions: `storage` for settings, `clipboardWrite` to copy transcripts, and access to www.youtube.com only.

## Screenshots to take (1280×800 works well)
1. A video page with the Transcript button next to Subscribe.
2. The popup on the Playback tab.
3. The popup on the Clean up tab.
4. The "2.5×" speed label on a playing video.
