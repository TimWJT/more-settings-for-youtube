// More Settings for YouTube - keyboard shortcut (default Alt+Shift+T, change it in about:addons > gear > Manage Extension Shortcuts).
browser.commands.onCommand.addListener(async (command) => {
  if (command !== 'copy-transcript') return;
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  try {
    await browser.tabs.sendMessage(tab.id, { type: 'copyNow' });
  } catch {
    // Not a YouTube tab.
  }
});
