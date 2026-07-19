// Thesis Engine: turns the VC's thesis config into a fit-adjusted ranking.
// Pure functions, no I/O, never throws — normalizeThesis() accepts any junk
// and returns a valid config, so a malformed request can't break ranking.
//
// The fit score is a RANKING heuristic only. The three screening axes stay
// independent everywhere they are displayed (hard rule: never averaged);
// this module just decides who appears first in the pipeline and who gets
// the "outside thesis" flag.

import type { Assessment, Founder } from "@/lib/types";

export type RiskAppetite = "conservative" | "balanced" | "aggressive";
export type Stage = "pre-seed" | "seed" | "series-a";

// Contract for the thesis form (Screen 1). All fields optional; empty
// sectors/geos mean "no filter". checkSize and ownershipTargetPct are
// captured for the memo/UI but do not move the ranking — an assessment's
// check size derives from the recommendation, not the founder's ask, so
// scoring it here would be fake precision.
export interface ThesisConfig {
  sectors: string[];
  geos: string[];
  stage?: Stage;
  checkSize?: string;
  ownershipTargetPct?: number;
  riskAppetite: RiskAppetite;
}

export interface ThesisFit {
  score: number;          // 0..100 fit-adjusted ranking score
  outsideThesis: boolean; // sector mismatch — render flagged/dimmed, not hidden
  reasons: string[];      // human-readable adjustments, ready for the UI
}

export interface RankedEntry {
  founder: Founder;
  assessment: Assessment;
  fit: ThesisFit;
}

export const DEFAULT_THESIS: ThesisConfig = {
  sectors: [],
  geos: [],
  riskAppetite: "balanced",
};

const RISK_APPETITES: RiskAppetite[] = ["conservative", "balanced", "aggressive"];
const STAGES: Stage[] = ["pre-seed", "seed", "series-a"];

// Minimal region aliases so "Europe only" theses work on city-level seed data.
const GEO_ALIASES: Record<string, string[]> = {
  europe: ["berlin", "oslo", "london", "paris", "amsterdam", "stockholm"],
  eu: ["berlin", "oslo", "london", "paris", "amsterdam", "stockholm"],
  nordics: ["oslo", "stockholm", "copenhagen", "helsinki"],
  dach: ["berlin", "munich", "vienna", "zurich"],
  uk: ["london"],
};

const tokens = (s: string) =>
  s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

function strList(v: unknown): string[] {
  if (typeof v === "string") return v.trim() ? [v.trim()] : [];
  if (Array.isArray(v)) {
    return v.filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.trim());
  }
  return [];
}

// Accepts anything (form payload, partial config, garbage) -> valid config.
export function normalizeThesis(input: unknown): ThesisConfig {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  return {
    sectors: strList(raw.sectors ?? raw.sector),
    geos: strList(raw.geos ?? raw.geo ?? raw.geography ?? raw.geographies),
    stage: STAGES.includes(raw.stage as Stage) ? (raw.stage as Stage) : undefined,
    checkSize: typeof raw.checkSize === "string" && raw.checkSize.trim() ? raw.checkSize.trim() : undefined,
    ownershipTargetPct:
      typeof raw.ownershipTargetPct === "number" && raw.ownershipTargetPct > 0
        ? Math.min(100, raw.ownershipTargetPct)
        : undefined,
    riskAppetite: RISK_APPETITES.includes(raw.riskAppetite as RiskAppetite)
      ? (raw.riskAppetite as RiskAppetite)
      : "balanced",
  };
}

function anyTokenOverlap(thesisValues: string[], founderValue: string): boolean {
  const founderToks = new Set(tokens(founderValue));
  return thesisValues.some((tv) => tokens(tv).some((t) => founderToks.has(t)));
}

function geoMatches(thesisGeos: string[], founderGeo: string): boolean {
  if (anyTokenOverlap(thesisGeos, founderGeo)) return true;
  const founderToks = tokens(founderGeo);
  return thesisGeos.some((g) =>
    tokens(g).some((t) => GEO_ALIASES[t]?.some((city) => founderToks.includes(city)))
  );
}

