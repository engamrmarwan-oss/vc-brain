export type TrustLabel =
  | "verified"
  | "caution"
  | "contradicted"
  | "insufficient-evidence";

export type TrustChannelName = "github" | "linkedin" | "web" | "deck";

export interface TrustChannel {
  channel: TrustChannelName;
  present: boolean;
  detail: string;
}

export interface TrustUnlock {
  action: string;
  unlocks: string;
}

export interface TrustReport {
  score: number | null;
  band: number;
  label: TrustLabel;
  verifiedCount: number;
  contradictedCount: number;
  unverifiableCount: number;
  coverage: {
    present: number;
    required: number;
    channels: TrustChannel[];
  };
  unlocks: TrustUnlock[];
  rationale: string;
}

export type AssessmentTrustPayload = {
  trust?: TrustReport | null;
};

const TRUST_LABELS: TrustLabel[] = [
  "verified",
  "caution",
  "contradicted",
  "insufficient-evidence",
];
const TRUST_CHANNELS: TrustChannelName[] = [
  "github",
  "linkedin",
  "web",
  "deck",
];

// Frozen UI-development fixture. Runtime surfaces still render "Trust pending"
// whenever an API/cache payload does not contain a valid trust report.
export const MOCK_TRUST_REPORT: TrustReport = {
  score: 35,
  band: 8,
  label: "contradicted",
  verifiedCount: 2,
  contradictedCount: 1,
  unverifiableCount: 0,
  coverage: {
    present: 2,
    required: 3,
    channels: [
      {
        channel: "github",
        present: true,
        detail: "Live repo signals fetched",
      },
      {
        channel: "linkedin",
        present: true,
        detail: "Employment history matched",
      },
      {
        channel: "web",
        present: false,
        detail: "No press or product footprint found",
      },
    ],
  },
  unlocks: [],
  rationale:
    "1 contradicted claim caps trust regardless of 2 verified claims.",
};

export function trustReportFromUnknown(value: unknown): TrustReport | undefined {
  if (!value || typeof value !== "object") return undefined;
  const report = value as Partial<TrustReport>;
  const coverage = report.coverage;

  if (
    !(report.score === null || isFiniteNumber(report.score)) ||
    !isFiniteNumber(report.band) ||
    !TRUST_LABELS.includes(report.label as TrustLabel) ||
    !isNonNegativeInteger(report.verifiedCount) ||
    !isNonNegativeInteger(report.contradictedCount) ||
    !isNonNegativeInteger(report.unverifiableCount) ||
    !coverage ||
    !isNonNegativeInteger(coverage.present) ||
    !isNonNegativeInteger(coverage.required) ||
    !Array.isArray(coverage.channels) ||
    !coverage.channels.every(isTrustChannel) ||
    !Array.isArray(report.unlocks) ||
    !report.unlocks.every(isTrustUnlock) ||
    typeof report.rationale !== "string"
  ) {
    return undefined;
  }

  return report as TrustReport;
}

export function trustFromAssessment(value: unknown): TrustReport | undefined {
  if (!value || typeof value !== "object" || !("trust" in value)) {
    return undefined;
  }

  return trustReportFromUnknown(value.trust);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function isTrustChannel(value: unknown): value is TrustChannel {
  if (!value || typeof value !== "object") return false;
  const channel = value as Partial<TrustChannel>;
  return (
    TRUST_CHANNELS.includes(channel.channel as TrustChannelName) &&
    typeof channel.present === "boolean" &&
    typeof channel.detail === "string"
  );
}

function isTrustUnlock(value: unknown): value is TrustUnlock {
  if (!value || typeof value !== "object") return false;
  const unlock = value as Partial<TrustUnlock>;
  return typeof unlock.action === "string" && typeof unlock.unlocks === "string";
}
