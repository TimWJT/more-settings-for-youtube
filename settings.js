// Default settings, shared by content.js and popup.js.
// page.js keeps its own copy of these defaults (it runs in the page and can't load this file).
const YTT_DEFAULTS = {
  // Transcript
  transcriptButton: true,
  includeTimestamps: true,
  includeHeader: true,
  // Playback: speed
  maxSpeed: 2.5,
  speedStep: 0.25,
  speedOverlay: true,
  rememberSpeed: true,
  doublePressPast2: false,
  lastSpeed: 1,
  // Playback: keys
  quietKeys: true,
  blockNumberSeek: true,
  fixShortcutDialog: true,
  edgeHideControls: true,
  edgePauseIcon: false,
  // Player
  bigTheater: true,
  resetTheater: true,
  hideFullscreenActions: true,
  hideWatermark: true,
  fsNoScroll: true,
  fsHideMoreVideos: true,
  // Clean up: top bar
  hideCreate: true,
  hideNotifications: true,
  hideVoiceSearch: true,
  // Clean up: sidebar
  hideGuideShorts: true,
  hideGuideYourChannel: true,
  hideGuideYourVideos: true,
  hideGuideDownloads: true,
  hideGuideMore: true,
  hideGuideReportHistory: true,
  hideGuidePlayables: true,
  hideGuideMemberships: true,
  hideGuideFooter: true,
  // Clean up: feeds
  hideShortsFeed: false,
  hideShortsSearch: false,
  // Performance
  noBlur: true,
  noAnimations: true,
  noAmbient: true,
};
