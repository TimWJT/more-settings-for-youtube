# Speed benchmarks (real Firefox via Selenium)

Needs Python with `selenium` and `psutil` (`python -m venv venv && venv/Scripts/pip install selenium psutil`).
Build the zip first (`npx web-ext build --overwrite-dest`), then pass its path. Runs headless, logged out, against live YouTube.

- `bench.py <zip> <pairs> <out.json>`: with vs without the add-on, a fresh profile each run, taking turns.
  Measures load timings, time until the video plays, style recalcs, 3000 mouse moves / key presses, frame times
  during playback and scrolling, Firefox CPU, and clicking a video until YouTube's page is ready.
  Summarise with `summ.py <out.json>`.
- `bench2.py <zip> <out.json>`: one browser with the add-on. Switches features through the add-on's own
  `ytt:settings` event (off / defaults / defaults + Hide Shorts) on the same page, 20 rounds taking turns.
  Measures adding 48 video tiles (what infinite scroll does) and a full-page restyle. Much less noisy than `bench.py`.

`results-2026-11-10-*.json` are the raw results behind the Speed section in `../NOTES.md`.
