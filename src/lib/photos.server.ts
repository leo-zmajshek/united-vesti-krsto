/* Player headshots for the squad page.

   Faces are easier to tell apart than names, which is the whole point for Krsto.
   Neither football provider supplies usable photos: football-data has none, and
   ESPN's soccer headshots exist for only 2 of 30 players (verified against both
   the roster payload and the a.espncdn.com CDN pattern).

   Wikipedia covers 26 of 30. It is fetched with ONE batched request for the
   whole squad rather than one per player — Cloudflare Workers cap outbound
   subrequests, and 30 extra calls per cold start would risk that ceiling. */

const WIKI_API = "https://en.wikipedia.org/w/api.php";

/* Wikipedia's API policy asks for a descriptive User-Agent. Without one the
   endpoint throttles bursts hard — that alone looked like a 13/30 coverage rate
   before it was added. */
const UA =
  "DedoUnitedApp/1.0 (Macedonian Manchester United reader; contact: leonardo@easeaccess24.com)";

type WikiPage = {
  title?: string;
  description?: string;
  thumbnail?: { source?: string };
};

type WikiResponse = {
  query?: {
    pages?: Record<string, WikiPage>;
    normalized?: { from?: string; to?: string }[];
    redirects?: { from?: string; to?: string }[];
  };
};

/* Wikipedia thumbnail URLs carry the rendered width, so asking for a smaller one
   is a URL rewrite. 120px keeps the whole squad around 185 KB instead of 900 KB
   on a phone. Only certain widths are pre-rendered — 120 is, 160 is not. */
function smallThumb(url: string): string {
  return url.split("?")[0]!.replace(/\/\d+px-/, "/120px-");
}

/** A page is only accepted as a player photo if Wikipedia describes it as a
    footballer. Without this guard a disambiguation page ("Topics referred to by
    the same term") or an unrelated namesake can supply a photo of the wrong
    person, which is worse than showing no photo at all. */
function isFootballer(page: WikiPage): boolean {
  return (page.description ?? "").toLowerCase().includes("football");
}

async function fetchPages(titles: string[]): Promise<{
  pages: WikiPage[];
  aliasOf: Map<string, string>;
}> {
  const params = new URLSearchParams({
    action: "query",
    prop: "pageimages|description",
    pithumbsize: "120",
    format: "json",
    redirects: "1",
    origin: "*",
    titles: titles.join("|"),
  });
  const res = await fetch(`${WIKI_API}?${params.toString()}`, {
    headers: { "user-agent": UA, accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`wikipedia ${res.status}`);
  const body = (await res.json()) as WikiResponse;

  // Wikipedia may answer under a different title than the one asked for
  // ("Benjamin Sesko" resolves to "Benjamin Šeško"), so follow the
  // normalisation and redirect chains back to the name we asked about.
  const aliasOf = new Map<string, string>();
  for (const step of [...(body.query?.normalized ?? []), ...(body.query?.redirects ?? [])]) {
    if (step.from && step.to) aliasOf.set(step.to, step.from);
  }
  return { pages: Object.values(body.query?.pages ?? {}), aliasOf };
}

/**
 * Map player name -> small headshot URL. Never throws: a missing photo just
 * means the squad row keeps its shirt-number circle.
 */
export async function loadPlayerPhotos(names: string[]): Promise<Record<string, string>> {
  const photos: Record<string, string> = {};
  if (names.length === 0) return photos;

  const resolve = (title: string, aliasOf: Map<string, string>): string => {
    // Walk back through any redirect chain to the originally requested name.
    let current = title;
    for (let i = 0; i < 4; i++) {
      const previous = aliasOf.get(current);
      if (!previous) break;
      current = previous;
    }
    return current;
  };

  try {
    // The API accepts up to 50 titles per call, so one request covers a squad.
    const { pages, aliasOf } = await fetchPages(names.slice(0, 50));
    for (const page of pages) {
      const thumb = page.thumbnail?.source;
      if (!thumb || !page.title || !isFootballer(page)) continue;
      const requested = resolve(page.title, aliasOf);
      const key = names.includes(requested) ? requested : page.title;
      photos[key] = smallThumb(thumb);
    }
  } catch (error) {
    console.error("[manutd] player photos failed", error);
    return photos;
  }

  // Names that landed on a disambiguation page usually have a "(footballer)"
  // article. One extra request covers all of them.
  const missing = names.filter((n) => !photos[n]);
  if (missing.length > 0) {
    try {
      const disambiguated = missing.map((n) => `${n} (footballer)`);
      const { pages } = await fetchPages(disambiguated.slice(0, 50));
      for (const page of pages) {
        const thumb = page.thumbnail?.source;
        if (!thumb || !page.title || !isFootballer(page)) continue;
        const base = page.title.replace(/\s*\(footballer\)\s*$/i, "");
        const match = missing.find((n) => n === base);
        if (match) photos[match] = smallThumb(thumb);
      }
    } catch {
      /* the first pass already gave us most of them */
    }
  }

  return photos;
}
