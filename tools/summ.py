import json, statistics, sys

rows = json.load(open(sys.argv[1]))
METRICS = [
    ('watch_nav.dcl', 'Watch page: DOM ready (ms)'),
    ('watch_nav.load', 'Watch page: load (ms)'),
    ('watch_nav.fcp', 'Watch page: first paint (ms)'),
    ('watch_to_playing_s', 'Watch page: until video plays (s)'),
    ('watch.style40Ms', 'Watch: 40 full style recalcs (ms)'),
    ('watch.styleLayout40Ms', 'Watch: 40 style+layout (ms)'),
    ('watch.addTilesMs', 'Watch: add 12 up-next tiles (ms)'),
    ('watch.mousemove3000Ms', 'Watch: 3000 mouse moves (ms)'),
    ('watch.keydown3000Ms', 'Watch: 3000 key presses (ms)'),
    ('watch.frameP95', 'Watch playback: frame p95 (ms)'),
    ('watch.framesOver50ms', 'Watch playback: frames >50ms'),
    ('cpu_15s_playback', 'CPU during 15s playback (s)'),
    ('home_nav.dcl', 'Home: DOM ready (ms)'),
    ('home_nav.load', 'Home: load (ms)'),
    ('home.style40Ms', 'Home: 40 full style recalcs (ms)'),
    ('home.styleLayout40Ms', 'Home: 40 style+layout (ms)'),
    ('home.addTilesMs', 'Home: add 12 feed tiles (ms)'),
    ('home.mousemove3000Ms', 'Home: 3000 mouse moves (ms)'),
    ('home.keydown3000Ms', 'Home: 3000 key presses (ms)'),
    ('home.frameP95', 'Home scrolling: frame p95 (ms)'),
    ('home.framesOver50ms', 'Home scrolling: frames >50ms'),
    ('cpu_10s_home_idle', 'CPU home idle 10s (s)'),
    ('spa_nav_ms', 'Click video -> page ready (ms)'),
]


def get(r, path):
    v = r
    for k in path.split('.'):
        if not isinstance(v, dict) or k not in v:
            return []
        v = v[k]
    if isinstance(v, list):
        return [x for x in v if isinstance(x, (int, float))]
    return [v] if isinstance(v, (int, float)) else []


print(f"{'metric':42} {'off (median)':>14} {'on (median)':>14} {'diff':>8}  n")
for path, label in METRICS:
    vals = {}
    for var in ('off', 'on'):
        xs = [x for r in rows if r.get('variant') == var and not r.get('error') for x in get(r, path)]
        vals[var] = xs
    if not vals['off'] or not vals['on']:
        continue
    a, b = statistics.median(vals['off']), statistics.median(vals['on'])
    pct = f"{(b - a) / a * 100:+.0f}%" if a else ''
    print(f"{label:42} {a:14.2f} {b:14.2f} {pct:>8}  {len(vals['off'])}/{len(vals['on'])}")
errs = [r for r in rows if r.get('error')]
print('errors:', len(errs), [e['error'][:120] for e in errs])
print('loaded flags:', [(r['variant'], r.get('watch', {}).get('loaded')) for r in rows if not r.get('error')])
