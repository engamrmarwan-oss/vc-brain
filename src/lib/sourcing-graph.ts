// Sourcing & Network Intelligence (full): the graph of channels, programs,
// institutions, and people through which founders become visible — plus the
// outcome feedback loop that teaches it which channels produce QUALITY.
// Deterministic and explainable throughout: Bayesian shrinkage, not ML.
// Pure computation + store reads/appends. Never throws.
//
// Learning scope is one session by design (no-DB architecture): OutcomeEvent
// is append-only in shape, so a persistent event store drops in cleanly
// post-hackathon. CONTRACT FROZEN with Codex.

import { SEED_NODES, SIMILARITY, TOPIC_SIBLINGS } from "@/data/sourcing-seed";
import { provenanceFor } from "@/lib/sourcing";
import {
  addOutcomeEvent,
  allFounders,
  getAssessment,
  getSourcingSeedData,
} from "@/lib/store";
import { buildTrustReport } from "@/lib/trust";
import type { Founder } from "@/lib/types";

export type NodeKind = "channel" | "program" | "institution" | "person" | "founder";
export interface SourceNode {
  id: string;
  kind: NodeKind;
  name: string;
}
export type EdgeRelation = "discovered-via" | "referred-by" | "alumni-of" | "member-of";
export interface SourceEdge {
  from: string; // founder node
  to: string; // source node
  relation: EdgeRelation;
  observedAt: string;
}
export type OutcomeStage = "screened" | "meeting" | "diligence" | "funded" | "passed";
export interface OutcomeEvent {
  founderId: string;
  stage: OutcomeStage;
  sourceNodeIds: string[]; // every contributing node, even attribution split
  trustScore?: number;
  conviction?: string;
  occurredAt: string;
}

export interface ChannelQuality {
  nodeId: string;
  name: string;
  kind: NodeKind;
  founders: number;
  funded: number;
  diligence: number;
  passed: number;
  medianTrust: number | null;
  qualityScore: number; // 0-100, shrinkage-adjusted — never volume-driven
  band: number; // uncertainty from sample size
  note: string;
}

export interface SourcingSuggestion {
  nodeId?: string; // absent for not-yet-created channels (topic siblings)
  name: string;
  reason: string;
  explorationScore: number;
  scanHint?: { topics: string[]; minStars?: number }; // POST to /api/discover
}

export interface SourcingGraph {
  nodes: SourceNode[];
  edges: SourceEdge[];
  outcomes: OutcomeEvent[];
  quality: ChannelQuality[];
  suggestions: SourcingSuggestion[];
}

export const OUTCOME_STAGES: OutcomeStage[] = [
  "screened",
  "meeting",
  "diligence",
  "funded",
  "passed",
];

// Map the lite provenance channel ids onto graph node ids.
const LITE_TO_GRAPH: Record<string, string> = {
  "outbound-oss-scout": "ch-oss-scout",
  "inbound-application": "ch-inbound",
  "cold-start-scout": "ch-coldstart-scout",
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return Math.round(s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2);
};

// Prior strength for shrinkage: a channel needs ~K founders of evidence
// before its own rate outweighs the global prior — one lucky founder can't
// outrank twenty consistently strong ones.
const K = 3;

function liveTrust(f: Founder): number | null {
  const a = getAssessment(f.id);
  if (!a) return null;
  return buildTrustReport(f, a.claims).score;
}

// Everything derived fresh from store state: live founders join the seeded
// graph dynamically, so the graph always reflects the current pipeline.
function assembleGraph(): { nodes: SourceNode[]; edges: SourceEdge[]; outcomes: OutcomeEvent[] } {
  const { edges: seedEdges, outcomes } = getSourcingSeedData();
  const nodes = new Map<string, SourceNode>(SEED_NODES.map((n) => [n.id, n]));
  const edges: SourceEdge[] = [...seedEdges];

  for (const f of allFounders()) {
    nodes.set(f.id, { id: f.id, kind: "founder", name: f.name });
    const p = provenanceFor(f);
    const channelId =
      LITE_TO_GRAPH[p.channelId] ?? `ch-github-${p.channelId.replace(/^github-topic:/, "")}`;
    if (!nodes.has(channelId)) {
      nodes.set(channelId, { id: channelId, kind: "channel", name: p.channelName });
    }
    edges.push({
      from: f.id,
      to: channelId,
      relation: "discovered-via",
      observedAt: new Date().toISOString().slice(0, 10),
    });
  }
  return { nodes: [...nodes.values()], edges, outcomes };
}

