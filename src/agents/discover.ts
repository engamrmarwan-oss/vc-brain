// Outbound founder discovery: live GitHub repo search -> owners as
// candidate founders -> scored by the same engine as everyone else.
// This is the "scraped, never applied" side of the pipeline.
// FAIL-SOFT BY CONTRACT: search failure, rate-limit, or timeout returns
// { candidates: [], note } — never throws, never breaks the pipeline.

import { fetchGitHubUser, ghFetch } from "@/agents/github";
import { scoreFounder } from "@/agents/score";
import { saveAssessment, upsertFounder } from "@/lib/store";
import type { Assessment, Founder } from "@/lib/types";

export interface DiscoverFilters {
  topics?: string[];
  language?: string;
  minStars?: number;
  pushedAfter?: string; // YYYY-MM-DD
  geo?: string;         // best-effort: plain search keyword, repos have no owner-location filter
}

export interface DiscoveredCandidate {
  founder: Founder;
  assessment: Assessment;
  repo: { fullName: string; stars: number; description: string | null; url: string };
}

export interface DiscoverResult {
  candidates: DiscoveredCandidate[];
  query: string;
  note?: string;
}

// Cap: each candidate costs GitHub calls + one LLM scoring pass. Five keeps
// discovery inside the demo's latency budget and far from rate limits.
const MAX_CANDIDATES = 5;

const clampInt = (v: unknown, lo: number, hi: number): number | undefined =>
  typeof v === "number" && Number.isFinite(v)
    ? Math.min(hi, Math.max(lo, Math.round(v)))
    : undefined;

export function normalizeFilters(input: unknown): DiscoverFilters {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const topics = (Array.isArray(raw.topics) ? raw.topics : typeof raw.topics === "string" ? [raw.topics] : [])
    .filter((t): t is string => typeof t === "string" && !!t.trim())
    .map((t) => t.trim().toLowerCase().replace(/\s+/g, "-"))
    .slice(0, 3);
  return {
    topics,
    language: typeof raw.language === "string" && raw.language.trim() ? raw.language.trim() : undefined,
    minStars: clampInt(raw.minStars, 0, 100_000),
    pushedAfter:
      typeof raw.pushedAfter === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.pushedAfter)
        ? raw.pushedAfter
        : undefined,
    geo: typeof raw.geo === "string" && raw.geo.trim() ? raw.geo.trim() : undefined,
  };
}

export function buildQuery(f: DiscoverFilters): string {
  const parts: string[] = [];
  for (const t of f.topics ?? []) parts.push(`topic:${t}`);
  if (f.language) parts.push(`language:${f.language}`);
  parts.push(`stars:>${f.minStars ?? 50}`); // floor keeps out empty toy repos
  if (f.pushedAfter) parts.push(`pushed:>${f.pushedAfter}`);
  if (f.geo) parts.push(f.geo); // plain keyword, best effort
  return parts.join(" ");
}

interface SearchRepo {
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  owner: { login: string; type: string };
  topics?: string[];
}

async function searchRepositories(query: string): Promise<SearchRepo[] | null> {
  try {
    const res = await ghFetch(
      `/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=15`
    );
    if (!res.ok) return null; // 403 rate-limit, 422 bad query, 5xx — fail soft
    const data = await res.json();
    return Array.isArray(data?.items) ? (data.items as SearchRepo[]) : null;
  } catch {
    return null; // timeout / network — fail soft
  }
}

// Repo quality nudges the memory score a little; the confidence band stays
// WIDE (0.5) — a starred repo is evidence of engineering, not of a company.
function memoryScore(stars: number): number {
  return Math.min(80, 50 + Math.round(Math.log10(Math.max(stars, 1)) * 8));
}

export async function discoverFounders(input: unknown): Promise<DiscoverResult> {
  const filters = normalizeFilters(input);
  const query = buildQuery(filters);

  const repos = await searchRepositories(query);
  if (repos === null) {
    return {
      candidates: [],
      query,
      note: "GitHub search unavailable (rate-limit, network, or bad query) — no candidates this run; existing pipeline untouched.",
    };
  }
  if (repos.length === 0) {
    return { candidates: [], query, note: "GitHub search returned no repositories for these filters." };
  }

  // One candidate per owner, capped.
  const seen = new Set<string>();
  const picks: SearchRepo[] = [];
  for (const r of repos) {
    if (!r?.owner?.login || seen.has(r.owner.login)) continue;
    seen.add(r.owner.login);
    picks.push(r);
    if (picks.length >= MAX_CANDIDATES) break;
  }

  const candidates = await Promise.all(
    picks.map(async (repo): Promise<DiscoveredCandidate> => {
      const login = repo.owner.login;
      const profile = await fetchGitHubUser(login); // null -> login-only fallback
      const founder: Founder = {
        id: `gh-${login.toLowerCase()}`,
        name: profile?.name ?? login,
        company: repo.full_name.split("/")[1] ?? repo.full_name,
        sector: filters.topics?.length ? filters.topics.join(" / ") : "open source",
        geo: profile?.location ?? "unknown",
        entry: "outbound",
        founderScore: memoryScore(repo.stargazers_count),
        founderScoreConfidence: 0.5, // wide band: repo-only evidence
        deckClaims: [], // scraped, never applied — thin-evidence scoring path
        githubUrl: `https://github.com/${repo.full_name}`,
        publicFootprint: [
          `GitHub profile: ${login}${profile?.bio ? ` — ${profile.bio}` : ""}${profile?.company ? ` (${profile.company})` : ""}`,
          ...(repo.description ? [`Repo ${repo.full_name}: ${repo.description}`] : []),
        ],
      };
      upsertFounder(founder);
      const assessment = await scoreFounder(founder); // never throws
      saveAssessment(assessment);
      return {
        founder,
        assessment,
        repo: {
          fullName: repo.full_name,
          stars: repo.stargazers_count,
          description: repo.description,
          url: repo.html_url,
        },
      };
    })
  );

  return { candidates, query };
}
