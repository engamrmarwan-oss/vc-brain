"use client";

import { useId, useMemo, useState } from "react";

import type {
  DecisionStep,
  EvidenceRef,
  EvidenceType,
  TraceReport,
  ValidationIssue,
  ValidationResult,
} from "@/components/traceability";

export function EvidenceCitations({
  evidence,
  evidenceIds,
  uncited = false,
}: {
  evidence: EvidenceRef[];
  evidenceIds: string[];
  uncited?: boolean;
}) {
  const refs = useMemo(() => {
    const byId = new Map(evidence.map((item) => [item.id, item]));
    return evidenceIds
      .map((id) => byId.get(id))
      .filter((item): item is EvidenceRef => Boolean(item));
  }, [evidence, evidenceIds]);
  const [isOpen, setIsOpen] = useState(false);
  const titleId = useId();

  if (!refs.length) {
    return uncited ? (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-[#cbc8bf] bg-[#f1efe9] px-2 py-1 text-[8px] font-semibold text-[#7f8179]">
        <span className="size-1 rounded-full bg-[#aaa89f]" />
        No independent evidence
      </span>
    ) : null;
  }

  return (
    <>
      <button
        aria-expanded={isOpen}
        className="inline-flex items-center gap-1.5 rounded-full bg-[#e8eee9] px-2 py-1 text-[8px] font-bold uppercase tracking-[0.08em] text-[#4e715d] ring-1 ring-inset ring-[#d4e1d7] transition-colors hover:bg-[#dfeae2]"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <CitationIcon />
        {refs.length} {refs.length === 1 ? "citation" : "citations"}
      </button>

      {isOpen && (
        <div
          aria-labelledby={titleId}
          aria-modal="true"
          className="fixed inset-0 z-[70] grid place-items-center bg-[#171915]/35 p-4 backdrop-blur-[2px]"
          role="dialog"
        >
          <button
            aria-label="Close evidence popover"
            className="absolute inset-0 cursor-default"
            onClick={() => setIsOpen(false)}
            type="button"
          />
          <div className="relative z-10 max-h-[78vh] w-full max-w-[520px] overflow-y-auto rounded-[18px] border border-[#d7d4ca] bg-[#faf9f6] shadow-[0_28px_80px_rgba(23,25,21,0.24)]">
            <div className="flex items-center justify-between gap-4 border-b border-[#e0ded6] px-5 py-4">
              <div>
                <p className="text-[8px] font-bold uppercase tracking-[0.15em] text-[#8d8f87]">
                  Decision evidence
                </p>
                <h3
                  className="mt-1 text-[16px] font-semibold tracking-[-0.02em]"
                  id={titleId}
                >
                  Exact supporting signals
                </h3>
              </div>
              <button
                aria-label="Close evidence popover"
                className="grid size-8 place-items-center rounded-full bg-[#eceae4] text-[#6f7169] transition-colors hover:bg-[#e2e0d8] hover:text-[#272923]"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="divide-y divide-[#e5e2da]">
              {refs.map((ref) => (
                <article className="px-5 py-5" key={ref.id}>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <EvidenceTypeBadge type={ref.type} />
                    {ref.locator?.page !== undefined && (
                      <span className="text-[8.5px] font-semibold text-[#83857d]">
                        Page {ref.locator.page}
                      </span>
                    )}
                    {ref.locator?.section && (
                      <span className="text-[8.5px] font-semibold text-[#83857d]">
                        {ref.locator.section}
                      </span>
                    )}
                  </div>
                  <h4 className="text-[12px] font-semibold text-[#34362f]">
                    {ref.title}
                  </h4>
                  <blockquote className="mt-2.5 border-l-2 border-[#9eb4a5] pl-3 text-[11px] leading-[1.65] text-[#666860]">
                    {ref.excerpt}
                  </blockquote>
                  {ref.url && (
                    <a
                      className="mt-3 inline-flex items-center gap-1.5 text-[9.5px] font-semibold text-[#47745a] underline decoration-[#b7c8bb] underline-offset-4 hover:text-[#27583d]"
                      href={ref.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open source <ExternalIcon />
                    </a>
                  )}
                </article>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function AuditTrailDrawer({
  onClose,
  trace,
}: {
  onClose: () => void;
  trace: TraceReport;
}) {
  const evidenceById = useMemo(
    () => new Map(trace.evidence.map((item) => [item.id, item])),
    [trace.evidence],
  );

  return (
    <div
      aria-labelledby="audit-trail-title"
      aria-modal="true"
      className="fixed inset-0 z-[65] bg-[#171915]/30 backdrop-blur-[2px]"
      role="dialog"
    >
      <button
        aria-label="Close audit trail"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        type="button"
      />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-[520px] flex-col border-l border-[#d4d1c8] bg-[#f5f3ee] shadow-[-24px_0_64px_rgba(23,25,21,0.18)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#dad7ce] bg-[#faf9f6] px-5 py-5 sm:px-6">
          <div>
            <p className="text-[8.5px] font-bold uppercase tracking-[0.16em] text-[#758078]">
              Structured evidence trace
            </p>
            <h2
              className="mt-1.5 text-[23px] font-semibold tracking-[-0.04em]"
              id="audit-trail-title"
            >
              Audit trail
            </h2>
            <p className="mt-2 text-[9.5px] text-[#85877f]">
              Evidence, checks and conclusions only—never private model reasoning.
            </p>
          </div>
          <button
            aria-label="Close audit trail"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-[#eceae4] text-[#6f7169] transition-colors hover:bg-[#dfddd5] hover:text-[#272923]"
            onClick={onClose}
            type="button"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="mb-5 flex items-center justify-between rounded-xl border border-[#dad7ce] bg-[#faf9f6] px-3.5 py-3 text-[8.5px] text-[#81837b]">
            <span>Run {trace.runId}</span>
            <span>{formatTraceDate(trace.generatedAt)}</span>
          </div>

          <ol className="space-y-3">
            {trace.steps.map((step, index) => (
              <AuditStep
                evidenceById={evidenceById}
                index={index}
                key={step.id}
                step={step}
              />
            ))}
          </ol>
        </div>
      </aside>
    </div>
  );
}

export function ValidationDelta({
  evidence,
  result,
}: {
  evidence: EvidenceRef[];
  result: ValidationResult;
}) {
  const revised = result.originalStatus !== result.validatedStatus;

  return (
    <div
      className={`mt-4 rounded-xl border px-3.5 py-3 ${
        revised
          ? "border-[#e0cfaa] bg-[#f8f0df]"
          : "border-[#cfe0d3] bg-[#edf4ee]"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 text-[8.5px] font-bold uppercase tracking-[0.1em] ${
            revised ? "text-[#8a6633]" : "text-[#43765a]"
          }`}
        >
          {revised ? <RevisionIcon /> : <CheckIcon />}
          {revised ? "Validator revised" : "Validator upheld"}
        </span>
        {revised && (
          <span className="rounded-full bg-white/65 px-2 py-1 text-[8.5px] font-semibold text-[#74613f] ring-1 ring-inset ring-[#dfcfad]">
            {result.originalStatus} → {result.validatedStatus}
          </span>
        )}
        <span className="ml-auto text-[8.5px] font-semibold tabular-nums text-[#83857d]">
          {Math.round(result.confidence * 100)}% confidence in verdict
        </span>
      </div>

      {result.issues.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {result.issues.map((issue) => (
            <span
              className="rounded-full bg-white/70 px-2 py-1 text-[7.5px] font-bold uppercase tracking-[0.07em] text-[#7a6540] ring-1 ring-inset ring-[#e1d4b9]"
              key={issue}
            >
              {validationIssueLabel(issue)}
            </span>
          ))}
        </div>
      )}

      {result.note && (
        <p className="mt-2.5 text-[9.5px] leading-relaxed text-[#666860]">
          {result.note}
        </p>
      )}

      {result.evidenceIds.length > 0 && (
        <div className="mt-2.5">
          <EvidenceCitations
            evidence={evidence}
            evidenceIds={result.evidenceIds}
          />
        </div>
      )}
    </div>
  );
}

export function NotIndependentlyValidatedBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-[#bcb9ae] bg-[#f0eee8] px-2.5 py-1.5 text-[8px] font-bold uppercase tracking-[0.08em] text-[#6f7169]">
      <span className="size-1.5 rounded-full bg-[#9c9a91]" />
      Not independently validated
    </span>
  );
}

function AuditStep({
  evidenceById,
  index,
  step,
}: {
  evidenceById: Map<string, EvidenceRef>;
  index: number;
  step: DecisionStep;
}) {
  const refs = step.evidenceIds
    .map((id) => evidenceById.get(id))
    .filter((item): item is EvidenceRef => Boolean(item));

  return (
    <li className="relative rounded-[16px] border border-[#dcd9d0] bg-[#faf9f6] p-4 shadow-[0_7px_20px_rgba(40,42,36,0.035)]">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="grid size-6 place-items-center rounded-full bg-[#ebe9e2] text-[8px] font-bold tabular-nums text-[#74766e]">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="rounded-full bg-[#e9e7e0] px-2 py-1 text-[7.5px] font-bold uppercase tracking-[0.09em] text-[#60635b]">
          {agentLabel(step.agent)}
        </span>
        <StepStatusChip status={step.status} />
        {step.durationMs > 0 && (
          <span className="ml-auto text-[8px] font-semibold tabular-nums text-[#969890]">
            {formatDuration(step.durationMs)}
          </span>
        )}
      </div>
      <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-[#777971]">
        {step.action}
      </p>
      <p className="mt-2 text-[11px] leading-[1.6] text-[#454841]">
        {step.conclusion}
      </p>
      {refs.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[#e6e3db] pt-3">
          {refs.map((ref) => (
            <span
              className="rounded-full bg-[#eef1ec] px-2 py-1 text-[7.5px] font-semibold text-[#66746b]"
              key={ref.id}
              title={ref.excerpt}
            >
              {evidenceTypeLabel(ref.type)} · {ref.title}
            </span>
          ))}
        </div>
      )}
    </li>
  );
}

function StepStatusChip({ status }: { status: DecisionStep["status"] }) {
  const style =
    status === "supported"
      ? "bg-[#e4eee6] text-[#3f7658]"
      : status === "corrected"
        ? "bg-[#f1eadb] text-[#886735]"
        : status === "challenged"
          ? "bg-[#f8e6e2] text-[#a94134]"
          : "bg-[#eceae4] text-[#74766e]";
  return (
    <span
      className={`rounded-full px-2 py-1 text-[7.5px] font-bold uppercase tracking-[0.08em] ${style}`}
    >
      {status}
    </span>
  );
}

function EvidenceTypeBadge({ type }: { type: EvidenceType }) {
  return (
    <span className="rounded-full bg-[#e7ede8] px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.09em] text-[#4f6f5d]">
      {evidenceTypeLabel(type)}
    </span>
  );
}

function evidenceTypeLabel(type: EvidenceType): string {
  const labels: Record<EvidenceType, string> = {
    deck: "Deck evidence",
    resume: "Resume evidence",
    github: "GitHub evidence",
    linkedin: "LinkedIn evidence",
    web: "Web evidence (best-effort)",
    footprint: "Web evidence (best-effort)",
    interview: "Interview evidence",
    "market-db": "Market comparable",
  };
  return labels[type];
}

function validationIssueLabel(issue: ValidationIssue): string {
  return issue.replaceAll("-", " ");
}

function agentLabel(agent: DecisionStep["agent"]): string {
  return agent === "trust-engine"
    ? "Trust engine"
    : agent.charAt(0).toUpperCase() + agent.slice(1);
}

function formatDuration(durationMs: number): string {
  return durationMs >= 1000
    ? `${(durationMs / 1000).toFixed(1)}s`
    : `${Math.round(durationMs)}ms`;
}

function formatTraceDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Latest screen"
    : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function CitationIcon() {
  return <svg aria-hidden="true" fill="none" height="9" viewBox="0 0 11 10" width="10"><path d="M4.7 6.5 6.4 4.8M3.8 7.4l-.9.8A1.8 1.8 0 0 1 .4 5.7L2 4.1a1.8 1.8 0 0 1 2.5 0m2-1.5.9-.8a1.8 1.8 0 0 1 2.5 2.5L8.3 5.9a1.8 1.8 0 0 1-2.5 0" stroke="currentColor" strokeLinecap="round" strokeWidth="1"/></svg>;
}
function ExternalIcon() {
  return <svg aria-hidden="true" fill="none" height="9" viewBox="0 0 10 10" width="9"><path d="M4 2H2v6h6V6M5.5 1.5h3v3m0-3-4 4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function CloseIcon() {
  return <svg aria-hidden="true" fill="none" height="13" viewBox="0 0 14 14" width="13"><path d="m3.5 3.5 7 7m0-7-7 7" stroke="currentColor" strokeLinecap="round" strokeWidth="1.4"/></svg>;
}
function CheckIcon() {
  return <svg aria-hidden="true" fill="none" height="9" viewBox="0 0 10 10" width="9"><path d="m1.8 5.1 2.1 2.1L8.3 2.8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3"/></svg>;
}
function RevisionIcon() {
  return <svg aria-hidden="true" fill="none" height="9" viewBox="0 0 10 10" width="9"><path d="M8.3 4.2A3.5 3.5 0 1 0 8 6.5M8.3 4.2V1.8m0 2.4H5.9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.1"/></svg>;
}
