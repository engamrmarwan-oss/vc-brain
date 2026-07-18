// POST /api/score  { id: string } -> Assessment
// Scores one founder on demand. force-dynamic: never cached, always re-runs.

import { NextResponse } from "next/server";
import { scoreFounder } from "@/agents/score";
import { getFounder } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let id: string | undefined;
  try {
    const body = await req.json();
    if (typeof body?.id === "string") id = body.id;
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

  const assessment = await scoreFounder(founder);
  return NextResponse.json(assessment);
}
