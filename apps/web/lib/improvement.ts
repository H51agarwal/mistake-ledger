import type { Session } from "@shared/types";

export function distinctErrorHistory(session: Session | null | undefined): string[] {
  if (!session) return [];
  const seen = new Set<string>();
  const history: string[] = [];
  for (const event of session.events) {
    if (event.kind !== "run-error" && event.kind !== "submit") continue;
    if (!event.verdict || event.verdict === "AC") continue;
    const line = event.message ?? event.verdict;
    if (seen.has(line)) continue;
    seen.add(line);
    history.push(line);
  }
  return history;
}

export function buildImprovementNote(session: Session | null | undefined): string | undefined {
  if (!session || session.events.length < 2) return undefined;

  const failures = session.events.filter(
    (event) =>
      (event.kind === "run-error" || event.kind === "submit") &&
      event.verdict &&
      event.verdict !== "AC",
  );
  const successes = session.events.filter(
    (event) =>
      (event.kind === "run-ok" || event.kind === "submit") && event.verdict === "AC",
  );

  if (failures.length === 0 && successes.length === 0) return undefined;

  if (failures.length > 0 && successes.length > 0) {
    const first = failures[0];
    return `Improved during this session: started with ${first.verdict}${first.message ? ` (${short(first.message)})` : ""}, later reached AC.`;
  }

  if (failures.length >= 2) {
    const first = failures[0];
    const last = failures[failures.length - 1];
    if (first.verdict !== last.verdict) {
      return `Partial improvement: moved ${first.verdict} → ${last.verdict}, but still not AC.`;
    }
    return `Still stuck on ${last.verdict}. The same failure showed up ${failures.length} times this session.`;
  }

  if (successes.length > 0 && failures.length === 0) {
    return "This session reached AC without a recorded failed run.";
  }

  return undefined;
}

function short(text: string): string {
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}
