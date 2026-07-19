"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import { AppHeader } from "@/components/app-header";
import { FounderOutcomeActions } from "@/components/founder-outcome-actions";
import {
  deckSummaryFromUnknown,
  EMPTY_APPLICATIONS_SNAPSHOT,
  getApplicationsSnapshot,
  parseApplicationsSnapshot,
  resumeSummaryFromUnknown,
  saveApplication,
  subscribeToApplications,
  type DeckSummary,
  type ResumeSummary,
  type StoredAssessment,
} from "@/components/founder-application-storage";
import {
  AuditTrailDrawer,
  EvidenceCitations,
  NotIndependentlyValidatedBadge,
  ValidationDelta,
} from "@/components/memo-traceability";
import {
  traceReportFromUnknown,
  validationReportFromUnknown,
  type ClaimCitation,
  type TraceReport,
  type ValidationReport,
  type ValidationResult,
} from "@/components/traceability";
import {
  trustFromAssessment,
  type TrustChannelName,
  type TrustLabel,
  type TrustReport,
} from "@/components/trust-report";
import type {
  Assessment,
  Axis,
  AxisVerdict,
  Claim,
  Trend,
} from "@/lib/types";

type FounderProfile = {
  name: string;
  company: string;
  initials: string;
  sector: string;
  geo: string;
  entry: string;
};

const FOUNDER_PROFILES: Record<string, FounderProfile> = {
  "maya-chen": {
    name: "Maya Chen",
    company: "Reflex AI",
    initials: "MC",
    sector: "AI infrastructure",
    geo: "Berlin",
    entry: "Inbound",
  },
  "priya-nair": {
    name: "Priya Nair",
    company: "Vectorplane",
    initials: "PN",
    sector: "AI infrastructure",
    geo: "Berlin",
    entry: "Outbound",
  },
  "tomas-halvorsen": {
    name: "Tomas Halvorsen",
    company: "Pre-company",
    initials: "TH",
    sector: "AI infrastructure",
    geo: "Oslo",
    entry: "Cold start",
  },
  "dan-okoro": {
    name: "Dan Okoro",
    company: "Ledgerloop",
    initials: "DO",
    sector: "Fintech infrastructure",
    geo: "London",
    entry: "Inbound",
  },
};

const MAYA_FALLBACK: StoredAssessment = {
  founderId: "maya-chen",
  axes: {
    founder: {
      verdict: "bullish",
      trend: "up",
      rationale:
        "Ex-DeepMind systems engineer; strong technical pedigree checks out on LinkedIn.",
    },
    market: {
      verdict: "bullish",
      trend: "up",
      rationale:
        "AI infrastructure spend is accelerating and the enterprise wedge is well timed.",
    },
    ideaVsMarket: {
      verdict: "neutral",
      trend: "flat",
      rationale:
        "The wedge is credible, but the traction story does not survive contact with the repo.",
    },
  },
  claims: [
    {
      text: "Technical founder, ex-DeepMind",
      status: "verified",
      confidence: 0.92,
      evidence: "LinkedIn: research engineer at DeepMind, 2021–2024.",
      source: "LinkedIn",
    },
    {
      text: "10,000 active users",
      status: "contradicted",
      confidence: 0.9,
      evidence:
        "GitHub shows 14 stars, 2 forks and no commit in 7 months — inconsistent with 10,000 active users.",
      source: "GitHub",
    },
    {
      text: "AI infra market, enterprise wedge",
      status: "verified",
      confidence: 0.8,
      evidence:
        "Sector positioning is consistent with public materials and current market signals.",
      source: "Web research",
    },
  ],
  recommendation: "conditional",
  conviction: "medium",
  checkSize: "$100k–$250k, post-diligence",
  speedSeconds: 1.4,
  flags: 1,
};

function fallbackFor(founderId: string): StoredAssessment {
  if (founderId === "maya-chen") return MAYA_FALLBACK;

  return {
    founderId,
    axes: {
      founder: {
        verdict: "neutral",
        trend: "flat",
        rationale: "The founder screen is queued and awaiting backend intake.",
      },
      market: {
        verdict: "neutral",
        trend: "flat",
        rationale: "Market evidence will appear when the merit screen completes.",
      },
      ideaVsMarket: {
        verdict: "neutral",
        trend: "flat",
        rationale: "Idea-to-market fit remains unscored until intake is available.",
      },
    },
    claims: [],
    recommendation: "conditional",
    conviction: "low",
    checkSize: "$0, pending screen",
    speedSeconds: 0,
    flags: 0,
  };
}

async function requestAssessment(
  founderId: string,
  fresh = false,
): Promise<StoredAssessment> {
  const response = await fetch("/api/score", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: founderId, fresh }),
    cache: "no-store",
  });

  if (!response.ok) throw new Error("Scoring request failed");

  return (await response.json()) as StoredAssessment;
}

async function requestDeckSummary(founderId: string): Promise<DeckSummary> {
  const response = await fetch(`/api/deck?id=${encodeURIComponent(founderId)}`, {
    cache: "no-store",
  });

  if (!response.ok) throw new Error("Deck summary unavailable");

  const payload = (await response.json()) as unknown;
  if (!payload || typeof payload !== "object" || !("summary" in payload)) {
    throw new Error("Deck summary response invalid");
  }

  const summary = deckSummaryFromUnknown(payload.summary);
  if (!summary) throw new Error("Deck summary response invalid");

  return summary;
}

async function requestResumeSummary(founderId: string): Promise<ResumeSummary> {
  const urls = [
    `/api/resume?id=${encodeURIComponent(founderId)}`,
    `/api/deck?id=${encodeURIComponent(founderId)}&type=resume`,
  ];

  for (const url of urls) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) continue;

    const payload = (await response.json()) as unknown;
    if (!payload || typeof payload !== "object" || !("summary" in payload)) {
      continue;
    }

    const summary = resumeSummaryFromUnknown(payload.summary);
    if (summary) return summary;
  }

  throw new Error("Resume summary unavailable");
}

