chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
});

// Content script can't talk to the side panel directly, so it writes
// the detected verdict into chrome.storage.local, and the panel polls it.
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "VERDICT_DETECTED") {
    chrome.storage.local.set({ lastVerdict: message.payload });
  }
});