function computeQuality(
  nodes: SourceNode[],
  edges: SourceEdge[],
  outcomes: OutcomeEvent[]
): ChannelQuality[] {
  const founderNodes = new Set(nodes.filter((n) => n.kind === "founder").map((n) => n.id));
  const liveById = new Map(allFounders().map((f) => [f.id, f]));

  // Latest recorded trust per founder (live assessment wins over event history).
  const eventTrust = new Map<string, number>();
  for (const o of outcomes) if (o.trustScore !== undefined) eventTrust.set(o.founderId, o.trustScore);

  const stageSet = (stage: OutcomeStage) =>
    new Set(outcomes.filter((o) => o.stage === stage).map((o) => o.founderId));
  const fundedSet = stageSet("funded");
  const diligenceSet = stageSet("diligence");

  const allWithOutcomes = new Set(outcomes.map((o) => o.founderId));
  const globalFundedRate = allWithOutcomes.size ? fundedSet.size / allWithOutcomes.size : 0.1;
  const globalDiligenceRate = allWithOutcomes.size ? diligenceSet.size / allWithOutcomes.size : 0.15;

  return nodes
    .filter((n) => n.kind !== "founder")
    .map((node) => {
      // Founders connected by graph edges OR credited via outcome attribution.
      const connected = new Set<string>();
      for (const e of edges) if (e.to === node.id && founderNodes.has(e.from)) connected.add(e.from);
      for (const o of outcomes) if (o.sourceNodeIds.includes(node.id)) connected.add(o.founderId);

      const n = connected.size;
      // Stage credit flows ONLY through outcome attribution (sourceNodeIds),
      // never through mere graph connectivity — an alumni-of employer is
      // background context, and must not inherit funded credit.
      const creditedFor = (stage: OutcomeStage) =>
        new Set(
          outcomes
            .filter((o) => o.stage === stage && o.sourceNodeIds.includes(node.id))
            .map((o) => o.founderId)
        ).size;
      const funded = creditedFor("funded");
      const dil = creditedFor("diligence");
      const passed = creditedFor("passed");
      const trusts = [...connected]
        .map((id) => {
          const live = liveById.get(id);
          return live ? liveTrust(live) : (eventTrust.get(id) ?? null);
        })
        .filter((t): t is number => t !== null);
      const medianTrust = median(trusts);

      // Bayesian shrinkage toward the global rate.
      const shrunkFunded = (K * globalFundedRate + funded) / (K + n);
      const shrunkDiligence = (K * globalDiligenceRate + dil) / (K + n);
      const qualityScore = Math.round(
        100 * (0.45 * shrunkFunded + 0.2 * shrunkDiligence + 0.35 * ((medianTrust ?? 50) / 100))
      );
      const band = clamp(Math.round(4 + 22 / Math.max(n, 1)), 4, 25);

      return {
        nodeId: node.id,
        name: node.name,
        kind: node.kind,
        founders: n,
        funded,
        diligence: dil,
        passed,
        medianTrust,
        qualityScore,
        band,
        note:
          n === 0
            ? "no founders yet — prior only"
            : n < 5
              ? `n=${n} — shrunk toward global prior, treat as directional`
              : `n=${n}`,
      };
    })
    .sort((a, b) => b.qualityScore - a.qualityScore);
}

