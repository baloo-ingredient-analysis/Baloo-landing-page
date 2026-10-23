// Thin wrapper over Firecrawl's /v2/scrape REST endpoint.
// Using REST directly avoids tying the build to a specific Firecrawl SDK version.
// Returns clean markdown of the fully-rendered page, or null on failure.

// Fail-fast cap (Luna's feedback): a page that can't be read should give up in ~30s, not hang toward
// the route's 60s ceiling and make someone wait a minute for a "no". Passed to Firecrawl as its own
// budget AND enforced client-side with an AbortController in case the HTTP call itself stalls. Set
// above the ~10-20s a slow-but-valid product page can legitimately take, so we don't cut real scrapes.
const SCRAPE_TIMEOUT_MS = 30_000;

export type ScrapedPage = {
  markdown: string;
  // The product packshot lifted from the SAME scrape (og:image / page metadata) — free, no extra
  // request. Best-effort: null when the page exposes no usable image. Threaded into products.image_url
  // so a share-card hero can later be generated from it (see docs/SHARE_CARDS.md).
  imageUrl: string | null;
};

// Pick a usable image URL out of Firecrawl's page metadata (keys vary across v2; be tolerant).
function pickImage(meta: unknown): string | null {
  if (!meta || typeof meta !== "object") return null;
  const m = meta as Record<string, unknown>;
  const candidates = [m.ogImage, m["og:image"], m.image, m.twitterImage, m["twitter:image"]];
  for (const c of candidates) {
    if (typeof c === "string" && /^https?:\/\//.test(c)) return c;
    if (Array.isArray(c)) {
      const first = c.find((x) => typeof x === "string" && /^https?:\/\//.test(x));
      if (typeof first === "string") return first;
    }
  }
  return null;
}

export async function scrapePage(url: string): Promise<ScrapedPage | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const abort = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS + 2_000);
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
        timeout: SCRAPE_TIMEOUT_MS,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.error("Firecrawl scrape failed:", res.status, await res.text());
      return null;
    }

    const data = await res.json();
    // v2 returns { success, data: { markdown, metadata, ... } }; be tolerant of shape changes.
    const d = data?.data ?? data;
    const markdown: string | undefined = d?.markdown;
    if (!markdown || markdown.trim().length === 0) return null;
    return { markdown, imageUrl: pickImage(d?.metadata) };
  } catch (err) {
    // AbortError (our timeout) lands here too — treated like any other scrape failure.
    console.error("Firecrawl scrape error:", err);
    return null;
  } finally {
    clearTimeout(abort);
  }
}

// Web search via Firecrawl's /v2/search — turns a product name into candidate page URLs, so the
// mobile app can find a niche product by NAME (not just a direct link). Returns ordered URLs, best
// first, or [] on failure/no-key. Shape-tolerant like scrapePage (v2: data.web[], older: data[]).
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
