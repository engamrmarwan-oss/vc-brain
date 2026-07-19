// Thesis-lens ranking over the whole pipeline.
// GET  -> rank all founders with the stored thesis
// POST { thesis } -> save the thesis (in-memory), rank with it
// Assessments come from the session cache; anyone unscored is scored now
// with the same engine (scoreFounder never throws — worst case a founder
// ranks on stub data). A malformed thesis normalizes to defaults: fail-soft.

import { NextResponse } from "next/server";
import { scoreFounder, wasStubFallback } from "@/agents/score";
import {
  allFounders,
  getAssessment,
  getThesis,
  saveAssessment,
  setThesis,
} from "@/lib/store";
import { normalizeThesis, rankFounders, type ThesisConfig } from "@/lib/thesis";
import { buildTrustReport } from "@/lib/trust";

export const dynamic = "force-dynamic";

async function rankResponse(thesis: ThesisConfig) {
  const entries = await Promise.all(
    allFounders().map(async (founder) => {
      const cached = getAssessment(founder.id);
      const assessment = cached ?? (await scoreFounder(founder));
      // Stubs rank this round but are not cached — next rank retries them.
      if (!cached && !wasStubFallback(assessment)) saveAssessment(assessment);
      return { founder, assessment };
    })
  );
  const ranked = rankFounders(thesis, entries).map((entry) => ({
    ...entry,
    trust: buildTrustReport(entry.founder, entry.assessment.claims),
  }));
  return NextResponse.json({ thesis, ranked });
}

export async function GET() {
  return rankResponse(getThesis());
}

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // no body -> rank with stored thesis
  }
  if (body.thesis !== undefined) {
    const thesis = normalizeThesis(body.thesis);
    setThesis(thesis);
    return rankResponse(thesis);
  }
  return rankResponse(getThesis());
}
