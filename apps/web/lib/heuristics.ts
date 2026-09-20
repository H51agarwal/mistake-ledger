import type { Attempt, Feedback, Session, TaxonomyTag } from "@shared/types";
import { buildChainNote } from "./diff";
import { buildImprovementNote, distinctErrorHistory } from "./improvement";
import { languageTitle, resolveLanguage, type CodeLanguage } from "./language";
import { NEXT_DRILLS, TAG_DESCRIPTIONS } from "./taxonomy";

const NEAR_TIMEOUT_MS = 1600;

export function classify(
  attempt: Attempt,
  priorAttempts: Attempt[] = [],
  session?: Session | null,
): Feedback {
  const language = resolveLanguage(attempt.language, attempt.code);
  const tagged = { ...attempt, language };
  const tags = chooseTags(tagged);
  if (looksLikeMidOverflow(tagged.code, language) && !tags.includes("overflow-modulo")) {
    tags.push("overflow-modulo");
  }
  const chainNote = buildChainNote([...priorAttempts, tagged]);
  const complexity = estimateComplexity(tagged.code, language);
  const lineNotes = buildLineNotes(tagged, tags, language);
  const primary = tags[0];
  const errorHistory = distinctErrorHistory(session);
  const improvementNote = buildImprovementNote(session);

  return {
    tags,
    summary: buildSummary(tagged, tags, language),
    whatWentWrong: buildWentWrong(tagged, tags, errorHistory, session, language),
    whatWentWell: buildWentWell(tagged, tags, language, improvementNote),
    lineNotes,
    complexity,
    nextDrill: nextDrillFor(primary, language),
    ...(chainNote ? { chainNote } : {}),
    ...(improvementNote ? { improvementNote } : {}),
    ...(errorHistory.length ? { errorHistory } : {}),
  };
}

export function chooseTags(attempt: Attempt): TaxonomyTag[] {
  if (attempt.verdict === "CE") return ["syntax"];
  if (attempt.verdict === "TLE") return ["tle-complexity"];

  if (attempt.verdict === "AC") {
    if (isLuckyAc(attempt)) return ["lucky-ac"];
    return [];
  }

  if (attempt.verdict === "WA") {
    if (isOffByOne(attempt)) return ["off-by-one"];
    if (isLargeInputFailure(attempt)) {
      return hasNestedLoops(attempt.code, attempt.language) ? ["tle-complexity"] : ["missed-constraint"];
    }
    return ["implementation-slip"];
  }

  return ["implementation-slip"];
}

function isLuckyAc(attempt: Attempt): boolean {
  if ((attempt.runtimeMs ?? 0) >= NEAR_TIMEOUT_MS) return true;
  return !hasEdgeCoverage(attempt.code, attempt.language);
}

