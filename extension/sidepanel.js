const verdictBadge = document.getElementById("verdict-badge");
const watchBadge = document.getElementById("watch-badge");
const watchBtn = document.getElementById("watch-btn");
const analyzeBtn = document.getElementById("analyze-btn");
const feedbackDiv = document.getElementById("feedback");

let currentVerdictData = null;
let shotCount = 0;
let watching = false;
let session = null;
let screenshots = [];
let scrapedLanguage = "unknown";
let scrapedCode = "";
let liveProblemTitle = "";
let liveProblemSlug = "";
let mediaStop = null;

const ANALYZE_URLS = [
  "http://localhost:3000/api/analyze",
  "http://localhost:3001/api/analyze",
];
const LEDGER_URLS = [
  "http://localhost:3000/api/ledger",
  "http://localhost:3001/api/ledger",
];

function send(type, extra = {}) {
  return new Promise((resolve) => {
    if (!chrome.runtime?.id) {
      resolve(undefined);
      return;
    }
    try {
      chrome.runtime.sendMessage({ type, ...extra }, (response) => {
        void chrome.runtime.lastError;
        resolve(response);
      });
    } catch {
      resolve(undefined);
    }
  });
}

async function postLedger(attempt) {
  for (const url of LEDGER_URLS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attempt }),
      });
      if (res.ok) return;
    } catch {
      // try the other local port
    }
  }
}

