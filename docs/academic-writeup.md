# Post-Solve Mistake Ledger — Academic write-up

**Team:** 2 · **Date:** 19 September 2026  
**Delivery:** Next.js web ledger + mock judge; optional Gemini enrichment; Chrome extension last if time remains.

## Problem type

This is a **learning-analytics and HCI** project on existing coding judges, not a new online judge.

Students already get a verdict (`AC` / `WA` / `TLE` / `CE` / `RE`). They do not get a durable record of *which mistakes keep repeating* or *what changed between failed and accepted tries on the same problem*. Live AI tutors fill a different gap and are contest-unsafe.

## Hypothesis

Structured post-attempt review of a **personal error taxonomy** improves retention more than rereading editorials or chatting with a general LLM about the last file.

The unit of value is the ledger (tag frequencies + WA → WA → AC chains), not a one-shot AI paragraph.

## What we built (evaluation instrument)

- Mock JavaScript judge (Four problems, Web Worker, 2000ms timeout → TLE)
- Fixed 8-tag classifier that runs with **no API key**
- Local `Attempt` ledger with JSON import/export (same shape for a future extension)
- Dashboard: error-mix chart, top recurring tag, next drill
- `/api/analyze`: heuristics first, Gemini Flash if `GEMINI_API_KEY` is set, schema/tag validation, fallback on failure
- Analyze is **non-functional** until a verdict exists (UI disable + server 400)

## Evaluation plan

A full user study is optional for this course. Minimum evidence:

1. **Demo script (instrument check):** seed history → wrong Two Sum → Analyze locked → Analyze after WA → fix → AC + `chainNote` → dashboard shows a skewed tag (e.g. 7 of 12 WAs `off-by-one`).
2. **Self-study log:** ~10 problems with vs without the ledger; after the week, the user names their last three failure types without looking.
3. **If a small study is possible:** quiz “what is your most expensive recurring mistake?” plus a short interview. Success metric from the report: after about 10 problems the user can answer that question and get one concrete next drill.

## Limitations

- Gemini quality and quota; the app must still run on heuristics alone
- Mock judge is JavaScript-only; no in-browser Python
- LeetCode extension depends on third-party DOM and is the first cut if time is short
- Hidden tests on real judges are not always visible
- Tags are a closed set; they compress nuance

## Official statement

Students practice on web judges and debug in the moment, then lose the lesson. Existing AI tools help while coding and risk cheating. This project stays silent until a submission verdict. It records the attempt, classifies the mistake with a fixed taxonomy, compares failed and accepted versions of the same problem, and builds a personal mistake ledger. AI explains that ledger in plain language and is labeled as AI-generated. The goal is continuous improvement from real attempts, without turning the editor into a live solver.
