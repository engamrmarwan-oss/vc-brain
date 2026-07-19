// Agentic traceability: structured decision trace for every scoring run.
// NOT raw chain-of-thought — a typed audit trail of evidence used, checks
// performed, corrections applied, and conclusions reached. Pure helpers +
// a collector; no I/O, no LLM. Evidence IDs are assigned HERE at creation
// time (deterministic); claims are matched to evidence post-hoc by text
// overlap — the scoring prompt and frozen types are untouched.
//
// CONTRACT FROZEN with Codex (Beta) — changes only via Tech Lead.
// Clients match citations to rendered claims by exact claimText equality.

export type EvidenceType =
  | "deck"
  | "resume"
  | "github"
  | "linkedin"
  | "web"
  | "footprint"
  | "interview"
  | "market-db";

export interface EvidenceRef {
  id: string;
  type: EvidenceType;
  title: string;
  excerpt: string;
  url?: string;
  locator?: { page?: number; section?: string };
  capturedAt: string;
}

export interface DecisionStep {
  id: string;
  agent: "extractor" | "scorer" | "guard" | "trust-engine" | "validator";
  action: string;
  conclusion: string;
  evidenceIds: string[];
  status: "supported" | "challenged" | "corrected" | "insufficient" | "info";
  durationMs: number;
}

export interface ClaimCitation {
  claimText: string; // exact string as served in Assessment.claims[].text
  evidenceIds: string[];
  uncited: boolean; // matched no independent evidence — render honestly
}

export interface TraceReport {
  runId: string;
  founderId: string;
  generatedAt: string;
  evidence: EvidenceRef[];
  steps: DecisionStep[];
  claimCitations: ClaimCitation[];
  axisEvidenceIds: { founder: string[]; market: string[]; ideaVsMarket: string[] };
}

// ---------- text matching (deterministic, additive) ----------

const STOP = new Set([
  "the", "and", "for", "with", "from", "that", "this", "has", "have", "was",
  "are", "not", "its", "their", "our", "per", "into", "over", "across",
]);

function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2 && !STOP.has(t))
  );
}

// Evidence relevance: shared significant tokens between a claim (text +
// its evidence line) and a ref excerpt. Threshold of 3 shared tokens or a
// direct substring hit keeps matches conservative — a wrong citation is
// worse than a missing one.
export function matchEvidence(text: string, refs: EvidenceRef[], max = 3): string[] {
  const t = tokens(text);
  const lower = text.toLowerCase();
  const scored = refs
    .map((r) => {
      const rt = tokens(`${r.title} ${r.excerpt}`);
      let shared = 0;
      for (const tok of rt) if (t.has(tok)) shared++;
      const substring =
        lower.includes(r.excerpt.toLowerCase().slice(0, 60)) ||
        r.excerpt.toLowerCase().includes(lower.slice(0, 60));
      return { id: r.id, score: shared + (substring ? 5 : 0) };
    })
    .filter((x) => x.score >= 3)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, max).map((x) => x.id);
}

const extractUrl = (s: string): string | undefined =>
  s.match(/https?:\/\/[^\s\])"']+/)?.[0] ??
  (s.match(/\bgithub\.com\/[\w.-]+(?:\/[\w.-]+)?/i)?.[0]
    ? `https://${s.match(/\bgithub\.com\/[\w.-]+(?:\/[\w.-]+)?/i)![0]}`
    : undefined);

export function classifySignalLine(line: string): EvidenceType {
  if (/^github\b/i.test(line.trim())) return "github";
  if (/linkedin/i.test(line)) return "linkedin";
  if (/^web\b|tavily/i.test(line.trim())) return "web";
  return "footprint";
}

// ---------- collector ----------

export class TraceCollector {
  private evidence: EvidenceRef[] = [];
  private steps: DecisionStep[] = [];
  private nEv = 0;
  private nStep = 0;
  private t0 = Date.now();

  constructor(private founderId: string) {}

  addEvidence(
    type: EvidenceType,
    excerpt: string,
    opts: { title?: string; url?: string; locator?: EvidenceRef["locator"] } = {}
  ): EvidenceRef {
    const ref: EvidenceRef = {
      id: `ev-${++this.nEv}`,
      type,
      title: opts.title ?? excerpt.slice(0, 60),
      excerpt: excerpt.slice(0, 300),
      url: opts.url ?? extractUrl(excerpt),
      locator: opts.locator,
      capturedAt: new Date().toISOString(),
    };
    this.evidence.push(ref);
    return ref;
  }

  addSignalLines(lines: string[]): EvidenceRef[] {
    return lines
      .filter((l) => !l.trim().startsWith("(NOTE")) // meta-notes are not evidence
      .map((l) => this.addEvidence(classifySignalLine(l), l));
  }

  step(
    agent: DecisionStep["agent"],
    action: string,
    conclusion: string,
    opts: { evidenceIds?: string[]; status?: DecisionStep["status"]; startedAt?: number } = {}
  ): void {
    this.steps.push({
      id: `step-${++this.nStep}`,
      agent,
      action,
      conclusion,
      evidenceIds: opts.evidenceIds ?? [],
      status: opts.status ?? "info",
      durationMs: opts.startedAt ? Date.now() - opts.startedAt : 0,
    });
  }

  refs(): EvidenceRef[] {
    return this.evidence;
  }

  finish(
    claimCitations: ClaimCitation[],
    axisEvidenceIds: TraceReport["axisEvidenceIds"]
  ): TraceReport {
    return {
      runId: `${this.founderId}-${this.t0.toString(36)}`,
      founderId: this.founderId,
      generatedAt: new Date().toISOString(),
      evidence: this.evidence,
      steps: this.steps,
      claimCitations,
      axisEvidenceIds,
    };
  }
}
