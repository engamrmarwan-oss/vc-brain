// POST /api/apply — founder application intake.
// Accepts what the apply form sends ({ companyName, deckName, githubUrl? })
// plus optional richer fields, constructs a valid Founder, stores it, and
// scores it with the SAME engine as seeded founders — no separate path for
// inbound applications, which is the point of the Founder -> VC demo beat.

import { NextResponse } from "next/server";
import { processDeck } from "@/agents/deck";
import { scoreFounder } from "@/agents/score";
import { allFounders, saveDeckSummary, upsertFounder } from "@/lib/store";
import type { Entry, Founder } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // pdf-parse needs Node, not edge

const ENTRIES: Entry[] = ["inbound", "outbound", "cold-start"];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42) || "founder";

const optStr = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  let deckBuffer: Buffer | undefined;

  // Accept JSON ({ companyName, deckName?, deckText?, ... }) or
  // multipart/form-data with the PDF in any file field.
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    try {
      const form = await req.formData();
      for (const [key, value] of form.entries()) {
        if (value && typeof value === "object" && "arrayBuffer" in value) {
          if (!deckBuffer) {
            deckBuffer = Buffer.from(await value.arrayBuffer());
            if (body.deckName === undefined && value.name) body.deckName = value.name;
          }
        } else {
          body[key] = value;
        }
      }
    } catch {
      // unreadable form -> validation 400 below
    }
  } else {
    try {
      body = await req.json();
    } catch {
      // fall through to validation below
    }
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

  // Deck in -> claims out. Extraction is fail-soft: on any failure the
  // pipeline continues with manual claims / seeded claims / a placeholder.
  const deck = await processDeck({ buffer: deckBuffer, text: optStr(body.deckText) });
  const extractedClaims = deck.summary?.claims ?? [];

  // Re-application of a founder already in the pipeline (the demo beat:
  // applying as Maya). Reuse the known profile — but a freshly extracted
  // deck supersedes the seeded claims: verify what was actually submitted.
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
      deckClaims: extractedClaims.length ? extractedClaims : existing.deckClaims,
    };
  } else {
    const manualClaims =
      Array.isArray(body.deckClaims) &&
      body.deckClaims.length > 0 &&
      body.deckClaims.every((c): c is string => typeof c === "string" && !!c.trim())
        ? body.deckClaims.map((c) => c.trim())
        : [];
    const deckAttempted = !!deckBuffer || !!optStr(body.deckText);
    const deckClaims = extractedClaims.length
      ? extractedClaims
      : manualClaims.length
        ? manualClaims
        : [
            `Pitch deck submitted${deckName ? `: ${deckName}` : ""}${
              deckAttempted && !deck.parsed ? " (deck not parsed)" : ""
            }`,
          ];
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
  if (deck.summary) saveDeckSummary(founder.id, deck.summary);
  const assessment = await scoreFounder(founder);
  return NextResponse.json({
    id: founder.id,
    founder,
    assessment,
    deck: { parsed: deck.parsed, source: deck.source, summary: deck.summary },
  });
}
