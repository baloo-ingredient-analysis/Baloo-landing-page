// Thin wrapper over Firecrawl's /v2/scrape REST endpoint.
// Using REST directly avoids tying the build to a specific Firecrawl SDK version.
// Returns clean markdown of the fully-rendered page, or null on failure.

export async function scrapeMarkdown(url: string): Promise<string | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
    });

    if (!res.ok) {
      console.error("Firecrawl scrape failed:", res.status, await res.text());
      return null;
    }

    const data = await res.json();
    // v2 returns { success, data: { markdown, ... } }; be tolerant of shape changes.
    const markdown: string | undefined = data?.data?.markdown ?? data?.markdown;
    return markdown && markdown.trim().length > 0 ? markdown : null;
  } catch (err) {
    console.error("Firecrawl scrape error:", err);
    return null;
  }
}

// Web search via Firecrawl's /v2/search — turns a product name into candidate page URLs, so the
// mobile app can find a niche product by NAME (not just a direct link). Returns ordered URLs, best
// first, or [] on failure/no-key. Shape-tolerant like scrapeMarkdown (v2: data.web[], older: data[]).
export async function searchWeb(query: string, limit = 5): Promise<string[]> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey || !query.trim()) return [];

  try {
    const res = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, limit }),
    });

    if (!res.ok) {
      console.error("Firecrawl search failed:", res.status, await res.text());
      return [];
    }

    const data = await res.json();
    const arr: unknown[] = data?.data?.web ?? data?.data ?? data?.web ?? [];
    return arr
      .map((x) => (x && typeof x === "object" ? (x as { url?: string }).url : undefined))
      .filter((u): u is string => typeof u === "string" && u.length > 0)
      .slice(0, limit);
  } catch (err) {
    console.error("Firecrawl search error:", err);
    return [];
  }
}
