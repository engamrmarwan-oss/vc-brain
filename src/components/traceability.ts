import {
  trustReportFromUnknown,
  type TrustReport,
} from "@/components/trust-report";

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
  claimText: string;
  evidenceIds: string[];
  uncited: boolean;
}

export interface TraceReport {
  runId: string;
  founderId: string;
  generatedAt: string;
  evidence: EvidenceRef[];
  steps: DecisionStep[];
  claimCitations: ClaimCitation[];
  axisEvidenceIds: {
    founder: string[];
    market: string[];
    ideaVsMarket: string[];
  };
}

export type ClaimStatus = "verified" | "contradicted" | "unverifiable";
export type ValidationIssue =
  | "unsupported"
  | "source-conflict"
  | "stale-source"
  | "wrong-entity"
  | "market-comparable-mismatch";

export interface ValidationResult {
  claimText: string;
  originalStatus: ClaimStatus;
  validatedStatus: ClaimStatus;
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

const EVIDENCE_TYPES: EvidenceType[] = [
  "deck",
  "resume",
  "github",
  "linkedin",
  "web",
  "footprint",
  "interview",
  "market-db",
];
const STEP_AGENTS: DecisionStep["agent"][] = [
  "extractor",
  "scorer",
  "guard",
  "trust-engine",
  "validator",
];
const STEP_STATUSES: DecisionStep["status"][] = [
  "supported",
  "challenged",
  "corrected",
  "insufficient",
  "info",
];
const CLAIM_STATUSES: ClaimStatus[] = [
  "verified",
  "contradicted",
  "unverifiable",
];
const VALIDATION_ISSUES: ValidationIssue[] = [
  "unsupported",
  "source-conflict",
  "stale-source",
  "wrong-entity",
  "market-comparable-mismatch",
];

export function traceReportFromUnknown(value: unknown): TraceReport | undefined {
  const candidate = unwrap(value, "trace") as Partial<TraceReport> | undefined;
  if (
    !candidate ||
    typeof candidate.runId !== "string" ||
    typeof candidate.founderId !== "string" ||
    typeof candidate.generatedAt !== "string" ||
    !Array.isArray(candidate.evidence) ||
    !candidate.evidence.every(isEvidenceRef) ||
    !Array.isArray(candidate.steps) ||
    !candidate.steps.every(isDecisionStep) ||
    !Array.isArray(candidate.claimCitations) ||
    !candidate.claimCitations.every(isClaimCitation) ||
    !isAxisEvidence(candidate.axisEvidenceIds)
  ) {
    return undefined;
  }

  return candidate as TraceReport;
}

export function validationReportFromUnknown(
  value: unknown,
): ValidationReport | undefined {
  const unwrapped =
    value && typeof value === "object" && "validation" in value
      ? value.validation
      : value && typeof value === "object" && "report" in value
        ? value.report
        : value;
  const candidate = unwrapped as Partial<ValidationReport> | undefined;
  if (
    !candidate ||
    typeof candidate.founderId !== "string" ||
    typeof candidate.validatedAt !== "string" ||
    !Array.isArray(candidate.results) ||
    !candidate.results.every(isValidationResult) ||
    !isNonNegativeInteger(candidate.revisedCount) ||
    !isNonNegativeInteger(candidate.upheldCount) ||
    typeof candidate.independentlyValidated !== "boolean"
  ) {
    return undefined;
  }

  let trustAfter: TrustReport | null;
  if (candidate.trustAfter === null) {
    trustAfter = null;
  } else {
    const parsedTrust = trustReportFromUnknown(candidate.trustAfter);
    if (!parsedTrust) return undefined;
    trustAfter = parsedTrust;
  }

  return { ...(candidate as ValidationReport), trustAfter };
}

function unwrap(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object") return value;
  return key in value ? value[key as keyof typeof value] : value;
}

function isEvidenceRef(value: unknown): value is EvidenceRef {
  if (!value || typeof value !== "object") return false;
  const ref = value as Partial<EvidenceRef>;
  return (
    typeof ref.id === "string" &&
    EVIDENCE_TYPES.includes(ref.type as EvidenceType) &&
    typeof ref.title === "string" &&
    typeof ref.excerpt === "string" &&
    (ref.url === undefined || typeof ref.url === "string") &&
    typeof ref.capturedAt === "string" &&
    (ref.locator === undefined || isLocator(ref.locator))
  );
}

function isLocator(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const locator = value as EvidenceRef["locator"];
  return (
    (locator?.page === undefined || typeof locator.page === "number") &&
    (locator?.section === undefined || typeof locator.section === "string")
  );
}

function isDecisionStep(value: unknown): value is DecisionStep {
  if (!value || typeof value !== "object") return false;
  const step = value as Partial<DecisionStep>;
  return (
    typeof step.id === "string" &&
    STEP_AGENTS.includes(step.agent as DecisionStep["agent"]) &&
    typeof step.action === "string" &&
    typeof step.conclusion === "string" &&
    isStringArray(step.evidenceIds) &&
    STEP_STATUSES.includes(step.status as DecisionStep["status"]) &&
    typeof step.durationMs === "number"
  );
}

function isClaimCitation(value: unknown): value is ClaimCitation {
  if (!value || typeof value !== "object") return false;
  const citation = value as Partial<ClaimCitation>;
  return (
    typeof citation.claimText === "string" &&
    isStringArray(citation.evidenceIds) &&
    typeof citation.uncited === "boolean"
  );
}

function isAxisEvidence(value: unknown): value is TraceReport["axisEvidenceIds"] {
  if (!value || typeof value !== "object") return false;
  const axes = value as Partial<TraceReport["axisEvidenceIds"]>;
  return (
    isStringArray(axes.founder) &&
    isStringArray(axes.market) &&
    isStringArray(axes.ideaVsMarket)
  );
}

function isValidationResult(value: unknown): value is ValidationResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<ValidationResult>;
  return (
    typeof result.claimText === "string" &&
    CLAIM_STATUSES.includes(result.originalStatus as ClaimStatus) &&
    CLAIM_STATUSES.includes(result.validatedStatus as ClaimStatus) &&
    !isValidationUpgrade(
      result.originalStatus as ClaimStatus,
      result.validatedStatus as ClaimStatus,
    ) &&
    typeof result.confidence === "number" &&
    result.confidence >= 0 &&
    result.confidence <= 1 &&
    isStringArray(result.evidenceIds) &&
    Array.isArray(result.issues) &&
    result.issues.every((issue) =>
      VALIDATION_ISSUES.includes(issue as ValidationIssue),
    ) &&
    (result.note === undefined || typeof result.note === "string")
  );
}

function isValidationUpgrade(
  original: ClaimStatus,
  validated: ClaimStatus,
): boolean {
  if (original === "contradicted") return validated !== "contradicted";
  if (original === "unverifiable") return validated === "verified";
  return false;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}
