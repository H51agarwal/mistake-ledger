import type { Attempt } from "@shared/types";

export type LineDiff = {
  added: string[];
  removed: string[];
};

export function diffLines(before: string, after: string): LineDiff {
  const prev = new Set(splitLines(before));
  const next = new Set(splitLines(after));
  return {
    added: [...next].filter((line) => !prev.has(line)),
    removed: [...prev].filter((line) => !next.has(line)),
  };
}

export function buildChainNote(attempts: Attempt[]): string | undefined {
  const chain = [...attempts].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  if (chain.length < 2) return undefined;

  const parts: string[] = [];
  for (let i = 1; i < chain.length; i++) {
    parts.push(describeStep(chain[i - 1], chain[i], i + 1));
  }
  return parts.join(" ");
}

function describeStep(prev: Attempt, curr: Attempt, tryNumber: number): string {
  const { added, removed } = diffLines(prev.code, curr.code);
  const boundFix = looksLikeBoundFix(added, removed);

  if (prev.verdict !== "AC" && curr.verdict === "AC") {
    if (boundFix) return `Fixed the loop bound on try ${tryNumber}.`;
    if (added.length === 0 && removed.length === 0) {
      return `Try ${tryNumber} reached AC without a visible code change.`;
    }
    return `Fixed the failing case on try ${tryNumber}.`;
  }

  if (curr.verdict === prev.verdict) {
    if (boundFix) return `Adjusted the loop bound on try ${tryNumber}; still ${curr.verdict}.`;
    if (added.length === 0 && removed.length === 0) {
      return `Try ${tryNumber} was unnecessary — the code did not change.`;
    }
    return `Try ${tryNumber} still ${curr.verdict} after a local edit.`;
  }

  return `Try ${tryNumber} went ${prev.verdict} → ${curr.verdict}.`;
}

function looksLikeBoundFix(added: string[], removed: string[]): boolean {
  const text = [...added, ...removed].join("\n");
  return /lo|hi|mid|length\s*-\s*1|<=|>=/.test(text);
}

function splitLines(code: string): string[] {
  return code
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}
