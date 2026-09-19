# Post-Solve Mistake Ledger — Academic write-up

**Team:** 2 · **Date:** 19 September 2026  
**Delivery:** Silent screen observer + Next.js mistake ledger + mock judge; Gemini explains the coding phase only after Analyze. Chrome extension shipped as a LeetCode paste-fallback (no screen capture).

## Problem type

This is a **learning-analytics and HCI** project on existing coding judges, not a new online judge.

Students already get a verdict (`AC` / `WA` / `TLE` / `CE` / `RE`). They do not get a durable record of *which mistakes keep repeating* or *what changed between failed and accepted tries on the same problem*. Live AI tutors fill a different gap and are contest-unsafe.

## Hypothesis

Structured post-attempt review of a **personal error taxonomy** improves retention more than rereading editorials or chatting with a general LLM about the last file.

The unit of value is the ledger (tag frequencies + WA → WA → AC chains), not a one-shot AI paragraph.

## What we built (evaluation instrument)

- **Core:** `Watch screen` (`getDisplayMedia`) records the coding phase silently — JPEG every 10s, max 24, stored in IndexedDB. Analyze is locked until a verdict *and* at least one screenshot exist.
- Session events (`run`, `submit`, `screenshot`) remember what went wrong during the sitting; analysis is written only on the Analyze click.
- Mock JavaScript judge (Four problems, Web Worker, 2000ms timeout → TLE)
- Fixed 8-tag classifier that runs with **no API key**
- Local `Attempt` ledger with JSON import/export (same shape as the Chrome extension bridge)
- Dashboard: error-mix chart, top recurring tag, next drill
- `/api/analyze`: heuristics first; Gemini Flash receives the session timeline plus the last 3 screenshots as vision `inline_data` and must describe workflow, not extract a solution. Schema/tag validation; fallback on failure. CORS `OPTIONS` so the extension can call the same route.
- Chrome extension (Manifest V3): side panel sits beside LeetCode. **Watch tab** captures the visible problem tab silently (JPEG, ~12s, max 24). Content script reads the editor and the verdict. Analyze is locked until a verdict and at least one shot; it posts the same `{ attempt, session, screenshots }` body as the web app. Paste is only a fallback if Monaco scrape is empty.

## Ethics (screen capture)

Screen frames are captured only after the user clicks Watch screen and picks a tab. They stay on-device (IndexedDB) until Analyze. The last three frames may be sent to Gemini as images. The prompt forbids transcribing a solution from those frames. Capture stops on Analyze. No live hints are shown while the user is coding.

## Evaluation plan

A full user study is optional for this course. Minimum evidence:

1. **Demo script (instrument check):** Watch screen → share the practice tab → wrong Two Sum → Analyze locked until verdict + first shot → Analyze after WA (workflow + shot count) → fix → AC + `chainNote` → dashboard shows a skewed tag (e.g. 7 of 12 WAs `off-by-one`).
2. **Self-study log:** ~10 problems with vs without the ledger; after the week, the user names their last three failure types without looking.
3. **If a small study is possible:** quiz “what is your most expensive recurring mistake?” plus a short interview. Success metric from the report: after about 10 problems the user can answer that question and get one concrete next drill.

## Limitations

- Gemini quality and quota; the app must still run on heuristics alone
- Mock judge is JavaScript-only; no in-browser Python
- LeetCode extension depends on third-party DOM and `captureVisibleTab` (the tab must stay visible). Demo web Watch screen if the site markup changes.
- Hidden tests on real judges are not always visible
- Tags are a closed set; they compress nuance

## Official statement

Students practice on web judges and debug in the moment, then lose the lesson. Existing AI tools help while coding and risk cheating. This project watches the screen silently during the sitting, stores that coding phase, and stays quiet until the user clicks Analyze after a verdict. It classifies the mistake with a fixed taxonomy, compares failed and accepted versions of the same problem, and builds a personal mistake ledger. AI describes the recorded workflow in plain language and is labeled as AI-generated. The goal is continuous improvement from the real sitting, without turning the editor into a live solver.
