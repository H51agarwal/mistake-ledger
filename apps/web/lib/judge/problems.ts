import {
  BINARY_SEARCH_TLE_N,
  kadane,
  MAX_SUBARRAY_TLE_N,
  TWO_SUM_TLE_N,
  VALID_PAREN_TLE_N,
  generateArgs,
  type CompareMode,
  type HiddenTest,
} from "./execute";

export const PROBLEM_SLUGS = [
  "two-sum",
  "binary-search",
  "max-subarray",
  "valid-parentheses",
] as const;

export type ProblemSlug = (typeof PROBLEM_SLUGS)[number];

export type Problem = {
  slug: ProblemSlug;
  title: string;
  fnName: string;
  language: "javascript";
  prompt: string;
  starterCode: string;
  compareMode: CompareMode;
  tests: HiddenTest[];
};

const twoSumTests: HiddenTest[] = [
  { id: "basic", args: [[2, 7, 11, 15], 9], expected: [0, 1], kind: "correctness" },
  { id: "order", args: [[3, 2, 4], 6], expected: [1, 2], kind: "correctness" },
  {
    id: "duplicates",
    args: [[3, 3], 6],
    expected: [0, 1],
    kind: "wa-trap",
    label: "duplicates [3,3] target=6",
  },
  {
    id: "duplicate-pair",
    args: [[2, 5, 5, 11], 10],
    expected: [1, 2],
    kind: "wa-trap",
    label: "duplicate values [2,5,5,11] target=10",
  },
  {
    id: "negatives",
    args: [[-3, 4, 3, 90], 0],
    expected: [0, 2],
    kind: "correctness",
    label: "negatives [-3,4,3,90] target=0",
  },
  {
    id: "no-solution",
    args: [[1, 2, 3], 7],
    expected: [],
    kind: "wa-trap",
    label: "no-solution [1,2,3] target=7",
  },
  {
    id: "tle",
    generator: "twoSumTle",
    expected: [],
    kind: "tle-trap",
    label: `twoSumTle n=${TWO_SUM_TLE_N} target=1 (no pair)`,
  },
];

const binarySearchTests: HiddenTest[] = [
  { id: "empty", args: [[], 1], expected: -1, kind: "wa-trap", label: "empty array target=1" },
  { id: "single-hit", args: [[5], 5], expected: 0, kind: "correctness", label: "single element hit" },
  { id: "single-miss", args: [[5], 3], expected: -1, kind: "correctness", label: "single element miss" },
  { id: "first", args: [[1, 3, 5, 7, 9], 1], expected: 0, kind: "wa-trap", label: "target is first index" },
  { id: "last", args: [[1, 3, 5, 7, 9], 9], expected: 4, kind: "wa-trap", label: "target is last index" },
  { id: "absent-mid", args: [[1, 3, 5, 7, 9], 4], expected: -1, kind: "correctness" },
  { id: "absent-low", args: [[1, 3, 5], 0], expected: -1, kind: "correctness" },
  { id: "absent-high", args: [[1, 3, 5], 6], expected: -1, kind: "correctness" },
  {
    id: "tle",
    generator: "binarySearchTle",
    expected: -1,
    kind: "tle-trap",
    label: `binarySearchTle n=${BINARY_SEARCH_TLE_N} target=-1`,
  },
];

const maxSubarraySmall = [-2, 1, -3, 4, -1, 2, 1, -5, 4];
const maxSubarrayTleExpected = kadane(generateArgs("maxSubarrayTle")[0] as number[]);

const maxSubarrayTests: HiddenTest[] = [
  { id: "classic", args: [maxSubarraySmall], expected: 6, kind: "correctness" },
  {
    id: "all-negative",
    args: [[-3, -1, -2]],
    expected: -1,
    kind: "wa-trap",
    label: "all-negative [-3,-1,-2]",
  },
  { id: "single-neg", args: [[-1]], expected: -1, kind: "wa-trap", label: "single element [-1]" },
  { id: "single-pos", args: [[5]], expected: 5, kind: "correctness" },
  { id: "mixed", args: [[1, -2, 3]], expected: 3, kind: "correctness" },
  {
    id: "tle",
    generator: "maxSubarrayTle",
    expected: maxSubarrayTleExpected,
    kind: "tle-trap",
    label: `maxSubarrayTle n=${MAX_SUBARRAY_TLE_N}`,
  },
];

const validParenTests: HiddenTest[] = [
  { id: "empty", args: [""], expected: true, kind: "wa-trap", label: "empty string" },
  { id: "simple", args: ["()"], expected: true, kind: "correctness" },
  { id: "mixed", args: ["()[]{}"], expected: true, kind: "correctness" },
  { id: "unmatched-closer", args: ["]"], expected: false, kind: "wa-trap", label: "unmatched closer ]" },
  { id: "mismatch", args: ["(]"], expected: false, kind: "correctness" },
  { id: "crossed", args: ["([)]"], expected: false, kind: "correctness" },
  { id: "nested", args: ["{[]}"], expected: true, kind: "correctness" },
  { id: "unmatched-open", args: ["((("], expected: false, kind: "correctness" },
  {
    id: "tle",
    generator: "validParenTle",
    expected: true,
    kind: "tle-trap",
    label: `validParenTle deep nesting n=${VALID_PAREN_TLE_N}`,
  },
];

export const PROBLEMS: Problem[] = [
  {
    slug: "two-sum",
    title: "Two Sum",
    fnName: "twoSum",
    language: "javascript",
    compareMode: "unordered-pair",
    prompt:
      "Return indices of the two numbers that add up to target. You may not use the same element twice. If no pair exists, return [].",
    starterCode: `function twoSum(nums, target) {
  
}`,
    tests: twoSumTests,
  },
  {
    slug: "binary-search",
    title: "Binary Search",
    fnName: "search",
    language: "javascript",
    compareMode: "strict",
    prompt:
      "nums is sorted in ascending order. Return the index of target, or -1 if it is not present. Must run in O(log n).",
    starterCode: `function search(nums, target) {
  
}`,
    tests: binarySearchTests,
  },
  {
    slug: "max-subarray",
    title: "Max Subarray",
    fnName: "maxSubArray",
    language: "javascript",
    compareMode: "strict",
    prompt:
      "Return the largest sum of any contiguous subarray. The array may be all negative — do not default to 0.",
    starterCode: `function maxSubArray(nums) {
  
}`,
    tests: maxSubarrayTests,
  },
  {
    slug: "valid-parentheses",
    title: "Valid Parentheses",
    fnName: "isValid",
    language: "javascript",
    compareMode: "strict",
    prompt:
      "Return true if s is a valid parentheses string. Brackets must close in the correct order. The empty string is valid.",
    starterCode: `function isValid(s) {
  
}`,
    tests: validParenTests,
  },
];

export function getProblems(): Problem[] {
  return PROBLEMS;
}

export function getProblem(slug: string): Problem {
  const problem = PROBLEMS.find((item) => item.slug === slug);
  if (!problem) {
    throw new Error(`Unknown problem slug: ${slug}`);
  }
  return problem;
}

export function getProblemSummaries() {
  return PROBLEMS.map(({ slug, title, fnName, prompt, starterCode }) => ({
    slug,
    title,
    fnName,
    prompt,
    starterCode,
  }));
}
