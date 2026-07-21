// Persistence layer: Neon Postgres (+ optional Vercel Blob for originals).
// Pattern: the in-memory store remains the working set — this module only
// loads snapshots into it (hydration) and mirrors mutations back out
// (write-through). Engines and all sync call sites stay untouched.
//
// FAIL-SOFT BY CONTRACT: no DATABASE_URL, network failure, or SQL error
// degrades to memory-only behavior (exactly the pre-persistence app) with a
// console warning. Persistence must never break the pipeline.
//
// JSONB mirror: every row stores the exact TypeScript object the app already
// uses — no relational remodeling, frozen types stay frozen.

import { neon } from "@neondatabase/serverless";
import type { DeckSummary, ResumeSummary } from "@/agents/deck";
import type { OutcomeEvent } from "@/lib/sourcing-graph";
import type { ThesisConfig } from "@/lib/thesis";
import type { TraceReport } from "@/lib/trace";
import type { Assessment, Founder } from "@/lib/types";
import type { DocumentType, StoredDocument } from "@/lib/store";

type Sql = ReturnType<typeof neon>;

let _sql: Sql | null | undefined;
function sql(): Sql | null {
  if (_sql !== undefined) return _sql;
  _sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
  if (!_sql) console.warn("db: DATABASE_URL not set — running memory-only");
  return _sql;
}

export function dbEnabled(): boolean {
  return sql() !== null;
}

let schemaReady = false;
export async function ensureSchema(): Promise<void> {
  const s = sql();
  if (!s || schemaReady) return;
  // One JSONB doc per row; founder-keyed tables upsert, events append.
  await s`CREATE TABLE IF NOT EXISTS founders (
    id text PRIMARY KEY, data jsonb NOT NULL, updated_at timestamptz DEFAULT now())`;
  await s`CREATE TABLE IF NOT EXISTS assessments (
    founder_id text PRIMARY KEY, data jsonb NOT NULL, updated_at timestamptz DEFAULT now())`;
  await s`CREATE TABLE IF NOT EXISTS deck_summaries (
    founder_id text PRIMARY KEY, data jsonb NOT NULL, updated_at timestamptz DEFAULT now())`;
  await s`CREATE TABLE IF NOT EXISTS resume_summaries (
    founder_id text PRIMARY KEY, data jsonb NOT NULL, updated_at timestamptz DEFAULT now())`;
  await s`CREATE TABLE IF NOT EXISTS traces (
    founder_id text PRIMARY KEY, data jsonb NOT NULL, updated_at timestamptz DEFAULT now())`;
  await s`CREATE TABLE IF NOT EXISTS validations (
    founder_id text PRIMARY KEY, data jsonb NOT NULL, updated_at timestamptz DEFAULT now())`;
  await s`CREATE TABLE IF NOT EXISTS outcome_events (
    id bigserial PRIMARY KEY, data jsonb NOT NULL, created_at timestamptz DEFAULT now())`;
  await s`CREATE TABLE IF NOT EXISTS thesis (
    id int PRIMARY KEY DEFAULT 1, data jsonb NOT NULL, updated_at timestamptz DEFAULT now())`;
  // Documents: blob_url when Vercel Blob is configured, else inline base64.
  // Excluded from snapshot hydration (large) — fetched lazily by id.
  await s`CREATE TABLE IF NOT EXISTS documents (
    founder_id text NOT NULL, type text NOT NULL,
    filename text NOT NULL, content_type text NOT NULL,
    blob_url text, data_base64 text,
    updated_at timestamptz DEFAULT now(),
    PRIMARY KEY (founder_id, type))`;
  schemaReady = true;
}

export interface DbSnapshot {
  founders: Founder[];
  assessments: Assessment[];
  deckSummaries: Array<{ founderId: string; data: DeckSummary }>;
  resumeSummaries: Array<{ founderId: string; data: ResumeSummary }>;
  traces: TraceReport[];
  validations: Array<{ founderId: string; data: unknown }>;
  outcomeEvents: OutcomeEvent[];
  thesis: ThesisConfig | null;
}

// Everything except documents (large, lazily fetched).
export async function loadSnapshot(): Promise<DbSnapshot | null> {
  const s = sql();
  if (!s) return null;
  try {
    await ensureSchema();
    // The neon tagged template's return type is a config-dependent union;
    // with default config it is always an array of row objects — pin it.
    const [founders, assessments, decks, resumes, traces, validations, outcomes, thesis] =
      (await Promise.all([
        s`SELECT data FROM founders`,
        s`SELECT data FROM assessments`,
        s`SELECT founder_id, data FROM deck_summaries`,
        s`SELECT founder_id, data FROM resume_summaries`,
        s`SELECT data FROM traces`,
        s`SELECT founder_id, data FROM validations`,
        s`SELECT data FROM outcome_events ORDER BY id`,
        s`SELECT data FROM thesis WHERE id = 1`,
      ])) as Record<string, unknown>[][];
    return {
      founders: founders.map((r) => r.data as Founder),
      assessments: assessments.map((r) => r.data as Assessment),
      deckSummaries: decks.map((r) => ({ founderId: r.founder_id as string, data: r.data as DeckSummary })),
      resumeSummaries: resumes.map((r) => ({ founderId: r.founder_id as string, data: r.data as ResumeSummary })),
      traces: traces.map((r) => r.data as TraceReport),
      validations: validations.map((r) => ({ founderId: r.founder_id as string, data: r.data })),
      outcomeEvents: outcomes.map((r) => r.data as OutcomeEvent),
      thesis: (thesis[0]?.data as ThesisConfig) ?? null,
    };
  } catch (err) {
    console.warn("db: snapshot load failed — memory-only this request:", err);
    return null;
  }
}

