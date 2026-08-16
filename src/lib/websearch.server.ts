/* Server-only live web lookup helpers used by the chat assistant. */

function stripTags(s: string) {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
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

async function text(url: string, timeoutMs = 12_000) {
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36",
      accept: "text/html,application/xhtml+xml,application/xml,application/json",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.text();
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
      return { title: pick("title"), source: pick("source"), date: pick("pubDate") };
    })
    .filter((n) => n.title);
}

/** Wikipedia intro extract for the best matching page. */
export async function wikiLookup(query: string) {
  const searchJson = JSON.parse(
    await text(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srlimit=1&format=json&srsearch=${encodeURIComponent(query)}`,
    ),
  ) as { query?: { search?: { title?: string }[] } };
  const title = searchJson.query?.search?.[0]?.title;
  if (!title) return null;
  const extractJson = JSON.parse(
    await text(
      `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&redirects=1&format=json&titles=${encodeURIComponent(title)}`,
    ),
  ) as { query?: { pages?: Record<string, { extract?: string }> } };
  const page = Object.values(extractJson.query?.pages ?? {})[0];
  const extract = (page?.extract ?? "").slice(0, 1800);
  return extract ? { title, extract } : null;
}

/** General web search (DuckDuckGo HTML endpoint). */
export async function searchWeb(query: string, limit = 6) {
  const html = await text(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
  const results: { title: string; snippet: string }[] = [];
  const re = /<a[^>]*class="result__a"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && results.length < limit) {
    results.push({ title: decode(stripTags(m[1]!)), snippet: decode(stripTags(m[2]!)) });
  }
  return results;
}

/** Best-effort combined live lookup: never throws. */
export async function liveLookup(query: string) {
  const [news, wiki, web] = await Promise.all([
    searchNews(query).catch(() => []),
    wikiLookup(query).catch(() => null),
    searchWeb(query).catch(() => []),
  ]);
  return { query, news, wiki, web };
}