// Stage is not a Founder field (types are frozen) — infer it, crudely and
// visibly: pre-company / cold-start founders are pre-seed, everyone else in
// this pipeline is seed. Only a soft nudge, never an outside-thesis flag.
function inferStage(f: Founder): Stage {
  if (f.entry === "cold-start" || /pre-company/i.test(f.company)) return "pre-seed";
  return "seed";
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function thesisFit(
  thesis: ThesisConfig,
  founder: Founder,
  assessment: Assessment
): ThesisFit {
  const reasons: string[] = [];

  // Base quality from the assessment: axis verdicts (as ranking inputs, not
  // a displayed average), memory score, trust record, recommendation.
  const axisPart = Object.values(assessment.axes).reduce(
    (sum, a) => sum + (a.verdict === "bullish" ? 2 : a.verdict === "neutral" ? 1 : 0),
    0
  ) * 8; // 0..48
  const contradictions = assessment.claims.filter((c) => c.status === "contradicted").length;
  const recPart =
    assessment.recommendation === "invest" ? 10 : assessment.recommendation === "pass" ? -10 : 0;
  let score = axisPart + founder.founderScore * 0.4 + recPart - contradictions * 12;
  if (contradictions > 0) reasons.push(`${contradictions} contradicted claim(s) penalized`);

  // Sector: the hard thesis boundary.
  let outsideThesis = false;
  if (thesis.sectors.length > 0) {
    if (anyTokenOverlap(thesis.sectors, founder.sector)) {
      score += 15;
      reasons.push("sector in thesis");
    } else {
      score -= 30;
      outsideThesis = true;
      reasons.push(`outside thesis: ${founder.sector} not in [${thesis.sectors.join(", ")}]`);
    }
  }

  // Geography: soft boundary — penalize, don't flag.
  if (thesis.geos.length > 0) {
    if (geoMatches(thesis.geos, founder.geo)) {
      score += 8;
    } else {
      score -= 8;
      reasons.push(`geo ${founder.geo} outside thesis focus`);
    }
  }

  // Stage: inferred, soft nudge only.
  if (thesis.stage && inferStage(founder) !== thesis.stage) {
    score -= 6;
    reasons.push(`inferred stage ${inferStage(founder)} != thesis ${thesis.stage}`);
  }

  // Risk appetite: how thin evidence is weighted. Contradictions are NOT
  // forgiven by aggressiveness — a caught lie is a trust problem, not a bet.
  const thinness = 1 - founder.founderScoreConfidence; // 0 = solid, 1 = unknown
  const coldStart = founder.entry === "cold-start";
  if (thesis.riskAppetite === "conservative") {
    const penalty = 25 * thinness + (coldStart ? 6 : 0);
    if (penalty >= 1) {
      score -= penalty;
      reasons.push("thin evidence discounted (conservative)");
    }
  } else if (thesis.riskAppetite === "balanced") {
    score -= 10 * thinness;
  } else {
    // aggressive: surface high-variance bets instead of burying them
    if (coldStart || thinness > 0.3) {
      score += 14;
      reasons.push("high-variance bet surfaced (aggressive)");
    }
  }

  return { score: Math.round(clamp(score, 0, 100) * 10) / 10, outsideThesis, reasons };
}

// In-thesis founders always rank above outside-thesis ones; within each
// group, by fit score. Outside-thesis founders stay visible (flagged) —
// hiding them would defeat the "why is this here" conversation.
export function rankFounders(
  thesis: ThesisConfig,
  entries: Array<{ founder: Founder; assessment: Assessment }>
): RankedEntry[] {
  return entries
    .map((e) => ({ ...e, fit: thesisFit(thesis, e.founder, e.assessment) }))
    .sort((a, b) =>
      a.fit.outsideThesis !== b.fit.outsideThesis
        ? Number(a.fit.outsideThesis) - Number(b.fit.outsideThesis)
        : b.fit.score - a.fit.score
    );
}
