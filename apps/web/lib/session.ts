import type { Attempt, Feedback, Session, SessionEvent, SessionEventKind } from "@shared/types";
import { saveScreenshot } from "./screenshots";

export const SESSION_STORAGE_KEY = "mistake-ledger:sessions";

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readAll(): Session[] {
  const raw = storage()?.getItem(SESSION_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Session[]) : [];
  } catch {
    return [];
  }
}

function writeAll(sessions: Session[]): void {
  storage()?.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions));
}

export function getSessions(problemSlug?: string): Session[] {
  const sessions = readAll();
  if (!problemSlug) return sessions;
  return sessions.filter((item) => item.problemSlug === problemSlug);
}

export function getSession(id: string): Session | undefined {
  return readAll().find((item) => item.id === id);
}

export function startSession(input: {
  problemSlug: string;
  problemTitle: string;
  platform?: Session["platform"];
}): Session {
  const existing = getSessions(input.problemSlug).find((item) => !item.endedAt);
  if (existing) return existing;

  const session: Session = {
    id: newId(),
    problemSlug: input.problemSlug,
    problemTitle: input.problemTitle,
    platform: input.platform ?? "mock",
    startedAt: new Date().toISOString(),
    events: [],
    attemptIds: [],
    analysis: null,
  };
  writeAll([...readAll(), session]);
  return session;
}

export function appendEvent(
  sessionId: string,
  event: Omit<SessionEvent, "id" | "at"> & { at?: string; id?: string },
): Session | null {
  const sessions = readAll();
  const index = sessions.findIndex((item) => item.id === sessionId);
  if (index === -1) return null;

  const nextEvent: SessionEvent = {
    id: event.id ?? newId(),
    at: event.at ?? new Date().toISOString(),
    kind: event.kind,
    ...(event.code ? { code: event.code } : {}),
    ...(event.message ? { message: event.message } : {}),
    ...(event.verdict ? { verdict: event.verdict } : {}),
    ...(event.attemptId ? { attemptId: event.attemptId } : {}),
    ...(event.screenshotId ? { screenshotId: event.screenshotId } : {}),
  };

  const session = sessions[index];
  sessions[index] = {
    ...session,
    events: [...session.events, nextEvent],
    attemptIds:
      event.attemptId && !session.attemptIds.includes(event.attemptId)
        ? [...session.attemptIds, event.attemptId]
        : session.attemptIds,
    // Never write analysis here — Analyze click is the only writer.
  };
  writeAll(sessions);
  return sessions[index];
}

export async function recordSilentScreenshot(sessionId: string, dataUrl: string): Promise<Session | null> {
  const id = newId();
  await saveScreenshot({
    id,
    sessionId,
    at: new Date().toISOString(),
    dataUrl,
  });
  return appendEvent(sessionId, {
    kind: "screenshot",
    screenshotId: id,
    message: "silent screenshot",
  });
}

export function recordJudgeResult(input: {
  sessionId: string;
  kind: "run" | "submit";
  code: string;
  verdict: Attempt["verdict"];
  failedTest?: Attempt["failedTest"];
  attemptId?: string;
}): Session | null {
  const kind: SessionEventKind = input.kind === "submit" ? "submit" : input.verdict === "AC" ? "run-ok" : "run-error";
  const message = input.failedTest
    ? `${input.verdict}: expected ${input.failedTest.expected}, got ${input.failedTest.actual} (${input.failedTest.input})`
    : input.verdict;
  return appendEvent(input.sessionId, {
    kind,
    code: input.code,
    message,
    verdict: input.verdict,
    attemptId: input.attemptId,
  });
}

export function endSession(sessionId: string): Session | null {
  const sessions = readAll();
  const index = sessions.findIndex((item) => item.id === sessionId);
  if (index === -1) return null;
  sessions[index] = { ...sessions[index], endedAt: new Date().toISOString() };
  writeAll(sessions);
  return sessions[index];
}

export function setSessionAnalysis(sessionId: string, analysis: Feedback): Session | null {
  const sessions = readAll();
  const index = sessions.findIndex((item) => item.id === sessionId);
  if (index === -1) return null;
  const ended = appendEvent(sessionId, { kind: "analyze" });
  if (!ended) return null;
  const next = readAll();
  const again = next.findIndex((item) => item.id === sessionId);
  next[again] = { ...next[again], analysis, endedAt: next[again].endedAt ?? new Date().toISOString() };
  writeAll(next);
  return next[again];
}

export function importSessions(sessions: Session[]): void {
  const byId = new Map(readAll().map((item) => [item.id, item]));
  for (const session of sessions) {
    byId.set(session.id, session);
  }
  writeAll([...byId.values()].sort((a, b) => a.startedAt.localeCompare(b.startedAt)));
}

export function clearSessions(): void {
  writeAll([]);
}

export function isSession(value: unknown): value is Session {
  if (!value || typeof value !== "object") return false;
  const session = value as Partial<Session>;
  return (
    typeof session.id === "string" &&
    typeof session.problemSlug === "string" &&
    typeof session.problemTitle === "string" &&
    Array.isArray(session.events) &&
    Array.isArray(session.attemptIds)
  );
}