// ---------- write-through mirrors (each fail-soft, each awaited via flush) ----------

const guard = async (label: string, fn: () => Promise<unknown>): Promise<void> => {
  const s = sql();
  if (!s) return;
  try {
    await ensureSchema();
    await fn();
  } catch (err) {
    console.warn(`db: ${label} write failed (memory retains the value):`, err);
  }
};

export const dbUpsertFounder = (f: Founder) =>
  guard("founder", async () => {
    await sql()!`INSERT INTO founders (id, data) VALUES (${f.id}, ${JSON.stringify(f)}::jsonb)
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`;
  });

export const dbSaveAssessment = (a: Assessment) =>
  guard("assessment", async () => {
    await sql()!`INSERT INTO assessments (founder_id, data) VALUES (${a.founderId}, ${JSON.stringify(a)}::jsonb)
      ON CONFLICT (founder_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`;
  });

export const dbDeleteAssessment = (founderId: string) =>
  guard("assessment-delete", async () => {
    await sql()!`DELETE FROM assessments WHERE founder_id = ${founderId}`;
  });

export const dbSaveDeckSummary = (founderId: string, d: DeckSummary) =>
  guard("deck-summary", async () => {
    await sql()!`INSERT INTO deck_summaries (founder_id, data) VALUES (${founderId}, ${JSON.stringify(d)}::jsonb)
      ON CONFLICT (founder_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`;
  });

export const dbSaveResumeSummary = (founderId: string, r: ResumeSummary) =>
  guard("resume-summary", async () => {
    await sql()!`INSERT INTO resume_summaries (founder_id, data) VALUES (${founderId}, ${JSON.stringify(r)}::jsonb)
      ON CONFLICT (founder_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`;
  });

export const dbSaveTrace = (t: TraceReport) =>
  guard("trace", async () => {
    await sql()!`INSERT INTO traces (founder_id, data) VALUES (${t.founderId}, ${JSON.stringify(t)}::jsonb)
      ON CONFLICT (founder_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`;
  });

export const dbSaveValidation = (founderId: string, report: unknown) =>
  guard("validation", async () => {
    await sql()!`INSERT INTO validations (founder_id, data) VALUES (${founderId}, ${JSON.stringify(report)}::jsonb)
      ON CONFLICT (founder_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`;
  });

export const dbAppendOutcome = (e: OutcomeEvent) =>
  guard("outcome", async () => {
    await sql()!`INSERT INTO outcome_events (data) VALUES (${JSON.stringify(e)}::jsonb)`;
  });

export const dbSaveThesis = (t: ThesisConfig) =>
  guard("thesis", async () => {
    await sql()!`INSERT INTO thesis (id, data) VALUES (1, ${JSON.stringify(t)}::jsonb)
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`;
  });

// ---------- documents: Blob when configured, inline base64 otherwise ----------

export const dbSaveDocument = (founderId: string, type: DocumentType, doc: StoredDocument) =>
  guard("document", async () => {
    let blobUrl: string | null = null;
    let inline: string | null = doc.data;
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const { put } = await import("@vercel/blob");
        // Private store: decks and resumes are founder-sensitive; bytes are
        // only ever served through our own /api/document route.
        const stored = await put(
          `documents/${founderId}/${type}/${doc.filename}`,
          Buffer.from(doc.data, "base64"),
          { access: "private", contentType: doc.contentType, allowOverwrite: true }
        );
        blobUrl = stored.url;
        inline = null; // blob holds the bytes; the row holds the pointer
      } catch (err) {
        console.warn("db: blob upload failed — storing inline base64:", err);
      }
    }
    await sql()!`INSERT INTO documents (founder_id, type, filename, content_type, blob_url, data_base64)
      VALUES (${founderId}, ${type}, ${doc.filename}, ${doc.contentType}, ${blobUrl}, ${inline})
      ON CONFLICT (founder_id, type) DO UPDATE SET filename = EXCLUDED.filename,
        content_type = EXCLUDED.content_type, blob_url = EXCLUDED.blob_url,
        data_base64 = EXCLUDED.data_base64, updated_at = now()`;
  });

export async function dbFetchDocument(
  founderId: string,
  type: DocumentType
): Promise<StoredDocument | null> {
  const s = sql();
  if (!s) return null;
  try {
    await ensureSchema();
    const rows = (await s`SELECT filename, content_type, blob_url, data_base64 FROM documents
        WHERE founder_id = ${founderId} AND type = ${type}`) as Record<string, unknown>[];
    const row = rows[0];
    if (!row) return null;
    if (row.data_base64) {
      return {
        filename: row.filename as string,
        contentType: row.content_type as string,
        data: row.data_base64 as string,
      };
    }
    if (row.blob_url) {
      // Private store: authenticated SDK read, never a bare URL fetch.
      const { get } = await import("@vercel/blob");
      const result = await get(row.blob_url as string, { access: "private" });
      if (!result?.stream) return null;
      const chunks: Uint8Array[] = [];
      const reader = result.stream.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
      return {
        filename: row.filename as string,
        contentType: row.content_type as string,
        data: Buffer.concat(chunks).toString("base64"),
      };
    }
    return null;
  } catch (err) {
    console.warn("db: document fetch failed:", err);
    return null;
  }
}
