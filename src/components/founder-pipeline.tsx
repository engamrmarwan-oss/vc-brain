"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { AppHeader } from "@/components/app-header";
import type {
  AxisVerdict,
  Entry,
  Founder,
  Trend,
} from "@/lib/types";

type EntryFilter = "all" | Entry;
type AxisSignal = { verdict: AxisVerdict; trend: Trend };
type FounderSignals = {
  founder: AxisSignal;
  market: AxisSignal;
  ideaVsMarket: AxisSignal;
  trust: "verified" | "contradicted" | "thin" | "pending";
  trustLabel: string;
};

const FOUNDER_SIGNALS: Record<string, FounderSignals> = {
  "priya-nair": {
    founder: { verdict: "bullish", trend: "up" },
    market: { verdict: "bullish", trend: "up" },
    ideaVsMarket: { verdict: "bullish", trend: "up" },
    trust: "verified",
    trustLabel: "Trust verified",
  },
  "maya-chen": {
    founder: { verdict: "bullish", trend: "up" },
    market: { verdict: "bullish", trend: "up" },
    ideaVsMarket: { verdict: "neutral", trend: "flat" },
    trust: "contradicted",
    trustLabel: "1 contradiction",
  },
  "tomas-halvorsen": {
    founder: { verdict: "neutral", trend: "up" },
    market: { verdict: "bullish", trend: "up" },
    ideaVsMarket: { verdict: "neutral", trend: "flat" },
    trust: "thin",
    trustLabel: "Thin evidence",
  },
  "dan-okoro": {
    founder: { verdict: "neutral", trend: "flat" },
    market: { verdict: "bear", trend: "down" },
    ideaVsMarket: { verdict: "neutral", trend: "flat" },
    trust: "verified",
    trustLabel: "Trust verified",
  },
};

const DEFAULT_SIGNALS: FounderSignals = {
  founder: { verdict: "neutral", trend: "flat" },
  market: { verdict: "neutral", trend: "flat" },
  ideaVsMarket: { verdict: "neutral", trend: "flat" },
  trust: "pending",
  trustLabel: "Screen pending",
};

const FILTERS: Array<{ label: string; value: EntryFilter }> = [
  { label: "All", value: "all" },
  { label: "Scraped", value: "outbound" },
  { label: "Inbound", value: "inbound" },
  { label: "Cold-start", value: "cold-start" },
];

