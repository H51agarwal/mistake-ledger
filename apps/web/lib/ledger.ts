import type { Attempt, Feedback, TaxonomyTag } from "@shared/types";
import { emptyTagCounts, isTaxonomyTag } from "./taxonomy";

export const LEDGER_STORAGE_KEY = "mistake-ledger:attempts";

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function readAll(): Attempt[] {
  const raw = storage()?.getItem(LEDGER_STORAGE_KEY);
  if (!raw) return [];
  try {
    return parseAttemptsJSON(raw);
  } catch {
    return [];
  }
}

function writeAll(attempts: Attempt[]): void {
  storage()?.setItem(LEDGER_STORAGE_KEY, JSON.stringify(attempts));
}

export function saveAttempt(attempt: Attempt): void {
  const attempts = readAll().filter((item) => item.id !== attempt.id);
  attempts.push(attempt);
  attempts.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  writeAll(attempts);
}

export function getAttempts(problemSlug?: string): Attempt[] {
  const attempts = readAll();
  if (!problemSlug) return attempts;
  return attempts.filter((item) => item.problemSlug === problemSlug);
}

export function getAttempt(id: string): Attempt | undefined {
  return readAll().find((item) => item.id === id);
}

export function setAnalysis(id: string, analysis: Feedback): Attempt | null {
  const attempts = readAll();
  const index = attempts.findIndex((item) => item.id === id);
  if (index === -1) return null;
  const updated = { ...attempts[index], analysis };
  attempts[index] = updated;
  writeAll(attempts);
  return updated;
}

export function getAllTags(): Record<TaxonomyTag, number> {
  const counts = emptyTagCounts();
  for (const attempt of readAll()) {
    for (const tag of attempt.analysis?.tags ?? []) {
      if (isTaxonomyTag(tag)) counts[tag] += 1;
    }
  }
  return counts;
}

export function exportJSON(): string {
  return JSON.stringify(readAll(), null, 2);
}

export function importJSON(json: string): void {
  const incoming = parseAttemptsJSON(json);
  const byId = new Map(readAll().map((item) => [item.id, item]));
  for (const attempt of incoming) {
    byId.set(attempt.id, attempt);
  }
  writeAll([...byId.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp)));
}

export function clearAttempts(): void {
  writeAll([]);
}

export function parseAttemptsJSON(json: string): Attempt[] {
  const parsed: unknown = JSON.parse(json);
  const rows = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { attempts?: unknown }).attempts)
      ? (parsed as { attempts: unknown[] }).attempts
      : null;

  if (!rows) {
    throw new Error("importJSON: expected an Attempt array (or { attempts: Attempt[] }).");
  }

  const attempts = rows.map((row, index) => {
    if (!isAttempt(row)) {
      throw new Error(`importJSON: entry ${index} is not a valid Attempt.`);
    }
    return row;
  });

  return attempts;
}

function isAttempt(value: unknown): value is Attempt {
  if (!value || typeof value !== "object") return false;
  const attempt = value as Partial<Attempt>;
  return (
    typeof attempt.id === "string" &&
    typeof attempt.problemSlug === "string" &&
    typeof attempt.problemTitle === "string" &&
    (attempt.platform === "mock" || attempt.platform === "leetcode") &&
    typeof attempt.language === "string" &&
    typeof attempt.code === "string" &&
    (attempt.verdict === "AC" ||
      attempt.verdict === "WA" ||
      attempt.verdict === "TLE" ||
      attempt.verdict === "CE" ||
      attempt.verdict === "RE") &&
    typeof attempt.timestamp === "string"
  );
}
