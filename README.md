# More Settings for YouTube

(The popup is titled "YouTube Settings".)

A Firefox extension that adds the settings YouTube doesn't give you. Install it from [addons.mozilla.org](https://addons.mozilla.org/firefox/addon/more-settings-for-youtube/) (Firefox 128+).

## Features

| Feature | Default |
|---|---|
| **Transcript** button next to Subscribe: one click copies it (with timestamps), a small "Transcript copied" message confirms. Shift-click copies without timestamps | on |
| Copy from the toolbar popup, or **Alt+Shift+T** (change in about:addons → ⚙ → Manage Extension Shortcuts) | – |
| **Shift+. / Shift+,** change speed past 2× up to your max (default 2.5×, up to 16×), step 0.05–0.5× | on |
| Past 2×, each speed-up needs a quick double press of Shift+. | off |
| On-screen speed indicator | on |
| Remember speed between videos | on |
| **C** (captions), **↑ ↓** (volume) and **M** (mute) don't pop up the progress bar; a small label shows the change | on |
| **Block 0–9** from jumping through the video | on |
| **Shift+/** closes the shortcut list if it's already open | on |
| Mouse parked at the far right edge (or just past it): Space, arrows and other keys still work but only the small speed, volume and captions labels show (no control bar, title, paused title, play/pause icon or seek arrows, and captions stay put) | on |
| Mouse at the edge: small ❚❚ badge in the player's bottom-left corner while paused | off |
| Fullscreen: no scrolling and no scrollbar | on |
| Fullscreen: remove the "more videos" grid you get by scrolling down | on |
| **Bigger theater mode**: video fills the browser window under YouTube's header, aspect kept, Firefox toolbar visible | on |
| New videos start in normal view (theater resets) | on |
| Hide the like / dislike / comment / share / more buttons in fullscreen | on |
| No see-through blur: solid top bar, home page chip bar, menus and player buttons instead of frosted glass (cheaper to draw) | on |
| No animations: theater mode and page changes happen instantly | on |
| No ambient glow behind the video | on |
| Hide Shorts in feeds (home, subscriptions, channels, up next) | off |
| Hide Shorts in search | off |
| Hide the Create button and notifications bell | on |
| Sidebar: hide Shorts tab, Your channel, Your videos, Downloads, More from YouTube (each its own switch) | on |
| Turn off voice search (mic button and the feature) | on |

Transcript is fetched three ways, falling back in order: YouTube's internal transcript API → the player's caption file → YouTube's own transcript panel, opened off-screen so you never see it. The browser console (F12) logs which one worked: `[More Settings for YouTube] transcript via ...`.

Performance: nothing runs while you scroll or watch except one keyboard listener and a once-a-second check that does a couple of lookups. Transcript requests only happen when you click.

## Run from source

1. Go to `about:debugging#/runtime/this-firefox`
2. **Load Temporary Add-on…** and pick `manifest.json` in this folder. It's removed when Firefox restarts.
3. Reload any open YouTube tabs.

Build the upload zip with `npx web-ext build --overwrite-dest --ignore-files "*.md" screenshots`.

## Files

- `page.js` – runs in YouTube's page (keys, speed, theater, transcript, button)
- `background.js` – Alt+Shift+T shortcut
- `content.js` – bridge: settings storage, clipboard fallback, popup messages
- `settings.js` – defaults (page.js has its own copy; keep them in sync)
- `popup.*` – toolbar popup with transcript copy and all settings

## Ideas for later

From a survey of popular enhancer extensions (Enhancer for YouTube, Improve YouTube):
force default quality / codec, frame screenshot hotkey, caption styling, A-B loop, disable autoplay / hide end-screen cards.

## License

All rights reserved. See [LICENSE](LICENSE).
