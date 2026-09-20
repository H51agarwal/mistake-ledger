import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import type { Attempt } from "@shared/types";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const DATA_FILE = path.join(process.cwd(), ".data", "extension-ledger.json");

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET() {
  return NextResponse.json({ attempts: await readAttempts() }, { headers: CORS });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const incoming = Array.isArray(body?.attempts)
      ? body.attempts
      : [body?.attempt ?? body];
    const valid = incoming.filter(isAttempt);
    if (valid.length === 0) {
      return NextResponse.json({ error: "No valid Attempt in body." }, { status: 400, headers: CORS });
    }

    const existing = await readAttempts();
    const byId = new Map(existing.map((item) => [item.id, item]));
    for (const attempt of valid) {
      byId.set(attempt.id, attempt);
    }
    const attempts = [...byId.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    await writeAttempts(attempts);
    return NextResponse.json({ ok: true, attempts }, { headers: CORS });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ledger write failed.";
    return NextResponse.json({ error: message }, { status: 500, headers: CORS });
  }
}

async function readAttempts(): Promise<Attempt[]> {
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isAttempt);
  } catch {
    return [];
  }
}

async function writeAttempts(attempts: Attempt[]): Promise<void> {
  await mkdir(path.dirname(DATA_FILE), { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(attempts, null, 2), "utf8");
}

function isAttempt(value: unknown): value is Attempt {
  if (!value || typeof value !== "object") return false;
  const attempt = value as Partial<Attempt>;
  return (
    typeof attempt.id === "string" &&
    typeof attempt.problemSlug === "string" &&
    typeof attempt.problemTitle === "string" &&
    (attempt.platform === "mock" || attempt.platform === "leetcode") &&
    typeof attempt.language === "string" &&
    typeof attempt.code === "string" &&
    (attempt.verdict === "AC" ||
      attempt.verdict === "WA" ||
      attempt.verdict === "TLE" ||
      attempt.verdict === "CE" ||
      attempt.verdict === "RE") &&
    typeof attempt.timestamp === "string"
  );
}
