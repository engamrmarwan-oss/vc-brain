"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AppHeader } from "@/components/app-header";
import type { Assessment, Founder } from "@/lib/types";

type RiskAppetite = "conservative" | "balanced" | "aggressive";
type Stage = "pre-seed" | "seed" | "series-a";

type ApiThesis = {
  sectors: string[];
  geos: string[];
  stage?: Stage;
  checkSize?: string;
  riskAppetite: RiskAppetite;
};

type RankedEntry = {
  founder: Founder;
  assessment: Assessment;
  fit: {
    score: number;
    outsideThesis: boolean;
    reasons: string[];
  };
};

type RankResponse = {
  thesis: ApiThesis;
  ranked: RankedEntry[];
};

type ThesisFormState = {
  sector: string;
  geography: string;
  stage: "" | Stage;
  riskAppetite: RiskAppetite;
  checkSize: string;
};

type LoadState = "loading" | "ready" | "error";
type SaveState = "idle" | "saving" | "saved" | "error";

const EMPTY_FORM: ThesisFormState = {
  sector: "",
  geography: "",
  stage: "",
  riskAppetite: "balanced",
  checkSize: "",
};

export function ThesisWorkspace() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [form, setForm] = useState<ThesisFormState>(EMPTY_FORM);
  const [ranked, setRanked] = useState<RankedEntry[]>([]);
  const [savedFormSignature, setSavedFormSignature] = useState("");

  useEffect(() => {
    let active = true;

    requestRank()
      .then((response) => {
        if (!active) return;
        const nextForm = formFromApi(response.thesis);
        setForm(nextForm);
        setRanked(response.ranked);
        setSavedFormSignature(formSignature(nextForm));
        setLoadState("ready");
      })
      .catch(() => {
        if (active) setLoadState("error");
      });

    return () => {
      active = false;
    };
  }, []);

  const inside = useMemo(
    () => ranked.filter((entry) => !entry.fit.outsideThesis),
    [ranked],
  );
  const outside = useMemo(
    () => ranked.filter((entry) => entry.fit.outsideThesis),
    [ranked],
  );
  const isDirty = formSignature(form) !== savedFormSignature;

  function updateForm<Key extends keyof ThesisFormState>(
    key: Key,
    value: ThesisFormState[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
    setSaveState("idle");
  }

  async function saveThesis() {
    setSaveState("saving");

    try {
      const response = await requestRank(thesisToApi(form));
      const persistedForm = formFromApi(response.thesis);
      setForm(persistedForm);
      setRanked(response.ranked);
      setSavedFormSignature(formSignature(persistedForm));
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  function retry() {
    setLoadState("loading");
    requestRank()
      .then((response) => {
        const nextForm = formFromApi(response.thesis);
        setForm(nextForm);
        setRanked(response.ranked);
        setSavedFormSignature(formSignature(nextForm));
        setLoadState("ready");
      })
      .catch(() => setLoadState("error"));
  }

  return (
    <div className="min-h-screen bg-[#f3f2f2] text-[#171915]">
      <AppHeader />

      <main className="mx-auto box-border w-full max-w-[1360px] px-5 py-8 sm:px-8 lg:px-12">
        <section className="mb-5 flex flex-col justify-between gap-5 rounded-xl border border-[#dddbda] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(40,42,36,0.05)] sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#03234a] text-[#8fc2f0]">
              <TargetIcon />
            </span>
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#8b8d85]">
                Configuration
              </p>
              <h1 className="mt-0.5 text-[23px] font-semibold leading-none tracking-[-0.03em]">
                Investment thesis
              </h1>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-[#73756e] sm:text-[11.5px]">
                Re-orders the pipeline · never blends or overrides a founder&apos;s
                F / M / I signals
              </p>
            </div>
          </div>
          <Link
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[#dddbda] bg-[#fbfbfa] px-4 text-[11px] font-semibold transition-colors hover:bg-white"
            href="/"
          >
            View pipeline <ArrowRightIcon />
          </Link>
        </section>

        {loadState === "loading" ? (
          <ThesisLoading />
        ) : loadState === "error" ? (
          <ThesisError onRetry={retry} />
        ) : (
          <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.5fr)]">
            <section
              aria-labelledby="active-thesis"
              className="min-w-0 overflow-hidden rounded-xl border border-[#0a3161] bg-[#03234a] text-white shadow-[0_14px_34px_rgba(32,35,30,0.14)]"
            >
              <div className="flex items-center gap-2.5 border-b border-white/[0.08] px-5 py-4">
                <span className="grid size-7 place-items-center rounded-lg bg-[#123a5e] text-[#7db9f2]">
                  <TargetSmallIcon />
                </span>
                <h2
                  className="text-[15px] font-semibold tracking-[-0.02em]"
                  id="active-thesis"
                >
                  Active thesis
                </h2>
                {isDirty && (
                  <span className="ml-auto rounded-full bg-[#6d5727] px-2.5 py-1 text-[7.5px] font-bold uppercase tracking-[0.08em] text-[#f0cf82]">
                    Unsaved changes
                  </span>
                )}
              </div>

              <form
                className="p-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveThesis();
                }}
              >
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <WorkspaceSelect
                    label="Sector"
                    onChange={(value) => updateForm("sector", value)}
                    value={form.sector}
                  >
                    <option value="">Generalist</option>
                    <option value="AI infrastructure">AI infrastructure</option>
                    <option value="Fintech infrastructure">
                      Fintech infrastructure
                    </option>
                    <option value="Developer tools">Developer tools</option>
                  </WorkspaceSelect>

                  <WorkspaceSelect
                    label="Geography"
                    onChange={(value) => updateForm("geography", value)}
                    value={form.geography}
                  >
                    <option value="">Europe · all hubs</option>
                    <option value="DACH">Berlin / DACH</option>
                    <option value="Nordics">Nordics</option>
                    <option value="UK">United Kingdom</option>
                    <option value="Europe">Europe</option>
                  </WorkspaceSelect>

                  <WorkspaceSelect
                    label="Stage"
                    onChange={(value) =>
                      updateForm("stage", value as ThesisFormState["stage"])
                    }
                    value={form.stage}
                  >
                    <option value="">Any stage</option>
                    <option value="pre-seed">Pre-seed</option>
                    <option value="seed">Seed</option>
                    <option value="series-a">Series A</option>
                  </WorkspaceSelect>

                  <WorkspaceSelect
                    label="Risk appetite"
                    onChange={(value) =>
                      updateForm(
                        "riskAppetite",
                        value as ThesisFormState["riskAppetite"],
                      )
                    }
                    value={form.riskAppetite}
                  >
                    <option value="conservative">Conservative</option>
                    <option value="balanced">Balanced</option>
                    <option value="aggressive">Aggressive</option>
                  </WorkspaceSelect>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <WorkspaceSelect
                    label="Check size"
                    onChange={(value) => updateForm("checkSize", value)}
                    value={form.checkSize}
                  >
                    <option value="">No fixed check size</option>
                    <option value="$100k–$250k">$100k–$250k</option>
                    <option value="$250k–$500k">$250k–$500k</option>
                    <option value="$500k–$1m">$500k–$1m</option>
                    <option value="$1m+">$1m+</option>
                  </WorkspaceSelect>

                  <button
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#0176d3] px-5 text-[11px] font-bold text-white shadow-[0_8px_18px_rgba(1,118,211,0.25)] transition-colors hover:bg-[#0b5cab] disabled:cursor-wait disabled:bg-[#426887]"
                    disabled={saveState === "saving" || !isDirty}
                    type="submit"
                  >
                    {saveState === "saving" ? (
                      <>
                        <SpinnerIcon /> Saving and re-ranking…
                      </>
                    ) : (
                      <>
                        <SaveIcon /> Save thesis
                      </>
                    )}
                  </button>
                </div>

                <div className="mt-5 flex flex-col justify-between gap-3 border-t border-white/[0.08] pt-4 sm:flex-row sm:items-center">
                  <p className="max-w-2xl text-[10px] leading-[1.65] text-[#9ea8b0]">
                    A thesis mismatch pushes a founder down; it never lowers
                    Founder Score or changes the independent screening axes.
                  </p>
                  <SaveStatus state={saveState} />
                </div>
              </form>
            </section>

            <ThesisFitPanel inside={inside} outside={outside} total={ranked.length} />
          </div>
        )}
      </main>
    </div>
  );
}

