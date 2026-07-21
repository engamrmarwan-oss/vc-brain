// POST /api/validate { id } -> run the validator agent, return ValidationReport
// GET  /api/validate?id=    -> last report for founder | 404
// The validator overlays the primary result — it never mutates the cached
// assessment. Failures return independentlyValidated: false, never an error.

import { NextResponse } from "next/server";
import { scoreFounder, wasStubFallback } from "@/agents/score";
import { validateFounder, type ValidationReport } from "@/agents/validate";
import {
  flushStore,
  getAssessment,
  getFounder,
  getValidation,
  hydrateStore,
  saveAssessment,
  saveValidation,
} from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let id: string | undefined;
  try {
    const body = await req.json();
    if (typeof body?.id === "string") id = body.id;
  } catch {
    // 400 below
  }
  if (!id) {
    return NextResponse.json({ error: "body must be { id: string }" }, { status: 400 });
  }
  await hydrateStore();
  const founder = getFounder(id);
  if (!founder) {
    return NextResponse.json({ error: `unknown founder: ${id}` }, { status: 404 });
  }

  // Validate against the cached assessment; score first if none exists yet.
  let assessment = getAssessment(id);
  if (!assessment) {
    assessment = await scoreFounder(founder);
    if (!wasStubFallback(assessment)) saveAssessment(assessment);
  }

  const report = await validateFounder(founder, assessment);
  saveValidation(id, report);
  await flushStore();
  return NextResponse.json(report);
}

export async function GET(req: Request) {
  await hydrateStore();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "query param id required" }, { status: 400 });
  }
  const report = getValidation<ValidationReport>(id);
  if (!report) {
    return NextResponse.json({ error: `no validation for: ${id}` }, { status: 404 });
  }
  return NextResponse.json(report);
}
