import assert from "node:assert/strict";
import { classify, chooseTags } from "../lib/heuristics";
import { buildChainNote } from "../lib/diff";
import { runUserTests } from "../lib/judge/execute";
import { getProblem, PROBLEM_SLUGS } from "../lib/judge/problems";
import {
  clearAttempts,
  exportJSON,
  getAllTags,
  getAttempts,
  importJSON,
  saveAttempt,
  setAnalysis,
} from "../lib/ledger";
import { buildSeedAttempts, buildSeedSession, seedDemo, seedTagStats } from "../lib/seed-demo";
import { appendEvent, getSessions, startSession } from "../lib/session";
import type { Attempt } from "@shared/types";

const SOLUTIONS: Record<string, string> = {
  "two-sum": `function twoSum(nums, target) {
    const seen = new Map();
    for (let i = 0; i < nums.length; i++) {
      const need = target - nums[i];
      if (seen.has(need)) return [seen.get(need), i];
      seen.set(nums[i], i);
    }
    return [];
  }`,
  "binary-search": `function search(nums, target) {
    let lo = 0;
    let hi = nums.length - 1;
    while (lo <= hi) {
      const mid = lo + Math.floor((hi - lo) / 2);
      if (nums[mid] === target) return mid;
      if (nums[mid] < target) lo = mid + 1;
      else hi = mid - 1;
    }
    return -1;
  }`,
  "max-subarray": `function maxSubArray(nums) {
    let best = nums[0];
    let cur = nums[0];
    for (let i = 1; i < nums.length; i++) {
      cur = Math.max(nums[i], cur + nums[i]);
      best = Math.max(best, cur);
    }
    return best;
  }`,
  "valid-parentheses": `function isValid(s) {
    const stack = [];
    const pair = { ")": "(", "]": "[", "}": "{" };
    for (const ch of s) {
      if (ch === "(" || ch === "[" || ch === "{") stack.push(ch);
      else if (stack.pop() !== pair[ch]) return false;
    }
    return stack.length === 0;
  }`,
};

function mockStorage() {
  const memory = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, String(value));
    },
    removeItem: (key: string) => {
      memory.delete(key);
    },
    clear: () => memory.clear(),
    key: (index: number) => [...memory.keys()][index] ?? null,
    get length() {
      return memory.size;
    },
  };
  (globalThis as { window?: { localStorage: typeof localStorage } }).window = { localStorage };
}

function testJudgeSolutions() {
  for (const slug of PROBLEM_SLUGS) {
    const problem = getProblem(slug);
    const result = runUserTests(SOLUTIONS[slug], problem.fnName, problem.tests, problem.compareMode);
    assert.equal(result.verdict, "AC", `${slug} reference solution should AC, got ${result.verdict} ${JSON.stringify(result.failedTest)}`);
  }

  const twoSum = getProblem("two-sum");
  const sameIndex = runUserTests(
    `function twoSum(nums, target) {
      for (let i = 0; i < nums.length; i++) {
        for (let j = 0; j < nums.length; j++) {
          if (nums[i] + nums[j] === target) return [i, j];
        }
      }
      return [];
    }`,
    twoSum.fnName,
    twoSum.tests.filter((test) => test.kind !== "tle-trap"),
    twoSum.compareMode,
  );
  assert.equal(sameIndex.verdict, "WA");

  const binary = getProblem("binary-search");
  const missLast = runUserTests(
    `function search(nums, target) {
      let lo = 0;
      let hi = nums.length - 2;
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (nums[mid] === target) return mid;
        if (nums[mid] < target) lo = mid + 1;
        else hi = mid - 1;
      }
      return -1;
    }`,
    binary.fnName,
    binary.tests.filter((test) => test.kind !== "tle-trap"),
    binary.compareMode,
  );
  assert.equal(missLast.verdict, "WA");
  assert.match(missLast.failedTest?.input ?? "", /single element|first index|last index/);

  const max = getProblem("max-subarray");
  const zeroDefault = runUserTests(
    `function maxSubArray(nums) {
      let best = 0;
      let cur = 0;
      for (let i = 0; i < nums.length; i++) {
        cur = Math.max(0, cur + nums[i]);
        best = Math.max(best, cur);
      }
      return best;
    }`,
    max.fnName,
    max.tests.filter((test) => test.kind !== "tle-trap"),
    max.compareMode,
  );
  assert.equal(zeroDefault.verdict, "WA");

  const paren = getProblem("valid-parentheses");
  const noEmpty = runUserTests(
    `function isValid(s) {
      if (!s) return false;
      return true;
    }`,
    paren.fnName,
    paren.tests.filter((test) => test.id === "empty"),
    paren.compareMode,
  );
  assert.equal(noEmpty.verdict, "WA");

  const ce = runUserTests("function twoSum(nums, target) {", "twoSum", [], "unordered-pair");
  assert.equal(ce.verdict, "CE");

  const missing = runUserTests("function foo() { return 1; }", "twoSum", [], "unordered-pair");
  assert.equal(missing.verdict, "CE");
}

