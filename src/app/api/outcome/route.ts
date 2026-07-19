// POST /api/outcome { founderId, stage, sourceNodeIds? } -> records an
// OutcomeEvent (auto-attributed to every contributing source node) and
// returns the recomputed quality + suggestions so the UI can show the
// ranking move immediately — the sourcing feedback loop, live.
// GET /api/outcome?founderId= -> outcome history (all events if no id).

import { NextResponse } from "next/server";
import {
  buildSourcingGraph,
  OUTCOME_STAGES,
  recordOutcome,
  type OutcomeStage,
} from "@/lib/sourcing-graph";
import { getFounder, getSourcingSeedData } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // 400 below
  }
  const founderId = typeof body.founderId === "string" ? body.founderId : undefined;
  const stage = OUTCOME_STAGES.includes(body.stage as OutcomeStage)
    ? (body.stage as OutcomeStage)
    : undefined;
  if (!founderId || !stage) {
    return NextResponse.json(
      { error: `body must be { founderId: string, stage: ${OUTCOME_STAGES.join("|")} }` },
      { status: 400 }
    );
  }
  const founder = getFounder(founderId);
  if (!founder) {
    return NextResponse.json({ error: `unknown founder: ${founderId}` }, { status: 404 });
  }
  const explicit = Array.isArray(body.sourceNodeIds)
    ? body.sourceNodeIds.filter((x): x is string => typeof x === "string")
    : undefined;

  const event = recordOutcome(founder, stage, explicit);
  const { quality, suggestions } = buildSourcingGraph();
  return NextResponse.json({ event, quality, suggestions });
}

export async function GET(req: Request) {
  const founderId = new URL(req.url).searchParams.get("founderId");
  const { outcomes } = getSourcingSeedData();
  return NextResponse.json({
    outcomes: founderId ? outcomes.filter((o) => o.founderId === founderId) : outcomes,
  });
}
