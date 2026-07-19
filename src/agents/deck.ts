// Pitch-deck extraction -> executive summary -> verifiable claims.
// Deck in, claims out: the extracted claims become the deckClaims the Trust
// Score verifies, so an overstated number in a PDF ends up flagged red in
// the memo with evidence attached.
// FAIL-SOFT BY CONTRACT: bad PDF, parser error, or slow extraction returns
// parsed:false and the pipeline continues on fallback claims. Never throws.

import { callLLM } from "@/lib/llm";

// Executive summary the memo can render directly.
export interface DeckSummary {
  snapshot: string;         // one-paragraph company snapshot
  claims: string[];         // verifiable assertions -> feed the Trust Score
  market: string;           // stated market / wedge
  tractionSignals: string[]; // qualitative traction the deck asserts
  statedMetrics: string[];  // hard numbers exactly as the deck states them
}

export interface DeckExtraction {
  parsed: boolean;
  source: "pdf" | "text" | "none";
  summary: DeckSummary | null;
}

// PDF text extraction capped at 5s; LLM summarization capped by input size.
const EXTRACT_TIMEOUT_MS = 5000;
const MAX_DECK_CHARS = 8000;

const SYSTEM = `You extract structured facts from startup pitch decks for a VC
screening engine. Respond with ONLY this JSON shape:
{
  "snapshot": "one paragraph: what the company does, for whom, and why now",
  "claims": ["each concrete, checkable assertion the deck makes — traction
numbers, user counts, credentials, partnerships, revenue — phrased close to
the deck's own wording. Max 6, most consequential first."],
  "market": "the market/wedge as the deck states it",
  "tractionSignals": ["qualitative traction assertions"],
  "statedMetrics": ["every hard number verbatim, e.g. '10,000 active users'"]
}
Extract what the deck SAYS, not what you believe — verification happens
downstream. Do not invent facts absent from the text.`;

export async function extractDeckText(buffer: Buffer): Promise<string | null> {
  try {
    // Lazy import: if the host fails to bundle/trace pdf-parse, that failure
    // lands here (-> "deck not parsed") instead of crashing the whole route.
    const { default: pdfParse } = await import("pdf-parse/lib/pdf-parse.js");
    const result = await Promise.race([
      pdfParse(buffer),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("pdf extraction timeout")), EXTRACT_TIMEOUT_MS)
      ),
    ]);
    const text = result.text?.trim();
    return text ? text : null;
  } catch {
    return null; // corrupt PDF, parser error, timeout — fail soft
  }
}

function strArr(v: unknown, max: number): string[] {
  return (Array.isArray(v) ? v : [])
    .filter((x): x is string => typeof x === "string" && !!x.trim())
    .map((x) => x.trim())
    .slice(0, max);
}

export async function summarizeDeck(deckText: string): Promise<DeckSummary | null> {
  try {
    const raw = await callLLM({
      system: SYSTEM,
      user: `Pitch deck text:\n\n${deckText.slice(0, MAX_DECK_CHARS)}`,
      tier: "reasoning",
      json: true,
    });
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    const parsed = JSON.parse(cleaned);
    const summary: DeckSummary = {
      snapshot: typeof parsed.snapshot === "string" ? parsed.snapshot : "",
      claims: strArr(parsed.claims, 6),
      market: typeof parsed.market === "string" ? parsed.market : "",
      tractionSignals: strArr(parsed.tractionSignals, 6),
      statedMetrics: strArr(parsed.statedMetrics, 8),
    };
    // A summary with no snapshot and no claims is useless — treat as failure
    // so the caller falls back rather than rendering an empty card.
    return summary.snapshot || summary.claims.length ? summary : null;
  } catch {
    return null; // LLM/parse failure — fail soft
  }
}

// ---------- resume extraction (same machinery, career-signal only) ----------

