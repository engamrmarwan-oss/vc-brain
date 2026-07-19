// GET /api/sourcing            -> { channels: ChannelStats[], provenance: SourcingProvenance[] }
// GET /api/sourcing?id=<fid>   -> { provenance: SourcingProvenance, channel: ChannelStats } | 404
// Sourcing intelligence (lite): where each founder became visible, and how
// each channel performs on quality (trust/invest/contradictions), not volume.

import { NextResponse } from "next/server";
import { buildSourcing } from "@/lib/sourcing";
import { getFounder } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  const { channels, provenance } = buildSourcing();

  if (id) {
    if (!getFounder(id)) {
      return NextResponse.json({ error: `unknown founder: ${id}` }, { status: 404 });
    }
    const p = provenance.find((x) => x.founderId === id)!;
    const channel = channels.find((c) => c.id === p.channelId) ?? null;
    return NextResponse.json({ provenance: p, channel });
  }

  return NextResponse.json({ channels, provenance });
}
