"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AppHeader } from "@/components/app-header";
import {
  postFounderOutcome,
  sourcingGraphFromUnknown,
  type ChannelQuality,
  type OutcomeStage,
  type SourceNode,
  type SourceRelation,
  type SourcingGraph,
  type SourcingSuggestion,
} from "@/components/sourcing-intelligence";

type WorkspaceState = "loading" | "ready" | "error";

export function SourcingWorkspace() {
  const [graph, setGraph] = useState<SourcingGraph>();
  const [workspaceState, setWorkspaceState] =
    useState<WorkspaceState>("loading");
  const [scanningSuggestion, setScanningSuggestion] = useState("");
  const [scanMessage, setScanMessage] = useState("");
  const [outcomePending, setOutcomePending] = useState("");
  const [outcomeMessage, setOutcomeMessage] = useState("");

  const loadGraph = useCallback(async () => {
    try {
      const nextGraph = await requestSourcingGraph();
      setGraph(nextGraph);
      setWorkspaceState("ready");
    } catch {
      setGraph(undefined);
      setWorkspaceState("error");
    }
  }, []);

  useEffect(() => {
    let active = true;

    requestSourcingGraph()
      .then((nextGraph) => {
        if (!active) return;
        setGraph(nextGraph);
        setWorkspaceState("ready");
      })
      .catch(() => {
        if (!active) return;
        setGraph(undefined);
        setWorkspaceState("error");
      });

    return () => {
      active = false;
    };
  }, []);

  const sourceGroups = useMemo(
    () => (graph ? groupFoundersBySource(graph) : []),
    [graph],
  );
  const latestStageByFounder = useMemo(() => {
    const stages = new Map<string, OutcomeStage>();
    for (const outcome of graph?.outcomes ?? []) {
      stages.set(outcome.founderId, outcome.stage);
    }
    return stages;
  }, [graph?.outcomes]);

  async function scanSuggestion(suggestion: SourcingSuggestion) {
    if (!suggestion.scanHint) return;
    setScanningSuggestion(suggestion.name);
    setScanMessage("");

    try {
      const response = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topics: suggestion.scanHint.topics,
          minStars: suggestion.scanHint.minStars ?? 100,
          limit: 5,
        }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Discovery failed");

      const payload = (await response.json()) as unknown;
      const count = discoverCandidateCount(payload);
      const refreshedGraph = await requestSourcingGraph();
      setGraph(refreshedGraph);
      setWorkspaceState("ready");
      setScanMessage(
        count > 0
          ? `${count} outbound ${count === 1 ? "founder" : "founders"} added. Channel intelligence refreshed.`
          : "No founders matched this scan. Channel intelligence is unchanged.",
      );
    } catch {
      setScanMessage(
        "This channel scan could not complete. Existing sourcing intelligence is unchanged.",
      );
    } finally {
      setScanningSuggestion("");
    }
  }

  async function recordOutcome(
    founderId: string,
    founderName: string,
    stage: "funded" | "passed",
  ) {
    setOutcomePending(founderId);
    setOutcomeMessage("");

    try {
      const response = await postFounderOutcome(founderId, stage);
      setGraph((current) =>
        current
          ? {
              ...current,
              outcomes: [...current.outcomes, response.event],
              quality: response.quality,
              suggestions: response.suggestions,
            }
          : current,
      );
      setOutcomeMessage(
        `${founderName} marked ${stage}. Channel ranking recomputed from the outcome.`,
      );
    } catch {
      setOutcomeMessage(
        `The ${stage} outcome could not be recorded. Channel ranking is unchanged.`,
      );
    } finally {
      setOutcomePending("");
    }
  }

  return (
    <div className="min-h-screen bg-[#efeee9] text-[#171915]">
      <AppHeader />

      <main className="mx-auto w-full max-w-[1360px] px-5 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12">
        <section className="mb-8 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <Link
              className="mb-5 inline-flex items-center gap-2 text-[11px] font-semibold text-[#777971] transition-colors hover:text-[#171915]"
              href="/"
            >
              <ArrowLeftIcon /> Back to pipeline
            </Link>
            <div className="mb-4 flex items-center gap-2.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#777971]">
                Network intelligence
              </span>
              <span className="h-px w-8 bg-[#c8c6bd]" />
              <span className="flex items-center gap-1.5 text-[10px] font-semibold text-[#4f8569]">
                <span className="size-1.5 rounded-full bg-[#54a079] shadow-[0_0_0_3px_rgba(84,160,121,0.12)]" />
                Outcome learning live
              </span>
            </div>
            <h1 className="text-[36px] font-semibold leading-none tracking-[-0.05em] sm:text-[46px]">
              Sourcing intelligence
            </h1>
            <p className="mt-4 max-w-2xl text-[13px] leading-relaxed text-[#73756e]">
              Track which channels surface quality—not just volume. Funded and
              passed outcomes flow back into uncertainty-aware channel rankings.
            </p>
          </div>

          {graph && (
            <div className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-[#d6d3ca] bg-[#d6d3ca] shadow-[0_10px_28px_rgba(40,42,36,0.05)]">
              <HeroMetric label="Sources" value={graph.quality.length} />
              <HeroMetric label="Founders" value={countFounderNodes(graph)} />
              <HeroMetric label="Outcomes" value={graph.outcomes.length} />
            </div>
          )}
        </section>

        {workspaceState === "error" ? (
          <WorkspaceEmptyState
            onRetry={() => {
              setWorkspaceState("loading");
              void loadGraph();
            }}
          />
        ) : workspaceState === "loading" || !graph ? (
          <WorkspaceLoading />
        ) : (
          <>
            <div className="mb-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.62fr)_minmax(330px,0.68fr)]">
              <ChannelPerformanceTable quality={graph.quality} />
              <SuggestionsPanel
                message={scanMessage}
                onScan={scanSuggestion}
                scanning={scanningSuggestion}
                suggestions={graph.suggestions}
              />
            </div>

            <SourceNetworkList
              latestStageByFounder={latestStageByFounder}
              message={outcomeMessage}
              onOutcome={recordOutcome}
              pendingFounderId={outcomePending}
              sourceGroups={sourceGroups}
            />
          </>
        )}
      </main>
    </div>
  );
}

