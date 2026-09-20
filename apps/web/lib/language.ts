export type CodeLanguage =
  | "javascript"
  | "typescript"
  | "python"
  | "cpp"
  | "java"
  | "csharp"
  | "go"
  | "rust"
  | "kotlin"
  | "unknown";

const LABEL_MAP: Record<string, CodeLanguage> = {
  js: "javascript",
  javascript: "javascript",
  node: "javascript",
  nodejs: "javascript",
  ts: "typescript",
  typescript: "typescript",
  py: "python",
  python: "python",
  python3: "python",
  python2: "python",
  "c++": "cpp",
  cpp: "cpp",
  "c++14": "cpp",
  "c++17": "cpp",
  "c++20": "cpp",
  "gnu c++": "cpp",
  c: "cpp",
  java: "java",
  "c#": "csharp",
  csharp: "csharp",
  golang: "go",
  go: "go",
  rust: "rust",
  kotlin: "kotlin",
};

export function normalizeLanguageLabel(raw: string | undefined | null): CodeLanguage {
  const key = (raw ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!key || key === "unknown") return "unknown";
  if (LABEL_MAP[key]) return LABEL_MAP[key];
  if (key.startsWith("c++")) return "cpp";
  if (key.startsWith("python")) return "python";
  if (key.startsWith("javascript")) return "javascript";
  if (key.startsWith("typescript")) return "typescript";
  if (key.startsWith("java")) return "java";
  return "unknown";
}

export function inferLanguageFromCode(code: string): CodeLanguage {
  const text = code ?? "";
  if (!text.trim()) return "unknown";

  if (/#include\s*<|std::|vector\s*<|unordered_map\s*<|nullptr\b/.test(text)) return "cpp";
  if (/class\s+Solution\s*\{[\s\S]{0,120}public\s*:/.test(text)) return "cpp";
  if (/public\s+class\s+\w+|HashMap\s*<|public\s+static\s+void\s+main/.test(text)) return "java";
  if (/class\s+Solution\s*\{[\s\S]{0,120}public\s+\w/.test(text)) return "java";
  if (
    (/def\s+\w+\s*\(|class\s+\w+\s*:|elif\s+|self\s*,/.test(text) || /class\s+Solution\s*:/.test(text)) &&
    !/function\s+|=>/.test(text)
  ) {
    return "python";
  }
  if (/function\s+\w+|const\s+\w+\s*=|let\s+\w+|=>\s*\{|console\.log/.test(text)) return "javascript";
  if (/fn\s+\w+|let\s+mut\s+|HashMap::/.test(text)) return "rust";
  if (/func\s+\w+|package\s+main/.test(text)) return "go";
  return "unknown";
}

export function resolveLanguage(declared: string | undefined | null, code: string): CodeLanguage {
  const fromLabel = normalizeLanguageLabel(declared);
  if (fromLabel !== "unknown") return fromLabel;
  return inferLanguageFromCode(code);
}

export function languageTitle(language: CodeLanguage): string {
  switch (language) {
    case "cpp":
      return "C++";
    case "csharp":
      return "C#";
    case "javascript":
      return "JavaScript";
    case "typescript":
      return "TypeScript";
    case "python":
      return "Python";
    case "unknown":
      return "the submitted language";
    default:
      return language;
  }
}
