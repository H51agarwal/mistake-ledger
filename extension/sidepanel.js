const verdictBadge = document.getElementById("verdict-badge");
const analyzeBtn = document.getElementById("analyze-btn");
const codeInput = document.getElementById("code-input");
const feedbackDiv = document.getElementById("feedback");

let currentVerdictData = null;

function refreshVerdict() {
  chrome.storage.local.get("lastVerdict", (result) => {
    if (result.lastVerdict) {
      currentVerdictData = result.lastVerdict;
      verdictBadge.textContent = `${currentVerdictData.verdict} — ${currentVerdictData.problemTitle}`;
      analyzeBtn.disabled = false;
    } else {
      verdictBadge.textContent = "No verdict yet";
      analyzeBtn.disabled = true;
    }
  });
}

setInterval(refreshVerdict, 1000);
refreshVerdict();

analyzeBtn.addEventListener("click", async () => {
  if (!currentVerdictData) return; // anti-cheat gate: handler returns immediately, matching the web app's rule

  const attempt = {
    id: `ext-${Date.now()}`,
    problemSlug: currentVerdictData.problemSlug,
    problemTitle: currentVerdictData.problemTitle,
    platform: "leetcode",
    language: "unknown",
    code: codeInput.value,
    verdict: currentVerdictData.verdict,
    timestamp: currentVerdictData.detectedAt,
  };

  feedbackDiv.textContent = "Analyzing…";
  analyzeBtn.disabled = true;

  try {
    const res = await fetch("http://localhost:3000/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attempt, priorAttempts: [], session: null, screenshots: [] }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Request failed (${res.status})`);
    }

    const feedback = await res.json();
    attempt.analysis = feedback;

    // Bridge storage: same Attempt shape as the web app's localStorage,
    // so the JSON export/import feature can move this into the dashboard later.
    chrome.storage.local.get({ attempts: [] }, (result) => {
      const attempts = result.attempts;
      attempts.push(attempt);
      chrome.storage.local.set({ attempts });
    });

    renderFeedback(feedback);
  } catch (err) {
    feedbackDiv.textContent = "Error: " + err.message;
  } finally {
    analyzeBtn.disabled = false;
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
  if (feedback.nextDrill) {
    lines.push("");
    lines.push(`Next drill: ${feedback.nextDrill.title}`);
  }
  feedbackDiv.textContent = lines.join("\n");
}