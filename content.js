// More Settings for YouTube - isolated content script. Owns storage and the clipboard permission,
// and relays between the popup and page.js (which runs in YouTube's page world).
(() => {
  'use strict';
  let settings = { ...YTT_DEFAULTS };

  const emit = (name, detail) =>
    document.dispatchEvent(new CustomEvent('ytt:' + name, { detail: JSON.stringify(detail ?? null) }));
  const parse = (e) => { try { return JSON.parse(e.detail); } catch { return null; } };
  // "Off everywhere": page.js gets every switch turned off (the saved choices stay untouched).
  const allOff = (s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, typeof v === 'boolean' ? false : v]));
  const push = () => emit('settings', settings.enabled === false ? allOff(settings) : settings);

  // Only send settings once the stored ones are loaded, so page.js never gets plain defaults.
  let loaded = false;
  browser.storage.local.get(YTT_DEFAULTS).then((s) => { settings = { ...settings, ...s }; loaded = true; push(); });
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    for (const k in changes) settings[k] = changes[k].newValue ?? YTT_DEFAULTS[k];
    if (loaded) push();
  });

  // page.js loaded after us: send settings again.
  document.addEventListener('ytt:ready', () => { if (loaded) push(); });

  // page.js saves the remembered speed. Only that key is accepted, since any script on the page can fire this.
  document.addEventListener('ytt:save', (e) => {
    const d = parse(e);
    const v = Number(d?.lastSpeed);
    if (v >= 0.0625 && v <= 16) browser.storage.local.set({ lastSpeed: v });
  });

  // page.js couldn't write the clipboard itself (user-gesture expired): do it with our permission.
  document.addEventListener('ytt:copy', async (e) => {
    const d = parse(e);
    if (!d || typeof d.text !== 'string' || d.text.length > 5_000_000) return;
    let ok = false;
    try { await navigator.clipboard.writeText(d.text); ok = true; } catch {
      const ta = document.createElement('textarea');
      ta.value = d.text;
      ta.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.documentElement.appendChild(ta);
      ta.select();
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      ta.remove();
    }
    emit('copy-result', { id: d.id, ok });
  });

  // Popup asks for the transcript of this tab.
  let seq = 0;
  const pending = new Map();
  document.addEventListener('ytt:get-transcript-result', (e) => {
    const d = parse(e);
    const done = d && pending.get(d.id);
    if (done) { pending.delete(d.id); done(d); }
  });
  browser.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'copyNow') { emit('copy-now'); return undefined; }
    if (msg?.type !== 'getTranscript') return undefined;
    return new Promise((resolve) => {
      const id = 'c' + ++seq;
      pending.set(id, resolve);
      emit('get-transcript', { id, timestamps: !!msg.timestamps });
      setTimeout(() => {
        if (pending.has(id)) { pending.delete(id); resolve({ ok: false, error: 'timed out' }); }
      }, 20000);
    });
  });
})();
