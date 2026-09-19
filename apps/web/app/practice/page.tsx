import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProblemSummaries } from "@/lib/judge/problems";

export default function PracticePage() {
  const problems = getProblemSummaries();

  return (
    <main className="max-w-3xl mx-auto p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Practice</h1>
        <Link className="text-sm underline underline-offset-2" href="/">
          Dashboard
        </Link>
      </div>
      <p className="text-sm text-muted-foreground">
        Open a problem, click Watch screen, share this tab, then solve. The ledger remembers that coding phase and explains it only after Analyze.
      </p>
      <ul className="space-y-3">
        {problems.map((problem) => (
          <li key={problem.slug}>
            <Link href={`/practice/${problem.slug}`}>
              <Card>
                <CardHeader>
                  <CardTitle>{problem.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{problem.prompt}</p>
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
