import { runUserTests, type CompareMode, type HiddenTest } from "./execute";

export type JudgeWorkerRequest = {
  code: string;
  fnName: string;
  tests: HiddenTest[];
  compareMode: CompareMode;
};

self.onmessage = (event: MessageEvent<JudgeWorkerRequest>) => {
  const { code, fnName, tests, compareMode } = event.data;
  self.postMessage(runUserTests(code, fnName, tests, compareMode));
};
