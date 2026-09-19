export const JUDGE_TIMEOUT_MS = 2000;

export type CompareMode = "strict" | "unordered-pair";
export type GeneratorId =
  | "twoSumTle"
  | "binarySearchTle"
  | "maxSubarrayTle"
  | "validParenTle";

export type TestKind = "correctness" | "wa-trap" | "tle-trap";

export type HiddenTest = {
  id: string;
  expected: unknown;
  args?: unknown[];
  generator?: GeneratorId;
  label?: string;
  kind?: TestKind;
};

export type ExecuteResult = {
  verdict: "AC" | "WA" | "TLE" | "CE" | "RE";
  failedTest: { input: string; expected: string; actual: string } | null;
};

export const TWO_SUM_TLE_N = 25000;
export const BINARY_SEARCH_TLE_N = 200000;
export const MAX_SUBARRAY_TLE_N = 16000;
export const VALID_PAREN_TLE_N = 8000;

export function generateArgs(id: GeneratorId): unknown[] {
  if (id === "twoSumTle") {
    const nums = Array.from({ length: TWO_SUM_TLE_N }, (_, i) => i * 2);
    return [nums, 1];
  }
  if (id === "binarySearchTle") {
    const nums = Array.from({ length: BINARY_SEARCH_TLE_N }, (_, i) => i);
    return [nums, -1];
  }
  if (id === "maxSubarrayTle") {
    const nums = Array.from({ length: MAX_SUBARRAY_TLE_N }, (_, i) => (i % 7) - 3);
    return [nums];
  }
  const n = VALID_PAREN_TLE_N;
  return ["(".repeat(n) + ")".repeat(n)];
}

export function kadane(nums: number[]): number {
  let best = nums[0];
  let cur = nums[0];
  for (let i = 1; i < nums.length; i++) {
    cur = Math.max(nums[i], cur + nums[i]);
    best = Math.max(best, cur);
  }
  return best;
}

export function valuesEqual(a: unknown, b: unknown, mode: CompareMode): boolean {
  if (mode === "unordered-pair" && isNumberPair(a) && isNumberPair(b)) {
    const [a0, a1] = a as [number, number];
    const [b0, b1] = b as [number, number];
    return (a0 === b0 && a1 === b1) || (a0 === b1 && a1 === b0);
  }
  return strictEqual(a, b);
}

function isNumberPair(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number"
  );
}

function strictEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => strictEqual(item, b[i]));
  }
  return false;
}

export function formatValue(value: unknown, label?: string): string {
  if (label) return label;
  try {
    const text = JSON.stringify(value);
    if (text.length > 180) return `${text.slice(0, 177)}...`;
    return text;
  } catch {
    return String(value);
  }
}

function resolveArgs(test: HiddenTest): unknown[] {
  if (test.generator) return generateArgs(test.generator);
  return test.args ?? [];
}

export function compileUserFn(
  code: string,
  fnName: string,
): { ok: true; fn: (...args: unknown[]) => unknown } | { ok: false; result: ExecuteResult } {
  try {
    const fn = new Function(
      `"use strict";\n${code}\n; if (typeof ${fnName} !== "function") throw new Error("__NOT_A_FUNCTION__"); return ${fnName};`,
    )();
    return { ok: true, fn };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const actual =
      message === "__NOT_A_FUNCTION__"
        ? `function ${fnName} was not defined`
        : message;
    return {
      ok: false,
      result: {
        verdict: "CE",
        failedTest: {
          input: "",
          expected: `function ${fnName}(...)`,
          actual,
        },
      },
    };
  }
}

export function runUserTests(
  code: string,
  fnName: string,
  tests: HiddenTest[],
  compareMode: CompareMode,
): ExecuteResult {
  const compiled = compileUserFn(code, fnName);
  if (!compiled.ok) return compiled.result;

  for (const test of tests) {
    const args = resolveArgs(test);
    const input = formatValue(args, test.label);
    try {
      const actual = compiled.fn(...args);
      if (!valuesEqual(actual, test.expected, compareMode)) {
        return {
          verdict: "WA",
          failedTest: {
            input,
            expected: formatValue(test.expected),
            actual: formatValue(actual),
          },
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        verdict: "RE",
        failedTest: {
          input,
          expected: formatValue(test.expected),
          actual: message,
        },
      };
    }
  }

  return { verdict: "AC", failedTest: null };
}