async function postAnalyze(payload) {
  let lastError = new Error("Analyze request failed.");
  for (const url of ANALYZE_URLS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok || res.status === 400) return res;
      lastError = new Error(`Request failed (${res.status})`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastError;
}

function resolveLanguage(declared, code) {
  const key = (declared ?? "").trim().toLowerCase();
  if (key && key !== "unknown") return declared;
  const text = code ?? "";
  if (/#include\s*<|std::|vector\s*<|unordered_map\s*<|public\s*:/.test(text)) return "cpp";
  if (/def\s+\w+\s*\(|class\s+Solution\s*:|elif\s+/.test(text) && !/function\s+|=>/.test(text)) return "python";
  if (/public\s+class\s+|HashMap\s*</.test(text)) return "java";
  if (/function\s+\w+|const\s+\w+\s*=|=>\s*\{/.test(text)) return "javascript";
  return declared || "unknown";
}

function sameProblem() {
  if (!currentVerdictData?.verdict || !liveProblemSlug) return false;
  return currentVerdictData.problemSlug === liveProblemSlug;
}

function grabFrame(video) {
  if (video.videoWidth === 0 || video.videoHeight === 0) return null;
  const scale = Math.min(1, 640 / video.videoWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.45);
}

async function startScreenWatch() {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: false,
  });
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  await video.play();

  let count = 0;
  const tick = async () => {
    if (count >= 24) return;
    const dataUrl = grabFrame(video);
    if (!dataUrl) return;
    count += 1;
    applyState(await send("STORE_SHOT", { dataUrl }));
  };

  await tick();
  const timer = window.setInterval(() => {
    void tick();
  }, 10_000);

  const stop = () => {
    window.clearInterval(timer);
    stream.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
    mediaStop = null;
  };
  stream.getVideoTracks()[0]?.addEventListener("ended", () => {
    stop();
    void send("STOP_WATCH").then(applyState);
  });
  mediaStop = stop;
}

function applyState(state) {
  if (!state) {
    feedbackDiv.textContent = "Extension background did not reply. Reload the unpacked extension, then click Watch tab again.";
    return;
  }
  watching = Boolean(state.watching);
  shotCount = state.shotCount ?? 0;
  session = state.session ?? null;
  screenshots = Array.isArray(state.screenshots) ? state.screenshots : [];
  scrapedLanguage = state.scrapedLanguage ?? "unknown";
  scrapedCode = state.scrapedCode ?? "";
  liveProblemTitle = state.liveProblemTitle || "";
  liveProblemSlug = state.liveProblemSlug || "";
  currentVerdictData = state.lastVerdict ?? null;
  if (currentVerdictData && currentVerdictData.problemSlug !== liveProblemSlug) {
    currentVerdictData = null;
  }

  watchBadge.textContent = watching
    ? `Watching coding phase (${shotCount})`
    : shotCount > 0
      ? `Stopped (${shotCount} shots stored)`
      : "Not watching";
  watchBtn.disabled = watching && shotCount > 0;
  watchBtn.textContent = watching && shotCount === 0 ? "Retry watch" : watching ? "Watching…" : "Watch tab";

  if (state.lastError) {
    feedbackDiv.textContent = state.lastError;
  } else if (watching && shotCount > 0) {
    feedbackDiv.textContent = "";
  }

  if (sameProblem() && liveProblemTitle) {
    verdictBadge.textContent = `${currentVerdictData.verdict} — ${liveProblemTitle}`;
  } else if (liveProblemTitle) {
    verdictBadge.textContent = `${liveProblemTitle} — no verdict yet`;
  } else {
    verdictBadge.textContent = "No verdict yet — submit on LeetCode first";
  }

  const canAnalyze = sameProblem() && shotCount > 0;
  analyzeBtn.disabled = !canAnalyze;
}

async function refreshState() {
  applyState(await send("GET_STATE"));
}

watchBtn.addEventListener("click", async () => {
  feedbackDiv.textContent = "Chrome will ask which tab to share. Pick the LeetCode tab.";
  try {
    applyState(await send("START_WATCH"));
    await startScreenWatch();
  } catch (err) {
    mediaStop?.();
    await send("STOP_WATCH");
    feedbackDiv.textContent = err instanceof Error
      ? err.message
      : "Screen share was blocked. Click Watch tab and choose the LeetCode tab.";
    applyState(await send("GET_STATE"));
  }
});

analyzeBtn.addEventListener("click", async () => {
  if (!sameProblem() || shotCount === 0) {
    feedbackDiv.textContent = "Analyze stays locked until this LeetCode problem has its own verdict on the badge.";
    return;
  }

  const code = scrapedCode.trim() || currentVerdictData.code || "// no editor scrape";

  const attempt = {
    id: `ext-${Date.now()}`,
    problemSlug: liveProblemSlug || currentVerdictData.problemSlug,
    problemTitle: liveProblemTitle || currentVerdictData.problemTitle,
    platform: "leetcode",
    language: resolveLanguage(scrapedLanguage || currentVerdictData.language, code),
    code,
    verdict: currentVerdictData.verdict,
    timestamp: currentVerdictData.detectedAt || new Date().toISOString(),
  };

  feedbackDiv.textContent = "Analyzing…";
  analyzeBtn.disabled = true;

  try {
    mediaStop?.();
    await send("STOP_WATCH");
    const res = await postAnalyze({
      attempt,
      priorAttempts: [],
      session,
      screenshots: screenshots.slice(-3),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Request failed (${res.status})`);
    }

    const feedback = await res.json();
    attempt.analysis = feedback;
    chrome.storage.local.get({ attempts: [] }, (result) => {
      const attempts = result.attempts;
      attempts.push(attempt);
      chrome.storage.local.set({ attempts });
    });
    await postLedger(attempt);
    renderFeedback(feedback);
  } catch (err) {
    feedbackDiv.textContent = "Error: " + err.message;
  } finally {
    await refreshState();
  }
});

function renderFeedback(feedback) {
  const lines = [];
  lines.push(`[${feedback.aiGenerated ? "AI-generated" : "Rule-based"}]`);
  lines.push(`Tags: ${feedback.tags.join(", ") || "none"}`);
  lines.push("");
  lines.push(feedback.summary);
  if (feedback.whatWentWrong?.length) {
    lines.push("");
    lines.push("What went wrong:");
    feedback.whatWentWrong.forEach((w) => lines.push("- " + w));
  }
  if (feedback.improvementNote) {
    lines.push("");
    lines.push("Improvement: " + feedback.improvementNote);
  }
  if (feedback.errorHistory?.length) {
    lines.push("");
    lines.push("Session errors: " + feedback.errorHistory.join(" · "));
  }
  if (feedback.nextDrill) {
    lines.push("");
    lines.push(`Next drill: ${feedback.nextDrill.title}`);
  }
  feedbackDiv.textContent = lines.join("\n");
}

setInterval(refreshState, 1000);
refreshState();
