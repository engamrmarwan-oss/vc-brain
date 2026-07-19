"use client";

export type ThesisSector = "ai-infra" | "fintech-infra" | "generalist";
export type ThesisGeography = "all" | "berlin" | "nordics" | "uk";
export type ThesisStage = "any" | "pre-seed" | "seed" | "series-a";
export type ThesisRisk = "conservative" | "balanced" | "aggressive";

export type ThesisState = {
  sector: ThesisSector;
  geography: ThesisGeography;
  stage: ThesisStage;
  riskAppetite: ThesisRisk;
};

export const DEFAULT_THESIS: ThesisState = {
  sector: "generalist",
  geography: "all",
  stage: "any",
  riskAppetite: "balanced",
};

export const SECTOR_LABELS: Record<ThesisSector, string> = {
  "ai-infra": "AI infrastructure",
  "fintech-infra": "Fintech infrastructure",
  generalist: "Generalist",
};

export const GEOGRAPHY_LABELS: Record<ThesisGeography, string> = {
  all: "Europe · all hubs",
  berlin: "Berlin / DACH",
  nordics: "Nordics",
  uk: "United Kingdom",
};

export function ThesisControls({
  inThesisCount,
  isRanking,
  onChange,
  thesis,
  totalCount,
}: {
  inThesisCount: number;
  isRanking: boolean;
  onChange: (thesis: ThesisState) => void;
  thesis: ThesisState;
  totalCount: number;
}) {
  return (
    <section
      aria-labelledby="thesis-engine"
      className="mb-5 overflow-hidden rounded-[18px] border border-[#30342e] bg-[#20231e] text-white shadow-[0_14px_34px_rgba(32,35,30,0.14)]"
    >
      <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,2fr)_150px] lg:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-[#324138] text-[#74c398]">
              <TargetIcon />
            </span>
            <h2
              className="text-[13px] font-semibold tracking-[-0.02em]"
              id="thesis-engine"
            >
              Active thesis
            </h2>
          </div>
          <p className="text-[9.5px] leading-relaxed text-[#92978f]">
            Fit changes order only. Founder Score and F / M / I stay independent.
          </p>
        </div>

        <form
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
          onSubmit={(event) => event.preventDefault()}
        >
          <ThesisSelect
            label="Sector"
            onChange={(value) =>
              onChange({ ...thesis, sector: value as ThesisSector })
            }
            value={thesis.sector}
          >
            <option value="ai-infra">AI infrastructure</option>
            <option value="fintech-infra">Fintech infrastructure</option>
            <option value="generalist">Generalist</option>
          </ThesisSelect>

          <ThesisSelect
            label="Geography"
            onChange={(value) =>
              onChange({ ...thesis, geography: value as ThesisGeography })
            }
            value={thesis.geography}
          >
            <option value="all">Europe · all hubs</option>
            <option value="berlin">Berlin / DACH</option>
            <option value="nordics">Nordics</option>
            <option value="uk">United Kingdom</option>
          </ThesisSelect>

          <ThesisSelect
            label="Stage"
            onChange={(value) =>
              onChange({ ...thesis, stage: value as ThesisStage })
            }
            value={thesis.stage}
          >
            <option value="any">Any stage</option>
            <option value="pre-seed">Pre-seed</option>
            <option value="seed">Seed</option>
            <option value="series-a">Series A</option>
          </ThesisSelect>

          <ThesisSelect
            label="Risk appetite"
            onChange={(value) =>
              onChange({ ...thesis, riskAppetite: value as ThesisRisk })
            }
            value={thesis.riskAppetite}
          >
            <option value="conservative">Conservative</option>
            <option value="balanced">Balanced</option>
            <option value="aggressive">Aggressive</option>
          </ThesisSelect>
        </form>

        <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-4 lg:block lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <div>
            <p className="text-[8px] font-bold uppercase tracking-[0.13em] text-[#7f857d]">
              Inside thesis
            </p>
            <p className="mt-1.5 text-[22px] font-semibold leading-none tracking-[-0.04em] tabular-nums">
              {inThesisCount}
              <span className="ml-1 text-[11px] font-medium text-[#777d75]">
                / {totalCount}
              </span>
            </p>
          </div>
          <span
            aria-live="polite"
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[8px] font-bold uppercase tracking-[0.09em] lg:mt-3 ${
              isRanking
                ? "bg-[#443d29] text-[#e5bd68]"
                : "bg-[#263c30] text-[#70bd91]"
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${
                isRanking ? "animate-pulse bg-[#e1b85d]" : "bg-[#69b589]"
              }`}
            />
            {isRanking ? "Re-ranking" : "Ranked live"}
          </span>
        </div>
      </div>
    </section>
  );
}

function ThesisSelect({
  children,
  label,
  onChange,
  value,
}: {
  children: React.ReactNode;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[8px] font-bold uppercase tracking-[0.12em] text-[#8b9089]">
        {label}
      </span>
      <span className="relative block">
        <select
          className="h-10 w-full appearance-none rounded-xl border border-white/10 bg-white/[0.06] px-3 pr-8 text-[10.5px] font-semibold text-[#eceee9] outline-none transition-colors hover:bg-white/[0.09] focus:border-[#6fa284] focus:ring-4 focus:ring-[#64a27c]/10"
          onChange={(event) => onChange(event.target.value)}
          value={value}
        >
          {children}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#899087]">
          <ChevronDownIcon />
        </span>
      </span>
    </label>
  );
}

function TargetIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="15" viewBox="0 0 16 16" width="15">
      <circle cx="7.5" cy="8.5" r="5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="7.5" cy="8.5" r="2" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="m9 7 4.3-4.3m0 0v2.8m0-2.8h-2.8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.2"
      />
    </svg>
  );
}
function ChevronDownIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="9" viewBox="0 0 12 9" width="10">
      <path
        d="m2 2.5 4 4 4-4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.3"
      />
    </svg>
  );
}
