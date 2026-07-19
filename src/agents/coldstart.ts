// Cold-start diligence: public-footprint search for founders with no GitHub,
// no funding history, no deck. Uses Tavily web search.
// FAIL-SOFT BY CONTRACT (same as github.ts): this module never throws. A
// missing key, timeout, rate-limit, or bad response returns null and the
// caller falls back to seeded footprint signals. Tavily being down must
// never break a score.

export interface FootprintSignal {
  source: string; // hostname, e.g. "x.com", "medium.com"
  snippet: string;
  url: string;
}

// 3s cap — footprint search sits inside the <60s decision window.
const TIMEOUT_MS = 3000;

function safeHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "web";
  }
}

// Generic Tavily search, same fail-soft contract — also used by the
// validator agent for independent cross-checks.
export async function tavilySearch(query: string): Promise<FootprintSignal[] | null> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Bearer is the current auth scheme; api_key in body covers older API.
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        api_key: key,
        query,
        search_depth: "basic",
        max_results: 5,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return null; // 401 / 429 / 5xx — fail soft

    const data = await res.json();
    const results: unknown[] = Array.isArray(data?.results) ? data.results : [];
    return results
      .filter(
        (r): r is { content: string; url: string } =>
          typeof (r as { content?: unknown })?.content === "string" &&
          !!(r as { content?: string }).content &&
          typeof (r as { url?: unknown })?.url === "string"
      )
      .map((r) => ({
        source: safeHost(r.url),
        snippet: r.content.slice(0, 300),
        url: r.url,
      }));
  } catch {
    return null; // timeout / DNS / network — fail soft
  }
}

export async function fetchFootprint(
  name: string,
  context: string
): Promise<FootprintSignal[] | null> {
  return tavilySearch(`"${name}" ${context}`);
}