async function requestTrace(founderId: string): Promise<TraceReport> {
  const response = await fetch(`/api/trace?id=${encodeURIComponent(founderId)}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Trace unavailable");

  const trace = traceReportFromUnknown(await response.json());
  if (!trace) throw new Error("Trace response invalid");
  return trace;
}

async function requestLastValidation(
  founderId: string,
): Promise<ValidationReport | undefined> {
  const response = await fetch(
    `/api/validate?id=${encodeURIComponent(founderId)}`,
    { cache: "no-store" },
  );
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error("Validation unavailable");

  const report = validationReportFromUnknown(await response.json());
  if (!report) throw new Error("Validation response invalid");
  return report;
}

async function runValidation(founderId: string): Promise<ValidationReport> {
  const response = await fetch("/api/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: founderId }),
    cache: "no-store",
  });

  if (!response.ok) throw new Error("Validator did not complete");

  const report = validationReportFromUnknown(await response.json());
  if (!report) throw new Error("Validation response invalid or attempted an upgrade");
  return report;
}

export function FounderMemo({ founderId }: { founderId: string }) {
  const applicationsSnapshot = useSyncExternalStore(
    subscribeToApplications,
    getApplicationsSnapshot,
    () => EMPTY_APPLICATIONS_SNAPSHOT,
  );
  const storedApplication = useMemo(
    () =>
      parseApplicationsSnapshot(applicationsSnapshot).find(
        (application) => application.founder.id === founderId,
      ),
    [applicationsSnapshot, founderId],
  );
  const [assessment, setAssessment] = useState<StoredAssessment>(() =>
    fallbackFor(founderId),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);
  const [deckSummary, setDeckSummary] = useState<DeckSummary | undefined>(
    storedApplication?.deckSummary,
  );
  const [isDeckLoading, setIsDeckLoading] = useState(true);
  const [resumeSummary, setResumeSummary] = useState<ResumeSummary | undefined>(
    storedApplication?.resumeSummary,
  );
  const [isResumeLoading, setIsResumeLoading] = useState(true);
  const [trace, setTrace] = useState<TraceReport | undefined>();
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [validationReport, setValidationReport] = useState<
    ValidationReport | undefined
  >();
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState("");

  const loadAssessment = useCallback(async () => {
    setIsLoading(true);
    setUsingFallback(false);

    try {
      const freshAssessment = await requestAssessment(founderId, true);
      setAssessment(freshAssessment);
      void requestTrace(founderId)
        .then(setTrace)
        .catch(() => setTrace(undefined));

      if (storedApplication) {
        saveApplication({
          ...storedApplication,
          assessment: freshAssessment,
          status: "scored",
        });
      }
    } catch {
      setAssessment(storedApplication?.assessment ?? fallbackFor(founderId));
      setUsingFallback(true);
    } finally {
      setIsLoading(false);
    }
  }, [founderId, storedApplication]);

  const validateAssessment = useCallback(async () => {
    setIsValidating(true);
    setValidationError("");

    try {
      const report = await runValidation(founderId);
      setValidationReport(report);
      void requestTrace(founderId)
        .then(setTrace)
        .catch(() => undefined);
    } catch {
      setValidationError("Independent validation is temporarily unavailable.");
    } finally {
      setIsValidating(false);
    }
  }, [founderId]);

  useEffect(() => {
    let active = true;

    requestAssessment(founderId)
      .then((result) => {
        if (!active) return;
        setAssessment(result);
        void requestTrace(founderId)
          .then((nextTrace) => {
            if (active) setTrace(nextTrace);
          })
          .catch(() => {
            if (active) setTrace(undefined);
          });
      })
      .catch(() => {
        if (!active) return;
        setAssessment(storedApplication?.assessment ?? fallbackFor(founderId));
        setUsingFallback(!storedApplication?.assessment);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [founderId, storedApplication]);

  useEffect(() => {
    let active = true;

    requestTrace(founderId)
      .then((result) => {
        if (active) setTrace(result);
      })
      .catch(() => {
        // Trace is additive and fail-soft: no trace means no citation UI.
      });

    requestLastValidation(founderId)
      .then((result) => {
        if (active) setValidationReport(result);
      })
      .catch(() => {
        // Validation is optional and never blocks the primary memo.
      });

    return () => {
      active = false;
    };
  }, [founderId]);

  useEffect(() => {
    let active = true;

    requestResumeSummary(founderId)
      .then((summary) => {
        if (active) setResumeSummary(summary);
      })
      .catch(() => {
        if (active) setResumeSummary(storedApplication?.resumeSummary);
      })
      .finally(() => {
        if (active) setIsResumeLoading(false);
      });

    return () => {
      active = false;
    };
  }, [founderId, storedApplication]);

  useEffect(() => {
    let active = true;

    requestDeckSummary(founderId)
      .then((summary) => {
        if (active) setDeckSummary(summary);
      })
      .catch(() => {
        if (active) setDeckSummary(storedApplication?.deckSummary);
      })
      .finally(() => {
        if (active) setIsDeckLoading(false);
      });

    return () => {
      active = false;
    };
  }, [founderId, storedApplication]);

  const profile =
    FOUNDER_PROFILES[founderId] ??
    (storedApplication
      ? profileFromFounder(storedApplication.founder)
      : {
          name: "Pending founder",
          company: "New application",
          initials: "PF",
          sector: "Unclassified",
          geo: "Undisclosed",
          entry: "Inbound",
        });
  const contradictionCount = assessment.claims.filter(
    (claim) => claim.status === "contradicted",
  ).length;
  const verifiedCount = assessment.claims.filter(
    (claim) => claim.status === "verified",
  ).length;
  const trustReport = trustFromAssessment(assessment);
  const effectiveTrustReport = validationReport?.trustAfter ?? trustReport;
  const citationByClaim = useMemo(
    () =>
      new Map(
        (trace?.claimCitations ?? []).map((citation) => [
          citation.claimText,
          citation,
        ]),
      ),
    [trace],
  );
  const validationByClaim = useMemo(
    () =>
      new Map(
        (validationReport?.results ?? []).map((result) => [
          result.claimText,
          result,
        ]),
      ),
    [validationReport],
  );
  const recommendationEvidenceIds = useMemo(() => {
    if (!trace) return [];
    return [
      ...new Set([
        ...trace.axisEvidenceIds.founder,
        ...trace.axisEvidenceIds.market,
        ...trace.axisEvidenceIds.ideaVsMarket,
        ...trace.claimCitations.flatMap((citation) => citation.evidenceIds),
      ]),
    ].slice(0, 4);
  }, [trace]);

  return (
    <div className="min-h-screen bg-[#efeee9] text-[#171915]">
      <AppHeader />

      <main className="mx-auto w-full max-w-[1360px] px-5 py-7 sm:px-8 sm:py-9 lg:px-12 lg:py-11">
        <div className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <Link
              className="group mb-5 inline-flex items-center gap-2 text-[12px] font-semibold text-[#71736c] transition-colors hover:text-[#171915]"
              href="/"
            >
              <ArrowLeftIcon />
              Back to pipeline
            </Link>
            <div className="flex items-center gap-4">
              <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#252821] text-[16px] font-semibold text-white shadow-[0_10px_24px_rgba(23,25,21,0.15)]">
                {profile.initials}
              </div>
              <div>
                <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
                  <h1 className="text-[30px] font-semibold leading-none tracking-[-0.045em] sm:text-[36px]">
                    {profile.name}
                  </h1>
                  <span className="rounded-full border border-[#d4d2ca] bg-white/70 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[#70726a]">
                    {profile.entry}
                  </span>
                  {validationReport &&
                    !validationReport.independentlyValidated && (
                      <NotIndependentlyValidatedBadge />
                    )}
                </div>
                <p className="text-[13px] text-[#74766e]">
                  <span className="font-semibold text-[#3e403a]">
                    {profile.company}
                  </span>
                  <span className="mx-2 text-[#c0beb5]">/</span>
                  {profile.sector}
                  <span className="mx-2 text-[#c0beb5]">/</span>
                  {profile.geo}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto sm:justify-end">
            <FounderOutcomeActions founderId={founderId} />
            <button
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#d4d2cb] bg-[#f8f7f3] px-4 text-[12px] font-semibold transition-colors hover:bg-white disabled:cursor-wait disabled:opacity-60"
              disabled={isLoading}
              onClick={() => void loadAssessment()}
              type="button"
            >
              <RefreshIcon spinning={isLoading} />
              {isLoading ? "Screening…" : "Re-run screen"}
            </button>
            <button
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#d4d2cb] bg-[#f8f7f3] px-4 text-[12px] font-semibold transition-colors hover:bg-white disabled:cursor-wait disabled:opacity-60"
              disabled={isValidating}
              onClick={() => void validateAssessment()}
              type="button"
            >
              <ValidationIcon spinning={isValidating} />
              {isValidating ? "Validating…" : "Validate screen"}
            </button>
            {trace && (
              <button
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#d4d2cb] bg-[#f8f7f3] px-3.5 text-[11px] font-semibold text-[#5f625a] transition-colors hover:bg-white hover:text-[#171915]"
                onClick={() => setIsAuditOpen(true)}
                type="button"
              >
                <AuditIcon /> Audit trail
              </button>
            )}
          </div>
        </div>

        {validationError && (
          <p className="mb-5 rounded-xl border border-[#e3d6bb] bg-[#f5eddd] px-4 py-3 text-[10px] font-medium text-[#7d6339]">
            {validationError}
          </p>
        )}

        <section aria-labelledby="screening-axes" className="mb-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2
                className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#73756e]"
                id="screening-axes"
              >
                Independent screening axes
              </h2>
              <span
                className="grid size-4 cursor-help place-items-center rounded-full border border-[#cac8bf] text-[9px] font-bold text-[#8c8e87]"
                title="Axes are evaluated independently and are never averaged."
              >
                i
              </span>
            </div>
            <span className="hidden text-[10px] font-medium text-[#969890] sm:block">
              Never averaged
            </span>
          </div>

          <div className="grid overflow-hidden rounded-[18px] border border-[#d8d6cf] bg-[#d8d6cf] shadow-[0_12px_32px_rgba(40,42,36,0.05)] md:grid-cols-3 md:gap-px">
            <AxisCard
              axis={assessment.axes.founder}
              evidence={trace?.evidence ?? []}
              evidenceIds={trace?.axisEvidenceIds.founder ?? []}
              label="Founder"
            />
            <AxisCard
              axis={assessment.axes.market}
              evidence={trace?.evidence ?? []}
              evidenceIds={trace?.axisEvidenceIds.market ?? []}
              label="Market"
            />
            <AxisCard
              axis={assessment.axes.ideaVsMarket}
              evidence={trace?.evidence ?? []}
              evidenceIds={trace?.axisEvidenceIds.ideaVsMarket ?? []}
              label="Idea vs. market"
            />
          </div>
        </section>

        <div className="mb-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(330px,0.55fr)]">
          <DeckSummaryCard isLoading={isDeckLoading} summary={deckSummary} />
          <ResumeSummaryCard
            isLoading={isResumeLoading}
            summary={resumeSummary}
          />
        </div>

        <DocumentsCard
          deckName={storedApplication?.documents?.deck}
          founderId={founderId}
          hasDeck={Boolean(deckSummary || storedApplication?.documents?.deck)}
          hasResume={Boolean(resumeSummary || storedApplication?.documents?.resume)}
          resumeName={storedApplication?.documents?.resume}
        />

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.74fr)]">
          <section
            aria-labelledby="trust-score"
            className="overflow-hidden rounded-[18px] border border-[#d8d6cf] bg-[#f9f8f5] shadow-[0_12px_32px_rgba(40,42,36,0.05)]"
          >
            <div className="flex flex-col justify-between gap-4 border-b border-[#dfddd6] px-5 py-5 sm:flex-row sm:items-center sm:px-6">
              <div>
                <div className="mb-1.5 flex items-center gap-2.5">
                  <ShieldIcon />
                  <h2
                    className="text-[17px] font-semibold tracking-[-0.025em]"
                    id="trust-score"
                  >
                    Claim-level Trust Score
                  </h2>
                </div>
                <p className="text-[11px] text-[#81837b]">
                  Every claim traced to evidence — confidence reflects the status,
                  not the company.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <MetricPill tone="green" value={`${verifiedCount} verified`} />
                {contradictionCount > 0 && (
                  <MetricPill
                    tone="red"
                    value={`${contradictionCount} contradicted`}
                  />
                )}
              </div>
            </div>

            <div className="divide-y divide-[#e3e1da]">
              {assessment.claims.length ? (
                assessment.claims.map((claim, index) => {
                  const citation = citationByClaim.get(claim.text);
                  const validation = validationByClaim.get(claim.text);
                  return (
                    <ClaimRow
                      citation={citation}
                      claim={claim}
                      evidence={trace?.evidence ?? []}
                      index={index}
                      key={`${claim.text}-${index}`}
                      validation={validation}
                    />
                  );
                })
              ) : (
                <div className="px-6 py-12 text-center">
                  <div className="mx-auto mb-3 grid size-9 place-items-center rounded-full bg-[#eceae3] text-[#85877f]">
                    <SearchIcon />
                  </div>
                  <p className="text-[13px] font-semibold">No deck claims submitted</p>
                  <p className="mt-1 text-[11px] text-[#888a82]">
                    This assessment is based on public-footprint signals only.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-[#dfddd6] bg-[#f2f1ec] px-5 py-3.5 text-[10px] text-[#85877f] sm:px-6">
              <span className="flex items-center gap-1.5">
                <LockIcon /> Evidence snapshots locked to this screening
              </span>
              <span className="hidden items-center gap-1.5 font-semibold text-[#527a66] sm:flex">
                <span className="size-1.5 rounded-full bg-[#58a37b]" />
                Trust layer active
              </span>
            </div>
          </section>

          <aside className="space-y-5">
            <DecisionCard
              assessment={assessment}
              evidence={trace?.evidence ?? []}
              evidenceIds={recommendationEvidenceIds}
              traceAvailable={Boolean(trace)}
              trust={effectiveTrustReport}
            />
            <TrustEvidenceCard trust={effectiveTrustReport} />
            <SpeedCard
              isLoading={isLoading}
              speedSeconds={assessment.speedSeconds}
              usingFallback={usingFallback}
            />
          </aside>
        </div>
      </main>

      {trace && isAuditOpen && (
        <AuditTrailDrawer onClose={() => setIsAuditOpen(false)} trace={trace} />
      )}
    </div>
  );
}

function profileFromFounder(
  founder: ReturnType<typeof parseApplicationsSnapshot>[number]["founder"],
): FounderProfile {
  const initials = founder.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return {
    name: founder.name,
    company: founder.company,
    initials: initials || "NF",
    sector: founder.sector,
    geo: founder.geo,
    entry: "Inbound",
  };
}

function ResumeSummaryCard({
  isLoading,
  summary,
}: {
  isLoading: boolean;
  summary?: ResumeSummary;
}) {
  return (
    <section
      aria-labelledby="resume-summary"
      className="overflow-hidden rounded-[18px] border border-[#d8d6cf] bg-[#f9f8f5] shadow-[0_12px_32px_rgba(40,42,36,0.05)]"
    >
      <div className="border-b border-[#dfddd6] px-5 py-5 sm:px-6">
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid size-7 place-items-center rounded-lg bg-[#eee9df] text-[#75623d]">
              <ResumeIcon />
            </span>
            <h2
              className="text-[17px] font-semibold tracking-[-0.025em]"
              id="resume-summary"
            >
              Resume executive summary
            </h2>
          </div>
          <span
            className={`size-2 rounded-full ${
              isLoading
                ? "animate-pulse bg-[#c79f58]"
                : summary
                  ? "bg-[#58a17a]"
                  : "bg-[#aaa89f]"
            }`}
          />
        </div>
        <p className="text-[11px] leading-relaxed text-[#81837b]">
          Career signal only. Contact details are excluded from the screen.
        </p>
      </div>

      {isLoading && !summary ? (
        <div className="space-y-6 p-5 sm:p-6">
          <DeckSummarySkeleton />
          <DeckSummarySkeleton compact />
        </div>
      ) : summary ? (
        <div className="p-5 sm:p-6">
          <DeckSummaryField label="Career snapshot">
            <p className="text-[13px] font-medium leading-[1.65] text-[#34362f]">
              {summary.headline || "No clear career headline was extracted."}
            </p>
          </DeckSummaryField>

          <DeckSummaryField label={`Roles · ${summary.roles.length}`}>
            {summary.roles.length ? (
              <ul className="space-y-2.5">
                {summary.roles.map((role) => (
                  <li
                    className="flex items-start gap-2.5 text-[10.5px] leading-[1.5] text-[#555750]"
                    key={role}
                  >
                    <span className="mt-[5px] size-1.5 shrink-0 rounded-full bg-[#779483]" />
                    {role}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[10.5px] text-[#85877f]">No roles extracted.</p>
            )}
          </DeckSummaryField>

          {summary.education.length > 0 && (
            <DeckSummaryField label="Education">
              <div className="space-y-2">
                {summary.education.map((item) => (
                  <p
                    className="rounded-lg bg-[#eeece5] px-2.5 py-2 text-[9.5px] font-medium leading-relaxed text-[#5f625a]"
                    key={item}
                  >
                    {item}
                  </p>
                ))}
              </div>
            </DeckSummaryField>
          )}

          <DeckSummaryField
            label={`Background claims · ${summary.backgroundClaims.length}`}
            last
          >
            {summary.backgroundClaims.length ? (
              <div className="space-y-2">
                {summary.backgroundClaims.map((claim) => (
                  <div
                    className="flex items-start gap-2 rounded-lg bg-[#e8f0e9] px-2.5 py-2 text-[9.5px] font-medium leading-relaxed text-[#476b56]"
                    key={claim}
                  >
                    <ShieldMiniIcon />
                    <span>{claim}</span>
                  </div>
                ))}
                <p className="pt-1 text-[8.5px] font-bold uppercase tracking-[0.1em] text-[#7c8c80]">
                  Sent to Trust Score for verification
                </p>
              </div>
            ) : (
              <p className="text-[10.5px] text-[#85877f]">
                No checkable background claims were extracted.
              </p>
            )}
          </DeckSummaryField>
        </div>
      ) : (
        <div className="flex items-start gap-3 px-5 py-6 sm:px-6">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#eceae3] text-[#85877f]">
            <ResumeIcon />
          </span>
          <div>
            <p className="text-[12px] font-semibold text-[#42443e]">
              No resume attached
            </p>
            <p className="mt-1 text-[10.5px] leading-relaxed text-[#85877f]">
              Optional by design—the screen continues with deck and public signals.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function DocumentsCard({
  deckName,
  founderId,
  hasDeck,
  hasResume,
  resumeName,
}: {
  deckName?: string;
  founderId: string;
  hasDeck: boolean;
  hasResume: boolean;
  resumeName?: string;
}) {
  const documents = [
    ...(hasDeck
      ? [{ name: deckName || "Pitch deck.pdf", type: "deck" as const }]
      : []),
    ...(hasResume
      ? [{ name: resumeName || "Resume.pdf", type: "resume" as const }]
      : []),
  ];

  return (
    <section
      aria-labelledby="documents"
      className="mb-5 overflow-hidden rounded-[18px] border border-[#d8d6cf] bg-[#f9f8f5] shadow-[0_12px_32px_rgba(40,42,36,0.04)]"
    >
      <div className="flex flex-col justify-between gap-2 border-b border-[#dfddd6] px-5 py-4 sm:flex-row sm:items-center sm:px-6">
        <div>
          <h2
            className="text-[13px] font-semibold tracking-[-0.015em]"
            id="documents"
          >
            Documents
          </h2>
          <p className="mt-1 text-[9.5px] text-[#85877f]">
            Original founder-provided files, unchanged.
          </p>
        </div>
        <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#92948c]">
          {documents.length} attached
        </span>
      </div>

      {documents.length ? (
        <div className="grid divide-y divide-[#e3e1da] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          {documents.map((document) => {
            const url = `/api/document?id=${encodeURIComponent(founderId)}&type=${document.type}`;
            return (
              <article
                className="flex min-w-0 items-center gap-3 px-5 py-4 sm:px-6"
                key={document.type}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#eceae3] text-[#666a61]">
                  {document.type === "deck" ? <DeckIcon /> : <ResumeIcon />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-semibold text-[#393b35]">
                    {document.name}
                  </p>
                  <p className="mt-1 text-[8.5px] font-bold uppercase tracking-[0.1em] text-[#969890]">
                    {document.type === "deck" ? "Pitch deck" : "Resume"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <a
                    className="rounded-lg border border-[#d8d5cc] px-2.5 py-1.5 text-[8.5px] font-bold text-[#62655d] transition-colors hover:bg-white hover:text-[#252721]"
                    href={url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    View
                  </a>
                  <a
                    className="rounded-lg bg-[#252821] px-2.5 py-1.5 text-[8.5px] font-bold text-white transition-colors hover:bg-[#353931]"
                    download={document.name}
                    href={url}
                  >
                    Download
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="px-5 py-4 text-[10.5px] text-[#85877f] sm:px-6">
          No original files are stored for this founder.
        </p>
      )}
    </section>
  );
}

function DeckSummaryCard({
  isLoading,
  summary,
}: {
  isLoading: boolean;
  summary?: DeckSummary;
}) {
  return (
    <section
      aria-labelledby="deck-summary"
      className="overflow-hidden rounded-[18px] border border-[#d8d6cf] bg-[#f9f8f5] shadow-[0_12px_32px_rgba(40,42,36,0.05)]"
    >
      <div className="flex flex-col justify-between gap-4 border-b border-[#dfddd6] px-5 py-5 sm:flex-row sm:items-center sm:px-6">
        <div>
          <div className="mb-1.5 flex items-center gap-2.5">
            <span className="grid size-7 place-items-center rounded-lg bg-[#e8ece4] text-[#536c5d]">
              <DeckIcon />
            </span>
            <h2
              className="text-[17px] font-semibold tracking-[-0.025em]"
              id="deck-summary"
            >
              Deck executive summary
            </h2>
          </div>
          <p className="text-[11px] text-[#81837b]">
            What the deck says first. Claim verification follows immediately below.
          </p>
        </div>
        <span
          className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[8.5px] font-bold uppercase tracking-[0.09em] ${
            isLoading
              ? "bg-[#eeeae0] text-[#8b7750]"
              : summary
                ? "bg-[#e5eee7] text-[#42775b]"
                : "bg-[#eceae4] text-[#7e8078]"
          }`}
        >
          <span
            className={`size-1.5 rounded-full ${
              isLoading
                ? "animate-pulse bg-[#c79f58]"
                : summary
                  ? "bg-[#58a17a]"
                  : "bg-[#aaa89f]"
            }`}
          />
          {isLoading ? "Extracting" : summary ? "PDF extracted" : "No extraction"}
        </span>
      </div>

      {isLoading && !summary ? (
        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1.2fr_0.8fr]">
          <DeckSummarySkeleton />
          <DeckSummarySkeleton compact />
        </div>
      ) : summary ? (
        <div className="grid lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
          <div className="border-b border-[#e2e0d9] p-5 sm:p-6 lg:border-b-0 lg:border-r">
            <DeckSummaryField label="Company snapshot">
              <p className="text-[13px] font-medium leading-[1.7] text-[#34362f]">
                {summary.snapshot || "The deck did not provide a clear company snapshot."}
              </p>
            </DeckSummaryField>

            <DeckSummaryField label="Market / wedge">
              <p className="text-[11px] leading-[1.65] text-[#70726a]">
                {summary.market || "No explicit market statement was extracted."}
              </p>
            </DeckSummaryField>

            {summary.statedMetrics.length > 0 && (
              <DeckSummaryField label="Stated metrics" last>
                <div className="flex flex-wrap gap-2">
                  {summary.statedMetrics.map((metric) => (
                    <span
                      className="rounded-lg bg-[#eceae3] px-2.5 py-1.5 text-[9.5px] font-semibold text-[#53564e] ring-1 ring-inset ring-[#dfdcd3]"
                      key={metric}
                    >
                      {metric}
                    </span>
                  ))}
                </div>
              </DeckSummaryField>
            )}
          </div>

          <div className="p-5 sm:p-6">
            <DeckSummaryField label={`Extracted claims · ${summary.claims.length}`}>
              {summary.claims.length > 0 ? (
                <ol className="space-y-2.5">
                  {summary.claims.map((claim, index) => (
                    <li
                      className="grid grid-cols-[22px_1fr] gap-2.5 text-[10.5px] leading-[1.5] text-[#555750]"
                      key={`${claim}-${index}`}
                    >
                      <span className="grid size-[22px] place-items-center rounded-full bg-[#e8eee8] text-[8px] font-bold tabular-nums text-[#4d755e]">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span>{claim}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-[10.5px] text-[#85877f]">
                  No checkable claims were extracted.
                </p>
              )}
            </DeckSummaryField>

            <DeckSummaryField label="Traction signals" last>
              {summary.tractionSignals.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {summary.tractionSignals.map((signal) => (
                    <span
                      className="rounded-full bg-[#f0eee8] px-2.5 py-1.5 text-[9px] font-medium text-[#666860]"
                      key={signal}
                    >
                      {signal}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[10.5px] text-[#85877f]">
                  No qualitative traction signals were extracted.
                </p>
              )}
            </DeckSummaryField>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 px-5 py-6 sm:px-6">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#eceae3] text-[#85877f]">
            <DeckIcon />
          </span>
          <div>
            <p className="text-[12px] font-semibold text-[#42443e]">
              No extracted deck summary for this founder
            </p>
            <p className="mt-1 text-[10.5px] leading-relaxed text-[#85877f]">
              The Trust Score below still uses submitted claims and public evidence.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function DeckSummaryField({
  children,
  label,
  last = false,
}: {
  children: React.ReactNode;
  label: string;
  last?: boolean;
}) {
  return (
    <div className={last ? "" : "mb-5 border-b border-[#e7e5de] pb-5"}>
      <p className="mb-2.5 text-[8.5px] font-bold uppercase tracking-[0.13em] text-[#8b8d85]">
        {label}
      </p>
      {children}
    </div>
  );
}

function DeckSummarySkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className="animate-pulse">
      <div className="mb-4 h-2 w-24 rounded-full bg-[#e0ded6]" />
      <div className="space-y-2.5">
        <div className="h-3 w-full rounded-full bg-[#e8e6df]" />
        <div className="h-3 w-[92%] rounded-full bg-[#e8e6df]" />
        {!compact && <div className="h-3 w-[72%] rounded-full bg-[#e8e6df]" />}
      </div>
    </div>
  );
}

function AxisCard({
  axis,
  evidence,
  evidenceIds,
  label,
}: {
  axis: Axis;
  evidence: TraceReport["evidence"];
  evidenceIds: string[];
  label: string;
}) {
  return (
    <article className="min-h-[182px] bg-[#f9f8f5] p-5 sm:p-6">
      <div className="mb-8 flex items-start justify-between gap-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#777971]">
          {label}
        </p>
        <TrendBadge trend={axis.trend} />
      </div>
      <div className="mb-3 flex items-center gap-2.5">
        <VerdictMark verdict={axis.verdict} />
        <p className="text-[23px] font-semibold capitalize leading-none tracking-[-0.04em]">
          {axis.verdict}
        </p>
      </div>
      <p className="max-w-sm text-[11px] leading-[1.55] text-[#71736c]">
        {axis.rationale}
      </p>
      {evidenceIds.length > 0 && (
        <div className="mt-3">
          <EvidenceCitations evidence={evidence} evidenceIds={evidenceIds} />
        </div>
      )}
    </article>
  );
}

function TrendBadge({ trend }: { trend: Trend }) {
  const label = trend === "up" ? "Rising" : trend === "down" ? "Declining" : "Stable";
  const tone =
    trend === "up"
      ? "bg-[#e7f0e9] text-[#39755a]"
      : trend === "down"
        ? "bg-[#f8e7e3] text-[#ab4638]"
        : "bg-[#eceae3] text-[#74766e]";

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] ${tone}`}>
      <TrendIcon trend={trend} />
      {label}
    </span>
  );
}

function VerdictMark({ verdict }: { verdict: AxisVerdict }) {
  const colors: Record<AxisVerdict, string> = {
    bullish: "bg-[#e4efe7] text-[#3c795d] ring-[#cce1d2]",
    neutral: "bg-[#eeeae0] text-[#7d704f] ring-[#ddd5c1]",
    bear: "bg-[#f8e5e1] text-[#b34738] ring-[#f0cbc4]",
  };

  return (
    <span className={`grid size-7 place-items-center rounded-full ring-1 ${colors[verdict]}`}>
      {verdict === "bullish" ? <ArrowUpRightIcon /> : verdict === "bear" ? <ArrowDownRightIcon /> : <MinusIcon />}
    </span>
  );
}

function ClaimRow({
  citation,
  claim,
  evidence,
  index,
  validation,
}: {
  citation?: ClaimCitation;
  claim: Claim;
  evidence: TraceReport["evidence"];
  index: number;
  validation?: ValidationResult;
}) {
  const contradicted = claim.status === "contradicted";
  const verified = claim.status === "verified";
  const confidence = Math.round(claim.confidence * 100);
  const statusStyles = contradicted
    ? "bg-[#fbe8e5] text-[#b33e30] ring-[#f1c9c2]"
    : verified
      ? "bg-[#e8f1ea] text-[#3a7659] ring-[#cfe1d4]"
      : "bg-[#eeece5] text-[#73756e] ring-[#ddd9ce]";

  return (
    <article
      className={`relative grid gap-4 px-5 py-5 sm:grid-cols-[34px_minmax(0,1fr)_118px] sm:px-6 ${
        contradicted ? "bg-[#fff8f6]" : "bg-[#f9f8f5]"
      }`}
    >
      {contradicted && (
        <span className="absolute inset-y-0 left-0 w-[3px] bg-[#e55a47]" />
      )}
      <div
        className={`grid size-7 place-items-center rounded-full text-[10px] font-bold ${
          contradicted
            ? "bg-[#f7ddd8] text-[#bd4536]"
            : "bg-[#ebe9e2] text-[#74766e]"
        }`}
      >
        {String(index + 1).padStart(2, "0")}
      </div>

      <div className="min-w-0">
        <div className="mb-2.5 flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em] ring-1 ring-inset ${statusStyles}`}>
            {verified ? <CheckIcon /> : contradicted ? <AlertIcon /> : <QuestionIcon />}
            {claim.status}
          </span>
          <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.1em] text-[#8d8f87]">
            <SourceIcon source={claim.source} /> {claim.source}
          </span>
          {citation && (
            <EvidenceCitations
              evidence={evidence}
              evidenceIds={citation.evidenceIds}
              uncited={citation.uncited}
            />
          )}
        </div>
        <h3 className={`text-[14px] font-semibold leading-snug tracking-[-0.015em] ${contradicted ? "text-[#a5382c]" : "text-[#252721]"}`}>
          “{claim.text}”
        </h3>
        <div className="mt-3 flex items-start gap-2 text-[10.5px] leading-[1.5] text-[#777971]">
          <span className="mt-[3px] shrink-0 text-[#a2a49c]">
            <EvidenceIcon />
          </span>
          <p>{claim.evidence}</p>
        </div>
        {validation && (
          <ValidationDelta evidence={evidence} result={validation} />
        )}
      </div>

      <div className="self-center sm:pl-3">
        {!verified && !contradicted ? (
          <div className="rounded-xl border border-dashed border-[#cbc8bd] bg-[#f2f0ea] px-3 py-2.5">
            <p className="text-[8.5px] font-bold uppercase tracking-[0.1em] text-[#898b83]">
              Evidence gap
            </p>
            <p className="mt-1 text-[9.5px] font-medium leading-[1.45] text-[#666860]">
              Missing independent corroboration
            </p>
            <p className="mt-1.5 text-[8.5px] leading-relaxed text-[#92948c]">
              {confidence}% confidence in the insufficient-evidence verdict
            </p>
          </div>
        ) : (
          <>
            <div className="mb-2 flex items-end justify-between">
              <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#989a92]">
                Confidence in verdict
              </span>
              <span className={`text-[13px] font-bold tabular-nums ${contradicted ? "text-[#b44133]" : "text-[#41433d]"}`}>
                {confidence}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[#dfddd6]">
              <div
                className={`h-full rounded-full ${contradicted ? "bg-[#df5947]" : "bg-[#4b9872]"}`}
                style={{ width: `${confidence}%` }}
              />
            </div>
          </>
        )}
      </div>
    </article>
  );
}

function TrustHeadlineChip({ trust }: { trust?: TrustReport }) {
  const label = trust
    ? trust.label === "insufficient-evidence" || trust.score === null
      ? `Insufficient evidence · ${trust.coverage.present}/${trust.coverage.required}`
      : `Trust ${Math.round(trust.score)} ±${Math.round(trust.band)}`
    : "Trust pending";
  const style = trust
    ? trustTone(trust.label)
    : "border-[#777b73] bg-white/[0.05] text-[#c4c7c0]";

  return (
    <span
      className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[8.5px] font-bold uppercase tracking-[0.08em] ${style}`}
      title={trust?.rationale ?? "Aggregate trust is waiting for evidence coverage."}
    >
      <span className="size-1.5 shrink-0 rounded-full bg-current opacity-80" />
      {label}
    </span>
  );
}

function TrustEvidenceCard({ trust }: { trust?: TrustReport }) {
  return (
    <section
      aria-labelledby="evidence-coverage"
      className="overflow-hidden rounded-[18px] border border-[#d8d6cf] bg-[#f9f8f5] shadow-[0_12px_32px_rgba(40,42,36,0.04)]"
    >
      <div className="border-b border-[#dfddd6] px-5 py-5 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              className="text-[15px] font-semibold tracking-[-0.02em]"
              id="evidence-coverage"
            >
              Evidence coverage
            </h2>
            <p className="mt-1.5 text-[10px] leading-relaxed text-[#81837b]">
              {trust?.rationale ??
                "Trust pending while the evidence channels finish screening."}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-[#eceae4] px-2.5 py-1.5 text-[9px] font-bold tabular-nums text-[#666860]">
            {trust
              ? `${trust.coverage.present}/${trust.coverage.required}`
              : "—/—"}
          </span>
        </div>
      </div>

      {trust ? (
        <>
          <div className="divide-y divide-[#e7e5de] px-5 sm:px-6">
            {trust.coverage.channels.map((channel) => (
              <div
                className="grid grid-cols-[24px_minmax(0,1fr)] gap-2.5 py-3.5"
                key={channel.channel}
              >
                <span
                  className={`grid size-6 place-items-center rounded-full ${
                    channel.present
                      ? "bg-[#e4eee6] text-[#3f795a]"
                      : "border border-dashed border-[#c9c6bc] bg-[#f1efe9] text-[#999b93]"
                  }`}
                >
                  {channel.present ? <CheckIcon /> : <CoverageDashIcon />}
                </span>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.11em] text-[#60635b]">
                    {trustChannelLabel(channel.channel)}
                  </p>
                  <p className="mt-1 text-[9.5px] leading-relaxed text-[#85877f]">
                    {channel.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-[#dfddd6] bg-[#f3f1ec] px-5 py-4 sm:px-6">
            <p className="mb-2.5 text-[8.5px] font-bold uppercase tracking-[0.12em] text-[#8b8d85]">
              Coverage unlocks
            </p>
            {trust.unlocks.length ? (
              <div className="space-y-2">
                {trust.unlocks.map((unlock, index) => (
                  <div
                    className="rounded-xl border border-[#dedbd2] bg-[#faf9f6] px-3 py-2.5"
                    key={`${unlock.action}-${index}`}
                  >
                    <p className="text-[10px] font-semibold leading-relaxed text-[#444740]">
                      {unlock.action}
                    </p>
                    <p className="mt-1 flex items-start gap-1.5 text-[9px] leading-relaxed text-[#6f8175]">
                      <UnlockArrowIcon />
                      unlocks {unlock.unlocks}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[9.5px] leading-relaxed text-[#8a8c84]">
                No additional founder action requested by this screen.
              </p>
            )}
          </div>
        </>
      ) : (
        <div className="m-5 rounded-xl border border-dashed border-[#cbc8bf] bg-[#f3f1ec] px-4 py-5 text-center sm:m-6">
          <p className="text-[10px] font-semibold text-[#686b63]">Trust pending</p>
          <p className="mt-1 text-[9.5px] leading-relaxed text-[#92948c]">
            Coverage and evidence unlocks will appear after the trust engine responds.
          </p>
        </div>
      )}
    </section>
  );
}

function trustTone(label: TrustLabel): string {
  const styles: Record<TrustLabel, string> = {
    verified: "border-[#4d8265] bg-[#203e2e] text-[#78c69b]",
    caution: "border-[#856f3f] bg-[#3e3521] text-[#e1bd6d]",
    contradicted: "border-[#8e493e] bg-[#442924] text-[#f18473]",
    "insufficient-evidence":
      "border-dashed border-[#777b73] bg-white/[0.04] text-[#c4c7c0]",
  };
  return styles[label];
}

function trustChannelLabel(channel: TrustChannelName): string {
  const labels: Record<TrustChannelName, string> = {
    github: "GitHub",
    linkedin: "LinkedIn",
    web: "Public web",
    deck: "Pitch deck",
  };
  return labels[channel];
}

function DecisionCard({
  assessment,
  evidence,
  evidenceIds,
  traceAvailable,
  trust,
}: {
  assessment: Assessment;
  evidence: TraceReport["evidence"];
  evidenceIds: string[];
  traceAvailable: boolean;
  trust?: TrustReport;
}) {
  const recommendationLabel =
    assessment.recommendation === "conditional"
      ? "Proceed with conditions"
      : assessment.recommendation === "invest"
        ? "Proceed to invest"
        : "Pass";
  const isPass = assessment.recommendation === "pass";
  const isInvest = assessment.recommendation === "invest";

  return (
    <section
      aria-labelledby="recommendation"
      className="overflow-hidden rounded-[18px] bg-[#20231e] text-white shadow-[0_16px_34px_rgba(32,35,30,0.17)]"
    >
      <div className="p-5 sm:p-6">
        <div className="mb-7 flex items-start justify-between gap-3">
          <h2
            className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#aeb2aa]"
            id="recommendation"
          >
            IC recommendation
          </h2>
          <div className="flex flex-wrap justify-end gap-2">
            <TrustHeadlineChip trust={trust} />
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-[#c5c8c0] ring-1 ring-white/10">
              <span className={`size-1.5 rounded-full ${isPass ? "bg-[#ec6a57]" : isInvest ? "bg-[#6bc291]" : "bg-[#e5b95c]"}`} />
              {assessment.conviction} conviction
            </span>
          </div>
        </div>

        <div className="mb-7 flex items-start gap-3">
          <span className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-full ${isPass ? "bg-[#4b2924] text-[#f27c69]" : isInvest ? "bg-[#214332] text-[#72c99a]" : "bg-[#453c24] text-[#e6bd64]"}`}>
            {isPass ? <CloseIcon /> : isInvest ? <CheckLargeIcon /> : <BranchIcon />}
          </span>
          <div>
            <p className="text-[22px] font-semibold leading-[1.05] tracking-[-0.035em]">
              {recommendationLabel}
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-[#aeb2aa]">
              {assessment.recommendation === "conditional"
                ? "Validate traction directly before partner review. Founder and market remain promising."
                : assessment.recommendation === "invest"
                  ? "Signals align across the three independent axes. Advance to partner review."
                  : "Current signals do not clear the fund’s underwriting threshold."}
            </p>
            {traceAvailable && (
              <div className="mt-3">
                <EvidenceCitations
                  evidence={evidence}
                  evidenceIds={evidenceIds}
                  uncited={evidenceIds.length === 0}
                />
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-white/10 ring-1 ring-white/10">
          <DecisionMetric label="Suggested check" value={assessment.checkSize} />
          <DecisionMetric
            label="Open flags"
            value={`${assessment.flags} ${assessment.flags === 1 ? "flag" : "flags"}`}
          />
        </div>
      </div>

      <button
        className="flex w-full items-center justify-center gap-2 border-t border-white/10 bg-white/[0.04] px-5 py-3.5 text-[11px] font-semibold text-[#e2e5dd] transition-colors hover:bg-white/[0.08]"
        type="button"
      >
        Add note for IC <ArrowRightIcon />
      </button>
    </section>
  );
}

function DecisionMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 bg-[#292c27] px-4 py-3.5">
      <p className="mb-1 text-[8px] font-bold uppercase tracking-[0.12em] text-[#8f938b]">
        {label}
      </p>
      <p className="break-words text-[11px] font-semibold leading-[1.35] text-[#f2f3ef]">
        {value}
      </p>
    </div>
  );
}

function SpeedCard({
  isLoading,
  speedSeconds,
  usingFallback,
}: {
  isLoading: boolean;
  speedSeconds: number;
  usingFallback: boolean;
}) {
  return (
    <section className="rounded-[18px] border border-[#d8d6cf] bg-[#f9f8f5] p-5 shadow-[0_12px_32px_rgba(40,42,36,0.04)] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#8a8c84]">
            Signal → decision
          </p>
          <p className="text-[26px] font-semibold leading-none tracking-[-0.045em] tabular-nums">
            {isLoading ? "—" : `${speedSeconds.toFixed(1)}s`}
          </p>
        </div>
        <span className="grid size-9 place-items-center rounded-full bg-[#e7efe8] text-[#42765b]">
          <BoltIcon />
        </span>
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-[#e2e0d9] pt-3.5 text-[9px] font-semibold">
        <span className="text-[#85877f]">
          {usingFallback ? "Demo-safe assessment" : "Live evidence pipeline"}
        </span>
        <span className={`flex items-center gap-1.5 ${usingFallback ? "text-[#9a7441]" : "text-[#4d8065]"}`}>
          <span className={`size-1.5 rounded-full ${usingFallback ? "bg-[#d3a65d]" : "bg-[#57a47a]"}`} />
          {usingFallback ? "Fallback" : isLoading ? "Running" : "Complete"}
        </span>
      </div>
    </section>
  );
}

function MetricPill({ tone, value }: { tone: "green" | "red"; value: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.08em] ${tone === "green" ? "bg-[#e7f0e9] text-[#3e755b]" : "bg-[#f8e6e2] text-[#ad4033]"}`}>
      <span className={`size-1.5 rounded-full ${tone === "green" ? "bg-[#559d77]" : "bg-[#df5b49]"}`} />
      {value}
    </span>
  );
}

function ArrowLeftIcon() {
  return <svg aria-hidden="true" fill="none" height="14" viewBox="0 0 14 14" width="14"><path d="M11.5 7H2.5m0 0 3.7-3.7M2.5 7l3.7 3.7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" /></svg>;
}
function RefreshIcon({ spinning }: { spinning: boolean }) {
  return <svg aria-hidden="true" className={spinning ? "animate-spin" : ""} fill="none" height="13" viewBox="0 0 14 14" width="13"><path d="M11.8 4.6A5.2 5.2 0 1 0 12 8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.4"/><path d="M9.2 4.6h2.7V1.9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4"/></svg>;
}
function ValidationIcon({ spinning }: { spinning: boolean }) {
  return <svg aria-hidden="true" className={spinning ? "animate-spin" : ""} fill="none" height="13" viewBox="0 0 14 14" width="13"><path d="M7 1.5 11.5 3v3.3c0 2.8-1.8 5.1-4.5 6.2-2.7-1.1-4.5-3.4-4.5-6.2V3L7 1.5Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.2"/><path d="m4.9 6.7 1.4 1.4 2.9-3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2"/></svg>;
}
function AuditIcon() {
  return <svg aria-hidden="true" fill="none" height="13" viewBox="0 0 14 14" width="13"><path d="M3 1.7h6l2 2v8.6H3V1.7Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.1"/><path d="M9 1.7v2h2M5 6h4M5 8h4M5 10h2.3" stroke="currentColor" strokeLinecap="round" strokeWidth="1"/></svg>;
}
function DeckIcon() {
  return <svg aria-hidden="true" fill="none" height="14" viewBox="0 0 16 16" width="14"><path d="M3.5 1.8h6l3 3v9.4h-9V1.8Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.2"/><path d="M9.5 1.8v3h3M5.7 7.3h4.6M5.7 9.5h4.6M5.7 11.7h2.7" stroke="currentColor" strokeLinecap="round" strokeWidth="1.1"/></svg>;
}
function ResumeIcon() {
  return <svg aria-hidden="true" fill="none" height="14" viewBox="0 0 16 16" width="14"><path d="M3.3 1.8h6.2l3.2 3.1v9.3H3.3V1.8Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.2"/><circle cx="8" cy="6.7" r="1.5" stroke="currentColor" strokeWidth="1.1"/><path d="M5.5 11.4c.4-1.2 1.3-1.9 2.5-1.9s2.1.7 2.5 1.9M9.5 1.8v3.1h3.2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.1"/></svg>;
}
function ShieldMiniIcon() {
  return <svg aria-hidden="true" className="mt-0.5 shrink-0" fill="none" height="12" viewBox="0 0 16 16" width="12"><path d="M8 1.7 13 3.6v3.8c0 3.1-2 5.8-5 6.9-3-1.1-5-3.8-5-6.9V3.6L8 1.7Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.4"/><path d="m5.6 7.8 1.5 1.5 3.4-3.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4"/></svg>;
}
function ShieldIcon() {
  return <span className="grid size-7 place-items-center rounded-lg bg-[#e5eee7] text-[#42775c]"><svg aria-hidden="true" fill="none" height="14" viewBox="0 0 16 16" width="14"><path d="M8 1.7 13 3.6v3.8c0 3.1-2 5.8-5 6.9-3-1.1-5-3.8-5-6.9V3.6L8 1.7Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.4"/><path d="m5.6 7.8 1.5 1.5 3.4-3.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4"/></svg></span>;
}
function SearchIcon() {
  return <svg aria-hidden="true" fill="none" height="15" viewBox="0 0 16 16" width="15"><circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4"/><path d="m10.5 10.5 3 3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.4"/></svg>;
}
function LockIcon() {
  return <svg aria-hidden="true" fill="none" height="11" viewBox="0 0 12 12" width="11"><rect height="6.2" rx="1.3" stroke="currentColor" strokeWidth="1.1" width="8.5" x="1.75" y="4.3"/><path d="M4 4.3V3a2 2 0 0 1 4 0v1.3" stroke="currentColor" strokeWidth="1.1"/></svg>;
}
function TrendIcon({ trend }: { trend: Trend }) {
  if (trend === "flat") return <MinusIcon />;
  return <svg aria-hidden="true" fill="none" height="9" viewBox="0 0 10 10" width="9"><path d={trend === "up" ? "M2 7.5 7.5 2M4 2h3.5v3.5" : "M2 2.5 7.5 8M4 8h3.5V4.5"} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2"/></svg>;
}
function ArrowUpRightIcon() {
  return <svg aria-hidden="true" fill="none" height="13" viewBox="0 0 14 14" width="13"><path d="m3 11 8-8m-5 0h5v5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/></svg>;
}
function ArrowDownRightIcon() {
  return <svg aria-hidden="true" fill="none" height="13" viewBox="0 0 14 14" width="13"><path d="m3 3 8 8m-5 0h5V6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/></svg>;
}
function MinusIcon() {
  return <svg aria-hidden="true" fill="none" height="10" viewBox="0 0 12 10" width="11"><path d="M2 5h8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5"/></svg>;
}
function CheckIcon() {
  return <svg aria-hidden="true" fill="none" height="9" viewBox="0 0 10 10" width="9"><path d="m1.8 5.1 2.1 2.1L8.3 2.8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4"/></svg>;
}
function CoverageDashIcon() {
  return <svg aria-hidden="true" fill="none" height="9" viewBox="0 0 10 10" width="9"><path d="M2.5 5h5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.3"/></svg>;
}
function UnlockArrowIcon() {
  return <svg aria-hidden="true" className="mt-0.5 shrink-0" fill="none" height="10" viewBox="0 0 12 10" width="11"><path d="M1.5 5h8m0 0L6.8 2.3M9.5 5 6.8 7.7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.1"/></svg>;
}
function AlertIcon() {
  return <svg aria-hidden="true" fill="none" height="9" viewBox="0 0 10 10" width="9"><path d="M5 1.5 9 8.3H1L5 1.5Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.1"/><path d="M5 3.7v2.1m0 1v.1" stroke="currentColor" strokeLinecap="round" strokeWidth="1.1"/></svg>;
}
function QuestionIcon() {
  return <svg aria-hidden="true" fill="none" height="9" viewBox="0 0 10 10" width="9"><circle cx="5" cy="5" r="4" stroke="currentColor"/><path d="M3.8 3.7a1.3 1.3 0 0 1 2.5.4c0 1-.9 1.1-1.3 1.7m0 1v.1" stroke="currentColor" strokeLinecap="round" strokeWidth="1.1"/></svg>;
}
function SourceIcon({ source }: { source: string }) {
  if (source.toLowerCase().includes("github")) return <svg aria-hidden="true" fill="currentColor" height="10" viewBox="0 0 16 16" width="10"><path d="M8 .8a7.4 7.4 0 0 0-2.3 14.4c.4.1.5-.2.5-.4v-1.5c-2.1.5-2.6-.9-2.6-.9-.3-.9-.8-1.1-.8-1.1-.7-.5.1-.5.1-.5.8 0 1.2.8 1.2.8.7 1.2 1.8.9 2.2.7.1-.5.3-.9.5-1.1-1.7-.2-3.5-.9-3.5-3.7 0-.8.3-1.5.8-2-.1-.2-.3-1 .1-2 0 0 .6-.2 2.1.8A7 7 0 0 1 8 4c.6 0 1.3.1 1.9.3 1.4-1 2.1-.8 2.1-.8.4 1 .2 1.8.1 2 .5.5.8 1.2.8 2 0 2.9-1.8 3.5-3.5 3.7.3.2.5.7.5 1.4v2.2c0 .2.1.5.5.4A7.4 7.4 0 0 0 8 .8Z"/></svg>;
  return <svg aria-hidden="true" fill="none" height="10" viewBox="0 0 12 12" width="10"><circle cx="6" cy="6" r="4.5" stroke="currentColor"/><path d="M1.8 6h8.4M6 1.5c1.2 1.2 1.8 2.7 1.8 4.5S7.2 9.3 6 10.5C4.8 9.3 4.2 7.8 4.2 6S4.8 2.7 6 1.5Z" stroke="currentColor" strokeWidth=".8"/></svg>;
}
function EvidenceIcon() {
  return <svg aria-hidden="true" fill="none" height="11" viewBox="0 0 12 12" width="11"><path d="M2 2.2h8v6H5.8L3 10V8.2H2v-6Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1"/></svg>;
}
function CloseIcon() {
  return <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 16 16" width="16"><path d="m4 4 8 8m0-8-8 8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7"/></svg>;
}
function CheckLargeIcon() {
  return <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 16 16" width="16"><path d="m2.8 8.3 3.2 3.2 7.2-7.2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"/></svg>;
}
function BranchIcon() {
  return <svg aria-hidden="true" fill="none" height="17" viewBox="0 0 18 18" width="17"><circle cx="4" cy="4" r="1.6" stroke="currentColor" strokeWidth="1.3"/><circle cx="14" cy="4" r="1.6" stroke="currentColor" strokeWidth="1.3"/><circle cx="9" cy="14" r="1.6" stroke="currentColor" strokeWidth="1.3"/><path d="M4 5.7v1.6c0 1 .8 1.7 1.7 1.7H9m5-3.3v1.6c0 1-.8 1.7-1.7 1.7H9m0 0v3.3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.3"/></svg>;
}
function ArrowRightIcon() {
  return <svg aria-hidden="true" fill="none" height="12" viewBox="0 0 14 12" width="14"><path d="M1.5 6h11m0 0L8.7 2.2M12.5 6 8.7 9.8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3"/></svg>;
}
function BoltIcon() {
  return <svg aria-hidden="true" fill="none" height="17" viewBox="0 0 18 18" width="17"><path d="m10.2 1.8-6 8.1h4.6l-1 6.3 6-8.2H9.3l.9-6.2Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.4"/></svg>;
}
