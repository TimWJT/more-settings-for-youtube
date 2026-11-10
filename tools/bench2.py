"""Same page, same browser: switch the add-on's features via its own settings event and measure the cost
of YouTube adding tiles (what infinite scroll / up-next loading does) and of full restyles.
Usage: python bench2.py <addon.zip> <out.json>"""
import json, sys, time
from selenium import webdriver
from selenium.webdriver.firefox.options import Options

ADDON, OUT = sys.argv[1], sys.argv[2]
JS = r"""
const done = arguments[arguments.length - 1];
const configs = arguments[0];
(async () => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  const cands = [...document.querySelectorAll('ytd-rich-grid-renderer #contents, ytd-watch-next-secondary-results-renderer #items, ytd-watch-next-secondary-results-renderer #contents, ytd-item-section-renderer #contents')];
  const box = cands.sort((a, b) => b.children.length - a.children.length)[0];
  if (!box) return done({ error: 'no tile container' });
  let flip = 0;
  const src = [...box.children].filter(n => n.tagName !== 'YTD-CONTINUATION-ITEM-RENDERER').slice(0, 12);
  const apply = (s) => { document.dispatchEvent(new CustomEvent('ytt:settings', { detail: JSON.stringify(s) })); };
  const res = {}; for (const c of configs) res[c.name] = { tiles: [], restyle: [] };
  for (let round = 0; round < 20; round++) {
    for (const c of (round % 2 ? [...configs].reverse() : configs)) {
      apply(c.s); void document.body.offsetHeight; await sleep(30);
      // 4 batches of 12 tiles (48), flush style+layout after each batch
      const clones = [];
      let t = performance.now();
      for (let b = 0; b < 4; b++) { const cs = src.map(n => n.cloneNode(true)); clones.push(...cs); box.append(...cs); void document.body.offsetHeight; }
      res[c.name].tiles.push(performance.now() - t);
      clones.forEach(n => n.remove()); void document.body.offsetHeight;
      // full restyle: change an inherited property at the root so every element restyles
      t = performance.now();
      document.documentElement.style.setProperty('letter-spacing', (++flip % 2) ? '0.01px' : '0px');
      getComputedStyle(document.body).letterSpacing; void document.body.offsetHeight;
      res[c.name].restyle.push(performance.now() - t);
    }
  }
  document.documentElement.style.removeProperty('letter-spacing');
  const out = { elements: document.getElementsByTagName('*').length, srcTiles: src.length };
  for (const k in res) out[k] = { tilesMedMs: med(res[k].tiles), restyleMedMs: med(res[k].restyle) };
  done(out);
})().catch(e => done({ error: String(e) }));
"""


def main():
    o = Options()
    o.add_argument('-headless')
    for k, v in {'media.autoplay.default': 0, 'privacy.reduceTimerPrecision': False,
                 'privacy.resistFingerprinting': False}.items():
        o.set_preference(k, v)
    d = webdriver.Firefox(options=o)
    d.set_window_size(1600, 1000)
    d.set_script_timeout(300)
    d.install_addon(ADDON, temporary=True)
    time.sleep(2)
    out = {}
    try:
        for name, url in [('channel_videos', 'https://www.youtube.com/@BlenderStudio/videos'),
                          ('watch', 'https://www.youtube.com/watch?v=aqz-KE-bpKQ'),
                          ('search', 'https://www.youtube.com/results?search_query=minecraft')]:
            d.get(url); time.sleep(6)
            d.execute_script('scrollTo(0, 1500)'); time.sleep(3); d.execute_script('scrollTo(0, 0)'); time.sleep(1)
            defaults = d.execute_script("return JSON.parse(localStorage.getItem('ytp-settings') || '{}')")
            all_off = {k: (False if isinstance(v, bool) else v) for k, v in defaults.items()}
            shorts = dict(defaults, hideShortsFeed=True, hideShortsSearch=True)
            configs = [{'name': 'addon_off', 's': all_off}, {'name': 'defaults', 's': defaults},
                       {'name': 'defaults_plus_hide_shorts', 's': shorts}]
            out[name] = d.execute_async_script(JS, configs)
            # put defaults back
            d.execute_script("document.dispatchEvent(new CustomEvent('ytt:settings',{detail:arguments[0]}))", json.dumps(defaults))
            print(name, json.dumps(out[name]), flush=True)
    finally:
        d.quit()
    json.dump(out, open(OUT, 'w'), indent=1)


main()
