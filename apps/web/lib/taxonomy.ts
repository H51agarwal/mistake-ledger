import type { Feedback, TaxonomyTag } from "@shared/types";

export const TAXONOMY_TAGS: TaxonomyTag[] = [
  "syntax",
  "off-by-one",
  "wrong-ds",
  "tle-complexity",
  "overflow-modulo",
  "missed-constraint",
  "implementation-slip",
  "lucky-ac",
];

export const TAG_LABELS: Record<TaxonomyTag, string> = {
  syntax: "Syntax / compile error",
  "off-by-one": "Off-by-one",
  "wrong-ds": "Wrong data structure",
  "tle-complexity": "TLE / complexity",
  "overflow-modulo": "Overflow / modulo",
  "missed-constraint": "Missed constraint",
  "implementation-slip": "Implementation slip",
  "lucky-ac": "Lucky AC",
};

export const TAG_DESCRIPTIONS: Record<TaxonomyTag, string> = {
  syntax: "The code did not parse or the required function was missing.",
  "off-by-one": "A boundary index was wrong — first, last, or loop bound.",
  "wrong-ds": "The data structure does not match the access pattern.",
  "tle-complexity": "The approach is too slow for the input size.",
  "overflow-modulo": "Integer overflow or a missing modulo.",
  "missed-constraint": "An empty, negative, duplicate, or size constraint was ignored.",
  "implementation-slip": "The idea is close; a detail in the implementation is wrong.",
  "lucky-ac": "Accepted, but the solution is fragile or close to the time limit.",
};

export const NEXT_DRILLS: Record<TaxonomyTag, Feedback["nextDrill"]> = {
  syntax: {
    title: "Write the function skeleton first",
    reason: "Compile errors block every later lesson. Get a valid function in place, then iterate.",
  },
  "off-by-one": {
    title: "Binary Search bounds drill",
    reason: "Off-by-one is clustering on first/last indices. Rehearse lo/hi updates on a sorted array.",
  },
  "wrong-ds": {
    title: "Two Sum with a hash map",
    reason: "Practice swapping an O(n²) scan for an O(1) lookup structure.",
  },
  "tle-complexity": {
    title: "Kadane vs nested sums",
    reason: "A large hidden test is exposing a quadratic loop. Rewrite the hot path to O(n) or O(n log n).",
  },
  "overflow-modulo": {
    title: "Running sum with modulo",
    reason: "Check mid = lo + ((hi - lo) >> 1) and any product that can overflow.",
  },
  "missed-constraint": {
    title: "Empty / all-negative / no-pair cases",
    reason: "The hidden tests include empty, negative, and no-solution inputs. Cover those before the happy path.",
  },
  "implementation-slip": {
    title: "Re-read the failed test, then change one thing",
    reason: "The verdict is a local bug, not a wrong algorithm. Diff the expected and actual values first.",
  },
  "lucky-ac": {
    title: "Add the missing edge cases",
    reason: "The AC is close to the timeout or skips empty/first/last coverage. Harden it before the next problem.",
  },
};

export function emptyTagCounts(): Record<TaxonomyTag, number> {
  return {
    syntax: 0,
    "off-by-one": 0,
    "wrong-ds": 0,
    "tle-complexity": 0,
    "overflow-modulo": 0,
    "missed-constraint": 0,
    "implementation-slip": 0,
    "lucky-ac": 0,
  };
}

export function isTaxonomyTag(value: string): value is TaxonomyTag {
  return (TAXONOMY_TAGS as string[]).includes(value);
}