function hasEdgeCoverage(code: string, language?: string): boolean {
  const lang = resolveLanguage(language, code);
  if (/\blo\s*=|\bhi\s*=|\bleft\s*=|\bright\s*=|\bstack\b/.test(code)) return true;
  if (/==\s*0|!=\s*0|===\s*0/.test(code)) return true;
  if (lang === "python") {
    return /len\s*\(|if\s+not\s+|\[-1\]|\.empty\(/.test(code);
  }
  if (lang === "cpp" || lang === "java" || lang === "csharp") {
    return /\.size\s*\(|\.empty\s*\(|\.length\b|n\s*-\s*1|begin\s*\(|end\s*\(|\.count\s*\(/.test(code);
  }
  return /\.length|nums\.length\s*-\s*1/.test(code);
}

function isOffByOne(attempt: Attempt): boolean {
  const failed = attempt.failedTest;
  if (!failed) return false;

  const haystack = `${failed.input} ${failed.expected} ${failed.actual}`.toLowerCase();
  if (/first index|last index|empty array|empty string|loop bound/.test(haystack)) {
    return true;
  }

  // Index results only — do not treat numeric sums like -1 vs 0 as off-by-one.
  if (attempt.problemSlug !== "binary-search") return false;

  const expected = parseJson(failed.expected);
  const actual = parseJson(failed.actual);
  if (typeof expected === "number" && typeof actual === "number") {
    if (expected === 0 && actual === -1) return true;
    if (expected === -1 && actual === 0) return true;
    if (expected >= 0 && Math.abs(expected - actual) === 1) return true;
  }

  return false;
}

function isLargeInputFailure(attempt: Attempt): boolean {
  const input = attempt.failedTest?.input ?? "";
  if (/tle|n=\d{3,}|deep nesting/.test(input)) return true;
  return input.length > 400;
}

export function hasNestedLoops(code: string, language?: string): boolean {
  const lang = resolveLanguage(language, code);
  if (lang === "python") {
    return (
      /for\s+\w+\s+in[\s\S]{0,400}for\s+\w+\s+in/.test(code) ||
      /for\s+\w+\s+in[\s\S]{0,400}while\s+/.test(code) ||
      /while\s+.+:[\s\S]{0,400}for\s+\w+\s+in/.test(code)
    );
  }
  return (
    /for\s*\([^)]*\)\s*\{[\s\S]{0,400}for\s*\(/.test(code) ||
    /for\s*\([^)]*\)\s*\{[\s\S]{0,400}while\s*\(/.test(code) ||
    /while\s*\([^)]*\)\s*\{[\s\S]{0,400}for\s*\(/.test(code)
  );
}

function looksLikeMidOverflow(code: string, language: CodeLanguage): boolean {
  if (language !== "cpp" && language !== "java" && language !== "csharp") return false;
  if (/lo\s*\+\s*\(\s*\(\s*hi\s*-\s*lo/.test(code)) return false;
  return /\(\s*(lo|left)\s*\+\s*(hi|right)\s*\)\s*\/\s*2/.test(code);
}

function estimateComplexity(code: string, language: CodeLanguage): Feedback["complexity"] {
  if (hasNestedLoops(code, language)) {
    return { estimated: "O(n²)", vsConstraints: "Likely too slow once n reaches the hidden TLE tests." };
  }
  if ((/while\s*\(/.test(code) || /while\s+.+:/.test(code)) && /mid/.test(code)) {
    return { estimated: "O(log n)", vsConstraints: "Fits typical n ≤ 10^5 if the loop actually shrinks." };
  }
  if (hasLookupStructure(code, language)) {
    return { estimated: "O(n)", vsConstraints: "Hash / map lookups should fit typical n ≤ 10^5." };
  }
  return { estimated: "O(n)", vsConstraints: "Should fit typical n ≤ 10^5." };
}

function hasLookupStructure(code: string, language: CodeLanguage): boolean {
  if (language === "python") return /\bdict\b|\bset\b|defaultdict|Counter\b|\{\}/.test(code);
  if (language === "cpp") return /unordered_map|unordered_set|\bmap\s*<|\bset\s*</.test(code);
  if (language === "java") return /HashMap|HashSet|TreeMap/.test(code);
  return /\bMap\b|new Set\b|new Map\b/.test(code);
}

function buildSummary(attempt: Attempt, tags: TaxonomyTag[], language: CodeLanguage): string {
  if (attempt.verdict === "AC" && tags.length === 0) {
    return `${attempt.problemTitle} accepted. The attempt looks solid — no mistake tag.`;
  }
  if (attempt.verdict === "AC") {
    return `${attempt.problemTitle} accepted, but tagged ${tags.join(", ")}. Treat this as a near-miss, not a free pass.`;
  }
  const tag = tags[0];
  const hint = tag ? tagDescription(tag, language) : "The classifier fell back to a generic slip.";
  return `${attempt.verdict} on ${attempt.problemTitle} (${languageTitle(language)}). ${hint}`;
}

function buildWentWrong(
  attempt: Attempt,
  tags: TaxonomyTag[],
  errorHistory: string[] = [],
  session?: Session | null,
  language: CodeLanguage = "unknown",
): string[] {
  const notes: string[] = [];
  if (attempt.verdict !== "AC") {
    notes.push(`Judge verdict: ${attempt.verdict} (${languageTitle(language)}).`);
  }
  if (attempt.failedTest) {
    notes.push(
      `Failed test input ${attempt.failedTest.input || "(empty)"} — expected ${attempt.failedTest.expected}, got ${attempt.failedTest.actual}.`,
    );
  }
  for (const tag of tags) {
    notes.push(tagDescription(tag, language));
  }
  if (errorHistory.length > 1) {
    notes.push(`This session recorded ${errorHistory.length} distinct errors before Analyze.`);
  }
  const events = session?.events ?? [];
  const shots = events.filter((event) => event.kind === "screenshot").length;
  const runs = events.filter((event) => event.kind === "run-error" || event.kind === "run-ok" || event.kind === "submit").length;
  if (shots > 0) {
    notes.push(
      `Coding-phase observer: ${shots} silent screenshot(s) and ${runs} run/submit event(s) were recorded before Analyze.`,
    );
  } else {
    notes.push("No silent screenshots were stored — Watch screen was not running in this sitting.");
  }
  return notes;
}

function buildWentWell(
  attempt: Attempt,
  tags: TaxonomyTag[],
  language: CodeLanguage,
  improvementNote?: string,
): string[] {
  if (attempt.verdict === "AC" && !tags.includes("lucky-ac")) {
    return [`The ${languageTitle(language)} submission matched every hidden test, including the WA and TLE traps.`];
  }
  if (attempt.verdict === "AC") {
    return ["It passed, so the core idea is close enough to keep."];
  }
  if (improvementNote) {
    return [improvementNote];
  }
  if (attempt.verdict !== "CE") {
    if (language === "python") {
      return ["The file ran, so the remaining work is logic, not syntax."];
    }
    return ["The submission compiled and ran, so the remaining work is logic, not syntax."];
  }
  return [];
}

function buildLineNotes(
  attempt: Attempt,
  tags: TaxonomyTag[],
  language: CodeLanguage,
): Feedback["lineNotes"] {
  const notes: Feedback["lineNotes"] = [];
  if (tags.includes("off-by-one")) {
    const line = findLine(
      attempt.code,
      /for\s*\(|for\s+\w+\s+in|while\s*\(|while\s+|hi\s*=|lo\s*=|left\s*=|right\s*=|length\s*-\s*1|\.size\s*\(|len\s*\(/,
    );
    if (line) notes.push({ line, note: boundNote(language) });
  }
  if (tags.includes("tle-complexity")) {
    const line = findLine(attempt.code, /for\s*\(|for\s+\w+\s+in/);
    if (line) notes.push({ line, note: tleNote(language) });
  }
  if (tags.includes("overflow-modulo")) {
    const line = findLine(attempt.code, /\(\s*(lo|left)\s*\+\s*(hi|right)\s*\)/);
    if (line) {
      notes.push({
        line,
        note: "mid = (lo + hi) / 2 can overflow in C++/Java. Prefer lo + (hi - lo) / 2.",
      });
    }
  }
  if (tags.includes("syntax")) {
    const line =
      findLine(attempt.code, /class\s+Solution|def\s+|function\s+|public\s*:|#include/) ?? 1;
    notes.push({ line, note: syntaxLineNote(language) });
  }
  return notes;
}

function tagDescription(tag: TaxonomyTag, language: CodeLanguage): string {
  if (tag === "syntax") {
    if (language === "cpp") {
      return "Compile error — check includes, the Solution method signature, types, and missing semicolons.";
    }
    if (language === "python") {
      return "The file did not run — check indentation, the def signature, and missing colons.";
    }
    if (language === "java") {
      return "Compile error — check the class/method signature and types.";
    }
  }
  return TAG_DESCRIPTIONS[tag];
}

function boundNote(language: CodeLanguage): string {
  if (language === "python") {
    return "Check this bound — Python range() is exclusive on the right, and [-1] is last, not first.";
  }
  if (language === "cpp") {
    return "Check this bound — first/last index bugs usually live in < vs <= or nums.size() - 1.";
  }
  return "Check this bound — first/last index failures usually start here.";
}

function tleNote(language: CodeLanguage): string {
  if (language === "python") {
    return "Nested for/in loops over a large input will TLE. A set/dict lookup is usually the missing step.";
  }
  if (language === "cpp") {
    return "Nested or full-scan loops over a large input will TLE. Prefer unordered_map / two pointers.";
  }
  return "Nested or full-scan loops over a large input will TLE.";
}

function syntaxLineNote(language: CodeLanguage): string {
  if (language === "cpp") {
    return "Fix includes and the Solution method signature before debugging logic.";
  }
  if (language === "python") {
    return "Fix indentation and the def signature before debugging logic.";
  }
  if (language === "java") {
    return "Fix the class/method signature before debugging logic.";
  }
  return "The required function did not parse. Fix the skeleton before debugging logic.";
}

function nextDrillFor(primary: TaxonomyTag | undefined, language: CodeLanguage): Feedback["nextDrill"] {
  if (!primary) {
    return {
      title: "Next problem in the set",
      reason: "No recurring failure tag on this attempt.",
    };
  }
  if (primary === "syntax") {
    if (language === "cpp") {
      return {
        title: "Compile a valid Solution method first",
        reason: "C++ compile errors block every later lesson. Match the LeetCode signature, then iterate.",
      };
    }
    if (language === "python") {
      return {
        title: "Get a valid def in place first",
        reason: "Indentation and signature errors block every later lesson. Get the method running, then iterate.",
      };
    }
  }
  return NEXT_DRILLS[primary];
}

function findLine(code: string, pattern: RegExp): number | null {
  const lines = code.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) return i + 1;
  }
  return null;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
