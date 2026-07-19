// Scoring engine. Takes a Founder, returns an Assessment.
// Three axes scored independently — NEVER averaged (brief rule 4).
// Trust Score is per claim: every claim gets status + confidence + evidence
// (brief rule 5). All model traffic goes through callLLM (brief rule 3).

import { fetchFootprint } from "@/agents/coldstart";
import { fetchGitHubSignals } from "@/agents/github";
import { callLLM } from "@/lib/llm";
import { getDeckSummary, getResumeSummary, saveTrace } from "@/lib/store";
import { matchEvidence, TraceCollector, type ClaimCitation } from "@/lib/trace";
import { buildTrustReport } from "@/lib/trust";
import type { Assessment, Axis, AxisVerdict, Claim, Founder, Trend } from "@/lib/types";

// Signals a scout would gather before scoring — fed into the prompt so claim
// verification is grounded in evidence, not vibes. Maya's GitHub reality
// (14 stars, stale repo) is what contradicts her "10,000 active users" claim.
const SIGNALS: Record<string, string[]> = {
  "maya-chen": [
    "GitHub github.com/mayachen/reflex: 14 stars, 2 forks, last commit 7 months ago, zero issue activity in 5 months — repo is effectively dormant",
    "LinkedIn: research engineer at DeepMind 2021–2024, systems team",
    "No Product Hunt launch, no press coverage, no job postings for Reflex AI",
  ],
  "priya-nair": [
    "GitHub github.com/vectorplane: 2.1k stars, 40+ contributors, commits within the last 24h",
    "LinkedIn: staff engineer at Google 2017–2023, vector search infrastructure",
    "KubeCon EU talk on vector DB internals; pilot referenced by a Tier-1 bank engineer on LinkedIn",
  ],
  "dan-okoro": [
    "GitHub github.com/danokoro/ledgerloop: 3 stars, single contributor, active weekly commits",
    "Crunchbase: 6 funded competitors in ledger infra, 2 at Series B or later",
    "No users or design partners found in public footprint",
  ],
  "tomas-halvorsen": [
    "Twitter/X: 3 detailed threads on inference cost optimization, modest but technical audience",
    "Personal blog: 2 posts on LLM routing, technically deep",
    "Half-built landing page for an inference-routing idea; no GitHub, no funding history",
  ],
};

const SYSTEM = `You are the screening engine of an early-stage VC fund.
Score the opportunity on THREE INDEPENDENT axes. Never blend or average them:
- founder: quality/credibility of the founder(s) themselves
- market: size, timing, and competitive dynamics of the market
- ideaVsMarket: how well THIS idea fits THIS market right now

Then run Trust Score: for EACH deck claim, cross-check it against the gathered
signals. If a signal contradicts a claim, mark it "contradicted" and cite the
exact signal as evidence. If signals support it, "verified". If signals are
silent, "unverifiable" — never guess a claim into "verified".
A dormant repo with a handful of stars is NOT consistent with a claim of
thousands of active users — that is a contradiction, flag it.

Respond with ONLY this JSON shape:
{
  "axes": {
    "founder":      {"verdict":"bullish"|"neutral"|"bear","trend":"up"|"flat"|"down","rationale":"one sentence"},
    "market":       {"verdict":"...","trend":"...","rationale":"..."},
    "ideaVsMarket": {"verdict":"...","trend":"...","rationale":"..."}
  },
  "claims": [
    {"text":"the claim verbatim","status":"verified"|"contradicted"|"unverifiable","confidence":0.0-1.0,"evidence":"the exact signal or deck line this rests on","source":"GitHub"|"LinkedIn"|"deck"|"web"}
  ]
}
"confidence" is how confident YOU are in the status you assigned, 0..1.`;

const isGitHubLine = (s: string) => /^github\b/i.test(s.trim());

