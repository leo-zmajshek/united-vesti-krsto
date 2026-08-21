/* Server-only live lookup helpers used by the chat assistant.

   These deliberately avoid scraping search-engine HTML. The previous version
   scraped html.duckduckgo.com, which now answers 202 with a JavaScript
   challenge — the `result__a` class it looked for is gone, so every call
   returned an empty array and the assistant was left answering from memory.
   Both that endpoint and lite.duckduckgo.com were re-tested and are dead.

   Everything below is either a documented JSON API or an RSS feed, so it fails
   loudly rather than silently returning nothing. */

function stripTags(s: string) {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decode(s: string) {
  return s
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

const UA =
  "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36";

async function text(url: string, timeoutMs = 12_000) {
  const res = await fetch(url, {
    headers: {
      "user-agent": UA,
      accept: "text/html,application/xhtml+xml,application/xml,application/json",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.text();
}

async function json<T>(url: string, timeoutMs = 12_000): Promise<T> {
  return JSON.parse(await text(url, timeoutMs)) as T;
}

/** Recent news headlines about a topic (Google News RSS). */
export async function searchNews(query: string, limit = 8) {
  const xml = await text(
    `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-GB&gl=GB&ceid=GB:en`,
  );
  return xml
    .split("<item>")
    .slice(1, limit + 1)
    .map((item) => {
      const pick = (tag: string) => {
        const m = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
        return m ? decode(stripTags(m[1]!.replace(/<!\[CDATA\[|\]\]>/g, ""))) : "";
      };
      return {
        title: pick("title"),
        source: pick("source"),
        date: pick("pubDate"),
        link: pick("link"),
      };
    })
    .filter((n) => n.title);
}

/** Wikipedia intro for the best matching page. REST summary first — it is short
    and already plain text — with the action API as a fallback. */
export async function wikiLookup(query: string) {
  const searchJson = await json<{ query?: { search?: { title?: string }[] } }>(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srlimit=1&format=json&srsearch=${encodeURIComponent(query)}`,
  );
  const title = searchJson.query?.search?.[0]?.title;
  if (!title) return null;

  try {
    const summary = await json<{ extract?: string }>(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`,
    );
    if (summary.extract) return { title, extract: summary.extract.slice(0, 1800) };
  } catch {
    /* fall through to the action API */
  }

  const extractJson = await json<{ query?: { pages?: Record<string, { extract?: string }> } }>(
    `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&redirects=1&format=json&titles=${encodeURIComponent(title)}`,
  );
  const page = Object.values(extractJson.query?.pages ?? {})[0];
  const extract = (page?.extract ?? "").slice(0, 1800);
  return extract ? { title, extract } : null;
}

/** Encyclopedic multi-result lookup. Wikipedia's search API returns a snippet
    per hit, which gives several independent passages instead of one page. */
export async function searchWeb(query: string, limit = 5) {
  const data = await json<{ query?: { search?: { title?: string; snippet?: string }[] } }>(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srlimit=${limit}&format=json&srsearch=${encodeURIComponent(query)}`,
  );
  return (data.query?.search ?? [])
    .map((r) => ({ title: r.title ?? "", snippet: decode(stripTags(r.snippet ?? "")) }))
    .filter((r) => r.title);
}

/** Best-effort combined live lookup: never throws.
    Reading the linked article body was tried and dropped — Google News serves
    redirect URLs and the r.jina.ai reader refuses news.google.com outright, so it
    was a guaranteed empty string plus a 15s timeout on every question. The
    headlines carry injury and selection news well enough on their own. */
export async function liveLookup(query: string) {
  const [news, wiki, web] = await Promise.all([
    searchNews(query, 6).catch(() => []),
    wikiLookup(query).catch(() => null),
    searchWeb(query, 4).catch(() => []),
  ]);
  return { query, news, wiki, web };
}
