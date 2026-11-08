# Store listing: More Settings for YouTube

Copy these into the fields on addons.mozilla.org when you submit.

## Name
More Settings for YouTube

## Summary (max 250 characters)
One-click transcript copy, speed past 2× with Shift+. and Shift+, , no more 0–9 jumping, quieter keys, a bigger theater mode, a tidier YouTube and switches that make it lighter to run.

## Description
The settings YouTube doesn't give you, in one popup. Copy a whole transcript in one click, go past 2× speed, stop number keys jumping through the video, and make YouTube tidier and lighter to run. Every change has its own switch.

**Transcript**
• A Transcript button sits next to Subscribe. One click copies the whole transcript, and a small message tells you how many words it copied.
• Shift-click copies it the other way, with or without timestamps.
• Alt+Shift+T copies it from the keyboard. You can change the shortcut in about:addons > ⚙ > Manage Extension Shortcuts.
• You can also copy it from the toolbar popup.
• Choose whether to include timestamps, and whether to add the title, channel and link at the top.
• The transcript panel never pops open. It tries YouTube's transcript first and falls back to the video's captions, so it works on most videos that have them.

**Speed**
• Shift+. and Shift+, go past YouTube's 2× limit, up to a max you choose (2.5× by default, up to 16×).
• Pick how far each press moves the speed, from 0.05× to 0.5×.
• If you want, each step past 2× can need a quick double press of Shift+. so you don't go too fast by accident. This is off by default.
• A small label on the video shows the new speed. You can turn it off.
• Your speed carries over to the next video.

**Keys**
• C (captions), ↑ ↓ (volume) and M (mute) work without popping up the control bar. A small label shows what changed.
• Number keys 0–9 no longer jump through the video.
• Shift+/ closes the shortcut list as well as opening it.

**Player**
• Bigger theater mode. The video fills the window under YouTube's top bar, with nothing cut off.
• New videos start in normal view instead of theater.
• Hide the like, dislike, comment, share and more buttons in fullscreen.

**Clean up**
• Hide the Create button, the notifications bell and voice search (the mic button and the feature).
• Hide sidebar items one by one. Shorts, Your channel, Your videos, Downloads and More from YouTube each have a switch.
• Hide Shorts in feeds (home, subscriptions, channels, up next) and in search, with a switch for each. Both are off by default.

**Speed-ups**
• No see-through blur. The top bar, menus and player buttons get solid backgrounds, which are cheaper to draw.
• No animations. Theater mode, page changes and fades happen straight away.
• No ambient glow behind the video.

Thumbnail hover previews keep working.

It's built to stay out of the way. Apart from one keyboard listener and a small check once a second, nothing runs while you scroll or watch. Transcripts are only fetched when you ask for one.

Nothing about you is collected or sent anywhere. Not affiliated with or endorsed by YouTube or Google.

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