// Signal gathering: live GitHub first, cached SIGNALS as the safety net.
// If the live fetch succeeds, the fresh line REPLACES the cached GitHub line
// so the model reasons from real repo data. If it fails (404, rate-limit,
// timeout, GitHub down), the cached line stays, explicitly marked stale so
// both the model and the deterministic layer weight it lower. Never throws.
async function gatherSignals(
  f: Founder
): Promise<{ lines: string[]; liveGitHub: boolean }> {
  const cached = SIGNALS[f.id] ?? f.publicFootprint ?? [];

  // Cold-start founders: no repo to inspect — search the public footprint
  // instead. Live snippets are added alongside the cached/seeded signals;
  // on any failure the seeded footprint alone carries the score.
  if (f.entry === "cold-start" && !f.githubUrl) {
    const context = `${f.sector} founder ${f.geo}`;
    const live = await fetchFootprint(f.name, context);
    if (!live || live.length === 0) {
      console.warn(`gatherSignals(${f.id}): live footprint search failed or empty, using seeded footprint`);
      return {
        lines: [
          ...cached,
          "(NOTE: live web footprint search unavailable — signals above are cached snapshots; weight them with lower confidence)",
        ],
        liveGitHub: false,
      };
    }
    const liveLines = live.map(
      (s) => `Web ${s.source} (live Tavily): "${s.snippet}" [${s.url}]`
    );
    return { lines: [...liveLines, ...cached], liveGitHub: false };
  }

  if (!f.githubUrl) return { lines: cached, liveGitHub: false };

  const live = await fetchGitHubSignals(f.githubUrl);
  if (!live) {
    console.warn(`gatherSignals(${f.id}): live GitHub fetch failed for ${f.githubUrl}, using cached signals`);
    return {
      lines: [
        ...cached,
        "(NOTE: live GitHub fetch failed — GitHub lines above are cached snapshots; weight them with lower confidence)",
      ],
      liveGitHub: false,
    };
  }

  const repoPath = f.githubUrl
    .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
    .replace(/\/+$/, "");
  const liveLine =
    `GitHub ${repoPath} (live API): ${live.stars} stars, ${live.forks} forks, ` +
    (live.lastCommitDaysAgo === null
      ? "no commits found"
      : `last commit ${live.lastCommitDaysAgo} days ago`) +
    `, ${live.openIssues} open issues` +
    (live.primaryLanguage ? `, primary language ${live.primaryLanguage}` : "");
  const lines = cached.some(isGitHubLine)
    ? cached.map((s) => (isGitHubLine(s) ? liveLine : s))
    : [liveLine, ...cached];
  return { lines, liveGitHub: true };
}

