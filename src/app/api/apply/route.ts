// POST /api/apply — founder application intake.
// Accepts what the apply form sends ({ companyName, deckName, githubUrl? })
// plus optional richer fields, constructs a valid Founder, stores it, and
// scores it with the SAME engine as seeded founders — no separate path for
// inbound applications, which is the point of the Founder -> VC demo beat.

import { NextResponse } from "next/server";
import { processDeck, processResume } from "@/agents/deck";
import { scoreFounder } from "@/agents/score";
import {
  allFounders,
  saveDeckSummary,
  saveDocument,
  saveResumeSummary,
  upsertFounder,
} from "@/lib/store";
import type { Entry, Founder } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // pdf-parse needs Node, not edge

const ENTRIES: Entry[] = ["inbound", "outbound", "cold-start"];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42) || "founder";

const optStr = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;

interface UploadedFile {
  buffer: Buffer;
  filename: string;
  mime: string;
}

// Originals are kept in memory for viewing — cap per file so a huge upload
// can't blow the session store.
const MAX_STORED_BYTES = 15 * 1024 * 1024;

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  let deckFile: UploadedFile | undefined;
  let resumeFile: UploadedFile | undefined;

  // Accept JSON ({ companyName, deckName?, deckText?, resumeText?, ... }) or
  // multipart/form-data. A file field/filename matching resume|cv is the
  // resume; the first other file is the deck.
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    try {
      const form = await req.formData();
      for (const [key, value] of form.entries()) {
        if (value && typeof value === "object" && "arrayBuffer" in value) {
          const file: UploadedFile = {
            buffer: Buffer.from(await value.arrayBuffer()),
            filename: value.name || key,
            mime: value.type || "application/pdf",
          };
          const isResume = /resume|cv/i.test(key) || /resume|cv/i.test(value.name ?? "");
          if (isResume) resumeFile ??= file;
          else deckFile ??= file;
        } else {
          body[key] = value;
        }
      }
      if (deckFile && body.deckName === undefined) body.deckName = deckFile.filename;
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
  // Resume runs through the same machinery -> career-signal summary plus
  // verifiable background claims for the Trust Score.
  const [deck, resume] = await Promise.all([
    processDeck({ buffer: deckFile?.buffer, text: optStr(body.deckText) }),
    processResume({ buffer: resumeFile?.buffer, text: optStr(body.resumeText) }),
  ]);
  const extractedClaims = deck.summary?.claims ?? [];
  const backgroundClaims = resume.summary?.backgroundClaims ?? [];

  // Re-application of a founder already in the pipeline (the demo beat:
  // applying as Maya). Reuse the known profile — but a freshly extracted
  // deck supersedes the seeded claims: verify what was actually submitted.
  const target = norm(companyName);
  const existing = allFounders().find(
    (f) => norm(f.company) === target || norm(f.name) === target
  );

  // Resume background claims join the deck claims for verification — capped
  // and deduped so a resume can't flood the Trust Score list.
  const mergeClaims = (base: string[], extra: string[]): string[] => {
    const seenClaims = new Set(base.map(norm));
    const merged = [...base];
    for (const c of extra) {
      if (!seenClaims.has(norm(c))) {
        seenClaims.add(norm(c));
        merged.push(c);
      }
    }
    return merged.slice(0, 8);
  };

  let founder: Founder;
  if (existing) {
    founder = {
      ...existing,
      entry: "inbound",
      githubUrl: githubUrl ?? existing.githubUrl,
      deckClaims: mergeClaims(
        extractedClaims.length ? extractedClaims : existing.deckClaims,
        backgroundClaims
      ),
    };
  } else {
    const manualClaims =
      Array.isArray(body.deckClaims) &&
      body.deckClaims.length > 0 &&
      body.deckClaims.every((c): c is string => typeof c === "string" && !!c.trim())
        ? body.deckClaims.map((c) => c.trim())
        : [];
    const deckAttempted = !!deckFile || !!optStr(body.deckText);
    const baseClaims = extractedClaims.length
      ? extractedClaims
      : manualClaims.length
        ? manualClaims
        : deckAttempted || deckName
          ? [
              `Pitch deck submitted${deckName ? `: ${deckName}` : ""}${
                deckAttempted && !deck.parsed ? " (deck not parsed)" : ""
              }`,
            ]
          : [];
    const deckClaims = mergeClaims(baseClaims, backgroundClaims);
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
  if (resume.summary) saveResumeSummary(founder.id, resume.summary);

  // Keep the originals for viewing (session-scoped, like the rest of the store).
  for (const [type, file] of [["deck", deckFile], ["resume", resumeFile]] as const) {
    if (file && file.buffer.length <= MAX_STORED_BYTES) {
      saveDocument(founder.id, type, {
        data: file.buffer.toString("base64"),
        contentType: file.mime,
        filename: file.filename,
      });
    }
  }

  const assessment = await scoreFounder(founder);
  return NextResponse.json({
    id: founder.id,
    founder,
    assessment,
    deck: { parsed: deck.parsed, source: deck.source, summary: deck.summary },
    resume: { parsed: resume.parsed, source: resume.source, summary: resume.summary },
  });
}
