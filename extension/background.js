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
    void startWatch()
      .then((state) => sendResponse(state))
      .catch(async (err) => {
        const messageText = err instanceof Error ? err.message : String(err);
        await chrome.storage.local.set({ watching: false, lastError: messageText });
        sendResponse(await readState());
      });
    return true;
  }
  if (message.type === "STORE_SHOT") {
    void storeShot(message.dataUrl)
      .then(() => scanTabVerdict())
      .then(() => readState())
      .then((state) => sendResponse(state));
    return true;
  }
  if (message.type === "STOP_WATCH") {
    void stopWatch().then((state) => sendResponse(state));
    return true;
  }
  if (message.type === "GET_STATE") {
    void scanTabVerdict()
      .then(() => readState())
      .then((state) => sendResponse(state));
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

async function startWatch() {
  const tab = await watchedLeetCodeTab();
  if (!tab?.id) {
    throw new Error("Open a LeetCode problem tab first, then click Watch tab.");
  }

  const problemSlug = slugFromUrl(tab.url);
  const problemTitle = titleFromTab(tab);
  const session = {
    id: `ext-session-${Date.now()}`,
    problemSlug,
    problemTitle,
    platform: "leetcode",
    startedAt: new Date().toISOString(),
    events: [],
    attemptIds: [],
    analysis: null,
  };
  await chrome.storage.local.set({
    watching: true,
    watchTabId: tab.id,
    shotCount: 0,
    screenshots: [],
    session,
    lastVerdict: null,
    lastError: "",
  });
  return readState();
}

async function storeShot(dataUrl) {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
    return readState();
  }
  const stored = await chrome.storage.local.get({
    screenshots: [],
    session: null,
    watching: false,
  });
  const screenshots = [...stored.screenshots, dataUrl].slice(-MAX_SHOTS);
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
    watching: true,
    lastError: "",
  });
  return readState();
}

async function stopWatch() {
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
    if (payload.problemSlug) session.problemSlug = payload.problemSlug;
    if (payload.problemTitle) session.problemTitle = payload.problemTitle;
  }
  await chrome.storage.local.set({ lastVerdict: payload, session });
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
    lastError: "",
  });
  const tab = await watchedLeetCodeTab();
  const liveProblemSlug = tab ? slugFromUrl(tab.url) : stored.session?.problemSlug ?? "";
  const liveProblemTitle = tab ? titleFromTab(tab) : stored.session?.problemTitle ?? "";
  return { ...stored, liveProblemSlug, liveProblemTitle };
}

async function scanTabVerdict() {
  const tab = await watchedLeetCodeTab();
  if (!tab?.id) return;
  let results;
  try {
    results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: () => {
        const text = (document.body?.innerText ?? "").replace(/\u00a0/g, " ");
        const checks = [
          ["WA", /Wrong Answer[\s\S]{0,240}(Runtime|Output|Expected|Case)/i],
          ["TLE", /Time Limit Exceeded/i],
          ["CE", /Compile Error/i],
          ["RE", /Runtime Error/i],
          ["AC", /Accepted[\s\S]{0,80}Runtime/i],
        ];
        for (const [code, pattern] of checks) {
          if (pattern.test(text)) return code;
        }
        return null;
      },
    });
  } catch {
    return;
  }
  const verdict = results?.map((row) => row.result).find((value) => typeof value === "string");
  if (!verdict) return;

  const problemSlug = slugFromUrl(tab.url);
  const problemTitle = titleFromTab(tab);
  const stored = await chrome.storage.local.get({ lastVerdict: null });
  if (
    stored.lastVerdict?.verdict === verdict &&
    stored.lastVerdict?.problemSlug === problemSlug
  ) {
    return;
  }

  await onVerdict({
    verdict,
    problemSlug,
    problemTitle,
    detectedAt: new Date().toISOString(),
    code: "",
    language: "unknown",
  });
}

async function watchedLeetCodeTab() {
  const live = await activeLeetCodeTab();
  if (live?.id) {
    const stored = await chrome.storage.local.get({ watchTabId: null, lastVerdict: null, session: null });
    const liveSlug = slugFromUrl(live.url);
    const patch = { watchTabId: live.id };
    if (stored.session && stored.session.problemSlug !== liveSlug) {
      patch.session = {
        ...stored.session,
        problemSlug: liveSlug,
        problemTitle: titleFromTab(live),
      };
    }
    if (stored.lastVerdict && stored.lastVerdict.problemSlug !== liveSlug) {
      patch.lastVerdict = null;
    }
    await chrome.storage.local.set(patch);
    return live;
  }
  const stored = await chrome.storage.local.get({ watchTabId: null });
  if (stored.watchTabId) {
    return chrome.tabs.get(stored.watchTabId).catch(() => null);
  }
  return null;
}

async function activeLeetCodeTab() {
  const tabs = await chrome.tabs.query({ url: "https://leetcode.com/problems/*" });
  if (tabs.length === 0) return null;
  const current = await chrome.windows.getLastFocused().catch(() => null);
  const inWindow = current ? tabs.filter((tab) => tab.windowId === current.id) : tabs;
  return (
    inWindow.find((tab) => tab.active) ??
    tabs.find((tab) => tab.active) ??
    inWindow[0] ??
    tabs[0]
  );
}

function titleFromTab(tab) {
  return (tab.title ?? "LeetCode").replace(" - LeetCode", "").trim();
}

function slugFromUrl(url) {
  const match = String(url ?? "").match(/\/problems\/([^/]+)/);
  return match ? match[1] : "unknown";
}