function buildUserPrompt(f: Founder, signals: string[]): string {
  // Extracted deck summary (if a deck was submitted): axis evidence, so the
  // market axis can weigh the STATED market and ideaVsMarket the described
  // solution. It is the founder's own narrative, not verified fact — claim
  // verification stays per-claim, and signals outrank the deck on conflict.
  const deck = getDeckSummary(f.id);
  const resume = getResumeSummary(f.id);
  return [
    `Founder: ${f.name} — ${f.company} (${f.sector}, ${f.geo}, entry: ${f.entry})`,
    `Founder Score from memory: ${f.founderScore} (confidence ${f.founderScoreConfidence})`,
    ``,
    `Deck claims:`,
    ...(f.deckClaims.length ? f.deckClaims.map((c) => `- ${c}`) : ["(none — cold inbound, score from footprint only)"]),
    ``,
    `Gathered signals:`,
    ...(signals.length ? signals.map((s) => `- ${s}`) : ["(none found)"]),
    ...(deck
      ? [
          ``,
          `Deck executive summary (machine-extracted from the submitted deck —`,
          `the founder's OWN narrative, not verified fact; where it conflicts`,
          `with gathered signals, trust the signals):`,
          `- Snapshot: ${deck.snapshot.slice(0, 500)}`,
          ...(deck.market ? [`- Stated market: ${deck.market.slice(0, 300)}`] : []),
          ...(deck.tractionSignals.length
            ? [`- Stated traction: ${deck.tractionSignals.join("; ").slice(0, 300)}`]
            : []),
          ...(deck.statedMetrics.length
            ? [`- Stated metrics: ${deck.statedMetrics.join("; ").slice(0, 300)}`]
            : []),
          `Use it per axis, independently: market -> reason about the stated`,
          `market size, wedge, and competition; ideaVsMarket -> weigh the`,
          `described solution against what this market rewards right now;`,
          `founder -> factor any stated team background. Reference specifics`,
          `from the deck in your rationales.`,
        ]
      : []),
    ...(resume
      ? [
          ``,
          `Founder background (machine-extracted from the submitted resume —`,
          `self-reported career history; the background claims among the deck`,
          `claims above are verified against gathered signals as usual):`,
          `- ${resume.headline.slice(0, 200)}`,
          ...(resume.roles.length ? [`- Roles: ${resume.roles.join("; ").slice(0, 400)}`] : []),
          ...(resume.education.length
            ? [`- Education: ${resume.education.join("; ").slice(0, 200)}`]
            : []),
          `Factor this into the FOUNDER axis only: experience relevance,`,
          `seniority, domain depth. It does not move market or ideaVsMarket.`,
        ]
      : []),
    ...(isThinEvidence(f)
      ? [
          ``,
          `THIN-EVIDENCE FOUNDER: no deck was submitted (cold-start or scraped`,
          `outbound). All evidence comes from public signals — say so honestly in`,
          `every rationale. Score the founder axis from those signals: technical`,
          `depth, repo quality, communication, domain knowledge. Emit each`,
          `meaningful signal as a claim: status "verified" if directly observed`,
          `in a snippet or signal, otherwise "unverifiable" — NEVER`,
          `"contradicted": this founder claimed nothing, and missing evidence`,
          `(no funding, few users) is thinness, not a refuted lie. Source`,
          `"web:tavily" for live web snippets, "GitHub" for repo signals. Cap`,
          `every confidence at 0.6 — the score rests on limited signals and the`,
          `memo must reflect that. Live web snippets may describe a different`,
          `person with the same name; discount any snippet that does not clearly`,
          `match this founder's domain and geography.`,
        ]
      : []),
  ].join("\n");
}

// ---------- deterministic layer: parse, sanitize, derive ----------

const VERDICTS: AxisVerdict[] = ["bullish", "neutral", "bear"];
const TRENDS: Trend[] = ["up", "flat", "down"];
const STATUSES: Claim["status"][] = ["verified", "contradicted", "unverifiable"];

function sanitizeAxis(raw: unknown, fallback: Axis): Axis {
  const a = raw as Partial<Axis> | undefined;
  return {
    verdict: VERDICTS.includes(a?.verdict as AxisVerdict) ? (a!.verdict as AxisVerdict) : fallback.verdict,
    trend: TRENDS.includes(a?.trend as Trend) ? (a!.trend as Trend) : fallback.trend,
    rationale: typeof a?.rationale === "string" && a.rationale ? a.rationale : fallback.rationale,
  };
}

function sanitizeClaim(raw: unknown): Claim | null {
  const c = raw as Partial<Claim> | undefined;
  if (!c || typeof c.text !== "string" || !c.text) return null;
  return {
    text: c.text,
    status: STATUSES.includes(c.status as Claim["status"]) ? (c.status as Claim["status"]) : "unverifiable",
    confidence: typeof c.confidence === "number" ? Math.min(1, Math.max(0, c.confidence)) : 0.5,
    evidence: typeof c.evidence === "string" && c.evidence ? c.evidence : "no evidence surfaced",
    source: typeof c.source === "string" && c.source ? c.source : "deck",
  };
}

function parseModelJson(raw: string): { axes?: Record<string, unknown>; claims?: unknown[] } {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  return JSON.parse(cleaned);
}

