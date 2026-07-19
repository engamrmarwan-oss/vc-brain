// GET /api/trace?id=<founderId> -> { trace: TraceReport } | 404
// Structured audit trail of the most recent scoring run: evidence refs,
// decision steps, per-claim citations. Regenerated on every score.

import { NextResponse } from "next/server";
import { getTrace } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "query param id required" }, { status: 400 });
  }
  const trace = getTrace(id);
  if (!trace) {
    return NextResponse.json(
      { error: `no trace for: ${id} — founder has not been scored this session` },
      { status: 404 }
    );
  }
  return NextResponse.json({ trace });
}
