// GET /api/deck?id=<founderId> -> { summary: DeckSummary } | 404
// Serves the executive summary extracted from a founder's submitted deck,
// for the memo to render alongside the Trust Score.

import { NextResponse } from "next/server";
import { getDeckSummary } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "query param id required" }, { status: 400 });
  }
  const summary = getDeckSummary(id);
  if (!summary) {
    return NextResponse.json({ error: `no deck summary for: ${id}` }, { status: 404 });
  }
  return NextResponse.json({ summary });
}
