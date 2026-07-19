// Validator agent: independent cross-check of the primary agent's claim
// verdicts against freshly gathered evidence (live GitHub + Tavily web
// search — best-effort, no proprietary databases). Single pass, then a
// deterministic adjudicator.
//
// HARD RULES (agreed with Tech Lead):
// - DOWNGRADE ONLY. verified -> unverifiable/contradicted, unverifiable ->
//   contradicted. Never an upgrade — a hallucination checker that can
//   upgrade claims is a hallucination injector.
// - No verdict changes without independent evidence attached.
// - The cached assessment is NEVER mutated: the report is a side-channel
//   overlay. Trust-after is recomputed on a copy.
// - Fail-soft: any failure returns independentlyValidated: false with the
//   primary result untouched.

import { tavilySearch } from "@/agents/coldstart";
import { fetchGitHubSignals } from "@/agents/github";
import { callLLM } from "@/lib/llm";
import { getTrace, saveTrace } from "@/lib/store";
import type { EvidenceRef } from "@/lib/trace";
import { buildTrustReport, type TrustReport } from "@/lib/trust";
import type { Assessment, Claim, Founder } from "@/lib/types";

export type ValidationIssue =
  | "unsupported"
  | "source-conflict"
  | "stale-source"
  | "wrong-entity"
  | "market-comparable-mismatch";

export interface ValidationResult {
  claimText: string;
  originalStatus: Claim["status"];
  validatedStatus: Claim["status"];
  confidence: number;
  evidenceIds: string[];
  issues: ValidationIssue[];
  note?: string;
}

export interface ValidationReport {
  founderId: string;
  validatedAt: string;
  results: ValidationResult[];
  revisedCount: number;
  upheldCount: number;
  independentlyValidated: boolean;
  trustAfter: TrustReport | null;
}

const STATUS_RANK: Record<Claim["status"], number> = {
  verified: 2,
  unverifiable: 1,
  contradicted: 0,
};

const ISSUES: ValidationIssue[] = [
  "unsupported",
  "source-conflict",
  "stale-source",
  "wrong-entity",
  "market-comparable-mismatch",
];

const VALIDATOR_SYSTEM = `You are an independent VALIDATOR for a VC screening
engine. A primary agent already assigned verdicts to founder claims. You get
the claims plus FRESH independent evidence gathered just now. Your job is to
catch overstatement and hallucination — nothing else.

STRICT RULES:
- You may KEEP a verdict or DOWNGRADE it (verified -> unverifiable or
  contradicted; unverifiable -> contradicted). NEVER upgrade.
- Only change a verdict if a listed evidence item justifies it, and cite that
  evidence id. No evidence id -> keep the original verdict.
- Evidence about a different company or a different person with a similar
  name must be flagged "wrong-entity" and never used to verify anything.

Respond with ONLY this JSON shape:
{"results":[{"claimText":"exact claim text","validatedStatus":"verified"|"unverifiable"|"contradicted",
"issues":["unsupported"|"source-conflict"|"stale-source"|"wrong-entity"|"market-comparable-mismatch"],
"evidenceIds":["vev-1"],"confidence":0.0-1.0,"note":"one short sentence"}]}
Include every claim exactly once, claimText verbatim.`;

function upheldAll(claims: Claim[], independentlyValidated: boolean): ValidationResult[] {
  return claims.map((c) => ({
    claimText: c.text,
    originalStatus: c.status,
    validatedStatus: c.status,
    confidence: 0.5,
    evidenceIds: [],
    issues: [],
    note: independentlyValidated ? undefined : "not independently checked",
  }));
}

