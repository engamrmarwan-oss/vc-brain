import type { Assessment, Founder } from "@/lib/types";

export type DeckSummary = {
  snapshot: string;
  claims: string[];
  market: string;
  tractionSignals: string[];
  statedMetrics: string[];
};

export type ResumeSummary = {
  headline: string;
  roles: string[];
  education: string[];
  backgroundClaims: string[];
};

export type ApplicationDocuments = {
  deck?: string;
  resume?: string;
};

export type StoredApplication = {
  founder: Founder;
  assessment?: Assessment;
  deckSummary?: DeckSummary;
  resumeSummary?: ResumeSummary;
  documents?: ApplicationDocuments;
  submittedAt: string;
  status: "local-pending" | "scored";
};

export const APPLICATIONS_STORAGE_KEY = "vc-brain.founder-applications.v1";
export const APPLICATIONS_CHANGED_EVENT = "vc-brain:applications-changed";
export const EMPTY_APPLICATIONS_SNAPSHOT = "[]";

export function getApplicationsSnapshot(): string {
  if (typeof window === "undefined") return EMPTY_APPLICATIONS_SNAPSHOT;
  return localStorage.getItem(APPLICATIONS_STORAGE_KEY) ?? EMPTY_APPLICATIONS_SNAPSHOT;
}

export function subscribeToApplications(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;

  const onStorage = (event: StorageEvent) => {
    if (event.key === APPLICATIONS_STORAGE_KEY) onChange();
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(APPLICATIONS_CHANGED_EVENT, onChange);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(APPLICATIONS_CHANGED_EVENT, onChange);
  };
}

export function parseApplicationsSnapshot(snapshot: string): StoredApplication[] {
  try {
    const parsed = JSON.parse(snapshot) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isStoredApplication);
  } catch {
    return [];
  }
}

export function saveApplication(application: StoredApplication): void {
  const current = parseApplicationsSnapshot(getApplicationsSnapshot());
  const withoutDuplicate = current.filter(
    (item) => item.founder.id !== application.founder.id,
  );
  const next = [application, ...withoutDuplicate].slice(0, 12);

  localStorage.setItem(APPLICATIONS_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(APPLICATIONS_CHANGED_EVENT));
}

export function deckSummaryFromUnknown(value: unknown): DeckSummary | undefined {
  if (!value || typeof value !== "object") return undefined;
  const summary = value as Partial<DeckSummary>;

  if (
    typeof summary.snapshot !== "string" ||
    typeof summary.market !== "string" ||
    !isStringArray(summary.claims) ||
    !isStringArray(summary.tractionSignals) ||
    !isStringArray(summary.statedMetrics)
  ) {
    return undefined;
  }

  return summary as DeckSummary;
}

export function resumeSummaryFromUnknown(value: unknown): ResumeSummary | undefined {
  if (!value || typeof value !== "object") return undefined;
  const summary = value as Partial<ResumeSummary>;

  if (
    typeof summary.headline !== "string" ||
    !isStringArray(summary.roles) ||
    !isStringArray(summary.education) ||
    !isStringArray(summary.backgroundClaims)
  ) {
    return undefined;
  }

  return summary as ResumeSummary;
}

function isApplicationDocuments(value: unknown): value is ApplicationDocuments {
  if (!value || typeof value !== "object") return false;
  const documents = value as ApplicationDocuments;
  return (
    (documents.deck === undefined || typeof documents.deck === "string") &&
    (documents.resume === undefined || typeof documents.resume === "string")
  );
}

function isStoredApplication(value: unknown): value is StoredApplication {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<StoredApplication>;
  const founder = item.founder as Partial<Founder> | undefined;

  return Boolean(
    founder &&
      typeof founder.id === "string" &&
      typeof founder.name === "string" &&
      typeof founder.company === "string" &&
      typeof founder.founderScore === "number" &&
      (item.deckSummary === undefined ||
        deckSummaryFromUnknown(item.deckSummary) !== undefined) &&
      (item.resumeSummary === undefined ||
        resumeSummaryFromUnknown(item.resumeSummary) !== undefined) &&
      (item.documents === undefined || isApplicationDocuments(item.documents)) &&
      (item.status === "local-pending" || item.status === "scored") &&
      typeof item.submittedAt === "string",
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
