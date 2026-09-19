import type { Attempt, Feedback, Session, TaxonomyTag } from "@shared/types";
import { buildChainNote } from "./diff";
import { buildImprovementNote, distinctErrorHistory } from "./improvement";
import { NEXT_DRILLS, TAG_DESCRIPTIONS } from "./taxonomy";

const NEAR_TIMEOUT_MS = 1600;

export function classify(
  attempt: Attempt,
  priorAttempts: Attempt[] = [],
  session?: Session | null,
): Feedback {
  const tags = chooseTags(attempt);
  const chainNote = buildChainNote([...priorAttempts, attempt]);
  const complexity = estimateComplexity(attempt.code);
  const lineNotes = buildLineNotes(attempt, tags);
  const primary = tags[0];
  const errorHistory = distinctErrorHistory(session);
  const improvementNote = buildImprovementNote(session);

  return {
    tags,
    summary: buildSummary(attempt, tags),
    whatWentWrong: buildWentWrong(attempt, tags, errorHistory, session),
    whatWentWell: buildWentWell(attempt, tags, improvementNote),
    lineNotes,
    complexity,
    nextDrill: primary ? NEXT_DRILLS[primary] : {
      title: "Next problem in the set",
      reason: "No recurring failure tag on this attempt.",
    },
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
      return hasNestedLoops(attempt.code) ? ["tle-complexity"] : ["missed-constraint"];
    }
    return ["implementation-slip"];
  }

  return ["implementation-slip"];
}

function isLuckyAc(attempt: Attempt): boolean {
  if ((attempt.runtimeMs ?? 0) >= NEAR_TIMEOUT_MS) return true;
  return !hasEdgeCoverage(attempt.code);
}

function hasEdgeCoverage(code: string): boolean {
  return (
    /\.length/.test(code) ||
    /=== 0/.test(code) ||
    /== 0/.test(code) ||
    /nums\.length - 1/.test(code) ||
    /hi\s*=/.test(code) ||
    /lo\s*=/.test(code) ||
    /stack/.test(code)
  );
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

export function hasNestedLoops(code: string): boolean {
  return /for\s*\([^)]*\)\s*\{[\s\S]{0,400}for\s*\(/.test(code)
    || /for\s*\([^)]*\)\s*\{[\s\S]{0,400}while\s*\(/.test(code)
    || /while\s*\([^)]*\)\s*\{[\s\S]{0,400}for\s*\(/.test(code);
}

function estimateComplexity(code: string): Feedback["complexity"] {
  if (hasNestedLoops(code)) {
    return { estimated: "O(n²)", vsConstraints: "Likely too slow once n reaches the hidden TLE tests." };
  }
  if (/while\s*\(/.test(code) && /mid/.test(code)) {
    return { estimated: "O(log n)", vsConstraints: "Fits typical n ≤ 10^5 if the loop actually shrinks." };
  }
  return { estimated: "O(n)", vsConstraints: "Should fit typical n ≤ 10^5." };
}

function buildSummary(attempt: Attempt, tags: TaxonomyTag[]): string {
  if (attempt.verdict === "AC" && tags.length === 0) {
    return `${attempt.problemTitle} accepted. The attempt looks solid — no mistake tag.`;
  }
  if (attempt.verdict === "AC") {
    return `${attempt.problemTitle} accepted, but tagged ${tags.join(", ")}. Treat this as a near-miss, not a free pass.`;
  }
  const tag = tags[0];
  const hint = tag ? TAG_DESCRIPTIONS[tag] : "The classifier fell back to a generic slip.";
  return `${attempt.verdict} on ${attempt.problemTitle}. ${hint}`;
}

function buildWentWrong(
  attempt: Attempt,
  tags: TaxonomyTag[],
  errorHistory: string[] = [],
  session?: Session | null,
): string[] {
  const notes: string[] = [];
  if (attempt.verdict !== "AC") {
    notes.push(`Judge verdict: ${attempt.verdict}.`);
  }
  if (attempt.failedTest) {
    notes.push(
      `Failed test input ${attempt.failedTest.input || "(empty)"} — expected ${attempt.failedTest.expected}, got ${attempt.failedTest.actual}.`,
    );
  }
  for (const tag of tags) {
    notes.push(TAG_DESCRIPTIONS[tag]);
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

function buildWentWell(attempt: Attempt, tags: TaxonomyTag[], improvementNote?: string): string[] {
  if (attempt.verdict === "AC" && !tags.includes("lucky-ac")) {
    return ["The function matched every hidden test, including the WA and TLE traps."];
  }
  if (attempt.verdict === "AC") {
    return ["It passed, so the core idea is close enough to keep."];
  }
  if (improvementNote) {
    return [improvementNote];
  }
  if (attempt.verdict !== "CE") {
    return ["The function compiled and ran, so the remaining work is logic, not syntax."];
  }
  return [];
}

function buildLineNotes(attempt: Attempt, tags: TaxonomyTag[]): Feedback["lineNotes"] {
  const notes: Feedback["lineNotes"] = [];
  if (tags.includes("off-by-one")) {
    const line = findLine(attempt.code, /for\s*\(|while\s*\(|hi\s*=|lo\s*=|length\s*-\s*1/);
    if (line) notes.push({ line, note: "Check this bound — first/last index failures usually start here." });
  }
  if (tags.includes("tle-complexity")) {
    const line = findLine(attempt.code, /for\s*\(/);
    if (line) notes.push({ line, note: "Nested or full-scan loops over a large input will TLE." });
  }
  if (tags.includes("syntax")) {
    notes.push({ line: 1, note: "The required function did not parse. Fix the skeleton before debugging logic." });
  }
  return notes;
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