// Demo insurance: Maya's "10,000 active users" must be contradicted. The
// prompt carries the GitHub signal so the model reasons there itself; this
// guard only corrects the record if it doesn't — citing the same GitHub line
// (live or cached) that was actually in the prompt.
function enforceKnownContradictions(
  founder: Founder,
  claims: Claim[],
  signalLines: string[]
): Claim[] {
  if (founder.id !== "maya-chen") return claims;
  const ghLine =
    signalLines.find(isGitHubLine) ??
    "GitHub github.com/mayachen/reflex: 14 stars, last commit 7 months ago";
  return claims.map((c) => {
    if (/10[,.]?000|10k/i.test(c.text) && /user/i.test(c.text) && c.status !== "contradicted") {
      return {
        ...c,
        status: "contradicted",
        confidence: 0.9,
        evidence: `${ghLine} — inconsistent with 10,000 active users`,
        source: "GitHub",
      };
    }
    return c;
  });
}

// The "lower confidence flag" for stale evidence: if this founder has a repo
// but the live fetch failed, GitHub-sourced verdicts rest on cached snapshots
// — cap their confidence so the Trust Score stays honest.
function applyStaleGitHubPenalty(claims: Claim[], liveGitHub: boolean): Claim[] {
  if (liveGitHub) return claims;
  return claims.map((c) =>
    c.source === "GitHub" ? { ...c, confidence: Math.min(c.confidence, 0.7) } : c
  );
}

// Thin evidence = cold-start founders AND scraped outbound candidates with
// no deck: everything rests on public signals.
function isThinEvidence(f: Founder): boolean {
  return f.entry === "cold-start" || f.deckClaims.length === 0;
}

// Thin-evidence honesty: no claim gets to look certain, no matter what the
// model returned. The 0.6 cap also makes "high" conviction unreachable in
// deriveDecision (needs mean confidence >= 0.75) — the wide band is
// enforced in code, not just requested in the prompt. And with zero deck
// claims there is nothing to contradict: a footprint observation the model
// marks "contradicted" (no funding, few users) is thinness, not a caught
// lie — downgrade it so phantom contradictions can't trigger the pass rule
// or inflate flags.
function applyThinEvidenceHonesty(founder: Founder, claims: Claim[]): Claim[] {
  if (!isThinEvidence(founder)) return claims;
  return claims.map((c) => ({
    ...c,
    status:
      c.status === "contradicted" && founder.deckClaims.length === 0
        ? "unverifiable"
        : c.status,
    confidence: Math.min(c.confidence, 0.6),
  }));
}

// recommendation / conviction / checkSize / flags derive deterministically
// from the axes + contradiction count — never left to the model.
function deriveDecision(axes: Assessment["axes"], claims: Claim[]) {
  const contradictions = claims.filter((c) => c.status === "contradicted").length;
  const bearAxes = Object.values(axes).filter((a) => a.verdict === "bear").length;
  const axisScore = Object.values(axes).reduce(
    (sum, a) => sum + (a.verdict === "bullish" ? 2 : a.verdict === "neutral" ? 1 : 0),
    0
  ); // 0..6
  const meanConfidence = claims.length
    ? claims.reduce((s, c) => s + c.confidence, 0) / claims.length
    : 0.5;

  const flags = contradictions + bearAxes;

  let recommendation: Assessment["recommendation"];
  if (contradictions >= 2 || axisScore <= 2) recommendation = "pass";
  else if (contradictions === 0 && axisScore >= 5) recommendation = "invest";
  else recommendation = "conditional";

  let conviction: Assessment["conviction"];
  if (recommendation === "invest" && meanConfidence >= 0.75) conviction = "high";
  else if (recommendation === "pass" || meanConfidence < 0.5) conviction = "low";
  else conviction = "medium";

  const checkSize =
    recommendation === "invest"
      ? conviction === "high"
        ? "$500k–$750k (lead)"
        : "$250k–$500k"
      : recommendation === "conditional"
        ? "$100k–$250k, post-diligence"
        : "$0";

  return { recommendation, conviction, checkSize, flags };
}

// ---------- stub layer: instant, deterministic, correct shape ----------
// Keeps the API green with no key / a failed model call. Maya's stub carries
// the contradiction so the demo moment survives any outage.

