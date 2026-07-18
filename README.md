# VC Brain

Founder discovery + evidence-traced investment memos in <60s. Hack-Nation 6th Global AI.

## Deploy runbook (do in this order — deploy green BEFORE features)
1. `npm install`
2. `cp .env.example .env.local` and fill OPENAI_API_KEY + TAVILY_API_KEY
3. `npm run dev` -> open http://localhost:3000/api/health -> must show {ok:true}
4. Push to GitHub, import to Vercel, add the same env vars in Vercel settings
5. Hit https://YOUR-APP.vercel.app/api/health -> must be green before building UI

## Architecture
- No database. In-memory store (src/lib/store.ts), seeded at boot.
- One model swap point (src/lib/models.ts + llm.ts). OpenAI default, Anthropic fallback.
- Trust Score = per-claim evidence tracing. Three axes, never averaged.
- Cold-start scoring via Tavily public-footprint search.

See CLAUDE.md for the full build brief.
