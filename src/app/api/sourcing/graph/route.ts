// GET /api/sourcing/graph -> full SourcingGraph: nodes, edges, outcomes,
// shrinkage-adjusted channel quality, and underexplored-channel suggestions.
// Rebuilt fresh on every read so live founders and new outcomes are always in.

import { NextResponse } from "next/server";
import { buildSourcingGraph } from "@/lib/sourcing-graph";
import { hydrateStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  await hydrateStore();
  return NextResponse.json(buildSourcingGraph());
}