const STUB_AXES: Record<string, Assessment["axes"]> = {
  "maya-chen": {
    founder: { verdict: "bullish", trend: "up", rationale: "Ex-DeepMind systems engineer; strong technical pedigree checks out on LinkedIn." },
    market: { verdict: "bullish", trend: "up", rationale: "AI infra spend accelerating; enterprise wedge is well timed." },
    ideaVsMarket: { verdict: "neutral", trend: "flat", rationale: "Credible wedge, but traction story does not survive contact with the repo." },
  },
  "priya-nair": {
    founder: { verdict: "bullish", trend: "up", rationale: "Ex-Google staff engineer with a 2.1k-star OSS repo shipping daily." },
    market: { verdict: "bullish", trend: "up", rationale: "Vector infra demand compounding; enterprise budgets opening." },
    ideaVsMarket: { verdict: "bullish", trend: "up", rationale: "Tier-1 bank pilot shows the wedge converts to enterprise." },
  },
  "dan-okoro": {
    founder: { verdict: "neutral", trend: "flat", rationale: "Strong technical background but first-time founder with no shipped users." },
    market: { verdict: "bear", trend: "down", rationale: "Six funded incumbents, two at Series B+ — crowded and capitalized." },
    ideaVsMarket: { verdict: "neutral", trend: "flat", rationale: "Prototype-stage entry into a market that rewards distribution, not tech." },
  },
  "tomas-halvorsen": {
    founder: { verdict: "neutral", trend: "up", rationale: "No track record, but public writing shows real depth on inference costs." },
    market: { verdict: "bullish", trend: "up", rationale: "Inference cost optimization is a live, growing pain point." },
    ideaVsMarket: { verdict: "neutral", trend: "flat", rationale: "Thin evidence either way — idea plausible, execution unproven." },
  },
};

const STUB_CLAIMS: Record<string, Claim[]> = {
  "maya-chen": [
    { text: "Technical founder, ex-DeepMind", status: "verified", confidence: 0.92, evidence: "LinkedIn: research engineer at DeepMind 2021–2024", source: "LinkedIn" },
    { text: "10,000 active users", status: "contradicted", confidence: 0.9, evidence: "GitHub github.com/mayachen/reflex: 14 stars, last commit 7 months ago — inconsistent with 10,000 active users", source: "GitHub" },
    { text: "AI infra market, enterprise wedge", status: "verified", confidence: 0.8, evidence: "Sector positioning consistent with public materials and market data", source: "web" },
  ],
  "priya-nair": [
    { text: "Ex-Google, shipped vector DB used by 40 teams internally", status: "verified", confidence: 0.85, evidence: "LinkedIn: staff engineer at Google 2017–2023, vector search infrastructure", source: "LinkedIn" },
    { text: "Open-source repo with 2.1k stars", status: "verified", confidence: 0.97, evidence: "GitHub github.com/vectorplane: 2.1k stars, 40+ contributors, daily commits", source: "GitHub" },
    { text: "Enterprise pilot with a Tier-1 bank", status: "unverifiable", confidence: 0.55, evidence: "One LinkedIn mention by a bank engineer; no public confirmation", source: "web" },
  ],
  "dan-okoro": [
    { text: "First-time founder, strong technical background", status: "verified", confidence: 0.75, evidence: "GitHub shows consistent, competent solo commits", source: "GitHub" },
    { text: "Crowded market: 6 well-funded incumbents", status: "verified", confidence: 0.85, evidence: "Crunchbase: 6 funded competitors, 2 at Series B+", source: "web" },
    { text: "Early prototype, no users yet", status: "verified", confidence: 0.9, evidence: "No users or design partners in public footprint — matches the deck's own admission", source: "web" },
  ],
  "tomas-halvorsen": [],
};

function stubAssessment(founder: Founder): Omit<Assessment, "speedSeconds"> {
  const axes =
    STUB_AXES[founder.id] ??
    ({
      founder: { verdict: "neutral", trend: "flat", rationale: "No signals gathered yet." },
      market: { verdict: "neutral", trend: "flat", rationale: "No signals gathered yet." },
      ideaVsMarket: { verdict: "neutral", trend: "flat", rationale: "No signals gathered yet." },
    } satisfies Assessment["axes"]);
  const claims = applyThinEvidenceHonesty(
    founder,
    STUB_CLAIMS[founder.id] ??
      founder.deckClaims.map((text) => ({
        text,
        status: "unverifiable" as const,
        confidence: 0.5,
        evidence: "no evidence surfaced",
        source: "deck",
      }))
  );
  return { founderId: founder.id, axes, claims, ...deriveDecision(axes, claims) };
}

