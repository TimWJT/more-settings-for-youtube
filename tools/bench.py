"""A/B lag benchmark for More Settings for YouTube in real Firefox.
Usage: python bench.py <addon.zip> <reps> <out.json> [--headed]
Runs off/on alternately, each in a fresh profile.
"""
import json, statistics, sys, time
import psutil
from selenium import webdriver
from selenium.webdriver.firefox.options import Options

ADDON, REPS, OUT = sys.argv[1], int(sys.argv[2]), sys.argv[3]
HEADED = '--headed' in sys.argv
WATCH = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ'  # Big Buck Bunny (Blender), 10 min
HOME = 'https://www.youtube.com/'
RESULTS_JS = r"""
const done = arguments[arguments.length - 1];
(async () => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  const out = {};
  // Style recalc: toggle a class on <html> (invalidates the whole page, like YouTube's own html attribute
  // changes), then force a style flush by reading a computed style. 40 rounds, median ms.
  const root = document.documentElement;
  let t0 = performance.now();
  for (let i = 0; i < 40; i++) { root.classList.toggle('zz-bench'); getComputedStyle(document.body).color; }
  out.style40Ms = performance.now() - t0;
  t0 = performance.now();
  for (let i = 0; i < 40; i++) { root.classList.toggle('zz-bench2'); void document.body.offsetHeight; }
  out.styleLayout40Ms = performance.now() - t0;
  // DOM growth like infinite scroll / up-next loading: clone 12 existing tiles, add, flush, remove. 10 rounds.
  const box = document.querySelector('ytd-rich-grid-renderer #contents, ytd-watch-next-secondary-results-renderer #items, #related #items');
  if (box && box.children.length > 2) {
    const src = [...box.children].slice(0, 12);
    const times = [];
    for (let r = 0; r < 10; r++) {
      const clones = src.map(n => n.cloneNode(true));
      const t = performance.now();
      box.append(...clones); void document.body.offsetHeight;
      times.push(performance.now() - t);
      clones.forEach(c => c.remove()); void document.body.offsetHeight;
    }
    out.addTilesMs = med(times);
  }
  // Event handler cost: 3000 synthetic mousemoves and 3000 keydowns of an unused key (Q, which YouTube ignores).
  let t = performance.now();
  for (let i = 0; i < 3000; i++) window.dispatchEvent(new MouseEvent('mousemove', { clientX: i % 800, clientY: 200, bubbles: true }));
  out.mousemove3000Ms = performance.now() - t;
  t = performance.now();
  for (let i = 0; i < 3000; i++) document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'q', code: 'KeyQ', bubbles: true }));
  out.keydown3000Ms = performance.now() - t;
  // Frame timing over 8 s (playback on watch page, scrolling on home page if asked).
  const scroll = arguments[0];
  const gaps = []; let last = performance.now(); const end = last + 8000;
  await new Promise(res => { const f = (now) => { gaps.push(now - last); last = now;
    if (scroll) window.scrollBy(0, 40);
    if (now < end) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
  gaps.shift();
  const s = [...gaps].sort((a, b) => a - b);
  out.frames = gaps.length; out.frameP50 = s[Math.floor(s.length * .5)]; out.frameP95 = s[Math.floor(s.length * .95)];
  out.frameMax = s[s.length - 1]; out.framesOver50ms = gaps.filter(g => g > 50).length;
  out.loaded = !!window.__yttLoaded || root.classList.contains('ytt-hide-create');
  done(out);
})().catch(e => done({ error: String(e) }));
"""
SPA_JS = r"""
const done = arguments[arguments.length - 1];
const links = [...document.querySelectorAll('ytd-rich-item-renderer a[href^="/watch"]')];
const a = links[arguments[0] * 3] || links[0];
if (!a) { done(null); } else {
  let t0;
  const fin = () => { document.removeEventListener('yt-navigate-finish', fin);
    requestAnimationFrame(() => done(performance.now() - t0)); };
  document.addEventListener('yt-navigate-finish', fin);
  setTimeout(() => done(null), 20000);
  t0 = performance.now(); a.click();
}
"""
LOAD_JS = r"""
const n = performance.getEntriesByType('navigation')[0];
const fcp = performance.getEntriesByName('first-contentful-paint')[0];
return { dcl: n && n.domContentLoadedEventEnd, load: n && n.loadEventEnd, fcp: fcp && fcp.startTime };
"""


