// POST /api/discover  { topics?, language?, minStars?, pushedAfter?, geo? }
// Live GitHub search -> owners scored as outbound candidate founders.
// Fail-soft all the way down: a failed search returns { candidates: [], note }.

import { NextResponse } from "next/server";
import { discoverFounders } from "@/agents/discover";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // no body -> default filters
  }
  const result = await discoverFounders(body);
  return NextResponse.json(result);
}
