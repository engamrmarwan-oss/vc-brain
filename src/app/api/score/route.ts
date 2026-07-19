// POST /api/score  { id: string, fresh?: boolean } -> Assessment
// Serves the session-cached assessment when one exists so the memo and the
// ranked list tell the same story; pass fresh:true to force a re-score.

import { NextResponse } from "next/server";
import { scoreFounder } from "@/agents/score";
import { getAssessment, getFounder, saveAssessment } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let id: string | undefined;
  let fresh = false;
  try {
    const body = await req.json();
    if (typeof body?.id === "string") id = body.id;
    fresh = body?.fresh === true;
  } catch {
    // fall through to the 400 below
  }
  if (!id) {
    return NextResponse.json({ error: "body must be { id: string }" }, { status: 400 });
  }

  const founder = getFounder(id);
  if (!founder) {
    return NextResponse.json({ error: `unknown founder: ${id}` }, { status: 404 });
  }

  if (!fresh) {
    const cached = getAssessment(id);
    if (cached) return NextResponse.json(cached);
  }
  const assessment = await scoreFounder(founder);
  saveAssessment(assessment);
  return NextResponse.json(assessment);
}