function computeSuggestions(quality: ChannelQuality[]): SourcingSuggestion[] {
  const byId = new Map(quality.map((q) => [q.nodeId, q]));
  const withData = quality.filter((q) => q.founders > 0);
  const globalMean = withData.length
    ? withData.reduce((s, q) => s + q.qualityScore, 0) / withData.length
    : 40;

  const suggestions: SourcingSuggestion[] = [];

  // Underexplored existing nodes: thin coverage + strong adjacent evidence.
  for (const q of quality.filter((x) => x.founders <= 1)) {
    const similar = (SIMILARITY[q.nodeId] ?? [])
      .map((id) => byId.get(id))
      .filter((x): x is ChannelQuality => !!x && x.founders > 0);
    const sameKind = withData.filter((x) => x.kind === q.kind && x.nodeId !== q.nodeId);
    const basis = similar.length ? similar : sameKind;
    const base = basis.length
      ? basis.reduce((s, x) => s + x.qualityScore, 0) / basis.length
      : globalMean;
    const fundedNeighbor = basis.some((x) => x.funded > 0);
    const explorationScore = Math.round(
      0.8 * base + 18 / (1 + q.founders) + (fundedNeighbor ? 8 : 0)
    );
    const evidence = basis.length
      ? `adjacent ${basis.length > 1 ? "nodes" : "node"} ${basis.map((x) => x.name).join(", ")} ${
          fundedNeighbor ? "produced funded deals" : "show strong trust signals"
        }`
      : "no adjacent evidence yet";
    suggestions.push({
      nodeId: q.nodeId,
      name: q.name,
      reason: `underexplored: ${q.founders} founder(s) sourced, but ${evidence} — run a targeted scan`,
      explorationScore,
    });
  }

  // Sibling GitHub topics of proven scrape channels — directly scannable.
  for (const [topic, siblings] of Object.entries(TOPIC_SIBLINGS)) {
    const proven = byId.get(`ch-github-${topic}`);
    if (!proven || proven.founders === 0) continue;
    for (const sib of siblings) {
      if (byId.has(`ch-github-${sib}`)) continue; // already a channel
      suggestions.push({
        name: `GitHub scrape — ${sib}`,
        reason: `sibling topic of ${proven.name} (quality ${proven.qualityScore} across ${proven.founders} founders) — unscanned`,
        explorationScore: Math.round(0.7 * proven.qualityScore + 15),
        scanHint: { topics: [sib], minStars: 200 },
      });
    }
  }

  suggestions.sort((a, b) => b.explorationScore - a.explorationScore);
  const top = suggestions.slice(0, 4);
  // Always surface at least one directly actionable (scannable) suggestion.
  if (!top.some((s) => s.scanHint)) {
    const scannable = suggestions.find((s) => s.scanHint);
    if (scannable) top[top.length - 1] = scannable;
  }
  return top;
}

export function buildSourcingGraph(): SourcingGraph {
  const { nodes, edges, outcomes } = assembleGraph();
  const quality = computeQuality(nodes, edges, outcomes);
  return { nodes, edges, outcomes, quality, suggestions: computeSuggestions(quality) };
}

// Attribution: every contributing source node, never just the last touch.
// Sourcing credit goes to discovery/referral/community edges — an employer
// on a resume (alumni-of) is background, not sourcing.
export function sourceNodesForFounder(founderId: string): string[] {
  const { edges } = assembleGraph();
  return [
    ...new Set(
      edges
        .filter(
          (e) =>
            e.from === founderId &&
            (e.relation === "discovered-via" || e.relation === "referred-by" || e.relation === "member-of")
        )
        .map((e) => e.to)
    ),
  ];
}

export function recordOutcome(
  founder: Founder,
  stage: OutcomeStage,
  explicitNodeIds?: string[]
): OutcomeEvent {
  const derived = sourceNodesForFounder(founder.id);
  const assessment = getAssessment(founder.id);
  const trust = assessment ? buildTrustReport(founder, assessment.claims) : null;
  const event: OutcomeEvent = {
    founderId: founder.id,
    stage,
    sourceNodeIds: explicitNodeIds?.length ? explicitNodeIds : derived.length ? derived : ["ch-inbound"],
    ...(trust?.score !== null && trust !== null ? { trustScore: trust.score } : {}),
    ...(assessment ? { conviction: assessment.conviction } : {}),
    occurredAt: new Date().toISOString(),
  };
  addOutcomeEvent(event);
  return event;
}
