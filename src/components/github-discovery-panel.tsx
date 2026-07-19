"use client";

import { FormEvent, useState } from "react";

import type { Assessment, Founder } from "@/lib/types";

type DiscoveredCandidate = {
  founder: Founder;
  assessment: Assessment;
  repo: {
    fullName: string;
    stars: number;
    description: string | null;
    url: string;
  };
};

type DiscoverResponse = {
  candidates: DiscoveredCandidate[];
  query: string;
  note?: string;
};

type ScanState = "idle" | "scanning" | "success" | "empty" | "error";

export function GitHubDiscoveryPanel({
  onDiscovered,
}: {
  onDiscovered: (result: DiscoverResponse) => Promise<void>;
}) {
  const [topics, setTopics] = useState("ai-infra, llm-inference");
  const [language, setLanguage] = useState("");
  const [minStars, setMinStars] = useState("50");
  const [pushedAfter, setPushedAfter] = useState("");
  const [geo, setGeo] = useState("");
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [result, setResult] = useState<DiscoverResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleScan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setScanState("scanning");
    setErrorMessage("");
    setResult(null);

    try {
      const response = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topics: parseTopics(topics),
          language: language || undefined,
          minStars: Math.max(0, Number(minStars) || 0),
          pushedAfter: pushedAfter || undefined,
          geo: geo.trim() || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`Discovery failed with ${response.status}`);
      }

      const payload = parseDiscoverResponse(await response.json());
      setResult(payload);

      if (payload.candidates.length === 0) {
        setScanState("empty");
        return;
      }

      await onDiscovered(payload);
      setScanState("success");
    } catch {
      setScanState("error");
      setErrorMessage(
        "GitHub discovery could not complete. The existing pipeline is unchanged.",
      );
    }
  }

  return (
    <section
      aria-labelledby="github-discovery"
      className="relative mb-5 overflow-hidden rounded-[20px] border border-[#294035] bg-[#17251d] text-white shadow-[0_16px_38px_rgba(27,44,34,0.18)]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_82%_18%,rgba(112,193,147,0.2),transparent_28%),linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] [background-size:auto,28px_28px,28px_28px]"
      />

      <div className="relative grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(220px,0.68fr)_minmax(0,1.72fr)] lg:gap-8">
        <div className="flex flex-col justify-between">
          <div>
            <div className="mb-4 flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-xl bg-[#284436] text-[#79ca9d] ring-1 ring-white/10">
                <GitHubRadarIcon />
              </span>
              <div>
                <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-[#72b68f]">
                  Outbound discovery
                </p>
                <p className="mt-0.5 text-[9px] text-[#899a8f]">
                  Live GitHub signal
                </p>
              </div>
            </div>
            <h2
              className="max-w-xs text-[24px] font-semibold leading-[1.05] tracking-[-0.04em]"
              id="github-discovery"
            >
              Find builders before they apply.
            </h2>
            <p className="mt-3 max-w-sm text-[10.5px] leading-[1.65] text-[#9faea4]">
              Search active repositories, identify their owners, then score them
              through the same Founder / Market / Idea screen.
            </p>
          </div>

          <div className="mt-6 flex items-center gap-2 text-[8.5px] font-semibold text-[#7f9587]">
            <span className="size-1.5 rounded-full bg-[#69bc8d] shadow-[0_0_0_4px_rgba(105,188,141,0.1)]" />
            Scraped founders enter as outbound · never applied
          </div>
        </div>

        <div>
          <form
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(200px,1.4fr)_150px_105px_160px_minmax(130px,0.8fr)]"
            onSubmit={handleScan}
          >
            <DiscoveryField
              hint="Comma-separated · max 3"
              label="Topics / industry"
            >
              <input
                className={inputClasses}
                disabled={scanState === "scanning"}
                onChange={(event) => setTopics(event.target.value)}
                placeholder="ai-infra, fintech"
                type="text"
                value={topics}
              />
            </DiscoveryField>

            <DiscoveryField label="Language">
              <select
                className={`${inputClasses} appearance-none`}
                disabled={scanState === "scanning"}
                onChange={(event) => setLanguage(event.target.value)}
                value={language}
              >
                <option value="">Any language</option>
                <option value="Python">Python</option>
                <option value="TypeScript">TypeScript</option>
                <option value="JavaScript">JavaScript</option>
                <option value="Rust">Rust</option>
                <option value="Go">Go</option>
              </select>
            </DiscoveryField>

            <DiscoveryField label="Min stars">
              <input
                className={inputClasses}
                disabled={scanState === "scanning"}
                min="0"
                onChange={(event) => setMinStars(event.target.value)}
                type="number"
                value={minStars}
              />
            </DiscoveryField>

            <DiscoveryField label="Pushed after">
              <input
                className={`${inputClasses} [color-scheme:dark]`}
                disabled={scanState === "scanning"}
                onChange={(event) => setPushedAfter(event.target.value)}
                type="date"
                value={pushedAfter}
              />
            </DiscoveryField>

            <DiscoveryField label="Geo">
              <input
                className={inputClasses}
                disabled={scanState === "scanning"}
                onChange={(event) => setGeo(event.target.value)}
                placeholder="Berlin"
                type="text"
                value={geo}
              />
            </DiscoveryField>

            <button
              className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#72c394] px-5 text-[10.5px] font-bold text-[#15221a] shadow-[0_9px_22px_rgba(86,174,122,0.22)] transition-colors hover:bg-[#88d2a7] disabled:cursor-wait disabled:bg-[#496858] disabled:text-[#a7b8ad] sm:col-span-2 xl:col-span-5"
              disabled={scanState === "scanning"}
              type="submit"
            >
              {scanState === "scanning" ? (
                <>
                  <SpinnerIcon /> Scanning GitHub and scoring founders…
                </>
              ) : (
                <>
                  <ScanIcon /> Scan GitHub
                </>
              )}
            </button>
          </form>

          <DiscoveryStatus
            errorMessage={errorMessage}
            result={result}
            scanState={scanState}
          />
        </div>
      </div>
    </section>
  );
}

