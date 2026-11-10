// More Settings for YouTube - runs in YouTube's own page world so it can use the player API and ytcfg.
// Talks to content.js (which owns storage and the clipboard permission) through DOM events.
(() => {
  'use strict';
  if (window.__yttLoaded) return;
  window.__yttLoaded = true;

  const S = {
    enabled: true,
    maxSpeed: 2.5, speedStep: 0.25, speedOverlay: true, rememberSpeed: true, lastSpeed: 1, doublePressPast2: false, quietKeys: true,
    blockNumberSeek: true, fixShortcutDialog: true, edgeHideControls: true, edgePauseIcon: false, fsNoScroll: true, fsHideMoreVideos: true, hideEndVideos: false, blockVKey: true,
    transcriptButton: true, includeTimestamps: true, includeHeader: true,
    bigTheater: true, resetTheater: true, hideFullscreenActions: true, hideWatermark: true, hideInfoCards: true, hideShortsFeed: false, hideShortsSearch: false,
    hideCreate: true, hideNotifications: true, hideVoiceSearch: true, noBlur: true, noAnimations: true, noAmbient: true,
    hideGuideShorts: true, hideGuideYourChannel: true, hideGuideYourVideos: true, hideGuideDownloads: true, hideGuideMore: true,
    hideGuideReportHistory: true, hideGuidePlayables: true, hideGuideMemberships: true, hideGuideFooter: true, openGuideExplore: true,
  };

  // Last-known settings, saved by this script, so everything applies before YouTube draws.
  try { Object.assign(S, JSON.parse(localStorage.getItem('ytp-settings') || '{}')); } catch { /* ignore */ }

  // Voice search: remove the browser speech APIs before YouTube's code checks for them.
  if (S.hideVoiceSearch) {
    for (const k of ['SpeechRecognition', 'webkitSpeechRecognition']) {
      try { Object.defineProperty(window, k, { value: undefined, configurable: true, writable: true }); } catch { /* ignore */ }
    }
  }

  // No animations: YouTube skips all its page/theater view transitions when the browser
  // doesn't offer them, so hide the feature before YouTube's code checks.
  // Kept so it can be put back without a reload when the setting (or the whole add-on) is turned off.
  const viewTransition = Object.getOwnPropertyDescriptor(Document.prototype, 'startViewTransition');
  function setAnimations(off) {
    if (!viewTransition) return;
    try {
      if (off) Object.defineProperty(Document.prototype, 'startViewTransition', { value: undefined, configurable: true, writable: true });
      else Object.defineProperty(Document.prototype, 'startViewTransition', viewTransition);
    } catch { /* ignore */ }
  }
  if (S.noAnimations) setAnimations(true);

  // ---------- helpers ----------
  const emit = (name, detail) =>
    document.dispatchEvent(new CustomEvent('ytt:' + name, { detail: JSON.stringify(detail ?? null) }));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const round2 = (x) => Math.round(x * 100) / 100;
  const cfg = (k) => window.ytcfg?.get?.(k) ?? window.ytcfg?.data_?.[k];

  // Build DOM without innerHTML (YouTube enforces Trusted Types).
  function el(tag, props = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') n.className = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    n.append(...kids);
    return n;
  }

  function svgIcon(d) {
    const ns = 'http://www.w3.org/2000/svg';
    const s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('width', '18');
    s.setAttribute('height', '18');
    s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '2');
    s.setAttribute('stroke-linecap', 'round');
    s.setAttribute('stroke-linejoin', 'round');
    s.setAttribute('aria-hidden', 'true');
    for (const part of d.split('|')) {
      const p = document.createElementNS(ns, 'path');
      p.setAttribute('d', part);
      s.appendChild(p);
    }
    return s;
  }
  const ICON_COPY = 'M8 8h11v13H8z|M16 8V3H5v13h3';

  function isTyping(e) {
    const t = e.composedPath?.()[0] || e.target;
    if (!t || !t.tagName) return false;
    if (t.isContentEditable) return true;
    return t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT';
  }

  function videoId() {
    const u = new URL(location.href);
    if (u.pathname === '/watch') return u.searchParams.get('v');
    const m = u.pathname.match(/^\/(?:shorts|live)\/([\w-]{11})/);
    return m ? m[1] : null;
  }

  function getVideo() {
    if (location.pathname.startsWith('/shorts')) {
      const v = document.querySelector('ytd-reel-video-renderer[is-active] video, #shorts-player video');
      if (v) return v;
      return [...document.querySelectorAll('video')].find((x) => !x.paused) || null;
    }
    return document.querySelector('#movie_player video.html5-main-video') ||
      document.querySelector('video.html5-main-video');
  }

  // Ask content.js to do something and wait for its reply.
  let reqSeq = 0;
  function request(name, payload, timeout = 5000) {
    return new Promise((resolve) => {
      const id = 'p' + ++reqSeq;
      const onReply = (e) => {
        let d; try { d = JSON.parse(e.detail); } catch { return; }
        if (d?.id !== id) return;
        document.removeEventListener('ytt:' + name + '-result', onReply);
        resolve(d);
      };
      document.addEventListener('ytt:' + name + '-result', onReply);
      emit(name, { ...payload, id });
      setTimeout(() => { document.removeEventListener('ytt:' + name + '-result', onReply); resolve({ ok: false }); }, timeout);
    });
  }

  // ---------- styles ----------
  const css = `
.ytt-osd{position:absolute;top:12%;left:50%;transform:translateX(-50%);z-index:70;padding:8px 18px;border-radius:10px;
  background:rgba(0,0,0,.7);color:#fff;font:500 22px/1.2 Roboto,Arial,sans-serif;font-variant-numeric:tabular-nums;
  pointer-events:none;opacity:0;transition:opacity .3s ease-out}
.ytt-osd.show{opacity:1;transition:none}
#ytt-bar{display:flex;flex:0 0 auto;align-items:center;margin-left:8px;white-space:nowrap}
/* Own colours (YouTube's CSS variables aren't reliable). html[dark] is YouTube's dark-theme flag. */
#ytt-bar{--ytt-bg:rgba(0,0,0,.05);--ytt-bg-hover:rgba(0,0,0,.1);--ytt-text:#0f0f0f;}
html[dark] #ytt-bar{--ytt-bg:rgba(255,255,255,.1);--ytt-bg-hover:rgba(255,255,255,.2);--ytt-text:#f1f1f1;}
#ytt-bar .ytt-btn{height:36px;padding:0 16px;margin:0;border:0;border-radius:18px;white-space:nowrap;background:var(--ytt-bg);
  color:var(--ytt-text);font:500 14px Roboto,Arial,sans-serif;cursor:pointer;display:inline-flex;align-items:center;gap:6px;
  visibility:visible;opacity:1}
#ytt-bar .ytt-btn:hover{background:var(--ytt-bg-hover)}
#ytt-bar .ytt-btn:focus-visible{outline:2px solid #3ea6ff;outline-offset:2px}
#ytt-bar .ytt-btn[aria-busy="true"]{opacity:.65;cursor:progress}
.ytt-toast{position:fixed;left:50%;bottom:32px;transform:translate(-50%,8px);z-index:99999;padding:12px 20px;border-radius:8px;
  background:#262626;color:#f1f1f1;font:400 14px Roboto,Arial,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.35);
  opacity:0;transition:opacity .2s,transform .2s;pointer-events:none;max-width:min(560px,90vw)}
.ytt-toast.show{opacity:1;transform:translate(-50%,0);pointer-events:auto}
@media (prefers-reduced-motion:reduce){.ytt-toast,.ytt-osd{transition:none}}

/* Mouse parked at the far right edge: nothing pops up over the video when you press a key.
   Control bar and title, the play/pause icon in the middle and the seek arrows (YouTube's seek UI forces
   the control bar on). The keys still work. The small labels for speed, volume and captions still show
   (YouTube's volume % and this add-on's label), since those are what you want to see. */
html.ytt-edge .html5-video-player :is(.ytp-chrome-bottom,.ytp-chrome-top,.ytp-gradient-bottom,.ytp-gradient-top,
  .ytp-bezel,.ytp-unified-seek-wrapper,.ytp-doubletap-ui-legacy,.ytp-fullscreen-metadata,.ytp-title-expanded-overlay){
  opacity:0 !important;transition:none !important;animation:none !important}
.ytt-pause-badge{display:none;position:absolute;left:12px;bottom:12px;z-index:70;padding:4px 7px;border-radius:6px;
  background:rgba(0,0,0,.55);color:#fff;font:700 11px/1 Roboto,Arial,sans-serif;letter-spacing:-1px;pointer-events:none}
html.ytt-edge .ytt-pause-badge.on{display:block}
/* ...and captions stay where they sit when the bar is hidden, instead of jumping up for the invisible bar. */
html.ytt-edge .html5-video-player .caption-window.ytp-caption-window-bottom{margin-bottom:0 !important;transition:none !important}
html.ytt-edge .html5-video-player .caption-window.ytp-caption-window-top{margin-top:0 !important;transition:none !important}

/* Fullscreen: no page scrolling or scrollbar, and no "more videos" grid. */
html.ytt-fs.ytt-fs-noscroll,html.ytt-fs.ytt-fs-noscroll body,html.ytt-fs.ytt-fs-noscroll ytd-app{
  overflow:hidden !important;scrollbar-width:none !important}
/* The same grid holds the suggestions shown when a video ends (player gets .ended-mode), in any view. */
html.ytt-fs-nomore .html5-video-player:not(.ended-mode) :is(.ytp-fullscreen-grid,.ytp-fullscreen-grid-expand-button,.ytp-fullscreen-grid-hover-overlay),
html.ytt-end-hide .html5-video-player.ended-mode :is(.ytp-fullscreen-grid,.ytp-fullscreen-grid-expand-button,.ytp-fullscreen-grid-hover-overlay){
  display:none !important}

/* Fullscreen: hide the like / dislike / comment / share / more column on the right. */
html.ytt-hide-fs-actions .ytp-fullscreen-quick-actions{display:none !important}

/* Channel watermark: the logo in the video's bottom-right corner that turns into a Subscribe button. */
html.ytt-hide-watermark .html5-video-player .iv-branding{display:none !important}

/* Info cards: the (i) button at the top right of the video and its "More from..." teaser. */
html.ytt-hide-cards .html5-video-player :is(.ytp-cards-button,.ytp-cards-teaser,.ytp-cards-teaser-box){display:none !important}

/* Header buttons */
html.ytt-hide-create ytd-masthead #buttons > ytd-button-renderer:has(button[aria-label="Create"]),
html.ytt-hide-create ytd-masthead button[aria-label="Create"]{display:none !important}
html.ytt-hide-notif ytd-masthead ytd-notification-topbar-button-renderer{display:none !important}
html.ytt-hide-voice ytd-masthead #voice-search-button{display:none !important}

/* Sidebar: Shorts tab, Your channel, Your videos, Downloads, and the whole "More from YouTube" section.
   Matches links by title/address (English titles) - plain attribute selectors, cheap for the browser. */
html.ytt-g-shorts ytd-guide-entry-renderer:has(> a#endpoint[title="Shorts"]),
html.ytt-g-shorts ytd-mini-guide-entry-renderer[aria-label="Shorts"],
html.ytt-g-channel ytd-guide-entry-renderer:has(> a#endpoint[title="Your channel"]),
html.ytt-g-videos ytd-guide-entry-renderer:has(> a#endpoint:is([title="Your videos"],[href^="https://studio.youtube.com/channel/"])),
html.ytt-g-downloads ytd-guide-entry-renderer:has(> a#endpoint:is([title="Downloads"],[href="/feed/downloads"])),
html.ytt-g-downloads ytd-mini-guide-entry-renderer[aria-label="Downloads"],
html.ytt-g-more #sections > ytd-guide-section-renderer:has(> #items a[href*="music.youtube.com"], > #items a[href*="youtubekids.com"]),
html.ytt-g-report ytd-guide-entry-renderer:has(> a#endpoint:is([title="Report history"],[href^="/reporthistory"])),
html.ytt-g-playables ytd-guide-entry-renderer:has(> a#endpoint:is([title="Playables"],[href^="/playables"])),
html.ytt-g-members ytd-guide-entry-renderer:has(> a#endpoint:is([title="Memberships"],[href^="/paid_memberships"])),
html.ytt-g-footer ytd-guide-renderer #footer{display:none !important}

/* Explore always open: show its hidden items and drop the Show more / Show less rows.
   Only the Explore section (found by its Gaming / Podcasts links), not Subscriptions. */
html.ytt-g-explore ytd-guide-section-renderer:has(a[href="/gaming"], a[href^="/podcasts"]) ytd-guide-collapsible-entry-renderer :is(#expanded, #expandable-items){display:block !important}
html.ytt-g-explore ytd-guide-section-renderer:has(a[href="/gaming"], a[href^="/podcasts"]) ytd-guide-collapsible-entry-renderer :is(#expander-item, #collapser-item){display:none !important}

/* Big theater: player fills the browser window under YouTube's header, video kept whole (letterboxed). */
html.ytt-big-theater ytd-watch-flexy[theater] #full-bleed-container,
html.ytt-big-theater ytd-watch-flexy[full-bleed-player] #full-bleed-container{
  height:calc(100vh - var(--ytd-masthead-height,56px)) !important;
  max-height:none !important;min-height:0 !important}
`;
  // Hide Shorts uses :has(), which costs style work on every page change, so it's only
  // added to the page while the setting is on.
  // Shorts are hidden separately in feeds (home, subscriptions, channels, "up next") and in search.
  // Each list is scoped to its page so the browser only checks those parts.
  const shortsFeedCss = `
ytd-browse :is(ytd-reel-shelf-renderer,ytd-rich-shelf-renderer[is-shorts]),
ytd-browse ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts], ytm-shorts-lockup-view-model),
ytd-browse grid-shelf-view-model:has(ytm-shorts-lockup-view-model),
ytd-browse :is(ytd-rich-item-renderer,ytd-grid-video-renderer):has(a[href^="/shorts/"]),
ytd-watch-next-secondary-results-renderer ytd-reel-shelf-renderer,
ytd-watch-next-secondary-results-renderer :is(ytd-compact-video-renderer,yt-lockup-view-model):has(a[href^="/shorts/"]){display:none !important}`;
  const shortsSearchCss = `
ytd-search :is(ytd-reel-shelf-renderer,grid-shelf-view-model),
ytd-search ytd-video-renderer:has(a[href^="/shorts/"]){display:none !important}`;
  // No blur: YouTube's frosted glass re-blurs what's behind it every frame. YouTube has its own
  // switch (--yt-frosted-glass-backdrop-filter-override) for most of it; the rest are listed by name
  // (taken from YouTube's stylesheets). Backgrounds are made solid so text stays readable.
  const BLUR_SELECTORS = `.ytSpecButtonShapeNextOverlay.ytSpecButtonShapeNextTonal.ytSpecButtonShapeNextEnableBackdropFilterExperiment,
.ytSpecButtonShapeNextOverlayDark.ytSpecButtonShapeNextTonal.ytSpecButtonShapeNextEnableBackdropFilterExperiment,
.ytTooltipContainerPlayerTooltipContentBlurred,
.ytBadgeShapeThumbnailBadgeRedesign,
.ytdFeedCustomizationFormViewModelHost:after,
.ytAiSearchInputViewModelScrim,
.ytChannelAttributionViewModelHost,
.ytwGoalProgressBarHost,
.ytwVideoDisplayBillboardLayoutRendererControls .ytSpecButtonShapeNextHost.ytSpecButtonShapeNextOverlay.ytSpecButtonShapeNextTonal,
.ytwVideoDisplayBillboardLayoutRendererMenu,
.ytdReelVideoRendererPipBlurFilter,
.ytSheetViewModelContextual,
.ytInlinePlayerControlsTopRightControlsRedesign .ytInlinePlayerControlsTopRightControlsCircleButton,
ytd-multi-page-menu-renderer,
ytd-menu-popup-renderer,
ytd-reel-video-renderer[is-shorts-pip-active] .pip-blur-filter.ytd-reel-video-renderer,
ytd-engagement-panel-section-list-renderer[dropdown],
ytd-masthead[frosted-glass-mode=without-chipbar] #background.ytd-masthead,
#frosted-glass.with-chipbar.ytd-app,
.ytAvatarSubscribeShapeOverlay.ytAvatarSubscribeShapeTonal.ytAvatarSubscribeShapeEnableBackdropFilter,
.ytAvatarSubscribeShapeOverlayDark.ytAvatarSubscribeShapeTonal.ytAvatarSubscribeShapeEnableBackdropFilter,
.ytPlayerOverlayVideoDetailsRendererFrostedGlass,
.ytp-delhi-modern-with-luminosity.ytp-delhi-modern .ytp-chrome-controls .ytp-next-button:not(.ytp-miniplayer-button-container>*),
.ytp-delhi-modern-with-difference.ytp-delhi-modern .ytp-chrome-controls .ytp-next-button:not(.ytp-miniplayer-button-container>*),
.ytp-delhi-modern-with-exclusion.ytp-delhi-modern .ytp-chrome-controls .ytp-next-button:not(.ytp-miniplayer-button-container>*),
.ytp-delhi-modern-with-luminosity.ytp-delhi-modern .ytp-prev-button:not(.ytp-miniplayer-button-container>*),
.ytp-delhi-modern-with-difference.ytp-delhi-modern .ytp-prev-button:not(.ytp-miniplayer-button-container>*),
.ytp-delhi-modern-with-exclusion.ytp-delhi-modern .ytp-prev-button:not(.ytp-miniplayer-button-container>*),
.ytp-delhi-modern-with-luminosity.ytp-delhi-modern .ytp-chrome-controls .ytp-play-button,
.ytp-delhi-modern-with-difference.ytp-delhi-modern .ytp-chrome-controls .ytp-play-button,
.ytp-delhi-modern-with-exclusion.ytp-delhi-modern .ytp-chrome-controls .ytp-play-button,
.ytp-suggested-action.ytp-suggested-action-badge,
.ytp-featured-product.ytp-suggested-action-badge,
.ytp-delhi-modern-with-luminosity.ytp-delhi-modern .ytp-time-wrapper:not(.ytp-miniplayer-ui *),
.ytp-delhi-modern-with-difference.ytp-delhi-modern .ytp-time-wrapper:not(.ytp-miniplayer-ui *),
.ytp-delhi-modern-with-exclusion.ytp-delhi-modern .ytp-time-wrapper:not(.ytp-miniplayer-ui *),
.ytp-delhi-modern-with-luminosity.ytp-delhi-modern .ytp-clip .ytp-clip-watch-full-video-button,
.ytp-delhi-modern-with-difference.ytp-delhi-modern .ytp-clip .ytp-clip-watch-full-video-button,
.ytp-delhi-modern-with-exclusion.ytp-delhi-modern .ytp-clip .ytp-clip-watch-full-video-button`;
  const noBlurCss = `
html{--yt-frosted-glass-backdrop-filter-override:none !important}
${BLUR_SELECTORS}{backdrop-filter:none !important;-webkit-backdrop-filter:none !important}
ytd-masthead #background,#frosted-glass.ytd-app{background:#fff !important}
html[dark] ytd-masthead #background,html[dark] #frosted-glass.ytd-app{background:#0f0f0f !important}
ytd-menu-popup-renderer,ytd-multi-page-menu-renderer{background:#fff !important}
html[dark] ytd-menu-popup-renderer,html[dark] ytd-multi-page-menu-renderer{background:#282828 !important}`;

  // No animations is handled at startup (view transitions switched off, see top). No page-wide
  // `* { transition-duration }` rule: it turns every style change on every element into a
  // transition, which made style work about 3x slower in testing.

  // Ambient mode: the coloured glow drawn from the video behind the player.
  const noAmbientCss = `#cinematics,#cinematics-full-bleed-container,#cinematic-container{display:none !important}`;

  const addStyle = (id, text) => {
    const s = document.createElement('style');
    s.id = id;
    s.textContent = text;
    (document.head || document.documentElement).appendChild(s);
    return s;
  };
  addStyle('ytt-style', css);
  const optional = {};
  function toggleStyle(id, on, text) {
    if (on && !optional[id]) optional[id] = addStyle(id, text);
    else if (!on && optional[id]) { optional[id].remove(); delete optional[id]; }
  }

  // Explore always open: the CSS shows the hidden rows, but YouTube may only build them once
  // "Show more" is clicked, so click it (hidden) once if they aren't there yet. The sidebar
  // can load late, so try a few times.
  function openExplore(tries = 5) {
    if (!S.openGuideExplore) return;
    for (const sec of document.querySelectorAll('ytd-guide-section-renderer')) {
      if (!sec.querySelector('a[href="/gaming"], a[href^="/podcasts"]')) continue;
      const box = sec.querySelector('ytd-guide-collapsible-entry-renderer');
      if (box && !box.hasAttribute('expanded')) box.querySelector('#expander-item #endpoint, #expander-item')?.click();
      return;
    }
    if (tries > 0) setTimeout(() => openExplore(tries - 1), 1000);
  }

  // ---------- settings ----------
  let lastBigTheater = null;
  // Declared here, before the settings listener, because emit('ready') below can fire it straight away.
  let saveTimer;
  let atEdge = false; // mouse parked at the far right (see "mouse at the edge")
  let wheelBlocked = false; // fullscreen scroll lock is on (see "fullscreen")
  function applySettings() {
    const root = document.documentElement;
    toggleStyle('ytt-shorts-feed', S.hideShortsFeed, shortsFeedCss);
    toggleStyle('ytt-shorts-search', S.hideShortsSearch, shortsSearchCss);
    toggleStyle('ytt-no-blur', S.noBlur, noBlurCss);
    toggleStyle('ytt-no-ambient', S.noAmbient, noAmbientCss);
    root.classList.toggle('ytt-big-theater', !!S.bigTheater);
    root.classList.toggle('ytt-hide-fs-actions', !!S.hideFullscreenActions);
    root.classList.toggle('ytt-hide-watermark', !!S.hideWatermark);
    root.classList.toggle('ytt-hide-cards', !!S.hideInfoCards);
    root.classList.toggle('ytt-hide-create', !!S.hideCreate);
    root.classList.toggle('ytt-hide-notif', !!S.hideNotifications);
    root.classList.toggle('ytt-hide-voice', !!S.hideVoiceSearch);
    root.classList.toggle('ytt-g-shorts', !!S.hideGuideShorts);
    root.classList.toggle('ytt-g-channel', !!S.hideGuideYourChannel);
    root.classList.toggle('ytt-g-videos', !!S.hideGuideYourVideos);
    root.classList.toggle('ytt-g-downloads', !!S.hideGuideDownloads);
    root.classList.toggle('ytt-g-more', !!S.hideGuideMore);
    root.classList.toggle('ytt-g-report', !!S.hideGuideReportHistory);
    root.classList.toggle('ytt-g-playables', !!S.hideGuidePlayables);
    root.classList.toggle('ytt-g-members', !!S.hideGuideMemberships);
    root.classList.toggle('ytt-g-footer', !!S.hideGuideFooter);
    root.classList.toggle('ytt-g-explore', !!S.openGuideExplore);
    setAnimations(!!S.noAnimations);
    openExplore();
    if (!S.edgeHideControls) setEdge(false);
    root.classList.toggle('ytt-fs-noscroll', !!S.fsNoScroll);
    root.classList.toggle('ytt-fs-nomore', !!S.fsHideMoreVideos);
    root.classList.toggle('ytt-end-hide', !!S.hideEndVideos);
    updateFullscreen();
    if (lastBigTheater !== null && lastBigTheater !== S.bigTheater) nudgePlayerSize();
    lastBigTheater = !!S.bigTheater;
    clearWideCookie();
    ensureBar();
  }
  document.addEventListener('ytt:settings', (e) => {
    try {
      const incoming = JSON.parse(e.detail);
      if (saveTimer) delete incoming.lastSpeed; // a newer speed is waiting to be saved
      Object.assign(S, incoming);
      localStorage.setItem('ytp-settings', e.detail);
    } catch { /* ignore */ }
    applySettings();
  });
  emit('ready');

  // ---------- on-screen indicator ----------
  let osdTimer;
  function osd(text) {
    if (!S.speedOverlay) return;
    const v = getVideo();
    const host = v?.closest('.html5-video-player') || document.getElementById('movie_player');
    if (!host) return;
    let n = host.querySelector(':scope > .ytt-osd');
    if (!n) { n = el('div', { class: 'ytt-osd', role: 'status' }); host.appendChild(n); }
    n.textContent = text;
    n.classList.add('show');
    clearTimeout(osdTimer);
    osdTimer = setTimeout(() => n.classList.remove('show'), 800);
  }

  // ---------- speed ----------
  function saveSpeed(r) {
    S.lastSpeed = r;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { saveTimer = null; emit('save', { lastSpeed: r }); }, 400);
  }

  function setSpeed(r, show = true) {
    const v = getVideo();
    if (!v) return;
    const player = v.closest('.html5-video-player');
    // Keep YouTube's own menu in sync where it can be (its API stops at 2x).
    if (r <= 2 && player?.setPlaybackRate) { try { player.setPlaybackRate(r); } catch { /* ignore */ } }
    v.playbackRate = r;
    if (show) osd(`${r}×`);
    if (S.rememberSpeed) saveSpeed(r);
  }

  function changeSpeed(dir) {
    const v = getVideo();
    if (!v) return;
    const step = Number(S.speedStep) || 0.25;
    const max = Math.min(16, Math.max(1, Number(S.maxSpeed) || 2));
    const min = Math.min(0.25, step);
    // Snap to the step grid so 1.1x + 0.25 goes to 1.25, not 1.35.
    const cur = v.playbackRate;
    if ((dir > 0 && cur >= max) || (dir < 0 && cur <= min)) { osd(`${round2(cur)}×`); return; }
    const idx = cur / step;
    const next = dir > 0
      ? (Math.floor(idx + 1e-6) + 1) * step
      : (Math.ceil(idx - 1e-6) - 1) * step;
    const target = round2(Math.min(max, Math.max(min, next)));
    // Past 2x: each step up needs Shift+. twice in quick succession (setting).
    if (dir > 0 && target > 2 && S.doublePressPast2) {
      const now = Date.now();
      if (now - lastUpPress > 500) {
        lastUpPress = now;
        osd(`${round2(cur)}× · press again for ${target}×`);
        return;
      }
      lastUpPress = 0;
    }
    setSpeed(target);
  }
  let lastUpPress = 0;

  // Re-apply remembered speed when a new video starts (not during ads).
  let speedAppliedFor = null;
  let lastAutoApply = 0;
  document.addEventListener('playing', (e) => {
    const v = e.target;
    if (!(v instanceof HTMLVideoElement) || !S.rememberSpeed) return;
    if (v !== getVideo()) return; // ignore thumbnail hover previews
    const player = v.closest('.html5-video-player');
    if (player?.classList.contains('ad-showing')) return;
    const id = videoId();
    if (!id || speedAppliedFor === id) return;
    speedAppliedFor = id;
    if (S.lastSpeed && S.lastSpeed !== v.playbackRate) {
      lastAutoApply = Date.now();
      setSpeed(S.lastSpeed, false);
    }
  }, true);
  // Also remember speeds picked from YouTube's own menu.
  document.addEventListener('ratechange', (e) => {
    const v = e.target;
    if (!S.rememberSpeed || !(v instanceof HTMLVideoElement) || v !== getVideo()) return;
    if (v.closest('.html5-video-player')?.classList.contains('ad-showing')) return;
    // No video id = home/search page, i.e. a hover preview: don't let it overwrite the saved speed.
    const id = videoId();
    if (!id || Date.now() - lastAutoApply < 1500 || speedAppliedFor !== id) return;
    saveSpeed(round2(v.playbackRate));
  }, true);

  // ---------- Shift+/ fix ----------
  // YouTube opens its shortcuts list on Shift+/ but pressing it again does nothing. Make it a toggle.
  function closeHotkeyDialog() {
    const r = document.querySelector('ytd-hotkey-dialog-renderer');
    if (!r) return false;
    const dlg = r.closest('tp-yt-paper-dialog') || r;
    const shown = dlg.opened === true ||
      (getComputedStyle(dlg).display !== 'none' && dlg.getClientRects().length > 0 && r.getClientRects().length > 0);
    if (!shown) return false;
    if (typeof dlg.close === 'function') dlg.close();
    else {
      const btn = r.querySelector('#dismiss-button button, #dismiss-button, button');
      if (btn) btn.click();
      else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
    }
    return true;
  }

  // ---------- keyboard ----------
  function stop(e) {
    e.preventDefault();
    e.stopImmediatePropagation();
  }

  // Quiet keys: YouTube shows the whole control bar when you press C or change volume.
  // Do the same thing through the player's own API instead, which doesn't wake the controls.
  function toggleCaptions(player) {
    const btn = player.querySelector('.ytp-subtitles-button');
    if (btn && btn.getAttribute('aria-disabled') === 'true') { osd('No captions'); return; }
    const wasOn = btn ? btn.getAttribute('aria-pressed') === 'true' : null;
    if (typeof player.toggleSubtitles === 'function') player.toggleSubtitles();
    else if (btn) btn.click();
    else return;
    if (wasOn !== null) osd(wasOn ? 'Captions off' : 'Captions on');
  }
  // The player API changes the volume without saving it, so the next video would load with the old
  // setting (e.g. still muted). Save it the way YouTube does (localStorage for new tabs, sessionStorage for this one).
  function saveVolume(volume, muted) {
    try {
      const now = Date.now();
      const data = JSON.stringify({ volume: Math.round(volume), muted: !!muted });
      localStorage.setItem('yt-player-volume', JSON.stringify({ data, expiration: now + 30 * 864e5, creation: now }));
      sessionStorage.setItem('yt-player-volume', JSON.stringify({ data, creation: now }));
    } catch { /* ignore */ }
  }
  function changeVolume(player, delta) {
    if (!player.getVolume) return;
    const vol = Math.max(0, Math.min(100, Math.round(player.getVolume()) + delta));
    player.setVolume(vol);
    let muted = !!player.isMuted?.();
    if (vol > 0 && muted) { player.unMute(); muted = false; }
    saveVolume(vol, muted);
    osd(`Volume ${vol}%`);
  }
  function toggleMute(player) {
    if (!player.isMuted) return;
    const vol = player.getVolume();
    if (player.isMuted()) { player.unMute(); saveVolume(vol, false); osd(`Volume ${Math.round(vol)}%`); }
    else { player.mute(); saveVolume(vol, true); osd('Muted'); }
  }
  function quietKey(e) {
    if (!S.quietKeys || e.shiftKey || location.pathname !== '/watch') return false;
    const player = getVideo()?.closest('.html5-video-player');
    if (!player) return false;
    if (e.code === 'KeyC') { stop(e); toggleCaptions(player); return true; }
    if (e.code === 'KeyM') { stop(e); toggleMute(player); return true; }
    // Arrow keys only change volume when the video has focus (otherwise they scroll the page).
    if ((e.code === 'ArrowUp' || e.code === 'ArrowDown') && player.contains(e.target)) {
      stop(e);
      changeVolume(player, e.code === 'ArrowUp' ? 5 : -5);
      return true;
    }
    return false;
  }

  window.addEventListener('keydown', (e) => {
    if (isTyping(e) || e.ctrlKey || e.altKey || e.metaKey) return;

    // Shift+. / Shift+,  -> speed up / down past YouTube's 2x cap.
    if (e.shiftKey && (e.code === 'Period' || e.code === 'Comma')) {
      if (S.enabled === false || !getVideo()) return;
      stop(e);
      changeSpeed(e.code === 'Period' ? 1 : -1);
      return;
    }

    if (quietKey(e)) return;

    // 0-9 -> YouTube jumps to 0%-90% of the video. Block it.
    if (S.blockNumberSeek && !e.shiftKey && /^(Digit|Numpad)[0-9]$/.test(e.code)) {
      stop(e);
      return;
    }

    // V -> YouTube opens the grid of suggested videos over the player. Block it.
    if (S.blockVKey && !e.shiftKey && e.code === 'KeyV' && location.pathname === '/watch') {
      stop(e);
      return;
    }

    // Shift+/ -> close the shortcuts list if it's already open.
    if (S.fixShortcutDialog && e.shiftKey && e.code === 'Slash') {
      if (closeHotkeyDialog()) stop(e);
    }
  }, true);

  // ---------- mouse at the edge ----------
  // With the mouse at the far right of the window (or just left the window that way), the control
  // bar stays hidden even when Space, arrows or other keys would show it. Each mouse move is one number
  // comparison, and the page only changes when the mouse crosses the edge.
  // The right side is measured from the window edge with extra room: YouTube's page scrollbar sits there
  // (even in fullscreen), and Firefox stops reporting the mouse once it's over the scrollbar.
  const RIGHT_ROOM = 20;
  let winWidth = window.innerWidth;
  const readWidth = () => { winWidth = window.innerWidth; };
  window.addEventListener('resize', readWidth, { passive: true });
  document.addEventListener('fullscreenchange', () => { readWidth(); updateFullscreen(); });

  // Optional pause badge (setting): YouTube's big pause icon is hidden at the edge, so a small "❚❚" sits in
  // the player's bottom-left corner while paused. CSS only shows it while the mouse is at the edge.
  document.addEventListener('pause', (e) => {
    const v = e.target;
    if (!S.edgePauseIcon || v !== getVideo() || v.ended) return;
    const host = v.closest('.html5-video-player');
    if (!host) return;
    let b = host.querySelector(':scope > .ytt-pause-badge');
    if (!b) { b = el('div', { class: 'ytt-pause-badge', 'aria-hidden': 'true' }, '❚❚'); host.appendChild(b); }
    b.classList.add('on');
  }, true);
  document.addEventListener('play', (e) => {
    e.target?.closest?.('.html5-video-player')?.querySelector(':scope > .ytt-pause-badge.on')?.classList.remove('on');
  }, true);

  // ---------- fullscreen ----------
  // Scrolling in fullscreen pulls up YouTube's "more videos" grid and the page below. While in fullscreen
  // (and only then) the wheel is swallowed, except inside the player's own menus (quality list etc.).
  // The listener is only attached in fullscreen, so normal scrolling never runs any of this code.
  function onFullscreenWheel(e) {
    if (e.target?.closest?.('.ytp-popup, .ytp-settings-menu, .ytp-panel')) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  }
  function updateFullscreen() {
    const fs = !!document.fullscreenElement;
    document.documentElement.classList.toggle('ytt-fs', fs);
    const want = fs && !!(S.fsNoScroll || S.fsHideMoreVideos);
    if (want === wheelBlocked) return;
    wheelBlocked = want;
    if (want) window.addEventListener('wheel', onFullscreenWheel, { capture: true, passive: false });
    else window.removeEventListener('wheel', onFullscreenWheel, { capture: true });
  }
  function setEdge(on) {
    if (on === atEdge) return;
    atEdge = on;
    document.documentElement.classList.toggle('ytt-edge', on);
  }
  // Right side only.
  const nearSide = (x, extra) => x >= winWidth - RIGHT_ROOM - extra;
  window.addEventListener('mousemove', (e) => {
    if (S.edgeHideControls) setEdge(nearSide(e.clientX, 0));
  }, { capture: true, passive: true });
  // Mouse left the page (out of the window, or onto the scrollbar) through the right side.
  document.addEventListener('mouseout', (e) => {
    if (!e.relatedTarget && S.edgeHideControls && nearSide(e.clientX, 10)) setEdge(true);
  }, { passive: true });

  // ---------- theater ----------
  let lastTheater = null;
  let theaterDoneFor = null;
  function nudgePlayerSize() {
    // YouTube sizes the <video> from its container on resize; poke it after layout changes.
    setTimeout(() => window.dispatchEvent(new Event('resize')), 60);
    setTimeout(() => window.dispatchEvent(new Event('resize')), 400);
  }
  function theaterTick() {
    if (location.pathname !== '/watch') return;
    const flexy = document.querySelector('ytd-watch-flexy');
    if (!flexy) return;
    const isTheater = flexy.hasAttribute('theater') || flexy.hasAttribute('full-bleed-player');
    if (isTheater !== lastTheater) {
      lastTheater = isTheater;
      if (S.bigTheater) nudgePlayerSize();
    }
    // Each new video starts in normal view (YouTube otherwise keeps theater on).
    if (S.resetTheater) {
      const id = videoId();
      if (id && theaterDoneFor !== id && document.getElementById('movie_player')) {
        theaterDoneFor = id;
        if (isTheater && !document.fullscreenElement) exitTheater();
      }
    }
  }
  function exitTheater() {
    const flexy = document.querySelector('ytd-watch-flexy');
    if (flexy?.hasAttribute('theater') || flexy?.hasAttribute('full-bleed-player')) {
      document.querySelector('#movie_player .ytp-size-button')?.click();
    }
  }
  // YouTube remembers theater in the "wide" cookie; clear it so a fresh page load starts normal.
  function clearWideCookie() {
    if (S.resetTheater && /(?:^|;\s*)wide=1/.test(document.cookie)) {
      document.cookie = 'wide=0; domain=.youtube.com; path=/; max-age=31536000; secure';
    }
  }
  // Leaving a video: switch theater off before the next one loads, so it never flashes.
  document.addEventListener('yt-navigate-start', (e) => {
    if (!S.resetTheater || document.fullscreenElement) return;
    let next = null;
    try { next = new URL(e.detail?.url || '', location.origin).searchParams.get('v'); } catch { /* ignore */ }
    if (!next || next === videoId()) return; // same video (e.g. a timestamp link) or not a video
    clearWideCookie();
    exitTheater();
    theaterDoneFor = null;
  });
  // Revisiting a video should get the remembered speed again.
  document.addEventListener('yt-navigate-start', () => { speedAppliedFor = null; });

  // ---------- transcript: fetching ----------
  const cache = new Map(); // videoId -> segments [{ms, text}]

  function findAll(root, key) {
    const out = [];
    const stack = [root];
    while (stack.length) {
      const o = stack.pop();
      if (!o || typeof o !== 'object') continue;
      if (Array.isArray(o)) { for (const x of o) stack.push(x); continue; }
      for (const k in o) {
        if (k === key) out.push(o[k]);
        else if (o[k] && typeof o[k] === 'object') stack.push(o[k]);
      }
    }
    return out;
  }
  const textOf = (t) => (t?.simpleText ?? (t?.runs || []).map((r) => r.text).join('') ?? '').trim();

  async function sapisidHash() {
    const m = document.cookie.match(/(?:^|;\s*)(?:SAPISID|__Secure-3PAPISID)=([^;]+)/);
    if (!m) return null;
    const ts = Math.floor(Date.now() / 1000);
    const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(`${ts} ${m[1]} https://www.youtube.com`));
    const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
    return `SAPISIDHASH ${ts}_${hex}`;
  }

  async function innertube(endpoint, body, anon = false) {
    const ctx = cfg('INNERTUBE_CONTEXT');
    if (!ctx) throw new Error('YouTube config not ready');
    const headers = {
      'Content-Type': 'application/json',
      'X-Youtube-Client-Name': String(cfg('INNERTUBE_CONTEXT_CLIENT_NAME') || 1),
      'X-Youtube-Client-Version': String(cfg('INNERTUBE_CLIENT_VERSION') || ctx.client?.clientVersion || ''),
    };
    if (!anon) {
      const auth = await sapisidHash();
      if (auth) { headers.Authorization = auth; headers['X-Goog-AuthUser'] = String(cfg('SESSION_INDEX') ?? 0); headers['X-Origin'] = 'https://www.youtube.com'; }
    }
    const r = await fetch(`/youtubei/v1/${endpoint}?prettyPrint=false`, {
      method: 'POST', headers, credentials: anon ? 'omit' : 'same-origin', body: JSON.stringify({ context: ctx, ...body }),
    });
    if (!r.ok) throw new Error(`${endpoint} HTTP ${r.status}`);
    return r.json();
  }

  // Method 1: the same API YouTube's "Show transcript" panel uses. Tried signed in, then anonymously.
  // If YouTube says the video has no transcript, stop there (no point trying the panel).
  async function viaInnertube(id) {
    let lastErr;
    for (const anon of [false, true]) {
      let next;
      try { next = await innertube('next', { videoId: id }, anon); } catch (err) { lastErr = err; continue; }
      const ep = findAll(next.engagementPanels || [], 'getTranscriptEndpoint')[0] ||
        findAll(next, 'getTranscriptEndpoint')[0];
      if (!ep?.params) {
        const err = new Error('this video has no transcript');
        err.final = true;
        throw err;
      }
      try {
        const data = await innertube('get_transcript', { params: ep.params }, anon);
        const segs = findAll(data, 'transcriptSegmentRenderer')
          .map((s) => ({ ms: Number(s.startMs) || 0, text: textOf(s.snippet) }))
          .filter((s) => s.text);
        if (segs.length) return segs;
        lastErr = new Error('empty transcript');
      } catch (err) { lastErr = err; }
    }
    throw lastErr;
  }

  // Method 2a: reuse a caption file the player already downloaded for this video (e.g. after CC was on).
  // YouTube now signs these links, so a copy of the player's own link works where a made-up one doesn't.
  async function viaPlayerCaptionRequest(id) {
    const entry = performance.getEntriesByType('resource')
      .map((e) => e.name)
      .filter((u) => u.includes('/api/timedtext') && u.includes(`v=${id}`))
      .pop();
    if (!entry) throw new Error('no caption download yet');
    const url = new URL(entry);
    url.searchParams.set('fmt', 'json3');
    url.searchParams.delete('tlang');
    const r = await fetch(url, { credentials: 'same-origin' });
    const raw = await r.text();
    if (!raw) throw new Error('caption file empty');
    return parseJson3(raw);
  }
  function parseJson3(raw) {
    const j = JSON.parse(raw);
    const segs = (j.events || [])
      .filter((ev) => ev.segs)
      .map((ev) => ({ ms: ev.tStartMs || 0, text: ev.segs.map((s) => s.utf8).join('').replace(/\s+/g, ' ').trim() }))
      .filter((s) => s.text);
    if (!segs.length) throw new Error('caption file empty');
    return segs;
  }

  // Method 2b: caption track file from the player.
  async function viaCaptions(id) {
    const player = document.getElementById('movie_player');
    const pr = player?.getPlayerResponse?.();
    if (!pr || pr.videoDetails?.videoId !== id) throw new Error('player not ready');
    const tracks = pr.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    if (!tracks.length) throw new Error('no captions');
    const lang = (navigator.language || 'en').slice(0, 2);
    const manual = tracks.filter((t) => t.kind !== 'asr');
    const track = manual.find((t) => t.languageCode?.startsWith(lang)) || manual[0] ||
      tracks.find((t) => t.languageCode?.startsWith(lang)) || tracks[0];
    const r = await fetch(track.baseUrl + '&fmt=json3', { credentials: 'same-origin' });
    const raw = await r.text();
    if (!raw) throw new Error('caption file empty');
    const j = JSON.parse(raw);
    const segs = (j.events || [])
      .filter((ev) => ev.segs)
      .map((ev) => ({ ms: ev.tStartMs || 0, text: ev.segs.map((s) => s.utf8).join('').replace(/\s+/g, ' ').trim() }))
      .filter((s) => s.text);
    if (!segs.length) throw new Error('caption file empty');
    return segs;
  }

  // Method 3: open YouTube's transcript panel and read it.
  function parseTs(s) {
    const parts = (s || '').trim().split(':').map(Number);
    if (parts.some(isNaN)) return 0;
    return parts.reduce((a, b) => a * 60 + b, 0) * 1000;
  }
  // Handles both the old panel (ytd-transcript-segment-renderer) and the newer one
  // (transcript-segment-view-model), which only renders rows as you scroll.
  const SEG_SEL = 'ytd-transcript-segment-renderer, transcript-segment-view-model';
  function readRows(into) {
    for (const n of document.querySelectorAll(SEG_SEL)) {
      const ts = (n.querySelector('.segment-timestamp, [class*="Timestamp"]')?.textContent || '').trim();
      let text = n.querySelector('.segment-text, .yt-core-attributed-string, yt-formatted-string')?.textContent;
      if (!text) {
        text = [...n.querySelectorAll('span')]
          .filter((s) => !/Timestamp|A11yLabel/.test(s.className))
          .map((s) => s.textContent).join(' ');
      }
      text = (text || '').replace(/\s+/g, ' ').trim();
      if (text) into.set(ts + '|' + text, { ms: parseTs(ts), text });
    }
  }
  async function scrapePanel() {
    const found = new Map();
    readRows(found);
    if (!found.size) return [];
    const first = document.querySelector(SEG_SEL);
    const scroller = first?.closest('#content, #contents, #segments-container') ||
      document.querySelector('ytd-engagement-panel-section-list-renderer[target-id*="transcript" i] #content');
    if (scroller) {
      const start = scroller.scrollTop;
      let still = 0;
      for (let i = 0; i < 150 && still < 4; i++) {
        const before = found.size;
        scroller.scrollBy(0, 800);
        await sleep(120);
        readRows(found);
        still = found.size === before ? still + 1 : 0;
      }
      scroller.scrollTop = start;
    }
    return [...found.values()].sort((a, b) => a.ms - b.ms);
  }
  // Opens YouTube's transcript panel invisibly, reads it, closes it. The panel stays inside the
  // window (fully transparent, behind the page) so YouTube still loads its rows.
  const PANEL = 'ytd-engagement-panel-section-list-renderer[target-id*="transcript" i]';
  const HIDE_PANEL_CSS = `${PANEL}{position:fixed !important;left:0 !important;top:0 !important;width:400px !important;
    height:800px !important;opacity:0 !important;pointer-events:none !important;z-index:-1 !important}`;
  const panelOpen = () => !!document.querySelector(`${PANEL}[visibility="ENGAGEMENT_PANEL_VISIBILITY_EXPANDED"]`);
  const waitForRows = async () => { for (let i = 0; i < 40 && !document.querySelector(SEG_SEL); i++) await sleep(150); };

  function closePanel() {
    const panel = document.querySelector(`${PANEL}[visibility="ENGAGEMENT_PANEL_VISIBILITY_EXPANDED"]`);
    if (!panel) return;
    const close = panel.querySelector('#visibility-button button, button[aria-label*="close" i]');
    if (close) { close.click(); return; }
    // Same message YouTube's own close button sends.
    panel.dispatchEvent(new CustomEvent('yt-action', {
      bubbles: true, composed: true,
      detail: {
        actionName: 'yt-change-engagement-panel-visibility-action',
        args: [{ changeEngagementPanelVisibilityAction: {
          targetId: panel.getAttribute('target-id'), visibility: 'ENGAGEMENT_PANEL_VISIBILITY_HIDDEN' } }],
        returnValue: [],
      },
    }));
  }

  async function viaPanel() {
    // Hide it straight away (even if it was already open) and always close it afterwards.
    const hide = addStyle('ytt-hide-panel', HIDE_PANEL_CSS);
    if (panelOpen()) {
      try {
        await waitForRows();
        const segs = await scrapePanel();
        if (!segs.length) throw new Error('transcript panel did not load');
        return segs;
      } finally {
        closePanel();
        for (let i = 0; i < 30 && panelOpen(); i++) await sleep(100);
        hide.remove();
      }
    }
    try {
      const findBtn = () => document.querySelector(
        'ytd-video-description-transcript-section-renderer button, button[aria-label*="show transcript" i]');
      let btn = findBtn();
      if (!btn) {
        // Only expand the description if it's collapsed, and only collapse it again if we expanded it.
        const exp = document.querySelector('ytd-watch-metadata #description-inline-expander #expand, ytd-text-inline-expander #expand');
        if (exp && exp.offsetParent !== null) {
          exp.click();
          await sleep(300);
          btn = findBtn();
          document.querySelector('ytd-watch-metadata #description-inline-expander #collapse, ytd-text-inline-expander #collapse')?.click();
        }
      }
      if (!btn) throw new Error('this video has no transcript');
      btn.click();
      await waitForRows();
      const segs = await scrapePanel();
      if (!segs.length) throw new Error('transcript panel did not load');
      return segs;
    } finally {
      closePanel();
      // Keep it invisible until YouTube has really closed it (up to 3s).
      for (let i = 0; i < 30 && panelOpen(); i++) await sleep(100);
      hide.remove();
    }
  }

  // One fetch per video at a time (button, popup and Alt+Shift+T share it). Keeps the last 20 videos.
  const inflight = new Map();
  function getSegments(id) {
    if (!id) return Promise.reject(new Error('open a video first'));
    if (cache.has(id)) return Promise.resolve(cache.get(id));
    if (inflight.has(id)) return inflight.get(id);
    const job = (async () => {
      const errors = [];
      for (const fn of [viaInnertube, viaPlayerCaptionRequest, viaCaptions, viaPanel]) {
        try {
          const segs = await fn(id);
          console.debug('[More Settings for YouTube] transcript via', fn.name);
          cache.set(id, segs);
          if (cache.size > 20) cache.delete(cache.keys().next().value);
          return segs;
        } catch (err) {
          errors.push(err.message);
          if (err.final) break;
        }
      }
      throw new Error(errors[errors.length - 1] || 'unknown error');
    })();
    inflight.set(id, job);
    job.finally(() => inflight.delete(id)).catch(() => {});
    return job;
  }

  // ---------- transcript: formatting ----------
  function fmtTime(ms) {
    const t = Math.floor(ms / 1000);
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    const ss = String(s).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
  }
  function videoTitle() {
    return (document.querySelector('ytd-watch-metadata h1')?.textContent ||
      document.title.replace(/^\(\d+\)\s*/, '').replace(/ - YouTube$/, '')).trim();
  }
  function channelName() {
    return (document.querySelector('ytd-watch-metadata ytd-channel-name a')?.textContent || '').trim();
  }

  async function buildText({ timestamps = S.includeTimestamps } = {}) {
    // Read the video's details before any waiting, so they can't change if you click to another video.
    const id = videoId();
    const title = videoTitle();
    const ch = channelName();
    const segs = await getSegments(id);
    const body = timestamps
      ? segs.map((s) => `[${fmtTime(s.ms)}] ${s.text}`).join('\n')
      : segs.map((s) => s.text).join(' ').replace(/\s+/g, ' ').trim();
    const parts = [];
    if (S.includeHeader) {
      parts.push(`Title: ${title}`);
      if (ch) parts.push(`Channel: ${ch}`);
      parts.push(`URL: https://www.youtube.com/watch?v=${id}`, '', 'Transcript:');
    }
    parts.push(body);
    const words = body.split(/\s+/).filter(Boolean).length - (timestamps ? segs.length : 0);
    return { text: parts.join('\n'), words };
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return; } catch { /* fall back */ }
    const res = await request('copy', { text });
    if (!res.ok) throw new Error('clipboard was blocked, try again');
  }

  // ---------- toast ----------
  let toastTimer;
  function toast(msg) {
    let t = document.getElementById('ytt-toast');
    if (!t) { t = el('div', { id: 'ytt-toast', class: 'ytt-toast', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(t); }
    t.replaceChildren(msg);
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
  }

  // ---------- transcript bar under the video ----------
  let busy = false;
  async function run(fn) {
    if (busy) return;
    busy = true;
    const main = document.querySelector('#ytt-bar .ytt-btn');
    main?.setAttribute('aria-busy', 'true');
    try { await fn(); } catch (err) { toast(`Couldn't get the transcript: ${err.message}`); }
    finally { busy = false; main?.removeAttribute('aria-busy'); }
  }

  const copyTranscript = (timestamps = S.includeTimestamps) => run(async () => {
    const { text, words } = await buildText({ timestamps });
    await copyText(text);
    toast(`Transcript copied · ${words.toLocaleString()} words`);
  });

  function buildBar() {
    const btn = el('button', {
      type: 'button', class: 'ytt-btn', title: 'Copy the transcript (Shift-click: the other timestamp setting)',
      onclick: (e) => copyTranscript(e.shiftKey ? !S.includeTimestamps : S.includeTimestamps),
    }, svgIcon(ICON_COPY), 'Transcript');
    return el('div', { id: 'ytt-bar' }, btn);
  }

  // Sits right after the Subscribe button, like YouTube Transcript Copier did.
  function ensureBar() {
    const old = document.getElementById('ytt-bar');
    if (!S.transcriptButton || location.pathname !== '/watch') { old?.remove(); return; }
    if (old?.isConnected && old.previousElementSibling?.id === 'subscribe-button') return;
    const anchor = document.querySelector('ytd-watch-metadata #owner #subscribe-button') ||
      document.querySelector('ytd-watch-metadata #owner ytd-subscribe-button-renderer') ||
      document.querySelector('#owner #subscribe-button');
    if (!anchor?.parentNode) return;
    if (old && old.previousElementSibling === anchor) return;
    old?.remove();
    anchor.insertAdjacentElement('afterend', buildBar());
  }

  // ---------- Alt+Shift+T (browser command, via background.js and content.js) ----------
  document.addEventListener('ytt:copy-now', () => {
    if (S.enabled !== false && videoId()) copyTranscript();
  });

  // ---------- requests from the popup (via content.js) ----------
  document.addEventListener('ytt:get-transcript', async (e) => {
    let d; try { d = JSON.parse(e.detail); } catch { return; }
    try {
      const { text, words } = await buildText({ timestamps: d.timestamps });
      emit('get-transcript-result', { id: d.id, ok: true, text, words });
    } catch (err) {
      emit('get-transcript-result', { id: d.id, ok: false, error: err.message });
    }
  });

  // ---------- page loop ----------
  // A few cheap lookups once a second; nothing runs while the bar is already in place.
  setInterval(() => {
    if (document.hidden) return;
    ensureBar();
    theaterTick();
  }, 1000);
  document.addEventListener('yt-navigate-finish', () => { setTimeout(() => { ensureBar(); theaterTick(); openExplore(); }, 300); });

  // Apply cached settings right away; content.js sends the stored ones a moment later.
  applySettings();
})();
