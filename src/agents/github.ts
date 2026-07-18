// Live GitHub ingestion. Feeds real repo signals into the scoring engine.
// FAIL-SOFT BY CONTRACT: this module never throws. Any parse error, 404,
// rate-limit, timeout, or network failure returns null, and the caller falls
// back to cached signals. A GitHub outage must never break a score.

export interface GitHubSignals {
  stars: number;
  forks: number;
  lastCommitDaysAgo: number | null; // null if no commits found
  openIssues: number;
  primaryLanguage: string | null;
}

// 3s cap per request — a slow GitHub API can't blow the <60s decision claim.
const TIMEOUT_MS = 3000;

function parseOwnerRepo(url: string): { owner: string; repo: string } | null {
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    if (!/(^|\.)github\.com$/i.test(u.hostname)) return null;
    const [owner, repo] = u.pathname.split("/").filter(Boolean);
    if (!owner || !repo) return null; // org/user URL without a repo
    return { owner, repo: repo.replace(/\.git$/i, "") };
  } catch {
    return null;
  }
}

function ghFetch(path: string): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "vc-brain",
  };
  // Optional: 5000 req/hr with a token, 60/hr without. Works either way.
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return fetch(`https://api.github.com${path}`, {
    headers,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
}

export async function fetchGitHubSignals(url: string): Promise<GitHubSignals | null> {
  const parsed = parseOwnerRepo(url);
  if (!parsed) return null;
  const base = `/repos/${parsed.owner}/${parsed.repo}`;
  try {
    const [repoRes, commitsRes] = await Promise.all([
      ghFetch(base),
      ghFetch(`${base}/commits?per_page=1`),
    ]);
    if (!repoRes.ok) return null; // 404 / 403 rate-limit / 5xx — fail soft

    const repo = await repoRes.json();

    let lastCommitDaysAgo: number | null = null;
    if (commitsRes.ok) {
      const commits = await commitsRes.json();
      const iso: string | undefined =
        commits?.[0]?.commit?.committer?.date ?? commits?.[0]?.commit?.author?.date;
      if (iso) {
        lastCommitDaysAgo = Math.max(
          0,
          Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
        );
      }
    }

    return {
      stars: repo.stargazers_count ?? 0,
      forks: repo.forks_count ?? 0,
      lastCommitDaysAgo,
      openIssues: repo.open_issues_count ?? 0,
      primaryLanguage: repo.language ?? null,
    };
  } catch {
    return null; // timeout / DNS / network — fail soft
  }
}
