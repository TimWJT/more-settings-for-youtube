'use strict';

// Every setting, grouped into tabs and cards.
// switches: [key, label, hint, needsReload]  ·  checks: [key, label]
const TABS = [
  {
    id: 'transcript', label: 'Transcript',
    cards: [
      { wide: true, title: 'Copy this video', copy: true },
      {
        wide: true,
        switches: [['transcriptButton', 'Transcript button', 'Next to Subscribe. Alt+Shift+T works either way']],
        checks: [['includeTimestamps', 'Include timestamps'], ['includeHeader', 'Add title, channel and link']],
      },
    ],
  },
  {
    id: 'playback', label: 'Playback',
    cards: [
      {
        speed: true,
        checks: [
          ['doublePressPast2', 'Double-press Shift+. past 2×'],
          ['speedOverlay', 'Show speed and volume on video'],
          ['rememberSpeed', 'Remember my speed'],
        ],
      },
      {
        title: 'Keys',
        switches: [
          ['quietKeys', 'Quiet C and volume', 'C, ↑ ↓ and M don\'t pop up the progress bar'],
          ['blockNumberSeek', 'Block 0–9', 'Number keys don\'t jump through the video'],
          ['fixShortcutDialog', 'Shift+/ toggles', 'Press again to close the shortcut list'],
        ],
      },
    ],
  },
  {
    id: 'player', label: 'Player',
    cards: [
      {
        title: 'Theater',
        switches: [
          ['bigTheater', 'Bigger theater', 'Video fills the window, nothing cut off'],
          ['resetTheater', 'Reset each video', 'New videos start in normal view'],
        ],
      },
      {
        title: 'Fullscreen',
        switches: [['hideFullscreenActions', 'Hide side buttons', 'Like, dislike, comment, share, more']],
      },
    ],
  },
  {
    id: 'cleanup', label: 'Clean up',
    cards: [
      {
        title: 'Top bar',
        switches: [
          ['hideCreate', 'Hide Create', ''],
          ['hideNotifications', 'Hide bell', 'Notifications'],
          ['hideVoiceSearch', 'No voice search', 'Removes the mic', true],
        ],
      },
      {
        title: 'Sidebar',
        switches: [
          ['hideGuideShorts', 'Shorts tab', ''],
          ['hideGuideYourChannel', 'Your channel', ''],
          ['hideGuideYourVideos', 'Your videos', ''],
          ['hideGuideDownloads', 'Downloads', ''],
          ['hideGuideMore', 'More from YouTube', 'The whole section'],
        ],
      },
      {
        title: 'Shorts',
        switches: [
          ['hideShortsFeed', 'Hide in feeds', 'Home, subscriptions, channels, up next'],
          ['hideShortsSearch', 'Hide in search', 'Search results'],
        ],
      },
    ],
  },
  {
    id: 'performance', label: 'Speed-ups',
    cards: [
      {
        title: 'Lighter drawing',
        switches: [
          ['noBlur', 'No blur', 'Solid top bar, menus and player buttons'],
          ['noAnimations', 'No animations', 'Theater and page changes are instant', true],
        ],
      },
      {
        title: 'Video',
        switches: [
          ['noAmbient', 'No ambient glow', 'Also turn Ambient mode off in the video\'s ⚙ menu for the full saving'],
        ],
      },
    ],
  },
];

const $ = (id) => document.getElementById(id);
const save = (obj) => browser.storage.local.set(obj);
let current = { ...YTT_DEFAULTS };

function h(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) n.setAttribute(k, v);
  }
  n.append(...kids.filter((k) => k != null));
  return n;
}

function bindInput(input, key) {
  input.checked = !!current[key];
  input.addEventListener('change', () => save({ [key]: input.checked }));
  return input;
}

function switchRow([key, label, hint, reload]) {
  const input = bindInput(h('input', { type: 'checkbox', role: 'switch' }), key);
  return h('label', { class: 'row' },
    h('span', { class: 'switch' }, input, h('span', { 'aria-hidden': 'true' })),
    h('span', { class: 'label' },
      h('span', { class: 'name' }, label, reload ? h('span', { class: 'tag' }, 'reload') : null),
      hint ? h('small', {}, hint) : null));
}

function checkRow([key, label]) {
  const input = bindInput(h('input', { type: 'checkbox' }), key);
  return h('label', { class: 'check' }, input, h('span', { class: 'box', 'aria-hidden': 'true' }), h('span', {}, label));
}