function ChannelPerformanceTable({ quality }: { quality: ChannelQuality[] }) {
  return (
    <section
      aria-labelledby="channel-performance"
      className="overflow-hidden rounded-[20px] border border-[#d8d6cf] bg-[#f9f8f5] shadow-[0_14px_38px_rgba(40,42,36,0.06)]"
    >
      <div className="border-b border-[#dfddd6] px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[8.5px] font-bold uppercase tracking-[0.15em] text-[#6d806f]">
              Quality first
            </p>
            <h2
              className="mt-1.5 text-[19px] font-semibold tracking-[-0.03em]"
              id="channel-performance"
            >
              Channel performance
            </h2>
          </div>
          <span className="rounded-full bg-[#e7eee8] px-2.5 py-1.5 text-[8px] font-bold uppercase tracking-[0.08em] text-[#4d755e]">
            Shrinkage adjusted
          </span>
        </div>
        <p className="mt-2 text-[10.5px] leading-relaxed text-[#85877f]">
          Ordered by served quality. Wide bands expose thin samples instead of
          rewarding one lucky conversion.
        </p>
      </div>

      {quality.length === 0 ? (
        <div className="px-6 py-14 text-center">
          <p className="text-[13px] font-semibold">No channel history yet</p>
          <p className="mt-1 text-[10.5px] text-[#85877f]">
            Source founders and record outcomes to establish channel quality.
          </p>
        </div>
      ) : (
        <>
          <div className="hidden grid-cols-[minmax(170px,1.25fr)_82px_repeat(4,58px)_92px_104px] gap-3 border-b border-[#e2e0d9] bg-[#f1f0eb] px-5 py-3 text-[8px] font-bold uppercase tracking-[0.1em] text-[#8a8c84] lg:grid lg:px-6">
            <span>Source</span>
            <span>Kind</span>
            <span>Founders</span>
            <span>Funded</span>
            <span>Diligence</span>
            <span>Passed</span>
            <span>Median trust</span>
            <span>Quality</span>
          </div>
          <ol className="divide-y divide-[#e3e1da]">
            {quality.map((channel, index) => (
              <ChannelPerformanceRow
                channel={channel}
                index={index}
                key={channel.nodeId}
              />
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

function ChannelPerformanceRow({
  channel,
  index,
}: {
  channel: ChannelQuality;
  index: number;
}) {
  return (
    <li className="px-5 py-4 transition-colors hover:bg-white sm:px-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(170px,1.25fr)_82px_repeat(4,58px)_92px_104px] lg:items-center lg:gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`grid size-7 shrink-0 place-items-center rounded-full text-[9px] font-bold tabular-nums ${
              index === 0
                ? "bg-[#dfece3] text-[#3e7659]"
                : "bg-[#eceae3] text-[#777970]"
            }`}
          >
            {String(index + 1).padStart(2, "0")}
          </span>
          <p className="text-[12px] font-semibold leading-snug text-[#30322c]">
            {channel.name}
          </p>
        </div>
        <KindChip kind={channel.kind} />

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 lg:contents">
          <TableMetric label="Founders" value={channel.founders} />
          <TableMetric label="Funded" value={channel.funded} />
          <TableMetric label="Diligence" value={channel.diligence} />
          <TableMetric label="Passed" value={channel.passed} />
          <TableMetric
            label="Median trust"
            value={
              channel.medianTrust === null
                ? "—"
                : Math.round(channel.medianTrust)
            }
          />
        </div>

        <div className="flex items-center justify-between gap-4 lg:block">
          <span className="text-[8px] font-bold uppercase tracking-[0.1em] text-[#999b93] lg:hidden">
            Quality
          </span>
          <span className="text-[16px] font-semibold tracking-[-0.03em] tabular-nums text-[#2f4f3d]">
            {Math.round(channel.qualityScore)}
            <span className="ml-1 text-[10px] font-bold text-[#738078]">
              ±{Math.round(channel.band)}
            </span>
          </span>
        </div>
      </div>

      <p className="mt-3 rounded-xl border border-dashed border-[#d7d3c8] bg-[#f2f0e9] px-3 py-2.5 text-[9px] leading-relaxed text-[#73756e] lg:ml-10">
        <span className="mr-1.5 font-bold uppercase tracking-[0.08em] text-[#878981]">
          Why the band
        </span>
        {channel.note}
      </p>
    </li>
  );
}

function SuggestionsPanel({
  message,
  onScan,
  scanning,
  suggestions,
}: {
  message: string;
  onScan: (suggestion: SourcingSuggestion) => void;
  scanning: string;
  suggestions: SourcingSuggestion[];
}) {
  return (
    <aside className="overflow-hidden rounded-[20px] border border-[#294035] bg-[#17251d] text-white shadow-[0_16px_38px_rgba(27,44,34,0.18)]">
      <div className="border-b border-white/[0.08] px-5 py-5">
        <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-[#72b68f]">
          Underexplored channels
        </p>
        <h2 className="mt-1.5 text-[19px] font-semibold tracking-[-0.03em]">
          Where to look next
        </h2>
        <p className="mt-2 text-[10px] leading-relaxed text-[#8fa097]">
          Exploration balances demonstrated channel quality with what the
          current network has not searched yet.
        </p>
      </div>

      {suggestions.length === 0 ? (
        <p className="px-5 py-10 text-center text-[10px] text-[#94a49a]">
          No underexplored channel is ready to recommend yet.
        </p>
      ) : (
        <ol className="divide-y divide-white/[0.07]">
          {suggestions.map((suggestion, index) => (
            <li className="px-5 py-4" key={`${suggestion.name}-${index}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-[#edf2ed]">
                    {suggestion.name}
                  </p>
                  <p className="mt-1.5 text-[9px] leading-[1.55] text-[#8fa097]">
                    {suggestion.reason}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-[#294737] px-2.5 py-1.5 text-[9px] font-bold tabular-nums text-[#8bd2a9] ring-1 ring-inset ring-white/[0.08]">
                  {Math.round(suggestion.explorationScore)}
                </span>
              </div>

              {suggestion.scanHint && (
                <button
                  className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-[#72c394] px-3 text-[9.5px] font-bold text-[#15221a] transition-colors hover:bg-[#88d2a7] disabled:cursor-wait disabled:bg-[#496858] disabled:text-[#a7b8ad]"
                  disabled={Boolean(scanning)}
                  onClick={() => onScan(suggestion)}
                  type="button"
                >
                  {scanning === suggestion.name ? (
                    <>
                      <SpinnerIcon /> Scanning and scoring…
                    </>
                  ) : (
                    <>
                      <RadarIcon /> Scan this channel
                    </>
                  )}
                </button>
              )}
            </li>
          ))}
        </ol>
      )}

      {message && (
        <p className="m-4 rounded-xl bg-white/[0.06] px-3.5 py-3 text-[9px] leading-relaxed text-[#b8c7bd]" role="status">
          {message}
        </p>
      )}
    </aside>
  );
}

type SourceGroup = {
  source: SourceNode;
  founders: Array<{ node: SourceNode; relation: SourceRelation }>;
};

function SourceNetworkList({
  latestStageByFounder,
  message,
  onOutcome,
  pendingFounderId,
  sourceGroups,
}: {
  latestStageByFounder: Map<string, OutcomeStage>;
  message: string;
  onOutcome: (
    founderId: string,
    founderName: string,
    stage: "funded" | "passed",
  ) => void;
  pendingFounderId: string;
  sourceGroups: SourceGroup[];
}) {
  return (
    <section
      aria-labelledby="source-network"
      className="overflow-hidden rounded-[20px] border border-[#d8d6cf] bg-[#f9f8f5] shadow-[0_14px_38px_rgba(40,42,36,0.05)]"
    >
      <div className="flex flex-col justify-between gap-3 border-b border-[#dfddd6] px-5 py-5 sm:flex-row sm:items-end sm:px-6">
        <div>
          <p className="text-[8.5px] font-bold uppercase tracking-[0.15em] text-[#6d806f]">
            Source → founder
          </p>
          <h2
            className="mt-1.5 text-[19px] font-semibold tracking-[-0.03em]"
            id="source-network"
          >
            Network attribution
          </h2>
          <p className="mt-2 text-[10px] text-[#85877f]">
            Every contributing source keeps credit when an outcome changes.
          </p>
        </div>
        <p className="max-w-md text-[9px] leading-relaxed text-[#85877f] sm:text-right">
          Mark an outcome here to watch the quality-first table reorder from the
          live API response.
        </p>
      </div>

      {message && (
        <p className="border-b border-[#d8e3da] bg-[#edf4ee] px-5 py-3 text-[9.5px] font-semibold text-[#4b735b] sm:px-6" role="status">
          {message}
        </p>
      )}

      {sourceGroups.length === 0 ? (
        <p className="px-6 py-14 text-center text-[10.5px] text-[#85877f]">
          No founder-to-source relationships are available yet.
        </p>
      ) : (
        <div className="grid gap-px bg-[#e2e0d9] md:grid-cols-2 xl:grid-cols-3">
          {sourceGroups.map((group) => (
            <article className="bg-[#f9f8f5] p-5" key={group.source.id}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <KindChip kind={group.source.kind as ChannelQuality["kind"]} />
                  <h3 className="mt-2 truncate text-[13px] font-semibold">
                    {group.source.name}
                  </h3>
                </div>
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#e6eee8] text-[11px] font-bold tabular-nums text-[#4e765f]">
                  {group.founders.length}
                </span>
              </div>

              <ul className="space-y-2.5">
                {group.founders.map(({ node, relation }) => {
                  const pending = pendingFounderId === node.id;
                  const latestStage = latestStageByFounder.get(node.id);
                  const historical = node.id.startsWith("hist-");
                  return (
                    <li
                      className="rounded-xl border border-[#dedbd2] bg-white/65 p-3"
                      key={`${group.source.id}-${node.id}-${relation}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          {historical ? (
                            <p className="truncate text-[10.5px] font-semibold text-[#33352f]">
                              {node.name}
                            </p>
                          ) : (
                            <Link
                              className="truncate text-[10.5px] font-semibold text-[#33352f] hover:underline"
                              href={`/founder/${node.id}`}
                            >
                              {node.name}
                            </Link>
                          )}
                          <p className="mt-1 text-[7.5px] font-bold uppercase tracking-[0.08em] text-[#92948c]">
                            {relation.replaceAll("-", " ")}
                          </p>
                        </div>
                        {latestStage && <StageChip stage={latestStage} />}
                      </div>
                      {historical ? (
                        <p className="mt-3 rounded-lg bg-[#f0eee8] px-2 py-2 text-center text-[7.5px] font-bold uppercase tracking-[0.07em] text-[#8a8c84]">
                          Historical outcome locked
                        </p>
                      ) : (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <button
                            className="rounded-lg bg-[#e4eee6] px-2 py-2 text-[8px] font-bold uppercase tracking-[0.06em] text-[#3f7658] transition-colors hover:bg-[#d9e9dd] disabled:cursor-wait disabled:opacity-55"
                            disabled={pending}
                            onClick={() => onOutcome(node.id, node.name, "funded")}
                            type="button"
                          >
                            {pending ? "Recording…" : "Mark funded"}
                          </button>
                          <button
                            className="rounded-lg bg-[#eceae4] px-2 py-2 text-[8px] font-bold uppercase tracking-[0.06em] text-[#72746d] transition-colors hover:bg-[#e3e0d8] disabled:cursor-wait disabled:opacity-55"
                            disabled={pending}
                            onClick={() => onOutcome(node.id, node.name, "passed")}
                            type="button"
                          >
                            {pending ? "Recording…" : "Mark passed"}
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function WorkspaceEmptyState({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="rounded-[20px] border border-[#d8d6cf] bg-[#f9f8f5] px-6 py-20 text-center shadow-[0_14px_38px_rgba(40,42,36,0.05)]">
      <span className="mx-auto grid size-11 place-items-center rounded-full bg-[#eceae3] text-[#777970]">
        <NetworkIcon />
      </span>
      <h2 className="mt-4 text-[16px] font-semibold">
        Sourcing intelligence is temporarily unavailable
      </h2>
      <p className="mx-auto mt-2 max-w-md text-[10.5px] leading-relaxed text-[#85877f]">
        The pipeline remains usable. Retry when the live graph endpoint is ready.
      </p>
      <button
        className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-[#252821] px-4 text-[10px] font-semibold text-white"
        onClick={onRetry}
        type="button"
      >
        Retry graph
      </button>
    </section>
  );
}

function WorkspaceLoading() {
  return (
    <section className="grid min-h-[360px] place-items-center rounded-[20px] border border-[#d8d6cf] bg-[#f9f8f5]">
      <div className="text-center">
        <span className="mx-auto grid size-10 animate-pulse place-items-center rounded-full bg-[#e2ece5] text-[#4c765d]">
          <NetworkIcon />
        </span>
        <p className="mt-4 text-[11px] font-semibold text-[#62645d]">
          Mapping sourcing channels…
        </p>
      </div>
    </section>
  );
}

function HeroMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-[86px] bg-[#f9f8f5] px-4 py-3.5 text-center">
      <p className="text-[18px] font-semibold tracking-[-0.03em] tabular-nums">
        {String(value).padStart(2, "0")}
      </p>
      <p className="mt-1 text-[7.5px] font-bold uppercase tracking-[0.1em] text-[#8a8c84]">
        {label}
      </p>
    </div>
  );
}

function TableMetric({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div>
      <p className="text-[8px] font-bold uppercase tracking-[0.08em] text-[#999b93] lg:hidden">
        {label}
      </p>
      <p className="mt-1 text-[11px] font-semibold tabular-nums text-[#4d4f48] lg:mt-0">
        {value}
      </p>
    </div>
  );
}

function KindChip({ kind }: { kind: ChannelQuality["kind"] }) {
  const style =
    kind === "channel"
      ? "bg-[#e4eee6] text-[#40765a]"
      : kind === "program"
        ? "bg-[#e8e9f1] text-[#5d6583]"
        : kind === "institution"
          ? "bg-[#eee8df] text-[#806b4e]"
          : "bg-[#efe6ea] text-[#805d6c]";
  return (
    <span
      className={`inline-flex w-fit rounded-full px-2.5 py-1 text-[7.5px] font-bold uppercase tracking-[0.08em] ${style}`}
    >
      {kind}
    </span>
  );
}

function StageChip({ stage }: { stage: OutcomeStage }) {
  const style =
    stage === "funded"
      ? "bg-[#dfece3] text-[#3f7658]"
      : stage === "passed"
        ? "bg-[#eceae4] text-[#777970]"
        : "bg-[#efe8da] text-[#876937]";
  return (
    <span className={`rounded-full px-2 py-1 text-[7px] font-bold uppercase tracking-[0.06em] ${style}`}>
      {stage}
    </span>
  );
}

async function requestSourcingGraph(): Promise<SourcingGraph> {
  const response = await fetch("/api/sourcing/graph", { cache: "no-store" });
  if (!response.ok) throw new Error("Sourcing graph unavailable");

  const graph = sourcingGraphFromUnknown(await response.json());
  if (!graph) throw new Error("Sourcing graph response invalid");
  return graph;
}

function discoverCandidateCount(value: unknown): number {
  if (!value || typeof value !== "object" || !("candidates" in value)) return 0;
  return Array.isArray(value.candidates) ? value.candidates.length : 0;
}

function countFounderNodes(graph: SourcingGraph): number {
  return graph.nodes.filter((node) => node.kind === "founder").length;
}

function groupFoundersBySource(graph: SourcingGraph): SourceGroup[] {
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const groups = new Map<string, SourceGroup>();

  for (const edge of graph.edges) {
    const founder = nodesById.get(edge.from);
    const source = nodesById.get(edge.to);
    if (!founder || founder.kind !== "founder" || !source || source.kind === "founder") {
      continue;
    }

    const group = groups.get(source.id) ?? { source, founders: [] };
    if (
      !group.founders.some(
        (item) => item.node.id === founder.id && item.relation === edge.relation,
      )
    ) {
      group.founders.push({ node: founder, relation: edge.relation });
    }
    groups.set(source.id, group);
  }

  return [...groups.values()].sort(
    (a, b) => b.founders.length - a.founders.length,
  );
}

function ArrowLeftIcon() {
  return <svg aria-hidden="true" fill="none" height="11" viewBox="0 0 12 12" width="11"><path d="m5 2-4 4 4 4M1.5 6H11" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3"/></svg>;
}
function RadarIcon() {
  return <svg aria-hidden="true" fill="none" height="11" viewBox="0 0 12 12" width="11"><circle cx="5.5" cy="6" r="4" stroke="currentColor"/><path d="m5.5 6 5-3M5.5 2v4l3 1.5" stroke="currentColor" strokeLinecap="round"/><circle cx="5.5" cy="6" fill="currentColor" r="1"/></svg>;
}
function NetworkIcon() {
  return <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 20 20" width="18"><circle cx="4" cy="10" r="2" stroke="currentColor"/><circle cx="15.5" cy="4.5" r="2" stroke="currentColor"/><circle cx="15.5" cy="15.5" r="2" stroke="currentColor"/><path d="m5.8 9 7.8-3.7M5.8 11l7.8 3.7" stroke="currentColor"/></svg>;
}
function SpinnerIcon() {
  return <svg aria-hidden="true" className="animate-spin" fill="none" height="11" viewBox="0 0 12 12" width="11"><circle cx="6" cy="6" opacity=".25" r="4.5" stroke="currentColor"/><path d="M6 1.5A4.5 4.5 0 0 1 10.5 6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5"/></svg>;
}