const inputClasses =
  "h-11 w-full rounded-xl border border-white/10 bg-white/[0.065] px-3 text-[10.5px] font-semibold text-[#edf2ed] outline-none transition-colors placeholder:text-[#62736a] hover:bg-white/[0.085] focus:border-[#6fb58d] focus:ring-4 focus:ring-[#65ad83]/10 disabled:opacity-60";

function DiscoveryField({
  children,
  hint,
  label,
}: {
  children: React.ReactNode;
  hint?: string;
  label: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between gap-2 text-[8px] font-bold uppercase tracking-[0.12em] text-[#83968a]">
        {label}
        {hint && (
          <span className="font-medium normal-case tracking-normal text-[#5f7267]">
            {hint}
          </span>
        )}
      </span>
      {children}
    </label>
  );
}

function DiscoveryStatus({
  errorMessage,
  result,
  scanState,
}: {
  errorMessage: string;
  result: DiscoverResponse | null;
  scanState: ScanState;
}) {
  if (scanState === "idle") {
    return (
      <p className="mt-3 text-center text-[8.5px] text-[#687b70]">
        Live scan typically takes 7–8 seconds · up to 5 founders per run
      </p>
    );
  }

  if (scanState === "scanning") {
    return (
      <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-white/[0.035] px-4 py-3 text-[9px] text-[#a6b6ac]" role="status">
        <span className="flex gap-1">
          <span className="size-1.5 animate-pulse rounded-full bg-[#73c696]" />
          <span className="size-1.5 animate-pulse rounded-full bg-[#73c696] [animation-delay:150ms]" />
          <span className="size-1.5 animate-pulse rounded-full bg-[#73c696] [animation-delay:300ms]" />
        </span>
        Fetching repositories, resolving owners, and running the merit screen
      </div>
    );
  }

  if (scanState === "error") {
    return (
      <p className="mt-3 rounded-xl bg-[#4a2925] px-4 py-3 text-[9.5px] font-medium text-[#f0aaa0]" role="alert">
        {errorMessage}
      </p>
    );
  }

  if (scanState === "empty") {
    return (
      <div className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.035] px-4 py-3" role="status">
        <p className="text-[10px] font-semibold text-[#d9dfda]">
          No repos matched — try broader filters.
        </p>
        {result?.note && (
          <p className="mt-1 text-[8.5px] leading-relaxed text-[#76897d]">
            {result.note}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-[#3c5b49] bg-[#21382b] px-4 py-3" role="status">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <p className="flex items-center gap-2 text-[10px] font-semibold text-[#cde8d6]">
          <CheckIcon /> {result?.candidates.length} new outbound
          {result?.candidates.length === 1 ? " founder" : " founders"} added to
          the ranked pipeline
        </p>
        <p className="truncate text-[8px] text-[#718d7b] sm:max-w-[320px]" title={result?.query}>
          {result?.query}
        </p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {result?.candidates.map((candidate) => (
          <span
            className="inline-flex items-center gap-2 rounded-lg bg-black/15 px-2.5 py-1.5 text-[8.5px] text-[#a9c6b3] ring-1 ring-white/[0.06]"
            key={candidate.founder.id}
          >
            <span className="font-semibold text-[#e2ece5]">
              {candidate.founder.name}
            </span>
            <span>{candidate.repo.fullName}</span>
            <span className="text-[#78b88f]">★ {candidate.repo.stars}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function parseTopics(value: string): string[] {
  return value
    .split(",")
    .map((topic) => topic.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function parseDiscoverResponse(value: unknown): DiscoverResponse {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid discovery response");
  }

  const response = value as Partial<DiscoverResponse>;
  if (!Array.isArray(response.candidates) || typeof response.query !== "string") {
    throw new Error("Invalid discovery response");
  }

  return response as DiscoverResponse;
}

function GitHubRadarIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="17" viewBox="0 0 18 18" width="17">
      <circle cx="8" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 9 15.2 4.8M8 3.5V9l4.8 2.6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.2" />
      <circle cx="8" cy="9" fill="currentColor" r="1.2" />
    </svg>
  );
}

function ScanIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="13" viewBox="0 0 14 14" width="13">
      <path d="M2 4V2h2M10 2h2v2M12 10v2h-2M4 12H2v-2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
      <circle cx="7" cy="7" r="2.2" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg aria-hidden="true" className="animate-spin" fill="none" height="13" viewBox="0 0 14 14" width="13">
      <circle cx="7" cy="7" opacity=".25" r="5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7a5 5 0 0 0-5-5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="11" viewBox="0 0 12 12" width="11">
      <path d="m2 6.2 2.3 2.3L10 3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}
