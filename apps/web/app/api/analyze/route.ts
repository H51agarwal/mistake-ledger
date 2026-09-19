import { NextResponse } from "next/server";
import { Feedback } from "@shared/types";

export async function POST(req: Request) {
  const body = await req.json(); 

  const stubFeedback: Feedback = {
    tags: ["off-by-one"],
    summary: "Stub feedback — real classifier wires in Day 2.",
    whatWentWrong: ["This is a placeholder response."],
    whatWentWell: [],
    lineNotes: [],
    complexity: { estimated: "O(n)", vsConstraints: "unknown" },
    nextDrill: { title: "TBD", reason: "TBD" },
  };

  return NextResponse.json(stubFeedback);
}