function testHeuristics() {
  const base: Attempt = {
    id: "t1",
    problemSlug: "binary-search",
    problemTitle: "Binary Search",
    platform: "mock",
    language: "javascript",
    code: "function search(nums, target) { return -1; }",
    verdict: "WA",
    timestamp: "2026-09-19T00:00:00.000Z",
    failedTest: { input: "target is last index", expected: "4", actual: "-1" },
  };

  assert.deepEqual(chooseTags({ ...base, verdict: "CE" }), ["syntax"]);
  assert.deepEqual(chooseTags({ ...base, verdict: "TLE" }), ["tle-complexity"]);
  assert.deepEqual(chooseTags(base), ["off-by-one"]);
  assert.deepEqual(
    chooseTags({
      ...base,
      problemSlug: "two-sum",
      problemTitle: "Two Sum",
      failedTest: { input: "duplicates [3,3] target=6", expected: "[0,1]", actual: "[0,0]" },
    }),
    ["implementation-slip"],
  );
  assert.deepEqual(
    chooseTags({
      ...base,
      problemSlug: "two-sum",
      problemTitle: "Two Sum",
      code: `function twoSum(nums, target) {
        for (let i = 0; i < nums.length; i++) {
          for (let j = i + 1; j < nums.length; j++) {
            if (nums[i] + nums[j] === target) return [i, j];
          }
        }
        return [];
      }`,
      failedTest: { input: "twoSumTle n=25000 target=1 (no pair)", expected: "[]", actual: "TLE" },
    }),
    ["tle-complexity"],
  );

  const lucky = chooseTags({
    ...base,
    verdict: "AC",
    runtimeMs: 1800,
    failedTest: null,
    code: "function search(nums, target) { return 0; }",
  });
  assert.deepEqual(lucky, ["lucky-ac"]);

  const feedback = classify(base, []);
  assert.ok(feedback.summary.length > 0);
  assert.ok(feedback.nextDrill.title.length > 0);

  const cppHash = `class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> mp;
        for (int i = 0; i < nums.size(); i++) {
            if (mp.count(target - nums[i])) return {mp[target - nums[i]], i};
            mp[nums[i]] = i;
        }
        return {};
    }
};`;
  assert.deepEqual(
    chooseTags({
      ...base,
      language: "unknown",
      verdict: "AC",
      runtimeMs: 12,
      failedTest: null,
      code: cppHash,
    }),
    [],
  );

  const pythonNested = `class Solution:
    def twoSum(self, nums, target):
        for i in range(len(nums)):
            for j in range(i + 1, len(nums)):
                if nums[i] + nums[j] == target:
                    return [i, j]
        return []`;
  assert.deepEqual(
    chooseTags({
      ...base,
      language: "unknown",
      problemSlug: "two-sum",
      problemTitle: "Two Sum",
      verdict: "WA",
      code: pythonNested,
      failedTest: { input: "twoSumTle n=25000 target=1 (no pair)", expected: "[]", actual: "TLE" },
    }),
    ["tle-complexity"],
  );

  const cppCe = classify({
    ...base,
    language: "unknown",
    verdict: "CE",
    code: "class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n",
    failedTest: null,
  });
  assert.match(cppCe.whatWentWrong.join(" "), /C\+\+|semicolon|signature/i);
  assert.match(cppCe.nextDrill.title, /Solution method|Compile/i);

  const pyCe = classify({
    ...base,
    language: "Python3",
    verdict: "CE",
    code: "class Solution:\n    def twoSum(self, nums, target)\n        return []\n",
    failedTest: null,
  });
  assert.match(pyCe.whatWentWrong.join(" "), /indent|def|colon/i);
}

