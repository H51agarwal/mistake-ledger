import { Badge } from "@/components/ui/badge";
import type { Attempt } from "@shared/types";

const STYLES: Record<Attempt["verdict"], string> = {
  AC: "glow-ac border-transparent bg-primary/15 text-primary",
  WA: "glow-wa border-transparent bg-destructive/15 text-destructive",
  TLE: "glow-tle border-transparent bg-warning/15 text-warning",
  CE: "glow-ce border-transparent bg-destructive/15 text-destructive",
  RE: "glow-ce border-transparent bg-destructive/15 text-destructive",
};

export function VerdictBadge({ verdict }: { verdict: Attempt["verdict"] }) {
  return (
    <Badge className={`font-mono ${STYLES[verdict]}`}>
      {verdict}
    </Badge>
  );
}