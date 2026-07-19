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
type ScanFilters = {
  topics: string[];
  language?: string;
  minStars: number;
  pushedAfter?: string;
  limit: 5;
};
type DiscoveryPreset = {
  label: string;
  topic: string;
  minStars: number;
  detail: string;
};

const DISCOVERY_PRESETS: DiscoveryPreset[] = [
  {
    label: "AI / ML",
    topic: "machine-learning",
    minStars: 500,
    detail: "machine-learning · 500+ stars",
  },
  {
    label: "LLM tools",
    topic: "llm",
    minStars: 200,
    detail: "llm · 200+ stars",
  },
  {
    label: "Dev tools",
    topic: "developer-tools",
    minStars: 500,
    detail: "developer-tools · 500+ stars",
  },
  {
    label: "Web3",
    topic: "web3",
    minStars: 300,
    detail: "web3 · 300+ stars",
  },
];

export function GitHubDiscoveryPanel({
  onDiscovered,
}: {
  onDiscovered: (result: DiscoverResponse) => Promise<void>;
}) {
  const [topics, setTopics] = useState("machine-learning");
  const [language, setLanguage] = useState("");
  const [minStars, setMinStars] = useState("100");
  const [pushedAfter, setPushedAfter] = useState("");
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [result, setResult] = useState<DiscoverResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const currentFilters: ScanFilters = {
    topics: parseTopics(topics),
    language: language || undefined,
    minStars: Math.max(0, Number(minStars) || 0),
    pushedAfter: pushedAfter || undefined,
    limit: 5,
  };
  const queryPreview = buildQueryPreview(currentFilters);

  function handleScan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runScan(currentFilters);
  }

  function handlePreset(preset: DiscoveryPreset) {
    setTopics(preset.topic);
    setLanguage("");
    setMinStars(String(preset.minStars));
    setPushedAfter("");
    void runScan({
      topics: [preset.topic],
      minStars: preset.minStars,
      limit: 5,
    });
  }

  async function runScan(filters: ScanFilters) {
    setScanState("scanning");
    setErrorMessage("");
    setResult(null);

    try {
      const topicScans = filters.topics.length
        ? filters.topics.map((topic) =>
            requestDiscovery({ ...filters, topics: [topic] }),
          )
        : [requestDiscovery(filters)];
      const settledScans = await Promise.allSettled(topicScans);
      const completedScans = settledScans.flatMap((scan) =>
        scan.status === "fulfilled" ? [scan.value] : [],
      );

      if (completedScans.length === 0) {
        throw new Error("All discovery scans failed");
      }

      const payload = mergeDiscoverResponses(completedScans);
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
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-[8px] font-bold uppercase tracking-[0.13em] text-[#83968a]">
                Quick scans
              </p>
              <p className="text-[8px] text-[#62766a]">
                Proven GitHub topics · one click
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {DISCOVERY_PRESETS.map((preset) => {
                const isActive =
                  currentFilters.topics.length === 1 &&
                  currentFilters.topics[0] === preset.topic &&
                  currentFilters.minStars === preset.minStars;

                return (
                  <button
                    aria-pressed={isActive}
                    className={`rounded-xl border px-3 py-2.5 text-left transition-colors disabled:cursor-wait disabled:opacity-55 ${
                      isActive
                        ? "border-[#6fbd90] bg-[#294737] text-white"
                        : "border-white/[0.08] bg-white/[0.045] text-[#c1cec5] hover:bg-white/[0.075]"
                    }`}
                    disabled={scanState === "scanning"}
                    key={preset.label}
                    onClick={() => handlePreset(preset)}
                    type="button"
                  >
                    <span className="block text-[9.5px] font-bold">
                      {preset.label}
                    </span>
                    <span className="mt-1 block truncate text-[7.5px] text-[#71877a]">
                      {preset.detail}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <form
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1.4fr)_150px_105px_170px_80px]"
            onSubmit={handleScan}
          >
            <DiscoveryField
              hint="Comma-separated = OR · aliases accepted"
              label="Topics / industry"
            >
              <input
                className={inputClasses}
                disabled={scanState === "scanning"}
                onChange={(event) => setTopics(event.target.value)}
                placeholder="ai, llm-tools, fintech"
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

            <DiscoveryField hint="Fixed" label="Results">
              <input
                aria-readonly="true"
                className={`${inputClasses} cursor-default text-center tabular-nums`}
                readOnly
                type="number"
                value="5"
              />
            </DiscoveryField>

            <div className="flex min-w-0 items-center gap-2 rounded-xl border border-white/[0.07] bg-black/10 px-3 py-2 sm:col-span-2 xl:col-span-5">
              <span className="shrink-0 text-[7.5px] font-bold uppercase tracking-[0.12em] text-[#6f8578]">
                GitHub query
              </span>
              <code className="truncate text-[8.5px] text-[#9cb2a4]" title={queryPreview}>
                {queryPreview}
              </code>
            </div>

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
        Live scan typically takes 7–8 seconds · up to 5 founders per topic
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
          No matches — try a preset like &apos;AI / ML&apos; above.
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

const TOPIC_ALIASES: Record<string, string> = {
  ai: "machine-learning",
  "ai-infra": "machine-learning",
  "ai-ml": "machine-learning",
  ml: "machine-learning",
  "llm-inference": "llm",
  "llm-tools": "llm",
  devtools: "developer-tools",
  "developer-tooling": "developer-tools",
  crypto: "web3",
  blockchain: "web3",
};

async function requestDiscovery(filters: ScanFilters): Promise<DiscoverResponse> {
  const response = await fetch("/api/discover", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(filters),
  });

  if (!response.ok) {
    throw new Error(`Discovery failed with ${response.status}`);
  }

  return parseDiscoverResponse(await response.json());
}

function mergeDiscoverResponses(responses: DiscoverResponse[]): DiscoverResponse {
  const candidates = new Map<string, DiscoveredCandidate>();
  const notes = new Set<string>();

  for (const response of responses) {
    for (const candidate of response.candidates) {
      candidates.set(candidate.founder.id, candidate);
    }
    if (response.note) notes.add(response.note);
  }

  return {
    candidates: [...candidates.values()],
    query: responses.map((response) => response.query).join(" OR "),
    note: notes.size ? [...notes].join(" ") : undefined,
  };
}

function parseTopics(value: string): string[] {
  return [...new Set(
    value
      .split(",")
      .map(normalizeTopic)
      .filter(Boolean),
  )].slice(0, 3);
}

function normalizeTopic(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return TOPIC_ALIASES[normalized] ?? normalized;
}

function buildQueryPreview(filters: ScanFilters): string {
  const suffix = [
    filters.language ? `language:${filters.language}` : "",
    `stars:>${filters.minStars}`,
    filters.pushedAfter ? `pushed:>${filters.pushedAfter}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (filters.topics.length === 0) return suffix;

  return filters.topics
    .map((topic) => `topic:${topic} ${suffix}`)
    .join(" OR ");
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