function ThesisFitPanel({
  inside,
  outside,
  total,
}: {
  inside: RankedEntry[];
  outside: RankedEntry[];
  total: number;
}) {
  return (
            <section
              aria-labelledby="thesis-fit"
              className="min-w-0 rounded-xl border border-[#dddbda] bg-white p-5 shadow-[0_8px_24px_rgba(40,42,36,0.04)]"
    >
      <div className="flex items-center justify-between gap-3">
        <p
          className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8b8d85]"
          id="thesis-fit"
        >
          Thesis fit
        </p>
        <span className="text-[10px] font-semibold tabular-nums text-[#64746a]">
          Inside thesis: {inside.length}/{total}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <FitMetric label="inside thesis" tone="blue" value={inside.length} />
        <FitMetric label="outside thesis" tone="amber" value={outside.length} />
      </div>

      <div className="mt-5 space-y-2">
        {inside.map((entry, index) => (
          <FounderFitRow
            entry={entry}
            index={index}
            key={entry.founder.id}
            outside={false}
          />
        ))}
        {outside.map((entry, index) => (
          <FounderFitRow
            entry={entry}
            index={inside.length + index}
            key={entry.founder.id}
            outside
          />
        ))}
      </div>
    </section>
  );
}

function FounderFitRow({
  entry,
  index,
  outside,
}: {
  entry: RankedEntry;
  index: number;
  outside: boolean;
}) {
  const detail = outside
    ? entry.fit.reasons.find((reason) => reason.includes("outside thesis")) ??
      "Outside current sector thesis"
    : `${entry.founder.company} · ${entry.founder.geo}`;

  return (
    <Link
      className={`flex items-center gap-3 rounded-md border px-3 py-3 transition-colors ${
        outside
          ? "border-[#e6dcc9] bg-[#fbf7ef] hover:bg-[#f8f1e5]"
          : "border-[#ececec] bg-white hover:bg-[#f8fafc]"
      }`}
      href={`/founder/${entry.founder.id}`}
    >
      <span
        className={`size-1.5 shrink-0 rounded-full ${
          outside ? "bg-[#c89950]" : "bg-[#0176d3]"
        }`}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11.5px] font-semibold text-[#252721]">
          {entry.founder.name}
        </span>
        <span
          className={`mt-0.5 block truncate text-[9px] ${
            outside ? "text-[#8d6932]" : "text-[#85877f]"
          }`}
        >
          {detail}
        </span>
      </span>
      <span className="text-[8px] font-bold tabular-nums text-[#989a92]">
        #{index + 1}
      </span>
      <span
        className={`text-[8px] font-bold uppercase tracking-[0.08em] ${
          outside ? "text-[#a4533f]" : "text-[#0b5cab]"
        }`}
      >
        {outside ? "Out" : "In"}
      </span>
    </Link>
  );
}

