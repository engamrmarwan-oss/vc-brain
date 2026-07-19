# VC Brain

**Evidence-first founder screening.** VC Brain turns a pitch deck into an investment memo in under a minute — with every claim verified against live public signals, every conclusion traced to the exact evidence that produced it, and honest uncertainty wherever the evidence is thin.

Built for the Maschmeyer Group "The VC Brain" challenge at the Hack-Nation 6th Global AI Hackathon.

## What it does

**Screens on three independent axes.** Founder, Market, and Idea-vs-Market are scored separately — each with its own verdict, trend, and rationale. They are never averaged into a single number, because a great founder in a bad market is a different conversation than the reverse.

**Verifies every claim.** Deck claims ("10,000 active users") are checked against live GitHub repo data, employment signals, and web footprint. Each claim gets a verdict — verified, contradicted, or unverifiable — with the exact evidence attached. A claimed traction number that doesn't survive contact with a dormant repository comes back flagged red.

**Aggregates trust honestly.** A founder-level Trust Score is derived from the claim verdicts with three hard rules: one contradicted claim caps trust regardless of everything else; no independent evidence means *no score at all* (plus a list of exactly what to submit to unlock one); thin evidence widens the uncertainty band instead of hiding it. A cold-start founder with only a blog and some technical threads reads "64 ±14, thin evidence" — never a fake-precise number.

**Shows its work.** Every memo carries citations that open the underlying evidence — the deck excerpt, the repo stats, the web snippet — and a step-by-step audit trail of the screening run. An independent validator agent can re-check any screen against freshly gathered evidence; it may only downgrade verdicts, never upgrade them, and it flags wrong-entity evidence (a similarly-named company is not your company).

**Reads the documents.** Founders upload a pitch deck and optionally a resume (PDF). Claims are extracted and fed straight into verification; resume parsing keeps career signal only — no contact details or personal information.

**Sources outbound.** Live GitHub topic search discovers founders who never applied, scores them through the same engine, and models the sourcing network — which channels, programs, and people produce high-trust opportunities. Marking a deal funded feeds back into channel rankings (quality-weighted with proper small-sample shrinkage, never raw volume), and the system suggests underexplored channels worth scanning next.

**Ranks by thesis.** A configurable investment thesis (sectors, geography, stage, risk appetite) re-ranks the pipeline: out-of-thesis founders are flagged rather than hidden, and risk appetite controls how thin-evidence bets are weighted.

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in keys (see below)
npm run dev                  # http://localhost:3000
```

| Variable | Required | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | yes | Primary scoring and extraction models |
| `TAVILY_API_KEY` | yes | Web-footprint search and validation |
| `ANTHROPIC_API_KEY` | recommended | Automatic fallback provider if OpenAI is unavailable |
| `GITHUB_TOKEN` | recommended | Raises GitHub API limits (60 → 5,000 req/hr) |
| `MODEL_BACKEND` | no | `openai` (default) or `anthropic` |

Deploy: push to GitHub, import into Vercel, add the same environment variables, and check `/api/health` returns `{ok:true}`. Note: uploads on Vercel are limited to ~4.5 MB per request.

## API surface

| Endpoint | Purpose |
|---|---|
| `POST /api/apply` | Submit a founder application (JSON or multipart with deck/resume PDFs) |
| `POST /api/score` | Screen a founder (`{ id, fresh? }`) — returns assessment + trust report |
| `GET/POST /api/rank` | Thesis-lens ranked pipeline; POST saves a new thesis |
| `POST /api/discover` | Outbound founder discovery via GitHub topic search |
| `POST /api/validate` | Independent validator pass over a founder's claims |
| `GET /api/trace?id=` | Audit trail of the latest screening run |
| `GET /api/deck?id=` / `GET /api/resume?id=` | Extracted document summaries |
| `GET /api/document?id=&type=` | Original uploaded files |
| `GET /api/sourcing/graph` | Sourcing network, channel quality, suggestions |
| `POST /api/outcome` | Record a deal outcome — feeds channel quality |
| `GET /api/health` | Deployment health check |

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · OpenAI with Anthropic fallback · Tavily · GitHub API · deployed on Vercel.

State is held in-memory per server session by design — the demo scope is a single screening session, and every external call is fail-soft: a provider outage degrades an answer, never the pipeline.