export function FounderPipeline({ founders }: { founders: Founder[] }) {
  const [query, setQuery] = useState("");
  const [entryFilter, setEntryFilter] = useState<EntryFilter>("all");

  const filteredFounders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return founders.filter((founder) => {
      const matchesEntry =
        entryFilter === "all" || founder.entry === entryFilter;
      const matchesQuery =
        !normalizedQuery ||
        [founder.name, founder.company, founder.sector, founder.geo].some(
          (value) => value.toLowerCase().includes(normalizedQuery),
        );

      return matchesEntry && matchesQuery;
    });
  }, [entryFilter, founders, query]);

  const outboundCount = founders.filter(
    (founder) => founder.entry === "outbound",
  ).length;
  const inboundCount = founders.filter(
    (founder) => founder.entry === "inbound",
  ).length;
  const coldStartCount = founders.filter(
    (founder) => founder.entry === "cold-start",
  ).length;

  return (
    <div className="min-h-screen bg-[#efeee9] text-[#171915]">
      <AppHeader />

      <main className="mx-auto w-full max-w-[1360px] px-5 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12">
        <section className="mb-8 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <div className="mb-4 flex items-center gap-2.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#777971]">
                Dealflow intelligence
              </span>
              <span className="h-px w-8 bg-[#c8c6bd]" />
              <span className="flex items-center gap-1.5 text-[10px] font-semibold text-[#4f8569]">
                <span className="size-1.5 rounded-full bg-[#54a079] shadow-[0_0_0_3px_rgba(84,160,121,0.12)]" />
                Live
              </span>
            </div>
            <h1 className="text-[36px] font-semibold leading-none tracking-[-0.05em] sm:text-[46px]">
              Opportunity pipeline
            </h1>
            <p className="mt-4 max-w-2xl text-[13px] leading-relaxed text-[#73756e]">
              Founders ranked by persistent founder signal. Market and idea fit
              remain independent — no blended score hides the tradeoffs.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#d3d1c9] bg-[#f8f7f3] px-4 text-[12px] font-semibold transition-colors hover:bg-white"
              href="/apply?mode=thesis"
            >
              <SlidersIcon /> Thesis settings
            </Link>
            <Link
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#20231e] px-4 text-[12px] font-semibold text-white shadow-[0_8px_20px_rgba(32,35,30,0.14)] transition-colors hover:bg-[#30342d]"
              href="/apply"
            >
              <PlusIcon /> Add founder
            </Link>
          </div>
        </section>

        <section
          aria-label="Pipeline summary"
          className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-[18px] border border-[#d8d6cf] bg-[#d8d6cf] shadow-[0_12px_32px_rgba(40,42,36,0.04)] lg:grid-cols-4"
        >
          <SummaryMetric
            detail="currently screening"
            icon={<LayersIcon />}
            label="Active pipeline"
            value={String(founders.length).padStart(2, "0")}
          />
          <SummaryMetric
            detail="never applied"
            icon={<RadarIcon />}
            label="Scraped outbound"
            tone="green"
            value={String(outboundCount).padStart(2, "0")}
          />
          <SummaryMetric
            detail="founder submitted"
            icon={<InboxIcon />}
            label="Inbound"
            value={String(inboundCount).padStart(2, "0")}
          />
          <SummaryMetric
            detail="wide confidence band"
            icon={<ColdStartIcon />}
            label="Cold-start"
            tone="amber"
            value={String(coldStartCount).padStart(2, "0")}
          />
        </section>

        <section
          aria-labelledby="ranked-founders"
          className="overflow-hidden rounded-[18px] border border-[#d8d6cf] bg-[#f9f8f5] shadow-[0_14px_38px_rgba(40,42,36,0.06)]"
        >
          <div className="flex flex-col justify-between gap-4 border-b border-[#dfddd6] px-5 py-5 sm:px-6 lg:flex-row lg:items-center">
            <div>
              <div className="flex items-center gap-2.5">
                <h2
                  className="text-[17px] font-semibold tracking-[-0.025em]"
                  id="ranked-founders"
                >
                  Ranked founders
                </h2>
                <span className="rounded-full bg-[#e9e7df] px-2 py-0.5 text-[9px] font-bold text-[#777970]">
                  {filteredFounders.length}
                </span>
              </div>
              <p className="mt-1.5 text-[10.5px] text-[#85877f]">
                Founder Score drives rank. F / M / I are separate screening
                verdicts with their own momentum.
              </p>
            </div>

            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <div className="flex items-center rounded-xl border border-[#d8d6cf] bg-[#f1f0eb] p-1">
                {FILTERS.map((filter) => (
                  <button
                    aria-pressed={entryFilter === filter.value}
                    className={`rounded-lg px-3 py-1.5 text-[10px] font-semibold transition-colors ${
                      entryFilter === filter.value
                        ? "bg-white text-[#242620] shadow-sm"
                        : "text-[#85877f] hover:text-[#242620]"
                    }`}
                    key={filter.value}
                    onClick={() => setEntryFilter(filter.value)}
                    type="button"
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
              <label className="flex h-9 min-w-0 items-center gap-2 rounded-xl border border-[#d8d6cf] bg-white px-3 sm:w-[210px]">
                <span className="text-[#969890]">
                  <SearchIcon />
                </span>
                <span className="sr-only">Search founders</span>
                <input
                  className="min-w-0 flex-1 bg-transparent text-[11px] text-[#30322c] outline-none placeholder:text-[#a0a29a]"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search founders…"
                  type="search"
                  value={query}
                />
              </label>
            </div>
          </div>

          <div className="hidden grid-cols-[50px_minmax(230px,1.4fr)_122px_130px_178px_142px_24px] items-center gap-4 border-b border-[#e1dfd8] bg-[#f2f1ec] px-6 py-3 text-[9px] font-bold uppercase tracking-[0.12em] text-[#8b8d85] lg:grid">
            <span>Rank</span>
            <span>Opportunity</span>
            <span>Source</span>
            <span>Founder score</span>
            <span className="flex items-center gap-2">
              Screening axes
              <span className="font-medium normal-case tracking-normal text-[#aaa9a1]">
                F / M / I
              </span>
            </span>
            <span>Trust layer</span>
            <span />
          </div>

          <ol className="divide-y divide-[#e2e0d9]">
            {filteredFounders.map((founder) => {
              const rank = founders.findIndex((item) => item.id === founder.id) + 1;
              return (
                <FounderRow
                  founder={founder}
                  key={founder.id}
                  rank={rank}
                  signals={FOUNDER_SIGNALS[founder.id] ?? DEFAULT_SIGNALS}
                />
              );
            })}
          </ol>

          {filteredFounders.length === 0 && (
            <div className="px-6 py-16 text-center">
              <span className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-[#ebe9e2] text-[#85877f]">
                <SearchIcon />
              </span>
              <p className="text-[13px] font-semibold">No founders found</p>
              <p className="mt-1 text-[11px] text-[#888a82]">
                Try another source filter or search term.
              </p>
            </div>
          )}

          <div className="flex flex-col justify-between gap-2 border-t border-[#dfddd6] bg-[#f2f1ec] px-5 py-3.5 text-[9.5px] text-[#85877f] sm:flex-row sm:items-center sm:px-6">
            <span className="flex items-center gap-1.5">
              <LockIcon /> Ranking uses the persistent founder signal — never
              resets within this session
            </span>
            <span className="flex items-center gap-2 font-semibold text-[#73756d]">
              <SignalLegend verdict="bullish" /> Bullish
              <SignalLegend verdict="neutral" /> Neutral
              <SignalLegend verdict="bear" /> Bear
            </span>
          </div>
        </section>
      </main>
    </div>
  );
}

function SummaryMetric({
  detail,
  icon,
  label,
  tone = "default",
  value,
}: {
  detail: string;
  icon: React.ReactNode;
  label: string;
  tone?: "default" | "green" | "amber";
  value: string;
}) {
  const iconTone =
    tone === "green"
      ? "bg-[#e3eee6] text-[#42785c]"
      : tone === "amber"
        ? "bg-[#f1eadb] text-[#8a6b38]"
        : "bg-[#e9e7df] text-[#6f7169]";

  return (
    <article className="flex min-h-[112px] items-center justify-between gap-2 bg-[#f9f8f5] px-4 py-5 sm:px-6">
      <div>
        <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.14em] text-[#8b8d85]">
          {label}
        </p>
        <div className="flex items-end gap-1.5 sm:gap-2">
          <p className="text-[27px] font-semibold leading-none tracking-[-0.04em] tabular-nums">
            {value}
          </p>
          <p className="mb-0.5 text-[8px] leading-tight text-[#8d8f87] sm:text-[9.5px]">
            {detail}
          </p>
        </div>
      </div>
      <span className={`grid size-8 shrink-0 place-items-center rounded-full sm:size-9 ${iconTone}`}>
        {icon}
      </span>
    </article>
  );
}

function FounderRow({
  founder,
  rank,
  signals,
}: {
  founder: Founder;
  rank: number;
  signals: FounderSignals;
}) {
  const band = Math.max(
    2,
    Math.round((1 - founder.founderScoreConfidence) * 31),
  );
  const initials = founder.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

  return (
    <li>
      <Link
        aria-label={`Open ${founder.name} investment memo`}
        className={`group relative grid gap-5 px-5 py-5 transition-colors hover:bg-white sm:px-6 lg:grid-cols-[50px_minmax(230px,1.4fr)_122px_130px_178px_142px_24px] lg:items-center lg:gap-4 lg:py-4 ${
          rank === 1 ? "bg-[#fbfaf7]" : "bg-[#f9f8f5]"
        }`}
        href={`/founder/${founder.id}`}
      >
        {rank === 1 && (
          <span className="absolute inset-y-0 left-0 w-[3px] bg-[#4d9570]" />
        )}

        <div className="hidden lg:block">
          <span
            className={`grid size-7 place-items-center rounded-full text-[10px] font-bold tabular-nums ${
              rank === 1
                ? "bg-[#dfece3] text-[#3e7659]"
                : "bg-[#eceae3] text-[#777970]"
            }`}
          >
            {String(rank).padStart(2, "0")}
          </span>
        </div>

        <div className="flex min-w-0 items-center gap-3.5">
          <span
            className={`relative grid size-11 shrink-0 place-items-center rounded-[13px] text-[12px] font-bold ${
              rank === 1
                ? "bg-[#25332a] text-white"
                : "bg-[#e7e4dc] text-[#4f514b]"
            }`}
          >
            {initials}
            {founder.entry === "outbound" && (
              <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-[#dbeadf] text-[#3e795a] ring-2 ring-[#f9f8f5]">
                <SparkIcon />
              </span>
            )}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-[14px] font-semibold tracking-[-0.015em] text-[#252721]">
                {founder.name}
              </h3>
              {rank === 1 && founder.entry === "outbound" && (
                <span className="rounded-full bg-[#e5efe7] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.1em] text-[#44765c]">
                  surfaced
                </span>
              )}
            </div>
            <p className="mt-1 truncate text-[10.5px] text-[#7e8078]">
              <span className="font-semibold text-[#555750]">
                {founder.company === "(pre-company)"
                  ? "Pre-company"
                  : founder.company}
              </span>
              <span className="mx-1.5 text-[#c1bfb7]">/</span>
              {founder.sector}
              <span className="mx-1.5 text-[#c1bfb7]">/</span>
              {founder.geo}
            </p>
          </div>
          <span className="ml-auto grid size-7 shrink-0 place-items-center rounded-full bg-[#eeece6] text-[10px] font-bold text-[#777970] lg:hidden">
            {String(rank).padStart(2, "0")}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 lg:block">
          <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#999b93] lg:hidden">
            Source
          </span>
          <EntryBadge entry={founder.entry} />
        </div>

        <div className="flex items-end justify-between gap-4 lg:block">
          <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#999b93] lg:hidden">
            Founder score
          </span>
          <div className="min-w-[116px]">
            <div className="mb-2 flex items-baseline gap-1.5">
              <span className="text-[19px] font-semibold leading-none tracking-[-0.04em] tabular-nums">
                {founder.founderScore}
              </span>
              <span
                className={`text-[10px] font-bold tabular-nums ${
                  founder.entry === "cold-start"
                    ? "text-[#a16e2f]"
                    : "text-[#85877f]"
                }`}
              >
                ±{band}
              </span>
              {founder.entry === "cold-start" && (
                <span className="rounded-full bg-[#f3ead8] px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.08em] text-[#966b34]">
                  wide
                </span>
              )}
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[#dfddd6]">
              <div
                className={`h-full rounded-full ${
                  founder.entry === "cold-start"
                    ? "bg-[#c89950]"
                    : rank === 1
                      ? "bg-[#4c9670]"
                      : "bg-[#777b71]"
                }`}
                style={{ width: `${founder.founderScore}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 lg:block">
          <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#999b93] lg:hidden">
            F / M / I axes
          </span>
          <div className="flex items-center gap-2">
            <AxisMark label="F" signal={signals.founder} />
            <AxisMark label="M" signal={signals.market} />
            <AxisMark label="I" signal={signals.ideaVsMarket} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 lg:block">
          <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#999b93] lg:hidden">
            Trust layer
          </span>
          <TrustBadge label={signals.trustLabel} status={signals.trust} />
        </div>

        <span className="hidden text-[#9b9d95] transition-transform group-hover:translate-x-0.5 group-hover:text-[#33352f] lg:block">
          <ChevronRightIcon />
        </span>
      </Link>
    </li>
  );
}

function EntryBadge({ entry }: { entry: Entry }) {
  const config: Record<
    Entry,
    { icon: React.ReactNode; label: string; style: string }
  > = {
    outbound: {
      icon: <RadarSmallIcon />,
      label: "Scraped",
      style: "bg-[#e4eee6] text-[#40765a] ring-[#cfe0d3]",
    },
    inbound: {
      icon: <InboxSmallIcon />,
      label: "Inbound",
      style: "bg-[#e9e8e3] text-[#666861] ring-[#dad8d0]",
    },
    "cold-start": {
      icon: <ColdSmallIcon />,
      label: "Cold-start",
      style: "bg-[#f2eadb] text-[#8d6932] ring-[#e5d6b9]",
    },
  };
  const item = config[entry];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[8.5px] font-bold uppercase tracking-[0.09em] ring-1 ring-inset ${item.style}`}
    >
      {item.icon}
      {item.label}
    </span>
  );
}

function AxisMark({ label, signal }: { label: string; signal: AxisSignal }) {
  const styles: Record<AxisVerdict, string> = {
    bullish: "bg-[#e3eee6] text-[#3e785a] ring-[#c9dfcf]",
    neutral: "bg-[#eeebe2] text-[#7c704f] ring-[#ddd5bf]",
    bear: "bg-[#f7e4df] text-[#b14637] ring-[#efc9c1]",
  };

  return (
    <span
      aria-label={`${label}: ${signal.verdict}, trend ${signal.trend}`}
      className={`relative grid size-9 place-items-center rounded-full text-[10px] font-bold ring-1 ${styles[signal.verdict]}`}
      title={`${label}: ${signal.verdict} / ${signal.trend}`}
    >
      {label}
      <span className="absolute -right-0.5 -top-0.5 grid size-3.5 place-items-center rounded-full bg-[#f9f8f5] shadow-[0_1px_4px_rgba(30,32,27,0.14)]">
        <TrendArrow trend={signal.trend} />
      </span>
    </span>
  );
}

function TrustBadge({
  label,
  status,
}: {
  label: string;
  status: FounderSignals["trust"];
}) {
  const style =
    status === "verified"
      ? "bg-[#e6efe8] text-[#41775b]"
      : status === "contradicted"
        ? "bg-[#f8e6e2] text-[#ad4033]"
        : status === "thin"
          ? "bg-[#f2eadb] text-[#8b6934]"
          : "bg-[#eceae4] text-[#777970]";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[8.5px] font-bold uppercase tracking-[0.08em] ${style}`}
    >
      {status === "verified" ? (
        <CheckIcon />
      ) : status === "contradicted" ? (
        <AlertIcon />
      ) : (
        <EvidenceIcon />
      )}
      {label}
    </span>
  );
}

function SignalLegend({ verdict }: { verdict: AxisVerdict }) {
  const style =
    verdict === "bullish"
      ? "bg-[#5a9c78]"
      : verdict === "bear"
        ? "bg-[#dc6756]"
        : "bg-[#aaa487]";
  return <span className={`size-1.5 rounded-full ${style}`} />;
}

function TrendArrow({ trend }: { trend: Trend }) {
  const color =
    trend === "up"
      ? "text-[#3f7d5c]"
      : trend === "down"
        ? "text-[#bd4d3d]"
        : "text-[#8d8875]";
  const path =
    trend === "up"
      ? "M2 6.5 6.5 2M3.4 2h3.1v3.1"
      : trend === "down"
        ? "M2 2.5 6.5 7M3.4 7h3.1V3.9"
        : "M2 4.5h5";

  return (
    <svg
      aria-hidden="true"
      className={color}
      fill="none"
      height="9"
      viewBox="0 0 9 9"
      width="9"
    >
      <path
        d={path}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.15"
      />
    </svg>
  );
}

function SlidersIcon() {
  return <svg aria-hidden="true" fill="none" height="13" viewBox="0 0 14 14" width="13"><path d="M2 3.5h10M2 10.5h10" stroke="currentColor" strokeLinecap="round" strokeWidth="1.3"/><circle cx="5" cy="3.5" fill="#f8f7f3" r="1.7" stroke="currentColor" strokeWidth="1.2"/><circle cx="9" cy="10.5" fill="#f8f7f3" r="1.7" stroke="currentColor" strokeWidth="1.2"/></svg>;
}
function PlusIcon() {
  return <svg aria-hidden="true" fill="none" height="13" viewBox="0 0 14 14" width="13"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeLinecap="round" strokeWidth="1.4"/></svg>;
}
function LayersIcon() {
  return <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 18 18" width="16"><path d="m9 2 6.5 3.4L9 8.8 2.5 5.4 9 2Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.3"/><path d="m3 8.7 6 3.1 6-3.1M3 12l6 3.1 6-3.1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3"/></svg>;
}
function RadarIcon() {
  return <svg aria-hidden="true" fill="none" height="17" viewBox="0 0 18 18" width="17"><circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.2"/><circle cx="9" cy="9" r="3.5" stroke="currentColor" strokeWidth="1.2"/><path d="M9 9 14 4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.3"/><circle cx="9" cy="9" fill="currentColor" r="1"/></svg>;
}
function InboxIcon() {
  return <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 18 18" width="16"><path d="M3 4h12v10H3V4Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.3"/><path d="M3 9.5h3.5l1.2 1.7h2.6l1.2-1.7H15" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.3"/></svg>;
}
function ColdStartIcon() {
  return <svg aria-hidden="true" fill="none" height="17" viewBox="0 0 18 18" width="17"><path d="M9 2v14M3 5l12 8M3 13l12-8M5.4 2.8 9 5l3.6-2.2M5.4 15.2 9 13l3.6 2.2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.15"/></svg>;
}
function SearchIcon() {
  return <svg aria-hidden="true" fill="none" height="14" viewBox="0 0 16 16" width="14"><circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.3"/><path d="m10.5 10.5 3 3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.3"/></svg>;
}
function LockIcon() {
  return <svg aria-hidden="true" fill="none" height="11" viewBox="0 0 12 12" width="11"><rect height="6.2" rx="1.3" stroke="currentColor" strokeWidth="1.1" width="8.5" x="1.75" y="4.3"/><path d="M4 4.3V3a2 2 0 0 1 4 0v1.3" stroke="currentColor" strokeWidth="1.1"/></svg>;
}
function SparkIcon() {
  return <svg aria-hidden="true" fill="none" height="8" viewBox="0 0 10 10" width="8"><path d="M5 1c.2 2.4 1.5 3.7 4 4-2.5.3-3.8 1.6-4 4-.2-2.4-1.5-3.7-4-4 2.5-.3 3.8-1.6 4-4Z" fill="currentColor"/></svg>;
}
function RadarSmallIcon() {
  return <svg aria-hidden="true" fill="none" height="9" viewBox="0 0 10 10" width="9"><circle cx="5" cy="5" r="3.7" stroke="currentColor" strokeWidth=".9"/><path d="m5 5 3-3" stroke="currentColor" strokeLinecap="round"/><circle cx="5" cy="5" fill="currentColor" r=".7"/></svg>;
}
function InboxSmallIcon() {
  return <svg aria-hidden="true" fill="none" height="9" viewBox="0 0 10 10" width="9"><path d="M1.5 2.2h7v5.6h-7V2.2Z" stroke="currentColor" strokeLinejoin="round" strokeWidth=".9"/><path d="M1.5 5.2h2.1l.8 1h1.2l.8-1h2.1" stroke="currentColor" strokeLinejoin="round" strokeWidth=".9"/></svg>;
}
function ColdSmallIcon() {
  return <svg aria-hidden="true" fill="none" height="9" viewBox="0 0 10 10" width="9"><path d="M5 1v8M2 3l6 4M2 7l6-4" stroke="currentColor" strokeLinecap="round" strokeWidth=".85"/></svg>;
}
function CheckIcon() {
  return <svg aria-hidden="true" fill="none" height="9" viewBox="0 0 10 10" width="9"><path d="m1.8 5.1 2.1 2.1L8.3 2.8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3"/></svg>;
}
function AlertIcon() {
  return <svg aria-hidden="true" fill="none" height="9" viewBox="0 0 10 10" width="9"><path d="M5 1.5 9 8.3H1L5 1.5Z" stroke="currentColor" strokeLinejoin="round"/><path d="M5 3.7v2m0 1v.1" stroke="currentColor" strokeLinecap="round"/></svg>;
}
function EvidenceIcon() {
  return <svg aria-hidden="true" fill="none" height="9" viewBox="0 0 10 10" width="9"><path d="M2 2h6v4.8H5L3 8V6.8H2V2Z" stroke="currentColor" strokeLinejoin="round" strokeWidth=".9"/></svg>;
}
function ChevronRightIcon() {
  return <svg aria-hidden="true" fill="none" height="15" viewBox="0 0 10 16" width="10"><path d="m2.5 2.5 5 5.5-5 5.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3"/></svg>;
}
