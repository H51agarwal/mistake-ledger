"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AnalyzePanel } from "@/components/AnalyzePanel";
import { AttemptChain } from "@/components/AttemptChain";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAttempt, getAttempts } from "@/lib/ledger";
import { useLedger } from "@/lib/useLedger";

export default function AttemptPage() {
  const params = useParams<{ id: string }>();
  const { loaded } = useLedger();
  const attempt = loaded ? getAttempt(params.id) : undefined;
  const related = attempt ? getAttempts(attempt.problemSlug) : [];

  if (!loaded) {
    return (
      <main className="max-w-3xl mx-auto p-8">
        <p className="text-muted-foreground">Loading…</p>
      </main>
    );
  }

  if (!attempt) {
    return (
      <main className="max-w-3xl mx-auto p-8 space-y-3">
        <h1 className="text-2xl font-bold">Attempt not found</h1>
        <Link className="underline underline-offset-2" href="/">
          Back to dashboard
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto p-8 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{attempt.problemTitle}</h1>
        <Link className="text-sm underline underline-offset-2" href="/">
          Dashboard
        </Link>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline">{attempt.verdict}</Badge>
        <span className="text-sm text-muted-foreground">
          {attempt.runtimeMs ?? "—"}ms · {new Date(attempt.timestamp).toLocaleString()}
        </span>
      </div>
      {attempt.failedTest ? (
        <Card>
          <CardHeader>
            <CardTitle>Official verdict data</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p>Input: {attempt.failedTest.input}</p>
            <p>Expected: {attempt.failedTest.expected}</p>
            <p>Actual: {attempt.failedTest.actual}</p>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Submitted code</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto text-xs font-mono">{attempt.code}</pre>
        </CardContent>
      </Card>
      {attempt.analysis ? (
        <AnalyzePanel feedback={attempt.analysis} />
      ) : (
        <p className="text-sm text-muted-foreground">
          No analysis stored yet. Open practice, submit, then Analyze after the verdict.
        </p>
      )}
      <Card>
        <CardHeader>
          <CardTitle>WA → AC chain</CardTitle>
        </CardHeader>
        <CardContent>
          <AttemptChain attempts={related} />
        </CardContent>
      </Card>
    </main>
  );
}
