const verdictBadge = document.getElementById("verdict-badge");
const watchBadge = document.getElementById("watch-badge");
const watchBtn = document.getElementById("watch-btn");
const analyzeBtn = document.getElementById("analyze-btn");
const codeInput = document.getElementById("code-input");
const feedbackDiv = document.getElementById("feedback");

let currentVerdictData = null;
let shotCount = 0;
let watching = false;
let session = null;
let screenshots = [];
let scrapedLanguage = "unknown";

const ANALYZE_URLS = [
  "http://localhost:3000/api/analyze",
  "http://localhost:3001/api/analyze",
];

function send(type, extra = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, ...extra }, (response) => resolve(response));
  });
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

function applyState(state) {
  if (!state) return;
  watching = Boolean(state.watching);
  shotCount = state.shotCount ?? 0;
  session = state.session ?? null;
  screenshots = Array.isArray(state.screenshots) ? state.screenshots : [];
  scrapedLanguage = state.scrapedLanguage ?? "unknown";
  currentVerdictData = state.lastVerdict ?? null;

  watchBadge.textContent = watching
    ? `Watching coding phase (${shotCount})`
    : shotCount > 0
      ? `Stopped (${shotCount} shots stored)`
      : "Not watching";
  watchBtn.disabled = watching;
  watchBtn.textContent = watching ? "Watching…" : "Watch tab";

  if (currentVerdictData) {
    verdictBadge.textContent = `${currentVerdictData.verdict} — ${currentVerdictData.problemTitle}`;
  } else {
    verdictBadge.textContent = "No verdict yet";
  }

  if (state.scrapedCode && !codeInput.value) {
    codeInput.value = state.scrapedCode;
  } else if (state.scrapedCode && codeInput.dataset.autofill !== "done") {
    codeInput.value = state.scrapedCode;
    codeInput.dataset.autofill = "done";
  }

  const canAnalyze = Boolean(currentVerdictData?.verdict) && shotCount > 0;
  analyzeBtn.disabled = !canAnalyze;
}

async function refreshState() {
  applyState(await send("GET_STATE"));
}

watchBtn.addEventListener("click", async () => {
  feedbackDiv.textContent = "";
  applyState(await send("START_WATCH"));
});

analyzeBtn.addEventListener("click", async () => {
  if (!currentVerdictData?.verdict || shotCount === 0) return;

  const code = codeInput.value.trim();
  if (!code) {
    feedbackDiv.textContent = "No code yet. Stay on the editor or paste the submission.";
    return;
  }

  const attempt = {
    id: `ext-${Date.now()}`,
    problemSlug: currentVerdictData.problemSlug,
    problemTitle: currentVerdictData.problemTitle,
    platform: "leetcode",
    language: scrapedLanguage || "unknown",
    code,
    verdict: currentVerdictData.verdict,
    timestamp: currentVerdictData.detectedAt,
  };

  feedbackDiv.textContent = "Analyzing…";
  analyzeBtn.disabled = true;

  try {
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