export async function validateFounder(
  founder: Founder,
  assessment: Assessment
): Promise<ValidationReport> {
  const validatedAt = new Date().toISOString();
  const claims = assessment.claims.slice(0, 8);
  const base: ValidationReport = {
    founderId: founder.id,
    validatedAt,
    results: upheldAll(claims, false),
    revisedCount: 0,
    upheldCount: claims.length,
    independentlyValidated: false,
    trustAfter: null,
  };
  if (claims.length === 0) return base;

  try {
    // Independent evidence, gathered fresh (not the primary run's inputs).
    const wantsMarket = claims.some((c) => /market|\$|billion|arr|revenue|round/i.test(c.text));
    const [gh, webCompany, webMarket] = await Promise.all([
      founder.githubUrl ? fetchGitHubSignals(founder.githubUrl) : Promise.resolve(null),
      tavilySearch(`"${founder.company}" ${founder.sector} traction users funding`),
      wantsMarket
        ? tavilySearch(`${founder.sector} market size funding rounds`)
        : Promise.resolve(null),
    ]);

    let n = 0;
    const evidence: EvidenceRef[] = [];
    const addRef = (type: EvidenceRef["type"], excerpt: string, url?: string) => {
      evidence.push({
        id: `vev-${++n}`,
        type,
        title: excerpt.slice(0, 60),
        excerpt: excerpt.slice(0, 300),
        url,
        capturedAt: validatedAt,
      });
    };
    if (gh) {
      addRef(
        "github",
        `GitHub (validator re-fetch): ${gh.stars} stars, ${gh.forks} forks, ` +
          (gh.lastCommitDaysAgo === null
            ? "no commits found"
            : `last commit ${gh.lastCommitDaysAgo} days ago`) +
          `, ${gh.openIssues} open issues`,
        founder.githubUrl
      );
    }
    for (const s of [...(webCompany ?? []), ...(webMarket ?? [])].slice(0, 6)) {
      addRef("web", `[${s.source}] ${s.snippet}`, s.url);
    }

    // Nothing independent to check against — say so, change nothing.
    if (evidence.length === 0) return base;

    const user = [
      `Founder: ${founder.name} — ${founder.company} (${founder.sector}, ${founder.geo})`,
      ``,
      `Claims with the primary agent's verdicts:`,
      ...claims.map((c) => `- [${c.status}] ${c.text}`),
      ``,
      `Fresh independent evidence:`,
      ...evidence.map((e) => `- (${e.id}) ${e.excerpt}`),
    ].join("\n");

    const raw = await callLLM({ system: VALIDATOR_SYSTEM, user, tier: "volume", json: true });
    const parsed = JSON.parse(
      raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "")
    );
    const byText = new Map<string, Record<string, unknown>>(
      (Array.isArray(parsed?.results) ? parsed.results : [])
        .filter((r: Record<string, unknown>) => typeof r?.claimText === "string")
        .map((r: Record<string, unknown>) => [r.claimText as string, r])
    );
    const knownIds = new Set(evidence.map((e) => e.id));

    // Deterministic adjudication: enforce the hard rules no matter what the
    // validator model returned.
    const results: ValidationResult[] = claims.map((c) => {
      const v = byText.get(c.text);
      const proposed =
        v && ["verified", "unverifiable", "contradicted"].includes(v.validatedStatus as string)
          ? (v.validatedStatus as Claim["status"])
          : c.status;
      const evidenceIds = (Array.isArray(v?.issues) || Array.isArray(v?.evidenceIds)
        ? ((v?.evidenceIds as unknown[]) ?? [])
        : []
      ).filter((id): id is string => typeof id === "string" && knownIds.has(id));
      const issues = (Array.isArray(v?.issues) ? (v!.issues as unknown[]) : []).filter(
        (i): i is ValidationIssue => ISSUES.includes(i as ValidationIssue)
      );
      const isUpgrade = STATUS_RANK[proposed] > STATUS_RANK[c.status];
      const changedWithoutEvidence = proposed !== c.status && evidenceIds.length === 0;
      const validatedStatus = isUpgrade || changedWithoutEvidence ? c.status : proposed;
      const confidence =
        typeof v?.confidence === "number" ? Math.min(1, Math.max(0, v.confidence)) : 0.7;
      return {
        claimText: c.text,
        originalStatus: c.status,
        validatedStatus,
        confidence,
        evidenceIds,
        issues,
        note:
          typeof v?.note === "string" && v.note
            ? v.note.slice(0, 200)
            : isUpgrade
              ? "validator proposed an upgrade — rejected by adjudicator"
              : undefined,
      };
    });

    const revised = results.filter((r) => r.validatedStatus !== r.originalStatus);
    // Trust recomputed on a COPY with revised statuses — the cached
    // assessment itself is never mutated.
    const revisedClaims: Claim[] = assessment.claims.map((c) => {
      const r = results.find((x) => x.claimText === c.text);
      return r && r.validatedStatus !== c.status ? { ...c, status: r.validatedStatus } : c;
    });
    const trustAfter = buildTrustReport(founder, revisedClaims);

    // Append the validator's evidence + step to the audit trail.
    const trace = getTrace(founder.id);
    if (trace) {
      trace.evidence.push(...evidence);
      trace.steps.push({
        id: `step-validator-${trace.steps.length + 1}`,
        agent: "validator",
        action: "Independent cross-check (web + repo, best-effort)",
        conclusion: `${results.length - revised.length} verdict(s) upheld, ${revised.length} revised; trust after validation: ${trustAfter.score ?? "n/a"} (${trustAfter.label})`,
        evidenceIds: evidence.map((e) => e.id),
        status: revised.length > 0 ? "corrected" : "supported",
        durationMs: Date.now() - new Date(validatedAt).getTime(),
      });
      saveTrace(trace);
    }

    return {
      founderId: founder.id,
      validatedAt,
      results,
      revisedCount: revised.length,
      upheldCount: results.length - revised.length,
      independentlyValidated: true,
      trustAfter,
    };
  } catch (err) {
    console.warn(`validateFounder(${founder.id}) failed — primary result kept:`, err);
    return base; // independentlyValidated: false, nothing changed
  }
}
