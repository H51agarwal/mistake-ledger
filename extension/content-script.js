(function () {
  const VERDICT_PATTERNS = {
    Accepted: "AC",
    "Wrong Answer": "WA",
    "Time Limit Exceeded": "TLE",
    "Compile Error": "CE",
    "Runtime Error": "RE",
  };

  let lastSeen = null;
  let lastPath = location.pathname;

  function nearbyLooksLikeJudgeResult(el) {
    let node = el;
    for (let i = 0; i < 6 && node; i += 1) {
      const text = node.textContent ?? "";
      if (/Runtime|Memory|Beats|testcases?\s+passed|Case\s*1/i.test(text)) return true;
      node = node.parentElement;
    }
    return false;
  }

  function detectVerdict() {
    const locators = document.querySelectorAll(
      '[data-e2e-locator="submission-result"], [data-e2e-locator="console-result"], [data-e2e-locator="console-submit-result"]',
    );
    for (const node of locators) {
      const text = (node.textContent ?? "").trim();
      for (const [label, code] of Object.entries(VERDICT_PATTERNS)) {
        if (text === label || text.startsWith(`${label}\n`) || text.startsWith(`${label} `)) {
          return code;
        }
      }
    }

    const nodes = document.querySelectorAll("div, span, p, h1, h2, h3, h4");
    for (const el of nodes) {
      const text = (el.textContent ?? "").trim();
      for (const [label, code] of Object.entries(VERDICT_PATTERNS)) {
        if (text !== label) continue;
        if (nearbyLooksLikeJudgeResult(el)) return code;
      }
    }

    const panel = document.body.innerText;
    if (/Wrong Answer[\s\S]{0,120}(Runtime|Output|Expected)/i.test(panel)) return "WA";
    if (/Time Limit Exceeded[\s\S]{0,80}(Runtime|ms)/i.test(panel)) return "TLE";
    if (/Compile Error[\s\S]{0,80}(Line|error)/i.test(panel)) return "CE";
    if (/Runtime Error[\s\S]{0,80}(Line|error)/i.test(panel)) return "RE";
    if (/Accepted[\s\S]{0,120}(Runtime|testcases?\s+passed)/i.test(panel)) return "AC";
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

  function normalizeLang(raw) {
    const key = (raw ?? "").trim().toLowerCase().split("\n")[0].replace(/\s+/g, " ");
    if (!key) return "unknown";
    if (key.startsWith("c++") || key === "cpp" || key === "c") return "cpp";
    if (key.startsWith("python") || key === "py") return "python";
    if (key.startsWith("javascript") || key === "js") return "javascript";
    if (key.startsWith("typescript") || key === "ts") return "typescript";
    if (key.startsWith("java") && key !== "javascript") return "java";
    if (key === "c#" || key === "csharp") return "csharp";
    if (key === "go" || key === "golang") return "go";
    return "unknown";
  }

  function inferLangFromCode(code) {
    const text = code ?? "";
    if (/#include\s*<|std::|vector\s*<|unordered_map\s*<|public\s*:/.test(text)) return "cpp";
    if (/def\s+\w+\s*\(|class\s+Solution\s*:|elif\s+/.test(text) && !/function\s+|=>/.test(text)) return "python";
    if (/public\s+class\s+|HashMap\s*</.test(text)) return "java";
    if (/function\s+\w+|const\s+\w+\s*=|=>\s*\{/.test(text)) return "javascript";
    return "unknown";
  }

  function scrapeLanguage() {
    const nodes = document.querySelectorAll(
      "[data-cy='lang-select'], [id^='headlessui-listbox-button'], button[aria-haspopup='listbox']",
    );
    for (const node of nodes) {
      const lang = normalizeLang(node.textContent ?? "");
      if (lang !== "unknown") return lang;
    }
    return inferLangFromCode(scrapeCode());
  }

  function alive() {
    return Boolean(chrome.runtime?.id);
  }

  function safeSend(message) {
    if (!alive()) return;
    try {
      chrome.runtime.sendMessage(message, () => {
        void chrome.runtime.lastError;
      });
    } catch {
      // Extension was reloaded; this old content script is stale.
    }
  }

  function pushCode() {
    safeSend({
      type: "SCRAPED_CODE",
      code: scrapeCode(),
      language: scrapeLanguage(),
    });
  }

  function maybeVerdict() {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      lastSeen = null;
    }
    const verdict = detectVerdict();
    if (!verdict || verdict === lastSeen) return;
    lastSeen = verdict;
    const slugMatch = window.location.pathname.match(/\/problems\/([^/]+)/);
    safeSend({
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
    if (!alive()) {
      observer.disconnect();
      return;
    }
    maybeVerdict();
    pushCode();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  const timer = setInterval(() => {
    if (!alive()) {
      clearInterval(timer);
      observer.disconnect();
      return;
    }
    maybeVerdict();
    pushCode();
  }, 2000);
  maybeVerdict();
  pushCode();
})();