def browser_procs(driver):
    pid = driver.service.process.pid
    root = psutil.Process(pid)
    return [p for p in root.children(recursive=True) if 'firefox' in p.name().lower()]


def cpu_seconds(procs):
    total = 0.0
    for p in procs:
        try:
            c = p.cpu_times(); total += c.user + c.system
        except psutil.Error:
            pass
    return total


def wait_playing(driver, timeout=40):
    """Seconds from navigation start until the main video is playing past 1s (ads skipped where possible)."""
    t0 = time.time()
    while time.time() - t0 < timeout:
        st = driver.execute_script("""
          const p = document.querySelector('#movie_player'); const v = document.querySelector('video.html5-main-video');
          document.querySelector('.ytp-skip-ad-button, .ytp-ad-skip-button-modern')?.click();
          if (!p || !v) return null;
          return { ad: p.classList.contains('ad-showing'), t: v.currentTime, paused: v.paused };""")
        if st and not st['ad'] and st['t'] > 1 and not st['paused']:
            return True
        if st and st['paused'] and not st['ad']:
            driver.execute_script("document.querySelector('video.html5-main-video')?.play()")
        time.sleep(0.25)
    return False


def run(variant):
    o = Options()
    if not HEADED:
        o.add_argument('-headless')
    o.set_preference('media.autoplay.default', 0)
    o.set_preference('media.autoplay.blocking_policy', 0)
    o.set_preference('dom.webnotifications.enabled', False)
    o.set_preference('privacy.reduceTimerPrecision', False)
    o.set_preference('privacy.resistFingerprinting', False)
    d = webdriver.Firefox(options=o)
    d.set_window_size(1600, 1000)
    d.set_script_timeout(60)
    res = {'variant': variant}
    try:
        if variant == 'on':
            d.install_addon(ADDON, temporary=True)
            time.sleep(2)
        # Warm-up (cookies, cache), so both variants load from the same state.
        d.get(HOME); time.sleep(4)
        d.get(WATCH); wait_playing(d); time.sleep(2)

        # Watch page: cold-ish navigation timing
        d.get('about:blank'); time.sleep(1)
        t = time.time(); d.get(WATCH)
        res['watch_nav'] = d.execute_script(LOAD_JS)
        res['watch_playing'] = wait_playing(d)
        res['watch_to_playing_s'] = time.time() - t
        time.sleep(3)
        res['watch'] = d.execute_async_script(RESULTS_JS, False)

        # CPU of all Firefox processes during 15 s of steady playback
        procs = browser_procs(d)
        c0 = cpu_seconds(procs); time.sleep(15); c1 = cpu_seconds(procs)
        res['cpu_15s_playback'] = c1 - c0

        # Home page: load timing, then style/handlers/frames while scrolling
        d.get('about:blank'); time.sleep(1)
        d.get(HOME)
        res['home_nav'] = d.execute_script(LOAD_JS)
        time.sleep(4)
        res['home'] = d.execute_async_script(RESULTS_JS, True)

        # CPU idle on home page (top of page) 10 s
        d.execute_script('scrollTo(0,0)'); time.sleep(2)
        c0 = cpu_seconds(procs); time.sleep(10); c1 = cpu_seconds(procs)
        res['cpu_10s_home_idle'] = c1 - c0

        # In-site navigation: click a video thumbnail on home, time until YouTube says the page is done.
        spa = []
        for k in range(3):
            d.get(HOME); time.sleep(4)
            ms = d.execute_async_script(SPA_JS, k)
            if ms is not None:
                spa.append(ms)
        res['spa_nav_ms'] = spa
    finally:
        d.quit()
    return res


all_res = []
for i in range(REPS):
    for v in (['off', 'on'] if i % 2 == 0 else ['on', 'off']):
        print(f'rep {i + 1} {v} ...', flush=True)
        try:
            r = run(v)
        except Exception as e:  # keep going
            r = {'variant': v, 'error': repr(e)}
        print(json.dumps(r), flush=True)
        all_res.append(r)
        json.dump(all_res, open(OUT, 'w'), indent=1)
