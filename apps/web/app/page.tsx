"use client";

import { Attempt } from "@shared/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function DashboardPage() {
  const attempts: Attempt[] = []; // Person 1's ledger.getAttempts() plugs in here on Day 3

  return (
    <main className="max-w-3xl mx-auto p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Post-Solve Mistake Ledger</h1>
        <Link href="/practice"><Button>Go to Practice</Button></Link>
      </div>
      <Card>
        <CardHeader><CardTitle>Recent attempts ({attempts.length})</CardTitle></CardHeader>
        <CardContent>
          {attempts.length === 0 ? (
            <p className="text-muted-foreground text-sm">No attempts yet.</p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}