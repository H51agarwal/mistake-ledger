"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnalyzePanel } from "@/components/AnalyzePanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { attemptFromJudge, runJudge } from "@/lib/judge/runJudge";
import { getProblem } from "@/lib/judge/problems";
import { getAttempts, saveAttempt, setAnalysis } from "@/lib/ledger";
import { startPeriodicScreenshots, type ScreenWatch } from "@/lib/screen-capture";
import { getLatestScreenshotDataUrls } from "@/lib/screenshots";
import {
  getSession,
  recordJudgeResult,
  recordSilentScreenshot,
  setSessionAnalysis,
  startSession,
} from "@/lib/session";
import type { Attempt, Feedback } from "@shared/types";

export default function PracticeProblemPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const problem = getProblemSafe(slug);
  const [code, setCode] = useState(problem?.starterCode ?? "");
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [busy, setBusy] = useState<"run" | "submit" | "analyze" | null>(null);
  const [watching, setWatching] = useState(false);
  const [shotCount, setShotCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const watchRef = useRef<ScreenWatch | null>(null);

  useEffect(() => {
    if (!problem) return;
    const session = startSession({
      problemSlug: problem.slug,
      problemTitle: problem.title,
    });
    setSessionId(session.id);
  }, [problem]);

  useEffect(() => {
    return () => {
      watchRef.current?.stop();
      watchRef.current = null;
    };
  }, []);

  if (!problem) {
    return (
      <main className="max-w-3xl mx-auto p-8">
        <p>Unknown problem.</p>
        <Link className="underline" href="/practice">Back to practice</Link>
      </main>
    );
  }

  const canAnalyze = Boolean(attempt?.verdict);

  async function onRun() {
    setError(null);
    setFeedback(null);
    setBusy("run");
    try {
      const result = await runJudge(code, problem.slug);
      if (sessionId) {
        recordJudgeResult({
          sessionId,
          kind: "run",
          code,
          verdict: result.verdict,
          failedTest: result.failedTest,
        });
      }
      setAttempt(
        attemptFromJudge({
          problemSlug: problem.slug,
          code,
          result,
          id: attempt?.id ?? `run-${Date.now()}`,
        }),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  }

  async function onSubmit() {
    setError(null);
    setFeedback(null);
    setBusy("submit");
    try {
      const result = await runJudge(code, problem.slug);
      const next = attemptFromJudge({ problemSlug: problem.slug, code, result });
      saveAttempt(next);
      if (sessionId) {
        recordJudgeResult({
          sessionId,
          kind: "submit",
          code,
          verdict: next.verdict,
          failedTest: next.failedTest,
          attemptId: next.id,
        });
      }
      setAttempt(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  }

  async function onAnalyze() {
    if (!attempt?.verdict) return;
    setError(null);
    setBusy("analyze");
    try {
      const priorAttempts = getAttempts(attempt.problemSlug).filter((item) => item.id !== attempt.id);
      const session = sessionId ? getSession(sessionId) ?? null : null;
      const screenshots = sessionId ? await getLatestScreenshotDataUrls(sessionId, 3) : [];
      watchRef.current?.stop();
      watchRef.current = null;
      setWatching(false);
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attempt, priorAttempts, session, screenshots }),
      });
      if (!response.ok) {
        const body= await response.json().catch(() => ({}));
        throw new Error(body.error ?? `Analyze request failed (${response.status}).`);
      }
      const next = (await response.json()) as Feedback;
      setAnalysis(attempt.id, next);
      if (sessionId) setSessionAnalysis(sessionId, next);
      setFeedback(next);
      setAttempt({ ...attempt, analysis: next });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="max-w-3xl mx-auto p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{problem.title}</h1>
        <Link className="text-sm underline underline-offset-2" href="/practice">
          All problems
        </Link>
      </div>
      <p className="text-muted-foreground">{problem.prompt}</p>
      <p className="text-xs text-muted-foreground">
        Export a function named <code>{problem.fnName}</code>. Screen watch, Run, and Submit are recorded silently. Analyze stays locked until you click it after a verdict.
      </p>
      <textarea
        className="w-full min-h-56 rounded-md border border-input bg-background p-3 font-mono text-sm"
        spellCheck={false}
        value={code}
        onChange={(event) => setCode(event.target.value)}
      />
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={busy !== null || watching || !sessionId}
          onClick={async () => {
            if (!sessionId) return;
            setError(null);
            try {
              const watch = await startPeriodicScreenshots(async (dataUrl) => {
                await recordSilentScreenshot(sessionId, dataUrl);
                setShotCount((count) => count + 1);
              });
              watchRef.current = watch;
              setWatching(true);
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : "Screen share was blocked.");
            }
          }}
        >
          {watching ? `Watching (${shotCount})` : "Watch screen"}
        </Button>
        <Button type="button" variant="outline" onClick={onRun} disabled={busy !== null}>
          {busy === "run" ? "Running…" : "Run"}
        </Button>
        <Button type="button" onClick={onSubmit} disabled={busy !== null}>
          {busy === "submit" ? "Judging…" : "Submit"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!canAnalyze || busy !== null}
          onClick={onAnalyze}
        >
          {busy === "analyze" ? "Analyzing…" : "Analyze"}
        </Button>
        {attempt ? <Badge variant="outline">{attempt.verdict}</Badge> : null}
        {attempt ? (
          <Link className="text-sm underline underline-offset-2" href={`/attempt/${attempt.id}`}>
            Open attempt
          </Link>
        ) : null}
      </div>
      {!canAnalyze ? (
        <p className="text-sm text-muted-foreground">
          Analyze is disabled until a judge verdict exists. Grey-out is not the only lock — the handler also returns immediately.
        </p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {attempt?.failedTest ? (
        <Card>
          <CardHeader>
            <CardTitle>Failed test</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p>Input: {attempt.failedTest.input}</p>
            <p>Expected: {attempt.failedTest.expected}</p>
            <p>Actual: {attempt.failedTest.actual}</p>
          </CardContent>
        </Card>
      ) : null}
      {feedback ? <AnalyzePanel feedback={feedback} /> : null}
    </main>
  );
}

function getProblemSafe(slug: string) {
  try {
    return getProblem(slug);
  } catch {
    return null;
  }
}
