import Link from "next/link";
import type { Attempt } from "@shared/types";
import { Badge } from "@/components/ui/badge";
import { buildChainNote } from "@/lib/diff";

export function AttemptChain({ attempts }: { attempts: Attempt[] }) {
  const ordered = [...attempts].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const note = buildChainNote(ordered);

  if (ordered.length === 0) {
    return <p className="text-sm text-muted-foreground">No attempts on this problem yet.</p>;
  }

  return (
    <div className="space-y-2">
      {note ? <p className="text-sm">{note}</p> : null}
      <ol className="space-y-2">
        {ordered.map((attempt, index) => (
          <li key={attempt.id} className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Try {index + 1}</span>
            <Badge variant="outline">{attempt.verdict}</Badge>
            <Link className="underline underline-offset-2" href={`/attempt/${attempt.id}`}>
              {new Date(attempt.timestamp).toLocaleString()}
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