// ---------- speed ----------
function speedBlock() {
  const out = h('output', {});
  const down = h('button', { type: 'button', 'aria-label': 'Lower max speed', onclick: () => bump(-1) }, '−');
  const up = h('button', { type: 'button', 'aria-label': 'Raise max speed', onclick: () => bump(1) }, '+');
  const render = () => {
    out.textContent = `${current.maxSpeed}×`;
    down.disabled = current.maxSpeed <= 1;
    up.disabled = current.maxSpeed >= 16;
  };
  function bump(dir) {
    current.maxSpeed = Math.min(16, Math.max(1, Math.round((current.maxSpeed + dir * 0.25) * 100) / 100));
    render();
    save({ maxSpeed: current.maxSpeed });
  }
  render();

  const step = h('select', { id: 'speed-step' },
    ...[0.05, 0.1, 0.25, 0.5].map((v) => h('option', { value: String(v) }, `${v}×`)));
  step.value = String(current.speedStep);
  step.addEventListener('change', () => save({ speedStep: Number(step.value) }));

  return h('div', { class: 'speed' },
    h('div', { class: 'speed-top' },
      h('span', { class: 'name' }, 'Max speed'),
      h('div', { class: 'stepper', role: 'group', 'aria-label': 'Max speed' }, down, out, up)),
    h('small', {}, 'Shift+. faster · Shift+, slower'),
    h('label', { class: 'step-field', for: 'speed-step' }, 'Step per press', step));
}

// ---------- copy ----------
function copyBlock() {
  const main = h('button', { type: 'button', class: 'btn primary', onclick: () => copy(current.includeTimestamps) }, 'Copy transcript');
  const alt = h('button', { type: 'button', class: 'btn secondary', onclick: () => copy(!current.includeTimestamps) });
  const status = h('p', { class: 'status', role: 'status', 'aria-live': 'polite' }, 'Copies the video in this tab.');
  const label = () => { alt.textContent = current.includeTimestamps ? 'Without timestamps' : 'With timestamps'; };
  label();
  browser.storage.onChanged.addListener((ch) => {
    if (ch.includeTimestamps) { current.includeTimestamps = ch.includeTimestamps.newValue; label(); }
  });

  async function copy(timestamps) {
    main.disabled = alt.disabled = true;
    status.classList.remove('error');
    status.textContent = 'Getting transcript…';
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url || !/^https:\/\/www\.youtube\.com\/(watch|shorts|live)/.test(tab.url)) {
        throw new Error('Open a YouTube video first.');
      }
      const res = await browser.tabs.sendMessage(tab.id, { type: 'getTranscript', timestamps });
      if (!res?.ok) throw new Error(`Couldn't get the transcript: ${res?.error || 'no reply, try reloading the page'}.`);
      await navigator.clipboard.writeText(res.text);
      status.textContent = `Copied · ${res.words.toLocaleString()} words`;
    } catch (err) {
      status.classList.add('error');
      status.textContent = /Receiving end does not exist|Could not establish/.test(err.message)
        ? 'Reload the YouTube tab once, then try again.'
        : err.message;
    } finally {
      main.disabled = alt.disabled = false;
    }
  }
  return h('div', {}, h('div', { class: 'buttons' }, main, alt), status);
}

function card(c) {
  return h('section', { class: 'card' + (c.wide ? ' wide' : '') },
    c.title ? h('h2', {}, c.title) : null,
    c.copy ? copyBlock() : null,
    c.speed ? speedBlock() : null,
    ...(c.switches || []).map(switchRow),
    c.checks ? h('div', { class: 'checks' }, ...c.checks.map(checkRow)) : null);
}

// ---------- tabs ----------
function selectTab(id, focus = false) {
  for (const t of document.querySelectorAll('.tab')) {
    const on = t.dataset.id === id;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    if (on && focus) t.focus();
  }
  for (const p of document.querySelectorAll('.panel')) p.hidden = p.dataset.id !== id;
  try { localStorage.setItem('yp-tab', id); } catch { /* ignore */ }
}

function render() {
  const tabs = $('tabs');
  const panels = $('panels');
  for (const tab of TABS) {
    tabs.append(h('button', {
      type: 'button', class: 'tab', role: 'tab', id: 'tab-' + tab.id, 'data-id': tab.id,
      'aria-controls': 'panel-' + tab.id, onclick: () => selectTab(tab.id),
    }, tab.label));
    panels.append(h('div', {
      class: 'panel', role: 'tabpanel', id: 'panel-' + tab.id, 'data-id': tab.id, 'aria-labelledby': 'tab-' + tab.id,
    }, ...tab.cards.map(card)));
  }
  tabs.addEventListener('keydown', (e) => {
    const ids = TABS.map((t) => t.id);
    const i = ids.indexOf(document.activeElement?.dataset?.id);
    if (i < 0) return;
    if (e.key === 'ArrowRight') selectTab(ids[(i + 1) % ids.length], true);
    else if (e.key === 'ArrowLeft') selectTab(ids[(i - 1 + ids.length) % ids.length], true);
    else return;
    e.preventDefault();
  });
  let start = null;
  try { start = localStorage.getItem('yp-tab'); } catch { /* ignore */ }
  selectTab(TABS.some((t) => t.id === start) ? start : TABS[0].id);
}

browser.storage.local.get(YTT_DEFAULTS).then((s) => {
  current = s;
  render();
});
