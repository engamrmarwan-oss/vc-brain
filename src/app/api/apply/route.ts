// POST /api/apply — founder application intake.
// Accepts what the apply form sends ({ companyName, deckName, githubUrl? })
// plus optional richer fields, constructs a valid Founder, stores it, and
// scores it with the SAME engine as seeded founders — no separate path for
// inbound applications, which is the point of the Founder -> VC demo beat.

import { NextResponse } from "next/server";
import { scoreFounder } from "@/agents/score";
import { allFounders, upsertFounder } from "@/lib/store";
import type { Entry, Founder } from "@/lib/types";

export const dynamic = "force-dynamic";

const ENTRIES: Entry[] = ["inbound", "outbound", "cold-start"];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42) || "founder";

const optStr = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // fall through to validation below
  }

  const companyName = optStr(body.companyName);
  if (!companyName || companyName.length < 2) {
    return NextResponse.json(
      { error: "body must include companyName (string, min 2 chars)" },
      { status: 400 }
    );
  }

  const githubUrl = optStr(body.githubUrl);
  const deckName = optStr(body.deckName);

  // Re-application of a founder already in the pipeline (the demo beat:
  // applying as Maya). Reuse the known profile — its deck claims are what
  // the Trust Score verifies — instead of minting an empty duplicate.
  const target = norm(companyName);
  const existing = allFounders().find(
    (f) => norm(f.company) === target || norm(f.name) === target
  );

  let founder: Founder;
  if (existing) {
    founder = {
      ...existing,
      entry: "inbound",
      githubUrl: githubUrl ?? existing.githubUrl,
    };
  } else {
    const deckClaims =
      Array.isArray(body.deckClaims) &&
      body.deckClaims.length > 0 &&
      body.deckClaims.every((c): c is string => typeof c === "string" && !!c.trim())
        ? body.deckClaims.map((c) => c.trim())
        : [`Pitch deck submitted${deckName ? `: ${deckName}` : ""}`];
    const entry = ENTRIES.includes(body.entry as Entry) ? (body.entry as Entry) : "inbound";
    const name = optStr(body.name) ?? companyName;
    founder = {
      id: `${slugify(name)}-${Date.now().toString(36)}`,
      name,
      company: companyName,
      sector: optStr(body.sector) ?? "unclassified",
      geo: optStr(body.geo) ?? "undisclosed",
      entry,
      // New applicant with no track record on file: middling score, WIDE
      // confidence band — honest thin evidence, same as cold-start.
      founderScore: 60,
      founderScoreConfidence: 0.5,
      deckClaims,
      githubUrl,
    };
  }

  upsertFounder(founder);
  const assessment = await scoreFounder(founder);
  return NextResponse.json({ id: founder.id, founder, assessment });
}
