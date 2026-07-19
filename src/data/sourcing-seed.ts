// Seeded sourcing graph: the network through which founders became visible,
// plus HISTORICAL outcomes so channel quality has something to learn from on
// day one. Historical founders (hist-*) exist only as graph nodes — they are
// not in the live pipeline. Live pipeline founders get their edges built
// dynamically from provenance at graph-build time.

import type { OutcomeEvent, SourceEdge, SourceNode } from "@/lib/sourcing-graph";

export const SEED_NODES: SourceNode[] = [
  // channels
  { id: "ch-inbound", kind: "channel", name: "Inbound application" },
  { id: "ch-oss-scout", kind: "channel", name: "Outbound scout — OSS community" },
  { id: "ch-coldstart-scout", kind: "channel", name: "Cold-start scout — public footprint" },
  // programs
  { id: "prog-kubecon-eu", kind: "program", name: "KubeCon EU" },
  { id: "prog-eth-ai-center", kind: "program", name: "ETH AI Center" },
  // institutions
  { id: "inst-deepmind", kind: "institution", name: "DeepMind" },
  { id: "inst-google", kind: "institution", name: "Google" },
  // people
  { id: "person-jkeller", kind: "person", name: "Jonas Keller — OSS maintainer" },
  // historical founders (graph-only, drive channel history)
  { id: "hist-lena-fischer", kind: "founder", name: "Lena Fischer (Klarwerk, funded 2025)" },
  { id: "hist-arun-mehta", kind: "founder", name: "Arun Mehta (Loopdesk, passed 2025)" },
];

export const SEED_EDGES: SourceEdge[] = [
  // live pipeline founders — network context beyond their discovery channel
  { from: "priya-nair", to: "prog-kubecon-eu", relation: "member-of", observedAt: "2026-07-01" },
  { from: "priya-nair", to: "inst-google", relation: "alumni-of", observedAt: "2026-07-01" },
  { from: "priya-nair", to: "person-jkeller", relation: "referred-by", observedAt: "2026-07-05" },
  { from: "maya-chen", to: "inst-deepmind", relation: "alumni-of", observedAt: "2026-07-10" },
  // historical founders — the channel history the quality model learns from
  { from: "hist-lena-fischer", to: "ch-oss-scout", relation: "discovered-via", observedAt: "2025-03-12" },
  { from: "hist-lena-fischer", to: "prog-kubecon-eu", relation: "member-of", observedAt: "2025-03-12" },
  { from: "hist-arun-mehta", to: "ch-inbound", relation: "discovered-via", observedAt: "2025-05-02" },
];

export const SEED_OUTCOMES: OutcomeEvent[] = [
  // Lena: OSS-scout sourced, went the distance — this is why that channel ranks
  { founderId: "hist-lena-fischer", stage: "screened", sourceNodeIds: ["ch-oss-scout", "prog-kubecon-eu"], trustScore: 74, occurredAt: "2025-03-20" },
  { founderId: "hist-lena-fischer", stage: "diligence", sourceNodeIds: ["ch-oss-scout", "prog-kubecon-eu"], trustScore: 78, occurredAt: "2025-04-18" },
  { founderId: "hist-lena-fischer", stage: "funded", sourceNodeIds: ["ch-oss-scout", "prog-kubecon-eu"], trustScore: 78, occurredAt: "2025-05-30" },
  // Arun: inbound, passed after screen
  { founderId: "hist-arun-mehta", stage: "screened", sourceNodeIds: ["ch-inbound"], trustScore: 45, occurredAt: "2025-05-10" },
  { founderId: "hist-arun-mehta", stage: "passed", sourceNodeIds: ["ch-inbound"], trustScore: 45, occurredAt: "2025-05-24" },
  // live pipeline: screening events only — "Mark funded" on stage does the rest
  { founderId: "priya-nair", stage: "screened", sourceNodeIds: ["ch-oss-scout", "prog-kubecon-eu", "person-jkeller"], trustScore: 70, occurredAt: "2026-07-18" },
  { founderId: "priya-nair", stage: "meeting", sourceNodeIds: ["ch-oss-scout", "prog-kubecon-eu", "person-jkeller"], trustScore: 70, occurredAt: "2026-07-19" },
  { founderId: "maya-chen", stage: "screened", sourceNodeIds: ["ch-inbound"], trustScore: 40, occurredAt: "2026-07-19" },
  { founderId: "tomas-halvorsen", stage: "screened", sourceNodeIds: ["ch-coldstart-scout"], trustScore: 64, occurredAt: "2026-07-19" },
  { founderId: "dan-okoro", stage: "screened", sourceNodeIds: ["ch-inbound"], trustScore: 50, occurredAt: "2026-07-19" },
];

// Similarity priors for exploration scoring: which unproven nodes resemble
// proven ones. Static and explainable — no embedding magic in a demo.
export const SIMILARITY: Record<string, string[]> = {
  "prog-eth-ai-center": ["inst-deepmind", "prog-kubecon-eu"],
};

// Sibling GitHub topics of channels that performed — candidate new scrape
// channels, directly actionable via /api/discover.
export const TOPIC_SIBLINGS: Record<string, string[]> = {
  "llm-inference": ["model-serving", "ml-infrastructure"],
};