function testDiffAndSeed() {
  const attempts = buildSeedAttempts();
  const stats = seedTagStats(attempts);
  assert.equal(stats.was, 12, `expected 12 WAs, got ${stats.was}`);
  assert.equal(stats.offByOneWas, 7, `expected 7 off-by-one WAs, got ${stats.offByOneWas}`);

  const chain = attempts.filter((item) => ["seed-bs-1", "seed-bs-2", "seed-bs-3"].includes(item.id));
  const note = buildChainNote(chain);
  assert.ok(note, "WA→WA→AC chain should produce a chainNote");
  assert.match(note ?? "", /try 3/i);
}

function testLedger() {
  mockStorage();
  clearAttempts();
  const seeded = seedDemo();
  assert.ok(seeded.length >= 12);
  const tags = getAllTags();
  assert.equal(tags["off-by-one"], 7);
  const json = exportJSON();
  const pack = JSON.parse(json) as { attempts: unknown[]; sessions: unknown[] };
  assert.ok(Array.isArray(pack.attempts));
  assert.ok(pack.sessions.length >= 1);
  clearAttempts();
  assert.equal(getAttempts().length, 0);
  assert.equal(getSessions().length, 0);
  importJSON(json);
  assert.equal(getAttempts().length, seeded.length);
  assert.equal(getSessions().some((item) => item.id === "seed-session-bs"), true);

  const first = getAttempts()[0];
  const updated = setAnalysis(first.id, classify(first, []));
  assert.ok(updated?.analysis);

  saveAttempt({
    ...first,
    id: "extra-1",
    timestamp: "2026-09-19T12:00:00.000Z",
  });
  assert.ok(getAttempts().some((item) => item.id === "extra-1"));
}

function testSession() {
  mockStorage();
  clearAttempts();
  const session = startSession({ problemSlug: "binary-search", problemTitle: "Binary Search" });
  assert.equal(session.analysis, null);
  const afterRun = appendEvent(session.id, {
    kind: "run-error",
    verdict: "CE",
    message: "Unexpected end of input",
    code: "function search(nums, target) {",
  });
  assert.ok(afterRun);
  assert.equal(afterRun?.analysis, null);
  appendEvent(session.id, { kind: "run-error", verdict: "WA", message: "last index" });
  const afterSubmit = appendEvent(session.id, { kind: "submit", verdict: "AC", message: "AC" });
  assert.equal(afterSubmit?.analysis, null);

  const ac: Attempt = {
    id: "sess-ac",
    problemSlug: "binary-search",
    problemTitle: "Binary Search",
    platform: "mock",
    language: "javascript",
    code: "function search(nums, target) { return 0; }",
    verdict: "AC",
    timestamp: "2026-09-19T12:00:00.000Z",
  };
  const feedback = classify(ac, [], afterSubmit);
  assert.ok(feedback.improvementNote);
  assert.match(feedback.improvementNote ?? "", /AC/);
  assert.ok((feedback.errorHistory?.length ?? 0) >= 1);

  const seeded = buildSeedSession();
  assert.equal(seeded.events.length, 3);
  assert.ok(seeded.analysis?.improvementNote || seeded.analysis?.chainNote);
}

testJudgeSolutions();
testHeuristics();
testDiffAndSeed();
testLedger();
testSession();
console.log("Person 1 self-test passed.");
