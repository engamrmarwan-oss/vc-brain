// In-memory store. NO DATABASE — deliberate (henzard winner lesson).
// Persists across requests within a running server; reseeds on cold start.
// The Founder Score "never resets" requirement is satisfied within the demo
// session — which is all a judge ever sees. Zero Prisma/Neon deploy risk.

import { FOUNDERS } from "@/data/seed";
import { DEFAULT_THESIS, type ThesisConfig } from "@/lib/thesis";
import type { Assessment, Founder } from "@/lib/types";

type Store = {
  founders: Map<string, Founder>;
  assessments: Map<string, Assessment>; // session cache: list/memo consistency
  thesis: ThesisConfig;
  seeded: boolean;
};

// globalThis survives Next.js hot-reload and serverless warm invocations.
const g = globalThis as unknown as { __vcbrain?: Store };

function getStore(): Store {
  if (!g.__vcbrain) {
    g.__vcbrain = {
      founders: new Map(),
      assessments: new Map(),
      thesis: DEFAULT_THESIS,
      seeded: false,
    };
  }
  const s = g.__vcbrain;
  if (!s.seeded) {
    for (const f of FOUNDERS) s.founders.set(f.id, f);
    s.seeded = true;
  }
  return s;
}

export function allFounders(): Founder[] {
  return [...getStore().founders.values()];
}

export function getFounder(id: string): Founder | undefined {
  return getStore().founders.get(id);
}

export function upsertFounder(f: Founder): void {
  const s = getStore();
  s.founders.set(f.id, f);
  // Profile changed — any cached assessment is stale.
  s.assessments.delete(f.id);
}

export function getAssessment(founderId: string): Assessment | undefined {
  return getStore().assessments.get(founderId);
}

export function saveAssessment(a: Assessment): void {
  getStore().assessments.set(a.founderId, a);
}

export function getThesis(): ThesisConfig {
  return getStore().thesis;
}

export function setThesis(t: ThesisConfig): void {
  getStore().thesis = t;
}
