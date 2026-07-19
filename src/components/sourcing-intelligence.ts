export type SourceKind = "channel" | "program" | "institution" | "person";
export type SourceNodeKind = SourceKind | "founder";
export type SourceRelation =
  | "discovered-via"
  | "referred-by"
  | "alumni-of"
  | "member-of";
export type OutcomeStage =
  | "screened"
  | "meeting"
  | "diligence"
  | "funded"
  | "passed";

export interface SourceNode {
  id: string;
  kind: SourceNodeKind;
  name: string;
}

export interface SourceEdge {
  from: string;
  to: string;
  relation: SourceRelation;
  observedAt: string;
}

export interface OutcomeEvent {
  founderId: string;
  stage: OutcomeStage;
  sourceNodeIds: string[];
  trustScore?: number;
  conviction?: string;
  occurredAt: string;
}

export interface ChannelQuality {
  nodeId: string;
  name: string;
  kind: SourceKind;
  founders: number;
  funded: number;
  diligence: number;
  passed: number;
  medianTrust: number | null;
  qualityScore: number;
  band: number;
  note: string;
}

export interface SourcingSuggestion {
  nodeId?: string;
  name: string;
  reason: string;
  explorationScore: number;
  scanHint?: { topics: string[]; minStars?: number };
}

export interface SourcingGraph {
  nodes: SourceNode[];
  edges: SourceEdge[];
  outcomes: OutcomeEvent[];
  quality: ChannelQuality[];
  suggestions: SourcingSuggestion[];
}

export interface OutcomeResponse {
  event: OutcomeEvent;
  quality: ChannelQuality[];
  suggestions: SourcingSuggestion[];
}

const NODE_KINDS: SourceNodeKind[] = [
  "channel",
  "program",
  "institution",
  "person",
  "founder",
];
const SOURCE_KINDS: SourceKind[] = [
  "channel",
  "program",
  "institution",
  "person",
];
const RELATIONS: SourceRelation[] = [
  "discovered-via",
  "referred-by",
  "alumni-of",
  "member-of",
];
const OUTCOME_STAGES: OutcomeStage[] = [
  "screened",
  "meeting",
  "diligence",
  "funded",
  "passed",
];

export function sourcingGraphFromUnknown(
  value: unknown,
): SourcingGraph | undefined {
  if (!value || typeof value !== "object") return undefined;
  const graph = value as Partial<SourcingGraph>;

  if (
    !Array.isArray(graph.nodes) ||
    !graph.nodes.every(isSourceNode) ||
    !Array.isArray(graph.edges) ||
    !graph.edges.every(isSourceEdge) ||
    !Array.isArray(graph.outcomes) ||
    !graph.outcomes.every(isOutcomeEvent) ||
    !Array.isArray(graph.quality) ||
    !graph.quality.every(isChannelQuality) ||
    !Array.isArray(graph.suggestions) ||
    !graph.suggestions.every(isSourcingSuggestion)
  ) {
    return undefined;
  }

  return graph as SourcingGraph;
}

export function outcomeResponseFromUnknown(
  value: unknown,
): OutcomeResponse | undefined {
  if (!value || typeof value !== "object") return undefined;
  const response = value as Partial<OutcomeResponse>;

  if (
    !isOutcomeEvent(response.event) ||
    !Array.isArray(response.quality) ||
    !response.quality.every(isChannelQuality) ||
    !Array.isArray(response.suggestions) ||
    !response.suggestions.every(isSourcingSuggestion)
  ) {
    return undefined;
  }

  return response as OutcomeResponse;
}

export async function postFounderOutcome(
  founderId: string,
  stage: "funded" | "passed",
): Promise<OutcomeResponse> {
  const response = await fetch("/api/outcome", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ founderId, stage }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Outcome update failed with ${response.status}`);
  }

  const payload = outcomeResponseFromUnknown(await response.json());
  if (!payload) throw new Error("Outcome update returned an invalid response");
  return payload;
}

function isSourceNode(value: unknown): value is SourceNode {
  if (!value || typeof value !== "object") return false;
  const node = value as Partial<SourceNode>;
  return (
    typeof node.id === "string" &&
    typeof node.name === "string" &&
    NODE_KINDS.includes(node.kind as SourceNodeKind)
  );
}

function isSourceEdge(value: unknown): value is SourceEdge {
  if (!value || typeof value !== "object") return false;
  const edge = value as Partial<SourceEdge>;
  return (
    typeof edge.from === "string" &&
    typeof edge.to === "string" &&
    typeof edge.observedAt === "string" &&
    RELATIONS.includes(edge.relation as SourceRelation)
  );
}

function isOutcomeEvent(value: unknown): value is OutcomeEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<OutcomeEvent>;
  return (
    typeof event.founderId === "string" &&
    OUTCOME_STAGES.includes(event.stage as OutcomeStage) &&
    isStringArray(event.sourceNodeIds) &&
    (event.trustScore === undefined || typeof event.trustScore === "number") &&
    (event.conviction === undefined || typeof event.conviction === "string") &&
    typeof event.occurredAt === "string"
  );
}

function isChannelQuality(value: unknown): value is ChannelQuality {
  if (!value || typeof value !== "object") return false;
  const quality = value as Partial<ChannelQuality>;
  return (
    typeof quality.nodeId === "string" &&
    typeof quality.name === "string" &&
    SOURCE_KINDS.includes(quality.kind as SourceKind) &&
    isFiniteNumber(quality.founders) &&
    isFiniteNumber(quality.funded) &&
    isFiniteNumber(quality.diligence) &&
    isFiniteNumber(quality.passed) &&
    (quality.medianTrust === null || isFiniteNumber(quality.medianTrust)) &&
    isFiniteNumber(quality.qualityScore) &&
    isFiniteNumber(quality.band) &&
    typeof quality.note === "string"
  );
}

function isSourcingSuggestion(value: unknown): value is SourcingSuggestion {
  if (!value || typeof value !== "object") return false;
  const suggestion = value as Partial<SourcingSuggestion>;
  return (
    (suggestion.nodeId === undefined || typeof suggestion.nodeId === "string") &&
    typeof suggestion.name === "string" &&
    typeof suggestion.reason === "string" &&
    isFiniteNumber(suggestion.explorationScore) &&
    (suggestion.scanHint === undefined || isScanHint(suggestion.scanHint))
  );
}

function isScanHint(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const hint = value as SourcingSuggestion["scanHint"];
  return (
    isStringArray(hint?.topics) &&
    (hint?.minStars === undefined || isFiniteNumber(hint.minStars))
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
