const ALARM = "mistake-ledger-shot";
const MAX_SHOTS = 24;

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!tab.url || !tab.url.includes("leetcode.com/problems/")) return;
  await chrome.sidePanel.setOptions({ tabId, path: "sidepanel.html", enabled: true }).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "VERDICT_DETECTED") {
    void onVerdict(message.payload).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message.type === "START_WATCH") {
    void startWatch().then((state) => sendResponse(state));
    return true;
  }
  if (message.type === "STOP_WATCH") {
    void stopWatch().then((state) => sendResponse(state));
    return true;
  }
  if (message.type === "GET_STATE") {
    void readState().then((state) => sendResponse(state));
    return true;
  }
  if (message.type === "SCRAPED_CODE") {
    chrome.storage.local.set({
      scrapedCode: message.code ?? "",
      scrapedLanguage: message.language ?? "unknown",
    });
    return false;
  }
  return false;
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) void captureIfWatching();
});

async function startWatch() {
  const tab = await activeLeetCodeTab();
  const startedAt = new Date().toISOString();
  const session = {
    id: `ext-session-${Date.now()}`,
    problemSlug: slugFromUrl(tab?.url),
    problemTitle: (tab?.title ?? "LeetCode").replace(" - LeetCode", "").trim(),
    platform: "leetcode",
    startedAt,
    events: [],
    attemptIds: [],
    analysis: null,
  };
  await chrome.storage.local.set({
    watching: true,
    watchTabId: tab?.id ?? null,
    shotCount: 0,
    screenshots: [],
    session,
    lastVerdict: null,
  });
  await chrome.alarms.create(ALARM, { delayInMinutes: 0.01, periodInMinutes: 0.2 });
  await captureIfWatching();
  return readState();
}

async function stopWatch() {
  await chrome.alarms.clear(ALARM);
  await chrome.storage.local.set({ watching: false });
  return readState();
}

async function onVerdict(payload) {
  const stored = await chrome.storage.local.get({ session: null });
  const session = stored.session;
  if (session) {
    session.events = session.events ?? [];
    session.events.push({
      id: `evt-${Date.now()}`,
      at: payload.detectedAt,
      kind: "submit",
      verdict: payload.verdict,
      message: `LeetCode ${payload.verdict}`,
    });
  }
  await chrome.storage.local.set({ lastVerdict: payload, session });
}

async function captureIfWatching() {
  const stored = await chrome.storage.local.get({
    watching: false,
    watchTabId: null,
    screenshots: [],
    shotCount: 0,
    session: null,
  });
  if (!stored.watching) return;

  const tabId = stored.watchTabId ?? (await activeLeetCodeTab())?.id;
  if (tabId == null) return;

  let dataUrl;
  try {
    dataUrl = await chrome.tabs.captureVisibleTab({ format: "jpeg", quality: 45 });
  } catch {
    return;
  }
  if (!dataUrl) return;

  const shrunk = await shrinkJpeg(dataUrl);
  const screenshots = [...stored.screenshots, shrunk].slice(-MAX_SHOTS);
  const session = stored.session ?? emptySession();
  session.events = session.events ?? [];
  session.events.push({
    id: `shot-${Date.now()}`,
    at: new Date().toISOString(),
    kind: "screenshot",
    message: "silent screenshot",
  });

  await chrome.storage.local.set({
    screenshots,
    shotCount: screenshots.length,
    session,
  });
}

function emptySession() {
  return {
    id: `ext-session-${Date.now()}`,
    problemSlug: "unknown",
    problemTitle: "LeetCode",
    platform: "leetcode",
    startedAt: new Date().toISOString(),
    events: [],
    attemptIds: [],
    analysis: null,
  };
}

async function readState() {
  const stored = await chrome.storage.local.get({
    watching: false,
    shotCount: 0,
    lastVerdict: null,
    scrapedCode: "",
    scrapedLanguage: "unknown",
    screenshots: [],
    session: null,
  });
  return stored;
}

async function activeLeetCodeTab() {
  const tabs = await chrome.tabs.query({
    url: "https://leetcode.com/problems/*",
    lastFocusedWindow: true,
  });
  return tabs.find((tab) => tab.active) ?? tabs[0] ?? null;
}

function slugFromUrl(url) {
  const match = String(url ?? "").match(/\/problems\/([^/]+)/);
  return match ? match[1] : "unknown";
}

async function shrinkJpeg(dataUrl) {
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, 640 / bitmap.width);
    const canvas = new OffscreenCanvas(
      Math.round(bitmap.width * scale),
      Math.round(bitmap.height * scale),
    );
    const context = canvas.getContext("2d");
    if (!context) return dataUrl;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const out = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.45 });
    return blobToDataUrl(out);
  } catch {
    return dataUrl;
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result ?? ""));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