// Founder background from an uploaded resume. Career signal ONLY — the
// prompt excludes contact info / PII, and emails are stripped in code.
export interface ResumeSummary {
  headline: string;          // one-line career summary
  roles: string[];           // "Research Engineer, DeepMind (2021-2024)"
  education: string[];       // "MSc Computer Science, ETH Zurich (2019)"
  backgroundClaims: string[]; // verifiable claims -> Trust Score, e.g. "ex-DeepMind 2021-2024"
}

export interface ResumeExtraction {
  parsed: boolean;
  source: "pdf" | "text" | "none";
  summary: ResumeSummary | null;
}

const RESUME_SYSTEM = `You extract CAREER SIGNAL from a founder's resume for a
VC screening engine. Respond with ONLY this JSON shape:
{
  "headline": "one line: seniority, domain, standout credential",
  "roles": ["title, company (tenure)" — most recent first, max 6],
  "education": ["degree, institution (year)" — max 3],
  "backgroundClaims": ["verifiable background claims phrased for fact-checking,
e.g. 'ex-DeepMind research engineer 2021-2024' — max 3, most consequential first"]
}
STRICT PRIVACY RULE: career signal only. NEVER include contact details (email,
phone, address), date of birth, photos, marital status, or any personal
identifier beyond name, roles, companies, tenure, and education. Extract what
the resume SAYS — verification happens downstream. Do not invent.`;

// Deterministic belt to the prompt's suspenders: no email survives into the
// stored summary. (Phone/address exclusion is prompt-enforced — a regex wide
// enough for phones would eat tenure ranges like "2021-2024".)
const stripEmails = (s: string) => s.replace(/\S+@\S+\.\S+/g, "[redacted]");

// Retry/backoff and cross-backend fallback live inside callLLM (llm.ts).

export async function summarizeResume(resumeText: string): Promise<ResumeSummary | null> {
  try {
    const raw = await callLLM({
      system: RESUME_SYSTEM,
      user: `Resume text:\n\n${resumeText.slice(0, MAX_DECK_CHARS)}`,
      tier: "reasoning",
      json: true,
    });
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    const parsed = JSON.parse(cleaned);
    const summary: ResumeSummary = {
      headline: typeof parsed.headline === "string" ? stripEmails(parsed.headline) : "",
      roles: strArr(parsed.roles, 6).map(stripEmails),
      education: strArr(parsed.education, 3).map(stripEmails),
      backgroundClaims: strArr(parsed.backgroundClaims, 3).map(stripEmails),
    };
    return summary.headline || summary.roles.length ? summary : null;
  } catch {
    return null; // LLM/parse failure — fail soft
  }
}

export async function processResume(input: {
  buffer?: Buffer;
  text?: string;
}): Promise<ResumeExtraction> {
  let resumeText: string | null = null;
  let source: ResumeExtraction["source"] = "none";

  if (input.buffer?.length) {
    resumeText = await extractDeckText(input.buffer);
    if (resumeText) source = "pdf";
  }
  if (!resumeText && input.text?.trim()) {
    resumeText = input.text.trim();
    source = "text";
  }
  if (!resumeText) return { parsed: false, source: "none", summary: null };

  const summary = await summarizeResume(resumeText);
  return { parsed: summary !== null, source, summary };
}

// One entry point for the apply route: PDF bytes, pasted text, or nothing.
export async function processDeck(input: {
  buffer?: Buffer;
  text?: string;
}): Promise<DeckExtraction> {
  let deckText: string | null = null;
  let source: DeckExtraction["source"] = "none";

  if (input.buffer?.length) {
    deckText = await extractDeckText(input.buffer);
    if (deckText) source = "pdf";
  }
  if (!deckText && input.text?.trim()) {
    deckText = input.text.trim();
    source = "text";
  }
  if (!deckText) return { parsed: false, source: "none", summary: null };

  const summary = await summarizeDeck(deckText);
  return { parsed: summary !== null, source, summary };
}
