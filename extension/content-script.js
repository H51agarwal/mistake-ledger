(function () {
  const VERDICT_PATTERNS = {
    Accepted: "AC",
    "Wrong Answer": "WA",
    "Time Limit Exceeded": "TLE",
    "Compile Error": "CE",
    "Runtime Error": "RE",
  };

  let lastSeen = null;

  function detectVerdict() {
    const bodyText = document.body.innerText;
    for (const [text, code] of Object.entries(VERDICT_PATTERNS)) {
      if (bodyText.includes(text)) return code;
    }
    return null;
  }

  function scrapeCode() {
    const area = document.querySelector(".monaco-editor textarea");
    if (area && area.value && area.value.trim()) return area.value;
    const lines = document.querySelectorAll(".view-lines .view-line");
    if (lines.length) {
      return Array.from(lines)
        .map((line) => line.textContent ?? "")
        .join("\n");
    }
    return "";
  }

  function scrapeLanguage() {
    const button = document.querySelector("[data-cy='lang-select']")
      ?? document.querySelector("button.rounded-md");
    const text = button?.textContent?.trim().split("\n")[0] ?? "";
    return text || "unknown";
  }

  function pushCode() {
    chrome.runtime.sendMessage({
      type: "SCRAPED_CODE",
      code: scrapeCode(),
      language: scrapeLanguage(),
    });
  }

  function maybeVerdict() {
    const verdict = detectVerdict();
    if (!verdict || verdict === lastSeen) return;
    lastSeen = verdict;
    const slugMatch = window.location.pathname.match(/\/problems\/([^/]+)/);
    chrome.runtime.sendMessage({
      type: "VERDICT_DETECTED",
      payload: {
        verdict,
        problemSlug: slugMatch ? slugMatch[1] : "unknown",
        problemTitle: document.title.replace(" - LeetCode", "").trim(),
        detectedAt: new Date().toISOString(),
        code: scrapeCode(),
        language: scrapeLanguage(),
      },
    });
  }

  const observer = new MutationObserver(() => {
    maybeVerdict();
    pushCode();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  setInterval(() => {
    maybeVerdict();
    pushCode();
  }, 3000);
  pushCode();
})();
