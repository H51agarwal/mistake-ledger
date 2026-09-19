"use client";

import Link from "next/link";
import { ErrorMixChart } from "@/components/ErrorMixChart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { seedDemo } from "@/lib/seed-demo";
import { NEXT_DRILLS, TAG_LABELS } from "@/lib/taxonomy";
import { useLedger } from "@/lib/useLedger";
import type { TaxonomyTag } from "@shared/types";

export default function DashboardPage() {
  const { attempts, tags, loaded, refresh } = useLedger();
  const recent = [...attempts].reverse().slice(0, 8);
  const top = (Object.entries(tags) as [TaxonomyTag, number][])
    .sort((a, b) => b[1] - a[1])
    .find(([, count]) => count > 0);
  const drill = top ? NEXT_DRILLS[top[0]] : null;

  return (
    <main className="max-w-3xl mx-auto p-8 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Post-Solve Mistake Ledger</h1>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              seedDemo();
              refresh();
            }}
          >
            Seed demo
          </Button>
          <Button asChild>
            <Link href="/practice">Go to Practice</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Error mix</CardTitle>
        </CardHeader>
        <CardContent>
          {loaded ? <ErrorMixChart tags={tags} /> : <p className="text-sm text-muted-foreground">Loading…</p>}
        </CardContent>
      </Card>

      {top && drill ? (
        <Card>
          <CardHeader>
            <CardTitle>Top recurring mistake</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              <Badge>{TAG_LABELS[top[0]]}</Badge> showed up {top[1]} times.
            </p>
            <p className="mt-2 font-medium">{drill.title}</p>
            <p className="text-sm text-muted-foreground">{drill.reason}</p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Recent attempts ({loaded ? attempts.length : 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {!loaded ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : recent.length === 0 ? (
            <p className="text-muted-foreground text-sm">No attempts yet. Seed the demo or solve a practice problem.</p>
          ) : (
            <ul className="space-y-2">
              {recent.map((attempt) => (
                <li key={attempt.id} className="flex items-center justify-between gap-3 text-sm">
                  <Link className="underline underline-offset-2" href={`/attempt/${attempt.id}`}>
                    {attempt.problemTitle}
                  </Link>
                  <span className="flex items-center gap-2">
                    <Badge variant="outline">{attempt.verdict}</Badge>
                    {attempt.analysis?.tags[0] ? (
                      <span className="text-muted-foreground">{attempt.analysis.tags[0]}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
