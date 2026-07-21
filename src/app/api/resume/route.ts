// GET /api/resume?id=<founderId> -> { summary: ResumeSummary } | 404
// Career-signal summary extracted from a founder's uploaded resume,
// mirroring the /api/deck pattern.

import { NextResponse } from "next/server";
import { getResumeSummary, hydrateStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await hydrateStore();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "query param id required" }, { status: 400 });
  }
  const summary = getResumeSummary(id);
  if (!summary) {
    return NextResponse.json({ error: `no resume summary for: ${id}` }, { status: 404 });
  }
  return NextResponse.json({ summary });
}