// ---------- entry point ----------

// Stub results are demo insurance, not the truth — callers must never cache
// them (a poisoned cache would serve the stub until the founder changes).
// WeakSet marker instead of a field: the Assessment type is frozen.
const STUB_RESULTS = new WeakSet<Assessment>();
export function wasStubFallback(a: Assessment): boolean {
  return STUB_RESULTS.has(a);
}

// Post-hoc citation matching: claims cite evidence by text overlap, so the
// scoring prompt and frozen types stay untouched. Conservative matcher — a
// missing citation is flagged `uncited`, never invented.
function buildCitations(
  claims: Claim[],
  trace: TraceCollector
): ClaimCitation[] {
  const refs = trace.refs();
  return claims.map((c) => {
    const evidenceIds = matchEvidence(`${c.text} ${c.evidence}`, refs);
    return { claimText: c.text, evidenceIds, uncited: evidenceIds.length === 0 };
  });
}

export async function scoreFounder(founder: Founder): Promise<Assessment> {
  const t0 = Date.now();
  const trace = new TraceCollector(founder.id);
  try {
    // Live signal gathering happens inside the timing window — speedSeconds
    // measures signal -> decision, not just the LLM call.
    const gathered = await gatherSignals(founder);
    const signalRefs = trace.addSignalLines(gathered.lines);
    trace.step(
      "extractor",
      "Gather live and cached signals",
      `${signalRefs.length} evidence signal(s); GitHub ${
        founder.githubUrl ? (gathered.liveGitHub ? "live API" : "cached/unavailable") : "not provided"
      }`,
      {
        evidenceIds: signalRefs.map((r) => r.id),
        status: signalRefs.length ? "supported" : "insufficient",
        startedAt: t0,
      }
    );

    const deckSum = getDeckSummary(founder.id);
    if (deckSum) {
      const deckRefs = [
        trace.addEvidence("deck", deckSum.snapshot, {
          title: "Deck: company snapshot",
          locator: { section: "executive-summary" },
        }),
        ...deckSum.claims.map((c) =>
          trace.addEvidence("deck", c, { title: "Deck claim", locator: { section: "claims" } })
        ),
      ];
      trace.step(
        "extractor",
        "Load deck executive summary",
        `snapshot + ${deckSum.claims.length} extracted claim(s) fed to axis scoring`,
        { evidenceIds: deckRefs.map((r) => r.id), status: "supported" }
      );
    }
    const resumeSum = getResumeSummary(founder.id);
    if (resumeSum) {
      const resumeRefs = [
        trace.addEvidence("resume", resumeSum.headline, {
          title: "Resume: career headline",
          locator: { section: "headline" },
        }),
        ...resumeSum.backgroundClaims.map((c) =>
          trace.addEvidence("resume", c, {
            title: "Resume background claim",
            locator: { section: "background" },
          })
        ),
      ];
      trace.step(
        "extractor",
        "Load resume career signal",
        `${resumeSum.roles.length} role(s), ${resumeSum.backgroundClaims.length} background claim(s) fed to founder axis`,
        { evidenceIds: resumeRefs.map((r) => r.id), status: "supported" }
      );
    }

    // Retry/backoff and cross-backend fallback live inside callLLM.
    const tLLM = Date.now();
    const raw = await callLLM({
      system: SYSTEM,
      user: buildUserPrompt(founder, gathered.lines),
      tier: "reasoning",
      json: true,
    });
    const parsed = parseModelJson(raw);
    const fallback = stubAssessment(founder);

    const axes: Assessment["axes"] = {
      founder: sanitizeAxis(parsed.axes?.founder, fallback.axes.founder),
      market: sanitizeAxis(parsed.axes?.market, fallback.axes.market),
      ideaVsMarket: sanitizeAxis(parsed.axes?.ideaVsMarket, fallback.axes.ideaVsMarket),
    };
    const sanitized = (Array.isArray(parsed.claims) ? parsed.claims : [])
      .map(sanitizeClaim)
      .filter((c): c is Claim => c !== null);
    trace.step(
      "scorer",
      "Score three independent axes + verify claims (reasoning model)",
      `founder=${axes.founder.verdict} market=${axes.market.verdict} ideaVsMarket=${axes.ideaVsMarket.verdict}; ${sanitized.length} claim verdict(s) returned`,
      { status: "supported", startedAt: tLLM }
    );

    const claims = enforceKnownContradictions(founder, sanitized, gathered.lines);
    const guardCorrected = claims.filter((c, i) => c.status !== sanitized[i]?.status).length;
    if (guardCorrected > 0) {
      trace.step(
        "guard",
        "Deterministic contradiction guard",
        `corrected ${guardCorrected} claim verdict(s) the model missed, citing gathered GitHub evidence`,
        { status: "corrected" }
      );
    }

    // A model that returns axes but drops the claims array still owes a
    // Trust Score — fall back to stub claims rather than an empty list.
    const rawFinalClaims = claims.length || !founder.deckClaims.length ? claims : fallback.claims;
    const finalClaims = applyThinEvidenceHonesty(
      founder,
      founder.githubUrl
        ? applyStaleGitHubPenalty(rawFinalClaims, gathered.liveGitHub)
        : rawFinalClaims
    );
    const capped = finalClaims.filter(
      (c, i) =>
        rawFinalClaims[i] &&
        (c.confidence !== rawFinalClaims[i].confidence || c.status !== rawFinalClaims[i].status)
    ).length;
    if (capped > 0) {
      trace.step(
        "guard",
        "Evidence-honesty caps",
        `${capped} claim(s) capped: stale-evidence / thin-evidence confidence limits applied in code`,
        { status: "corrected" }
      );
    }

    const decision = deriveDecision(axes, finalClaims);
    trace.step(
      "scorer",
      "Derive recommendation deterministically",
      `${decision.recommendation} / ${decision.conviction} conviction, ${decision.flags} flag(s) — from axes + contradiction count, not the model`,
      { status: "info" }
    );

    const trust = buildTrustReport(founder, finalClaims);
    trace.step(
      "trust-engine",
      "Aggregate founder-level Trust Score",
      `Trust ${trust.score ?? "n/a"} ±${trust.band} (${trust.label}); coverage ${trust.coverage.present}/${trust.coverage.required} channels`,
      {
        status:
          trust.label === "contradicted"
            ? "challenged"
            : trust.label === "insufficient-evidence"
              ? "insufficient"
              : "supported",
      }
    );

    saveTrace(
      trace.finish(buildCitations(finalClaims, trace), {
        founder: matchEvidence(axes.founder.rationale, trace.refs()),
        market: matchEvidence(axes.market.rationale, trace.refs()),
        ideaVsMarket: matchEvidence(axes.ideaVsMarket.rationale, trace.refs()),
      })
    );

    return {
      founderId: founder.id,
      axes,
      claims: finalClaims,
      ...decision,
      speedSeconds: (Date.now() - t0) / 1000,
    };
  } catch (err) {
    // No key, provider outage, or malformed JSON — the demo still runs.
    console.warn(`scoreFounder(${founder.id}) fell back to stub:`, err);
    const stub = { ...stubAssessment(founder), speedSeconds: (Date.now() - t0) / 1000 };
    STUB_RESULTS.add(stub);
    trace.step(
      "scorer",
      "Primary scoring unavailable",
      "LLM call failed after retries — deterministic stub served (not cached, not validated)",
      { status: "insufficient" }
    );
    saveTrace(
      trace.finish(buildCitations(stub.claims, trace), {
        founder: [],
        market: [],
        ideaVsMarket: [],
      })
    );
    return stub;
  }
}
