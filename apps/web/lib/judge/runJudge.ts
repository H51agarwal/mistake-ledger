import type { Attempt } from "@shared/types";
import { JUDGE_TIMEOUT_MS, type ExecuteResult, type HiddenTest } from "./execute";
import { getProblem } from "./problems";

export { JUDGE_TIMEOUT_MS };

export type JudgeResult = {
  verdict: Attempt["verdict"];
  runtimeMs: number;
  failedTest: Attempt["failedTest"];
};

function assertBrowser(): void {
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    throw new Error("runJudge must run in the browser (Web Worker).");
  }
}

function createWorker(): Worker {
  return new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
}

function askWorker(worker: Worker, request: unknown, timeoutMs: number): Promise<ExecuteResult> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      worker.terminate();
      resolve({
        verdict: "TLE",
        failedTest: {
          input: "timed out",
          expected: `finish within ${timeoutMs}ms`,
          actual: `TLE (exceeded ${timeoutMs}ms)`,
        },
      });
    }, timeoutMs);

    const cleanup = () => {
      window.clearTimeout(timer);
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
    };

    const onMessage = (event: MessageEvent<ExecuteResult>) => {
      cleanup();
      resolve(event.data);
    };

    const onError = (event: ErrorEvent) => {
      cleanup();
      reject(event.error ?? new Error(event.message));
    };

    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);
    worker.postMessage(request);
  });
}

async function runInWorker(request: unknown, timeoutMs: number): Promise<ExecuteResult> {
  const worker = createWorker();
  try {
    return await askWorker(worker, request, timeoutMs);
  } finally {
    try {
      worker.terminate();
    } catch {
      // already terminated after TLE
    }
  }
}

export async function runJudge(code: string, problemSlug: string): Promise<JudgeResult> {
  assertBrowser();
  const problem = getProblem(problemSlug);
  const started = performance.now();

  const finish = (result: ExecuteResult): JudgeResult => ({
    verdict: result.verdict,
    runtimeMs: Math.round(performance.now() - started),
    failedTest: result.failedTest,
  });

  const payload = (tests: HiddenTest[]) => ({
    code,
    fnName: problem.fnName,
    tests,
    compareMode: problem.compareMode,
  });

  try {
    const compiled = await runInWorker(payload([]), JUDGE_TIMEOUT_MS);
    if (compiled.verdict !== "AC") return finish(compiled);

    for (const test of problem.tests) {
      const result = await runInWorker(payload([test]), JUDGE_TIMEOUT_MS);
      if (result.verdict === "TLE") {
        return finish({
          verdict: "TLE",
          failedTest: {
            input: test.label ?? test.id,
            expected: formatExpected(test.expected),
            actual: `TLE (exceeded ${JUDGE_TIMEOUT_MS}ms)`,
          },
        });
      }
      if (result.verdict !== "AC") return finish(result);
    }

    return finish({ verdict: "AC", failedTest: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return finish({
      verdict: "CE",
      failedTest: {
        input: "",
        expected: `function ${problem.fnName}(...)`,
        actual: message,
      },
    });
  }
}

function formatExpected(value: unknown): string {
  try {
    const text = JSON.stringify(value);
    return text.length > 180 ? `${text.slice(0, 177)}...` : text;
  } catch {
    return String(value);
  }
}

export function attemptFromJudge(input: {
  problemSlug: string;
  code: string;
  result: JudgeResult;
  id?: string;
  platform?: Attempt["platform"];
  language?: string;
}): Attempt {
  const problem = getProblem(input.problemSlug);
  return {
    id: input.id ?? crypto.randomUUID(),
    problemSlug: problem.slug,
    problemTitle: problem.title,
    platform: input.platform ?? "mock",
    language: input.language ?? problem.language,
    code: input.code,
    verdict: input.result.verdict,
    runtimeMs: input.result.runtimeMs,
    failedTest: input.result.failedTest,
    timestamp: new Date().toISOString(),
    analysis: null,
  };
}
