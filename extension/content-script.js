(function () {
  const VERDICT_PATTERNS = {
    "Accepted": "AC",
    "Wrong Answer": "WA",
    "Time Limit Exceeded": "TLE",
    "Compile Error": "CE",
    "Runtime Error": "RE",
  };

  let lastSeen = null;

  function detectVerdict() {
    const bodyText = document.body.innerText;
    for (const [text, code] of Object.entries(VERDICT_PATTERNS)) {
      if (bodyText.includes(text)) {
        return code;
      }
    }
    return null;
  }

  const observer = new MutationObserver(() => {
    const verdict = detectVerdict();
    if (verdict && verdict !== lastSeen) {
      lastSeen = verdict;
      const slugMatch = window.location.pathname.match(/\/problems\/([^/]+)/);
      chrome.runtime.sendMessage({
        type: "VERDICT_DETECTED",
        payload: {
          verdict,
          problemSlug: slugMatch ? slugMatch[1] : "unknown",
          problemTitle: document.title.replace(" - LeetCode", "").trim(),
          detectedAt: new Date().toISOString(),
        },
      });
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();