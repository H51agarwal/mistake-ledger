import { NextResponse } from "next/server";
import type { Attempt } from "@shared/types";
import { classify } from "@/lib/heuristics";

export async function POST(req: Request) {
  const body = await req.json();
  const attempt = body?.attempt as Attempt | undefined;
  const priorAttempts = (body?.priorAttempts ?? []) as Attempt[];

  if (!attempt?.id || !attempt.verdict || !attempt.code) {
    return NextResponse.json({ error: "attempt is required" }, { status: 400 });
  }

  // Heuristic baseline — always works with no API key.
  // Person 2 can wrap Gemini around this and fall back here on bad JSON/tags.
  const feedback = classify(attempt, priorAttempts);
  return NextResponse.json(feedback);
}