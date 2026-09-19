import { NextResponse } from "next/server";
import { Attempt, Feedback, Session, TaxonomyTag } from "@shared/types";
import { classify } from "@/lib/heuristics"; 

const VALID_TAGS: TaxonomyTag[] = [
  "syntax",
  "off-by-one",
  "wrong-ds",
  "tle-complexity",
  "overflow-modulo",
  "missed-constraint",
  "implementation-slip",
  "lucky-ac",
];

function isValidFeedback(obj: unknown): obj is Feedback {
  if (!obj || typeof obj !== "object") return false;
  const f = obj as Partial<Feedback>;
  if (!Array.isArray(f.tags) || f.tags.some((t) => !VALID_TAGS.includes(t))) return false;
  if (typeof f.summary !== "string") return false;
  if (!Array.isArray(f.whatWentWrong) || !Array.isArray(f.whatWentWell)) return false;
  if (!Array.isArray(f.lineNotes)) return false;
  if (!f.complexity || typeof f.complexity.estimated !== "string") return false;
  if (!f.nextDrill || typeof f.nextDrill.title !== "string") return false;
  return true;
}

function toInlineImage(dataUrl: string): { mime_type: string; data: string } | null {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!match) return null;
  return { mime_type: match[1], data: match[2] };
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

function sessionTimeline(session: Session | null) {
  if (!session) return null;
  const events = session.events.map((event) => ({
    at: event.at,
    kind: event.kind,
    verdict: event.verdict,
    message: event.message,
  }));
  return {
    problemTitle: session.problemTitle,
    startedAt: session.startedAt,
    screenshotCount: session.events.filter((event) => event.kind === "screenshot").length,
    runAndSubmit: events.filter((event) => event.kind !== "edit"),
  };
}

async function callGemini(
  attempt: Attempt,
  heuristicResult: Feedback,
  priorAttempts: Attempt[] = [],
  screenshots: string[] = [],
  session: Session | null = null,
): Promise<Feedback | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const timeline = sessionTimeline(session);
  const shotCount = screenshots.length;

  const prompt = `You are a post-solve observer. The user already finished this sitting. Analyze the coding PHASE (what happened while they worked), not only the final file. Respond with ONLY valid JSON matching this exact shape, no markdown fences, no extra text:

{
  "tags": string[] (only from: ${VALID_TAGS.join(", ")}),
  "summary": string,
  "whatWentWrong": string[],
  "whatWentWell": string[],
  "lineNotes": [{ "line": number, "note": string }],
  "complexity": { "estimated": string, "vsConstraints": string },
  "nextDrill": { "title": string, "reason": string }
}

Rules:
- Do NOT provide a full corrected solution or suggest specific code fixes.
- Do NOT suggest code changes.
- Do NOT transcribe or reconstruct a solution from screenshots.
- The silent screen recording is the primary evidence. ${shotCount} screenshot(s) of the coding phase are attached.
- In summary and whatWentWrong, describe the workflow visible in those frames (editor layout, stuck loops, run/submit pattern). Mention that ${timeline?.screenshotCount ?? shotCount} silent shot(s) were stored.
- Use the session timeline to say what went wrong during the sitting (failed runs before Analyze).
- Base your tags on this heuristic baseline: ${JSON.stringify(heuristicResult.tags)}
- Problem: ${attempt.problemTitle}
- Language: ${attempt.language}
- Verdict: ${attempt.verdict}
- Failed test: ${attempt.failedTest ? JSON.stringify(attempt.failedTest) : "none"}
- Prior attempts on this problem (oldest first): ${JSON.stringify(
    priorAttempts.map((item) => ({ verdict: item.verdict, timestamp: item.timestamp })),
  )}
- Session timeline: ${JSON.stringify(timeline)}
- Final code:
${attempt.code}`;

  const imageParts = screenshots
    .map(toInlineImage)
    .filter((part): part is { mime_type: string; data: string } => part !== null)
    .map((part) => ({ inline_data: part }));

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, ...imageParts] }],
        }),
      }
    );

    if (!res.ok) {
      console.error("Gemini API error:", res.status, await res.text());
      return null;
    }

    const data = await res.json();
    let text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    text = text.replace(/```json|```/g, "").trim();

    const parsed = JSON.parse(text);
    if (!isValidFeedback(parsed)) {
      console.error("Gemini returned invalid Feedback shape, falling back");
      return null;
    }
    return parsed as Feedback;
  } catch (err) {
    console.error("Gemini call failed:", err);
    return null;
  }
}

function parseAnalyzeBody(body: unknown): {
  attempt: Attempt | null;
  priorAttempts: Attempt[];
  session: Session | null;
  screenshots: string[];
} {
  if (!body || typeof body !== "object") {
    return { attempt: null, priorAttempts: [], session: null, screenshots: [] };
  }

  const record = body as Record<string, unknown>;
  const session = record.session && typeof record.session === "object" ? (record.session as Session) : null;
  const screenshots = Array.isArray(record.screenshots)
    ? record.screenshots.filter((item): item is string => typeof item === "string").slice(-3)
    : [];
  const wrapped = record.attempt;
  if (wrapped && typeof wrapped === "object") {
    return {
      attempt: wrapped as Attempt,
      priorAttempts: Array.isArray(record.priorAttempts) ? (record.priorAttempts as Attempt[]) : [],
      session,
      screenshots,
    };
  }

  return {
    attempt: body as Attempt,
    priorAttempts: Array.isArray(record.priorAttempts) ? (record.priorAttempts as Attempt[]) : [],
    session,
    screenshots,
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { attempt, priorAttempts, session, screenshots } = parseAnalyzeBody(body);

    if (!attempt?.verdict || !attempt.code) {
      return NextResponse.json(
        { error: "No verdict present — analysis is locked until a verdict exists." },
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } },
      );
    }

    const heuristicResult = classify(attempt, priorAttempts, session);
    const geminiResult = await callGemini(attempt, heuristicResult, priorAttempts, screenshots, session);

    const finalFeedback = geminiResult
      ? {
          ...geminiResult,
          chainNote: geminiResult.chainNote ?? heuristicResult.chainNote,
          improvementNote: geminiResult.improvementNote ?? heuristicResult.improvementNote,
          errorHistory: geminiResult.errorHistory ?? heuristicResult.errorHistory,
        }
      : heuristicResult;
    const aiGenerated = geminiResult !== null;

    return NextResponse.json(
      { ...finalFeedback, aiGenerated },
      { headers: { "Access-Control-Allow-Origin": "*" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analyze failed.";
    console.error("Analyze route failed:", err);
    return NextResponse.json(
      { error: message },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }
}