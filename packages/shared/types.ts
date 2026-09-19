// This is the "contract". Do not change this file alone -
// if you need to change it, tell the other person first.

export type TaxonomyTag =
  | "syntax"
  | "off-by-one"
  | "wrong-ds"
  | "tle-complexity"
  | "overflow-modulo"
  | "missed-constraint"
  | "implementation-slip"
  | "lucky-ac";

export type Attempt = {
  id: string;
  problemSlug: string;
  problemTitle: string;
  platform: "mock" | "leetcode";
  language: string;
  code: string;
  verdict: "AC" | "WA" | "TLE" | "CE" | "RE";
  runtimeMs?: number;
  memoryKb?: number;
  failedTest?: { input: string; expected: string; actual: string } | null;
  timestamp: string;
  analysis?: Feedback | null;
};

export type Feedback = {
  tags: TaxonomyTag[];
  summary: string;
  whatWentWrong: string[];
  whatWentWell: string[];
  lineNotes: { line: number; note: string }[];
  complexity: { estimated: string; vsConstraints: string };
  nextDrill: { title: string; reason: string };
  chainNote?: string;
  improvementNote?: string;
  errorHistory?: string[];
};

export type SessionEventKind = "edit" | "run-error" | "run-ok" | "submit" | "analyze" | "screenshot";

export type SessionEvent = {
  id: string;
  at: string;
  kind: SessionEventKind;
  code?: string;
  message?: string;
  verdict?: Attempt["verdict"];
  attemptId?: string;
  screenshotId?: string;
};

export type Session = {
  id: string;
  problemSlug: string;
  problemTitle: string;
  platform: "mock" | "leetcode";
  startedAt: string;
  endedAt?: string;
  events: SessionEvent[];
  attemptIds: string[];
  analysis?: Feedback | null;
};