import type { Attempt } from "@shared/types";
import { classify } from "./heuristics";
import { buildChainNote } from "./diff";
import { clearAttempts, saveAttempt, getAttempts } from "./ledger";

const TWO_SUM_HASH = `function twoSum(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];
    if (seen.has(need)) return [seen.get(need), i];
    seen.set(nums[i], i);
  }
  return [];
}`;

const TWO_SUM_SAME_INDEX = `function twoSum(nums, target) {
  for (let i = 0; i < nums.length; i++) {
    for (let j = 0; j < nums.length; j++) {
      if (nums[i] + nums[j] === target) return [i, j];
    }
  }
  return [];
}`;

const TWO_SUM_NESTED = `function twoSum(nums, target) {
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) {
      if (nums[i] + nums[j] === target) return [i, j];
    }
  }
  return [];
}`;

const SEARCH_MISS_LAST = `function search(nums, target) {
  let lo = 0;
  let hi = nums.length - 2;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (nums[mid] === target) return mid;
    if (nums[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}`;

const SEARCH_LO_LT_HI = `function search(nums, target) {
  let lo = 0;
  let hi = nums.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (nums[mid] === target) return mid;
    if (nums[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return nums[lo] === target ? lo : -1;
}`;

const SEARCH_OK = `function search(nums, target) {
  let lo = 0;
  let hi = nums.length - 1;
  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (nums[mid] === target) return mid;
    if (nums[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}`;

const MAX_ZERO_DEFAULT = `function maxSubArray(nums) {
  let best = 0;
  let cur = 0;
  for (let i = 0; i < nums.length; i++) {
    cur = Math.max(0, cur + nums[i]);
    best = Math.max(best, cur);
  }
  return best;
}`;

const MAX_OK = `function maxSubArray(nums) {
  let best = nums[0];
  let cur = nums[0];
  for (let i = 1; i < nums.length; i++) {
    cur = Math.max(nums[i], cur + nums[i]);
    best = Math.max(best, cur);
  }
  return best;
}`;

const PAREN_NO_EMPTY = `function isValid(s) {
  if (!s) return false;
  const stack = [];
  const pair = { ")": "(", "]": "[", "}": "{" };
  for (const ch of s) {
    if (ch === "(" || ch === "[" || ch === "{") stack.push(ch);
    else if (stack.pop() !== pair[ch]) return false;
  }
  return stack.length === 0;
}`;

const PAREN_OK = `function isValid(s) {
  const stack = [];
  const pair = { ")": "(", "]": "[", "}": "{" };
  for (const ch of s) {
    if (ch === "(" || ch === "[" || ch === "{") stack.push(ch);
    else if (stack.pop() !== pair[ch]) return false;
  }
  return stack.length === 0;
}`;

function at(hoursAgo: number): string {
  return new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
}

