# Developer notes: More Settings for YouTube

## Speed (measured 2026-11-10, add-on 1.0.7 defaults, `tools/`)

Real Firefox, headless, logged out, live YouTube. Result: **no measurable lag**. Every difference was inside the noise.

With vs without the add-on (`tools/bench.py`, 4 pairs taking turns, medians). Run-to-run noise was large
(the same test ranged 18 to 42 ms), so differences under ~20% mean nothing here.

| Case | Without | With |
|---|---|---|
| Watch page first paint | 1067 ms | 987 ms |
| Watch page until the video plays | 3.2 s | 2.9 s |
| Firefox CPU during 15 s of playback | 12.5 s | 12.2 s |
| Frames over 50 ms during playback | 0.5 | 0.5 |
| Home page load | 1820 ms | 1908 ms |
| Home page idle CPU (10 s) | 1.1 s | 0.7 s |
| Click a video until the page is ready | 1336 ms | 1065 ms |
| One key press / mouse move | | about +0.05 ms |

Same page, features switched in place (`tools/bench2.py`, 20 rounds, medians in ms):

| Page | Add-on off | Defaults | Defaults + Hide Shorts |
|---|---|---|---|
| Search: add 48 tiles | 753 | 699 | 667 |
| Channel videos: add 48 tiles | 56 | 58 | 57 |
| Watch page up next: add 48 tiles | 74 | 78 | 73 |
| Search: full-page restyle | 32 | 32 | 28 |

So the `:has()` rules (sidebar, and Hide Shorts when on) didn't slow down YouTube adding tiles or restyling.

Not covered: signed in (bigger home feed and sidebar), fullscreen (a script can't enter it).

Measuring tips:
- Firefox rounds `performance.now()` under automation. Set `privacy.reduceTimerPrecision` to false, or tiny
  timings come back as 0.
- A restyle test has to change the value every time. Setting the same value again does nothing and measures 0.
- Logged-out home and watch pages have few tiles to copy. Use search or a channel's videos page.
- The add-on's `ytt:settings` event switches features in place without a reload, which makes clean same-page comparisons.