function WorkspaceSelect({
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
    <label className="block min-w-0">
      <span className="mb-2 block text-[8px] font-bold uppercase tracking-[0.12em] text-[#9ea8b0]">
        {label}
      </span>
      <span className="relative block">
        <select
          className="h-11 w-full appearance-none rounded-md border border-white/[0.12] bg-white/[0.06] px-3.5 pr-9 text-[11px] font-semibold text-[#eceee9] outline-none transition-colors hover:bg-white/[0.09] focus:border-[#7db9f2] focus:ring-4 focus:ring-[#2f79bd]/20"
          onChange={(event) => onChange(event.target.value)}
          value={value}
        >
          {children}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#91a1ae]">
          <ChevronIcon />
        </span>
      </span>
    </label>
  );
}

function FitMetric({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "blue" | "amber";
  value: number;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        tone === "blue"
          ? "border-[#cfe0f2] bg-[#eef4fc]"
          : "border-[#e5d6b9] bg-[#f6f0e3]"
      }`}
    >
      <p
        className={`text-[30px] font-semibold leading-none tracking-[-0.04em] tabular-nums ${
          tone === "blue" ? "text-[#0b5cab]" : "text-[#8d6932]"
        }`}
      >
        {value}
      </p>
      <p className="mt-2 text-[9.5px] font-semibold text-[#5f665f]">{label}</p>
    </div>
  );
}

function SaveStatus({ state }: { state: SaveState }) {
  if (state === "saved") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 text-[9px] font-semibold text-[#79cca0]" role="status">
        <CheckIcon /> Saved · pipeline re-ranked
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="shrink-0 text-[9px] font-semibold text-[#f1ad9f]" role="alert">
        Save failed — existing thesis is unchanged
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-[9px] text-[#8395a2]">
      <span className="size-1.5 rounded-full bg-[#5c819e]" />
      Server-backed thesis
    </span>
  );
}

function ThesisLoading() {
  return (
    <section className="grid min-h-[360px] place-items-center rounded-xl border border-[#dddbda] bg-white">
      <div className="text-center">
        <span className="mx-auto grid size-10 place-items-center rounded-full bg-[#eef4fc] text-[#0b5cab]">
          <SpinnerIcon />
        </span>
        <p className="mt-4 text-[11px] font-semibold text-[#666861]">
          Loading the active thesis…
        </p>
      </div>
    </section>
  );
}

function ThesisError({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="rounded-xl border border-[#dddbda] bg-white px-6 py-20 text-center">
      <h2 className="text-[15px] font-semibold">Thesis workspace unavailable</h2>
      <p className="mx-auto mt-2 max-w-md text-[10.5px] leading-relaxed text-[#85877f]">
        The pipeline is still available. Retry when the live ranking endpoint is ready.
      </p>
      <button
        className="mt-5 h-9 rounded-md bg-[#03234a] px-4 text-[10px] font-semibold text-white"
        onClick={onRetry}
        type="button"
      >
        Retry thesis
      </button>
    </section>
  );
}

async function requestRank(thesis?: ApiThesis): Promise<RankResponse> {
  const response = await fetch("/api/rank", {
    ...(thesis
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ thesis }),
        }
      : { method: "GET" }),
    cache: "no-store",
  });

  if (!response.ok) throw new Error("Rank endpoint unavailable");
  const payload = (await response.json()) as Partial<RankResponse>;
  if (!isApiThesis(payload.thesis) || !Array.isArray(payload.ranked)) {
    throw new Error("Rank response invalid");
  }
  return payload as RankResponse;
}

function isApiThesis(value: unknown): value is ApiThesis {
  if (!value || typeof value !== "object") return false;
  const thesis = value as Partial<ApiThesis>;
  return (
    Array.isArray(thesis.sectors) &&
    thesis.sectors.every((item) => typeof item === "string") &&
    Array.isArray(thesis.geos) &&
    thesis.geos.every((item) => typeof item === "string") &&
    ["conservative", "balanced", "aggressive"].includes(
      thesis.riskAppetite ?? "",
    )
  );
}

function formFromApi(thesis: ApiThesis): ThesisFormState {
  return {
    sector: thesis.sectors[0] ?? "",
    geography: thesis.geos[0] ?? "",
    stage: thesis.stage ?? "",
    riskAppetite: thesis.riskAppetite,
    checkSize: thesis.checkSize ?? "",
  };
}

function thesisToApi(form: ThesisFormState): ApiThesis {
  return {
    sectors: form.sector ? [form.sector] : [],
    geos: form.geography ? [form.geography] : [],
    ...(form.stage ? { stage: form.stage } : {}),
    ...(form.checkSize ? { checkSize: form.checkSize } : {}),
    riskAppetite: form.riskAppetite,
  };
}

function formSignature(form: ThesisFormState): string {
  return JSON.stringify(form);
}

function TargetIcon() {
  return <svg aria-hidden="true" fill="none" height="19" viewBox="0 0 18 18" width="19"><circle cx="8.5" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.5"/><circle cx="8.5" cy="9" r="2.2" stroke="currentColor" strokeWidth="1.5"/><path d="m10.2 7.3 4.8-4.8m0 0v3.1m0-3.1h-3.1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/></svg>;
}
function TargetSmallIcon() {
  return <svg aria-hidden="true" fill="none" height="15" viewBox="0 0 16 16" width="15"><circle cx="7.5" cy="8.5" r="5" stroke="currentColor" strokeWidth="1.2"/><circle cx="7.5" cy="8.5" r="2" stroke="currentColor" strokeWidth="1.2"/><path d="m9 7 4.3-4.3m0 0v2.8m0-2.8h-2.8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2"/></svg>;
}
function ArrowRightIcon() {
  return <svg aria-hidden="true" fill="none" height="10" viewBox="0 0 12 10" width="11"><path d="M1 5h10m0 0L7.5 1.5M11 5 7.5 8.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2"/></svg>;
}
function ChevronIcon() {
  return <svg aria-hidden="true" fill="none" height="8" viewBox="0 0 12 8" width="10"><path d="m2 2 4 4 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3"/></svg>;
}
function SaveIcon() {
  return <svg aria-hidden="true" fill="none" height="12" viewBox="0 0 14 14" width="12"><path d="M2 2h8.5L12 3.5V12H2V2Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.2"/><path d="M4 2v3h5V2M4.5 9h5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.2"/></svg>;
}
function CheckIcon() {
  return <svg aria-hidden="true" fill="none" height="10" viewBox="0 0 11 10" width="10"><path d="m1.5 5 2.3 2.3L9 2.2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3"/></svg>;
}
function SpinnerIcon() {
  return <svg aria-hidden="true" className="animate-spin" fill="none" height="12" viewBox="0 0 12 12" width="12"><circle cx="6" cy="6" opacity=".25" r="4.5" stroke="currentColor"/><path d="M6 1.5A4.5 4.5 0 0 1 10.5 6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5"/></svg>;
}
