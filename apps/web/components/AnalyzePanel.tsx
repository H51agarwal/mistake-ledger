import type { Feedback } from "@shared/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TAG_LABELS } from "@/lib/taxonomy";

type AnalyzeFeedback = Feedback & { aiGenerated?: boolean };

export function AnalyzePanel({ feedback }: { feedback: AnalyzeFeedback }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Analysis</CardTitle>
        <Badge variant={feedback.aiGenerated ? "default" : "secondary"}>
          {feedback.aiGenerated ? "AI-generated" : "Rule-based"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {feedback.tags.length === 0 ? (
            <Badge variant="secondary">no mistake tag</Badge>
          ) : (
            feedback.tags.map((tag) => (
              <Badge key={tag}>{TAG_LABELS[tag]}</Badge>
            ))
          )}
        </div>
        <p>{feedback.summary}</p>
        {feedback.whatWentWrong.length > 0 ? (
          <div>
            <h3 className="font-medium">What went wrong</h3>
            <ul className="list-disc pl-5 text-muted-foreground">
              {feedback.whatWentWrong.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {feedback.whatWentWell.length > 0 ? (
          <div>
            <h3 className="font-medium">What went well</h3>
            <ul className="list-disc pl-5 text-muted-foreground">
              {feedback.whatWentWell.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {feedback.lineNotes.length > 0 ? (
          <div>
            <h3 className="font-medium">Line notes</h3>
            <ul className="list-disc pl-5 text-muted-foreground">
              {feedback.lineNotes.map((note) => (
                <li key={`${note.line}-${note.note}`}>
                  Line {note.line}: {note.note}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="text-sm text-muted-foreground">
          Complexity {feedback.complexity.estimated} — {feedback.complexity.vsConstraints}
        </p>
        <div>
          <h3 className="font-medium">Next drill</h3>
          <p>{feedback.nextDrill.title}</p>
          <p className="text-sm text-muted-foreground">{feedback.nextDrill.reason}</p>
        </div>
        {feedback.chainNote ? (
          <p className="text-sm">
            <span className="font-medium">Attempt chain: </span>
            {feedback.chainNote}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
