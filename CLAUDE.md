# VC Brain — Claude Code build brief (Builder Alpha)

You are Builder Alpha for a 24-hour solo hackathon. Solo founder is the Tech Lead
above you. Challenge: Maschmeyer Group "The VC Brain" (Hack-Nation 6th Global AI).
Optimizing for 1st place. Read this fully before writing code.

## Hard rules (encoded from prior-hackathon failures — do not violate)
1. NO DATABASE. State lives in `src/lib/store.ts` (in-memory). Do not add Prisma,
   Neon, SQLite, or any persistence. Deploy risk killed the last build; this
   deletes it. A judge only sees one session — in-memory is enough.
2. DEPLOY GREEN FIRST. Before any feature, confirm `next build` passes and
   `/api/health` returns `{ok:true}` on Vercel. Do not build features on a red build.
3. One model swap point: `src/lib/models.ts` + `src/lib/llm.ts`. Never call a
   provider anywhere else. Backend defaults to OpenAI; Anthropic is fallback.
4. Three screening axes are NEVER averaged. Founder / Market / Idea-vs-Market are
   independent, each with its own verdict + trend. Collapsing them loses points.
5. Trust Score is PER CLAIM, not per company. Each claim traces to evidence with a
   confidence 0..1. Contradictions are flagged. This is the moat — protect it.
6. Cold-start is required, not optional. The founder with no GitHub/funding
   (Tomas) must get a score from public footprint, WITH a wide confidence band.
   An honest "64 ±14, thin evidence" beats a fake-confident number.

## Priority order (build in this exact sequence)
P0. Scaffold Next.js (App Router, TypeScript, Tailwind). Wire `@/` path alias.
    Confirm `/api/health` green locally, commit, push, confirm green on Vercel.
P1. Scoring engine `src/agents/score.ts`: takes a Founder, returns an Assessment
    (see src/lib/types.ts). Uses callLLM. For each deck claim, produce a Claim
    with status + confidence + evidence. For Maya, the "10,000 active users"
    claim MUST come back contradicted (GitHub shows a near-dead repo). Instrument
    speedSeconds (Date.now diff around the pipeline).
P2. Screen 3 — founder memo `/founder/[id]`. THE moat screen. Render axes (not
    averaged), the per-claim Trust Score list with the red contradicted flag,
    speed readout, recommendation + conviction. Match the mockup already designed.
P3. Screen 2 — ranked list `/` (VC view). All founders, scored, F/M/I marks,
    scraped + inbound side by side. Row click -> memo.
P4. Screen 1 — thesis setup, and Screen 4 — founder apply (thin form). Add the
    VC/Founder view toggle threading through all screens.
P5. Cold-start: `src/agents/coldstart.ts` uses Tavily (TAVILY_API_KEY) to pull
    public-footprint signals for Tomas and score with wide bands.
P6. Polish: streaming reveal on the memo (SSE or progressive), "Trust verified"
    visible states. Seed feels production-ready. Then STOP building, rehearse.

## Demo climax this must deliver (build backward from it)
Toggle to Founder view -> apply as Maya (deck + name) -> toggle to VC view ->
Maya appears in ranked list -> open her memo -> the "10,000 users" claim is
flagged red against GitHub evidence. Then open Tomas (cold-start) to show scoring
someone with no track record, honestly, with confidence bands.

## Stack
Next.js App Router, TypeScript, TailwindCSS, deployed on Vercel.
Env vars: OPENAI_API_KEY, TAVILY_API_KEY, MODEL_BACKEND=openai,
optional ANTHROPIC_API_KEY. Put them in .env.local AND Vercel project settings.

## Build script (package.json)
"build": "next build"  — no prisma generate needed (no DB).

## Files already provided (do not rewrite, extend)
src/lib/models.ts, src/lib/llm.ts, src/lib/types.ts, src/lib/store.ts,
src/data/seed.ts, src/app/api/health/route.ts
