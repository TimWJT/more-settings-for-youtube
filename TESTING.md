# Firefox test checklist (before AMO submit)

Load: `about:debugging#/runtime/this-firefox` > Load Temporary Add-on > pick `manifest.json`.
Use your normal profile (signed in to YouTube). Keep DevTools console open for errors.

## Popup
- [ ] Opens fast, all 5 tabs switch (click and ←/→ keys), last tab is remembered.
- [ ] Red header wash + green controls look right in light and dark Firefox theme.
- [ ] Every switch saves: flip it, close popup, reopen, still flipped.
- [ ] Max speed −/+ stops at 1× and 16×; step dropdown saves.
- [ ] Copy transcript / Without timestamps from the popup works; on a non-video tab says "Open a YouTube video first."

## Speed
- [ ] Shift+. past 2× up to max; Shift+, back down; overlay shows.
- [ ] Double-press on: one press above 2× shows "press again", second press within 0.5s goes up.
- [ ] Remember speed: set 2.5×, open another video, it starts at 2.5×. Not applied during ads.
- [ ] Hover a thumbnail on Home, then open a video: saved speed is unchanged (fixed bug).

## Keys (on /watch)
- [ ] C toggles captions with no control bar pop-up; "Captions on/off" shows. Video without captions shows "No captions".
- [ ] M mutes/unmutes quietly. Click the video, then ↑/↓ change volume by 5 quietly; ↑/↓ without video focus still scroll.
- [ ] Typing C/M/digits in search or a comment box types normally.
- [ ] 0–9 don't seek. Shift+/ opens and closes the shortcut list.
- [ ] Mouse at the far right edge (left edge does nothing), in fullscreen and normal view: Space, ←/→, C, M work with no bar, title, middle icon or seek arrows, and captions don't move. Small labels still show for speed, volume and captions. Pausing shows nothing (no title, no icon). Pause badge switch on: small ❚❚ bottom-left while paused, gone when playing. Move the mouse back over the video and the controls come back. Switch off: old behaviour.

## Player
- [ ] Theater fills the window, no cropping; Reset each video: next video starts normal, no flash.
- [ ] Channel logo (Subscribe watermark) in the video's bottom-right corner is gone; comes back when switched off.
- [ ] Fullscreen side buttons hidden.
- [ ] Fullscreen: wheel/touchpad does nothing, no scrollbar, no more-videos grid. ⚙ quality menu still scrolls. Exit fullscreen: page scrolls normally.

## Clean up / Speed-ups
- [ ] Create, bell, mic hidden; sidebar items hidden (full and mini sidebar).
- [ ] Shorts hidden in feeds / search only when those switches are on.
- [ ] No blur: top bar and menus solid, readable in dark mode.
- [ ] No animations (after reload): theater and page changes instant, nothing stuck half-open.
- [ ] No ambient: no glow behind player.
- [ ] Hover previews still play on Home and search.

## Transcript (regression)
- [ ] Button by Subscribe, Alt+Shift+T, Shift-click: all copy; transcript panel never appears.