export function buildSeedAttempts(): Attempt[] {
  const rows: Attempt[] = [];
  const push = (partial: Omit<Attempt, "analysis" | "platform" | "language"> & Partial<Attempt>) => {
    const row: Attempt = {
      platform: "mock",
      language: "javascript",
      analysis: null,
      ...partial,
    };
    const prior = rows.filter((item) => item.problemSlug === row.problemSlug);
    rows.push({ ...row, analysis: classify(row, prior) });
  };

  push({
    id: "seed-bs-1",
    problemSlug: "binary-search",
    problemTitle: "Binary Search",
    code: SEARCH_MISS_LAST,
    verdict: "WA",
    runtimeMs: 4,
    failedTest: { input: "target is last index", expected: "4", actual: "-1" },
    timestamp: at(30),
  });
  push({
    id: "seed-bs-2",
    problemSlug: "binary-search",
    problemTitle: "Binary Search",
    code: SEARCH_LO_LT_HI,
    verdict: "WA",
    runtimeMs: 5,
    failedTest: { input: "empty array target=1", expected: "-1", actual: "TypeError" },
    timestamp: at(28),
  });
  push({
    id: "seed-bs-3",
    problemSlug: "binary-search",
    problemTitle: "Binary Search",
    code: SEARCH_OK,
    verdict: "AC",
    runtimeMs: 3,
    failedTest: null,
    timestamp: at(27),
  });

  const offByOneWas: Array<Pick<Attempt, "id" | "problemSlug" | "problemTitle" | "code" | "failedTest" | "timestamp">> = [
    {
      id: "seed-bs-4",
      problemSlug: "binary-search",
      problemTitle: "Binary Search",
      code: SEARCH_MISS_LAST,
      failedTest: { input: "target is first index", expected: "0", actual: "-1" },
      timestamp: at(20),
    },
    {
      id: "seed-bs-5",
      problemSlug: "binary-search",
      problemTitle: "Binary Search",
      code: SEARCH_MISS_LAST,
      failedTest: { input: "single element hit", expected: "0", actual: "-1" },
      timestamp: at(19),
    },
    {
      id: "seed-paren-1",
      problemSlug: "valid-parentheses",
      problemTitle: "Valid Parentheses",
      code: PAREN_NO_EMPTY,
      failedTest: { input: "empty string", expected: "true", actual: "false" },
      timestamp: at(18),
    },
    {
      id: "seed-bs-7",
      problemSlug: "binary-search",
      problemTitle: "Binary Search",
      code: SEARCH_MISS_LAST,
      failedTest: { input: "target is last index", expected: "4", actual: "-1" },
      timestamp: at(16),
    },
    {
      id: "seed-bs-6",
      problemSlug: "binary-search",
      problemTitle: "Binary Search",
      code: SEARCH_LO_LT_HI,
      failedTest: { input: "target is last index", expected: "4", actual: "3" },
      timestamp: at(12),
    },
  ];

  for (const row of offByOneWas) {
    push({
      ...row,
      verdict: "WA",
      runtimeMs: 6,
    });
  }

  push({
    id: "seed-two-1",
    problemSlug: "two-sum",
    problemTitle: "Two Sum",
    code: TWO_SUM_SAME_INDEX,
    verdict: "WA",
    runtimeMs: 8,
    failedTest: { input: "duplicates [3,3] target=6", expected: "[0,1]", actual: "[0,0]" },
    timestamp: at(14),
  });
  push({
    id: "seed-two-2",
    problemSlug: "two-sum",
    problemTitle: "Two Sum",
    code: TWO_SUM_NESTED,
    verdict: "WA",
    runtimeMs: 9,
    failedTest: { input: "no-solution [1,2,3] target=7", expected: "[]", actual: "undefined" },
    timestamp: at(13),
  });
  push({
    id: "seed-two-3",
    problemSlug: "two-sum",
    problemTitle: "Two Sum",
    code: TWO_SUM_NESTED,
    verdict: "TLE",
    runtimeMs: 2000,
    failedTest: {
      input: "twoSumTle n=25000 target=1 (no pair)",
      expected: "[]",
      actual: "TLE (exceeded 2000ms)",
    },
    timestamp: at(11),
  });
  push({
    id: "seed-two-4",
    problemSlug: "two-sum",
    problemTitle: "Two Sum",
    code: TWO_SUM_HASH,
    verdict: "AC",
    runtimeMs: 12,
    failedTest: null,
    timestamp: at(10),
  });
  push({
    id: "seed-max-1",
    problemSlug: "max-subarray",
    problemTitle: "Max Subarray",
    code: MAX_ZERO_DEFAULT,
    verdict: "WA",
    runtimeMs: 6,
    failedTest: { input: "single element [-1]", expected: "-1", actual: "0" },
    timestamp: at(17),
  });
  push({
    id: "seed-max-2",
    problemSlug: "max-subarray",
    problemTitle: "Max Subarray",
    code: MAX_ZERO_DEFAULT,
    verdict: "WA",
    runtimeMs: 7,
    failedTest: { input: "all-negative [-3,-1,-2]", expected: "-1", actual: "0" },
    timestamp: at(9),
  });
  push({
    id: "seed-max-3",
    problemSlug: "max-subarray",
    problemTitle: "Max Subarray",
    code: `function maxSubArray(nums) {
  let best = nums[0];
  for (let i = 0; i < nums.length; i++) {
    let sum = 0;
    for (let j = i; j < nums.length; j++) {
      sum += nums[j];
      best = Math.max(best, sum);
    }
  }
  return best;
}`,
    verdict: "TLE",
    runtimeMs: 2000,
    failedTest: { input: "maxSubarrayTle n=16000", expected: "6", actual: "TLE (exceeded 2000ms)" },
    timestamp: at(8),
  });
  push({
    id: "seed-max-4",
    problemSlug: "max-subarray",
    problemTitle: "Max Subarray",
    code: MAX_OK,
    verdict: "AC",
    runtimeMs: 5,
    failedTest: null,
    timestamp: at(7),
  });
  push({
    id: "seed-paren-2",
    problemSlug: "valid-parentheses",
    problemTitle: "Valid Parentheses",
    code: `function isValid(s) { return s === "()"; }`,
    verdict: "WA",
    runtimeMs: 2,
    failedTest: { input: "()[]{}", expected: "true", actual: "false" },
    timestamp: at(6),
  });
  push({
    id: "seed-paren-3",
    problemSlug: "valid-parentheses",
    problemTitle: "Valid Parentheses",
    code: PAREN_OK,
    verdict: "AC",
    runtimeMs: 4,
    failedTest: null,
    timestamp: at(5),
  });
  push({
    id: "seed-ce-1",
    problemSlug: "two-sum",
    problemTitle: "Two Sum",
    code: "function twoSum(nums, target) {",
    verdict: "CE",
    runtimeMs: 1,
    failedTest: { input: "", expected: "function twoSum(...)", actual: "Unexpected end of input" },
    timestamp: at(4),
  });

  const chain = rows.filter((item) => item.problemSlug === "binary-search").slice(0, 3);
  const chainNote = buildChainNote(chain);
  const ac = rows.find((item) => item.id === "seed-bs-3");
  if (ac?.analysis && chainNote) {
    ac.analysis = { ...ac.analysis, chainNote };
  }

  return rows;
}

export function seedDemo(): Attempt[] {
  clearAttempts();
  for (const row of buildSeedAttempts()) {
    saveAttempt(row);
  }
  return getAttempts();
}

export function seedTagStats(attempts: Attempt[] = buildSeedAttempts()) {
  const was = attempts.filter((item) => item.verdict === "WA");
  const offByOneWas = was.filter((item) => item.analysis?.tags.includes("off-by-one"));
  return {
    total: attempts.length,
    was: was.length,
    offByOneWas: offByOneWas.length,
  };
}
