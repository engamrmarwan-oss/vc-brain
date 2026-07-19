// Sourcing intelligence (lite): channel provenance per founder + per-channel
// quality stats derived from assessments we already hold. Pure + store reads,
// no LLM, never throws. Quality is trust/outcome-based, NOT volume-based.
//
// This is the demo slice of the full sourcing graph (nodes/edges/outcome
// events, shrinkage, attribution) documented in docs/HANDOFF.md as the
// follow-up milestone. Contract below is FROZEN with Codex.

import { allFounders, getAssessment } from "@/lib/store";
import { buildTrustReport } from "@/lib/trust";
import type { Founder } from "@/lib/types";

export interface SourcingProvenance {
  founderId: string;
  channelId: string;
  channelName: string;
  kind: "github-scrape" | "outbound-scout" | "inbound-application" | "cold-start-scout";
  path: string[]; // human-readable discovery chain, e.g. ["GitHub topic: llm-inference", "repo: ray-project/ray"]
}

export interface ChannelStats {
  id: string;
  name: string;
  kind: SourcingProvenance["kind"];
  founderCount: number;
  scoredCount: number;
  meanTrust: number | null; // mean aggregate trust of scored founders
  investRate: number | null; // share of scored founders recommended invest
  contradictionRate: number | null; // share of scored founders with >=1 contradiction
  note: string; // sample-size honesty, always present
}

// Seed founders' provenance — how each became visible to the fund.
const SEED_PROVENANCE: Record<string, Omit<SourcingProvenance, "founderId">> = {
  "priya-nair": {
    channelId: "outbound-oss-scout",
    channelName: "Outbound scout — OSS community",
    kind: "outbound-scout",
    path: ["KubeCon EU talk", "GitHub: vectorplane (2.1k stars)"],
  },
  "maya-chen": {
    channelId: "inbound-application",
    channelName: "Inbound application",
    kind: "inbound-application",
    path: ["Founder application form", "pitch deck submitted"],
  },
  "dan-okoro": {
    channelId: "inbound-application",
    channelName: "Inbound application",
    kind: "inbound-application",
    path: ["Founder application form", "pitch deck submitted"],
  },
  "tomas-halvorsen": {
    channelId: "cold-start-scout",
    channelName: "Cold-start scout — public footprint",
    kind: "cold-start-scout",
    path: ["X/Twitter: inference-cost threads", "personal blog: LLM routing"],
  },
};

export function provenanceFor(f: Founder): SourcingProvenance {
  const seeded = SEED_PROVENANCE[f.id];
  if (seeded) return { founderId: f.id, ...seeded };

  // Discovered via live GitHub search: sector carries the topic filter(s).
  if (f.id.startsWith("gh-")) {
    return {
      founderId: f.id,
      channelId: `github-topic:${f.sector.replace(/\s+/g, "")}`,
      channelName: `GitHub scrape — ${f.sector}`,
      kind: "github-scrape",
      path: [
        `GitHub topic search: ${f.sector}`,
        ...(f.githubUrl ? [`repo: ${f.githubUrl.replace(/^https?:\/\/(www\.)?github\.com\//i, "")}`] : []),
      ],
    };
  }

  // Everyone else arrived through the apply flow.
  return {
    founderId: f.id,
    channelId: "inbound-application",
    channelName: "Inbound application",
    kind: "inbound-application",
    path: ["Founder application form"],
  };
}

export function buildSourcing(): {
  channels: ChannelStats[];
  provenance: SourcingProvenance[];
} {
  const founders = allFounders();
  const provenance = founders.map(provenanceFor);

  const byChannel = new Map<string, { prov: SourcingProvenance; founders: Founder[] }>();
  for (const f of founders) {
    const p = provenance.find((x) => x.founderId === f.id)!;
    const entry = byChannel.get(p.channelId) ?? { prov: p, founders: [] };
    entry.founders.push(f);
    byChannel.set(p.channelId, entry);
  }

  const channels: ChannelStats[] = [...byChannel.values()].map(({ prov, founders: fs }) => {
    const scored = fs
      .map((f) => ({ f, a: getAssessment(f.id) }))
      .filter((x): x is { f: Founder; a: NonNullable<ReturnType<typeof getAssessment>> } => !!x.a);
    const trusts = scored
      .map(({ f, a }) => buildTrustReport(f, a.claims).score)
      .filter((s): s is number => s !== null);
    const invest = scored.filter(({ a }) => a.recommendation === "invest").length;
    const contradicted = scored.filter(({ a }) =>
      a.claims.some((c) => c.status === "contradicted")
    ).length;
    const n = scored.length;
    return {
      id: prov.channelId,
      name: prov.channelName,
      kind: prov.kind,
      founderCount: fs.length,
      scoredCount: n,
      meanTrust: trusts.length ? Math.round(trusts.reduce((s, t) => s + t, 0) / trusts.length) : null,
      investRate: n ? Math.round((invest / n) * 100) / 100 : null,
      contradictionRate: n ? Math.round((contradicted / n) * 100) / 100 : null,
      note:
        n === 0
          ? "no scored founders yet — no quality signal"
          : n < 5
            ? `n=${n} scored — small sample, treat as directional`
            : `n=${n} scored`,
    };
  });

  // Quality-first ordering: trust-backed channels first, volume never wins.
  channels.sort((a, b) => (b.meanTrust ?? -1) - (a.meanTrust ?? -1));
  return { channels, provenance };
}
