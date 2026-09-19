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

async function callGemini(
  attempt: Attempt,
  heuristicResult: Feedback,
  priorAttempts: Attempt[] = [],
): Promise<Feedback | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const prompt = `You are a coding practice coach. Analyze this submission and respond with ONLY valid JSON matching this exact shape, no markdown fences, no extra text:

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
- Base your tags on this heuristic baseline: ${JSON.stringify(heuristicResult.tags)}
- Problem: ${attempt.problemTitle}
- Language: ${attempt.language}
- Verdict: ${attempt.verdict}
- Failed test: ${attempt.failedTest ? JSON.stringify(attempt.failedTest) : "none"}
- Prior attempts on this problem (oldest first): ${JSON.stringify(
    priorAttempts.map((item) => ({ verdict: item.verdict, timestamp: item.timestamp })),
  )}
- Code:
${attempt.code}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
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
} {
  if (!body || typeof body !== "object") {
    return { attempt: null, priorAttempts: [], session: null };
  }

  const record = body as Record<string, unknown>;
  const session = record.session && typeof record.session === "object" ? (record.session as Session) : null;
  const wrapped = record.attempt;
  if (wrapped && typeof wrapped === "object") {
    return {
      attempt: wrapped as Attempt,
      priorAttempts: Array.isArray(record.priorAttempts) ? (record.priorAttempts as Attempt[]) : [],
      session,
    };
  }

  return {
    attempt: body as Attempt,
    priorAttempts: Array.isArray(record.priorAttempts) ? (record.priorAttempts as Attempt[]) : [],
    session,
  };
}

export async function POST(req: Request) {
  const body = await req.json();
  const { attempt, priorAttempts, session } = parseAnalyzeBody(body);

  if (!attempt?.verdict || !attempt.code) {
    return NextResponse.json(
      { error: "No verdict present — analysis is locked until a verdict exists." },
      { status: 400 }
    );
  }

  const heuristicResult = classify(attempt, priorAttempts, session);
  const geminiResult = await callGemini(attempt, heuristicResult, priorAttempts);

  const finalFeedback = geminiResult
    ? {
        ...geminiResult,
        chainNote: geminiResult.chainNote ?? heuristicResult.chainNote,
        improvementNote: geminiResult.improvementNote ?? heuristicResult.improvementNote,
        errorHistory: geminiResult.errorHistory ?? heuristicResult.errorHistory,
      }
    : heuristicResult;
  const aiGenerated = geminiResult !== null;

  return NextResponse.json({ ...finalFeedback, aiGenerated });
}