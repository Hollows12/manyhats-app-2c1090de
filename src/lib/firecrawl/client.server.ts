// Server-only Firecrawl v2 REST client.
// Loaded inside server function/route handlers only.

const BASE = "https://api.firecrawl.dev/v2";

function key() {
  const k = process.env.FIRECRAWL_API_KEY;
  if (!k) throw new Error("FIRECRAWL_API_KEY not configured");
  return k;
}

async function call<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  if (!res.ok) {
    const msg = json?.error || json?.message || res.statusText;
    throw new Error(`Firecrawl ${path} ${res.status}: ${msg}`);
  }
  return json as T;
}

export type FirecrawlScrape = {
  success: boolean;
  data?: {
    markdown?: string;
    html?: string;
    links?: string[];
    summary?: string;
    metadata?: { title?: string; description?: string; sourceURL?: string; statusCode?: number };
    json?: any;
  };
  // Some responses also include fields at top level; normalize on read.
  markdown?: string;
  metadata?: any;
  summary?: string;
  json?: any;
};

export type FirecrawlSearchResultItem = {
  url: string;
  title?: string;
  description?: string;
  markdown?: string;
};
export type FirecrawlSearch = {
  success: boolean;
  data?: FirecrawlSearchResultItem[] | { web?: FirecrawlSearchResultItem[] };
};

export function firecrawlScrape(url: string, opts?: {
  formats?: (string | { type: "json"; schema?: unknown; prompt?: string })[];
  onlyMainContent?: boolean;
  waitFor?: number;
}) {
  return call<FirecrawlScrape>("/scrape", {
    url,
    formats: opts?.formats ?? ["markdown"],
    onlyMainContent: opts?.onlyMainContent ?? true,
    waitFor: opts?.waitFor,
  });
}

export function firecrawlSearch(query: string, opts?: {
  limit?: number;
  lang?: string;
  country?: string;
  scrapeOptions?: { formats?: string[] };
}) {
  return call<FirecrawlSearch>("/search", {
    query,
    limit: opts?.limit ?? 10,
    lang: opts?.lang,
    country: opts?.country ?? "us",
    scrapeOptions: opts?.scrapeOptions,
  });
}

export function normalizeSearchResults(r: FirecrawlSearch): FirecrawlSearchResultItem[] {
  if (!r.data) return [];
  if (Array.isArray(r.data)) return r.data;
  return r.data.web ?? [];
}
