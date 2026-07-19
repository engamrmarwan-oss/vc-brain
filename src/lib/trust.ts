// Trust engine: aggregates the per-claim Trust Score into a founder-level
// TrustReport. Pure and deterministic — no LLM, no I/O, never throws.
//
// Design rules (agreed with Tech Lead):
// - The per-claim list stays the source of truth (brief rule 5); this is a
//   derived headline, never a replacement.
// - Trust is asymmetric: ONE contradicted claim caps the score at 40 no
//   matter how much else is verified. A caught lie outweighs truths.
// - No independent evidence channel -> NO number at all. A score built only
//   on the founder's own deck would be fake confidence; we say so instead
//   and list exactly what would unlock verification.
// - Thin coverage widens the band. Honest uncertainty is a feature.
//
// CONTRACT FROZEN with Codex — changes only via Tech Lead.

import type { Claim, Founder } from "@/lib/types";

export type TrustLabel = "verified" | "caution" | "contradicted" | "insufficient-evidence";

export interface TrustChannel {
  channel: "github" | "linkedin" | "web" | "deck";
  present: boolean;
  detail: string;
}

export interface TrustUnlock {
  action: string;
  unlocks: string;
}

export interface TrustReport {
  score: number | null; // 0-100; null when label is insufficient-evidence
  band: number; // +/- uncertainty, wide = thin evidence
  label: TrustLabel;
  verifiedCount: number;
  contradictedCount: number;
  unverifiableCount: number;
  coverage: { present: number; required: number; channels: TrustChannel[] };
  unlocks: TrustUnlock[];
  rationale: string;
}

// Independent channels that count toward coverage. The deck is tracked for
// display but is self-attestation — it never counts toward the minimum.
const REQUIRED_CHANNELS = 3; // github, linkedin, web

const UNLOCKS: Record<"github" | "linkedin" | "web", TrustUnlock> = {
  github: {
    action: "Add a GitHub repository URL",
    unlocks: "Live verification of traction and open-source claims",
  },
  linkedin: {
    action: "Add a LinkedIn profile URL",
    unlocks: "Employment history and background verification",
  },
  web: {
    action: "Add a company website or public links",
    unlocks: "Press, product, and market footprint checks",
  },
};

const usesSource = (claims: Claim[], pattern: RegExp) =>
  claims.some((c) => pattern.test(c.source));

function detectChannels(founder: Founder, claims: Claim[]): TrustChannel[] {
  // GitHub presence = the founder actually provided a repo, not a claim
  // merely citing GitHub — otherwise "no repo found" absence-observations
  // would count the channel as available.
  const github = !!founder.githubUrl;
  const linkedin = usesSource(claims, /linkedin/i);
  const web =
    (founder.publicFootprint?.length ?? 0) > 0 ||
    founder.entry === "cold-start" ||
    usesSource(claims, /web|tavily/i);
  const deck = founder.deckClaims.length > 0;

  return [
    {
      channel: "github",
      present: github,
      detail: github
        ? founder.githubUrl
          ? "GitHub URL provided — live repo signals fetched"
          : "GitHub signals referenced in evidence"
        : "No GitHub URL provided",
    },
    {
      channel: "linkedin",
      present: linkedin,
      detail: linkedin
        ? "Employment signals matched against claims"
        : "No LinkedIn signal available",
    },
    {
      channel: "web",
      present: web,
      detail: web
        ? "Public web footprint searched"
        : "No public web footprint found or searched",
    },
    {
      channel: "deck",
      present: deck,
      detail: deck
        ? "Founder-submitted deck (self-reported — does not count toward coverage)"
        : "No deck submitted",
    },
  ];
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function buildTrustReport(founder: Founder, claims: Claim[]): TrustReport {
  const verified = claims.filter((c) => c.status === "verified");
  const contradicted = claims.filter((c) => c.status === "contradicted");
  const unverifiable = claims.filter((c) => c.status === "unverifiable");

  const channels = detectChannels(founder, claims);
  const independent = channels.filter((c) => c.channel !== "deck");
  const present = independent.filter((c) => c.present).length;
  const coverageRatio = present / REQUIRED_CHANNELS;
  const coverage = { present, required: REQUIRED_CHANNELS, channels };
  const unlocks = independent
    .filter((c) => !c.present)
    .map((c) => UNLOCKS[c.channel as "github" | "linkedin" | "web"]);

  const base = {
    verifiedCount: verified.length,
    contradictedCount: contradicted.length,
    unverifiableCount: unverifiable.length,
    coverage,
    unlocks,
  };

  // Minimum criteria: at least one independent channel, and at least one
  // claim to judge. Below that, an aggregate would be fake confidence.
  if (present === 0 || claims.length === 0) {
    return {
      ...base,
      score: null,
      band: 0,
      label: "insufficient-evidence",
      rationale:
        claims.length === 0
          ? "No claims to verify yet — screening has not produced a claim list."
          : "Only self-reported deck content available — no independent channel to verify against.",
    };
  }

  // Verified claims add, weighted by confidence; unverifiable claims add
  // nothing but widen the band; coverage adds a little. Not an average.
  const verifiedWeight =
    verified.reduce((s, c) => s + c.confidence, 0) / claims.length; // 0..1
  const unverifiableRatio = unverifiable.length / claims.length;
  let score = 35 + 60 * verifiedWeight + 10 * coverageRatio;

  // Asymmetry: one caught lie caps trust regardless of everything else.
  if (contradicted.length > 0) {
    score = Math.min(score, 40 - 8 * (contradicted.length - 1));
  }
  score = Math.round(clamp(score, 3, 97));

  let band = Math.round(
    clamp(4 + 12 * (1 - coverageRatio) + 8 * unverifiableRatio, 3, 20)
  );

  let label: TrustLabel =
    contradicted.length > 0 ? "contradicted" : score >= 70 ? "verified" : "caution";

  let rationale =
    label === "contradicted"
      ? `${contradicted.length} contradicted claim(s) cap trust regardless of ${verified.length} verified claim(s).`
      : label === "verified"
        ? `${verified.length} of ${claims.length} claims verified across ${present} evidence channel(s).`
        : `Thin evidence: ${verified.length} verified, ${unverifiable.length} unverifiable across ${present} of ${REQUIRED_CHANNELS} channels.`;

  // Cold-start / scraped founders never submitted claims — their "verified"
  // entries are footprint observations, not vetted assertions. The aggregate
  // mirrors the per-claim 0.6 cap: caution at most, wide band, capped score.
  const thinEvidence = founder.entry === "cold-start" || founder.deckClaims.length === 0;
  if (thinEvidence && label === "verified") {
    score = Math.min(score, 65);
    band = Math.max(band, 12);
    label = "caution";
    rationale = `Footprint observations only — no founder-submitted claims to verify; directional trust with a wide band.`;
  }

  return { ...base, score, band, label, rationale };
}
