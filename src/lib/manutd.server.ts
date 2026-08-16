/* Server-only helpers: football data (TheSportsDB free tier) + AI translation. */

const TEAM_ID = "133612";
const TEAM_NAMES = ["manchester united", "man united", "man utd"];
const PL_LEAGUE = "4328";
const SDB = "https://www.thesportsdb.com/api/v1/json/3";
const ESPN = "https://site.api.espn.com/apis/site/v2/sports/soccer";
const ESPN_TEAM_ID = "360";

import { searchNews, wikiLookup, liveLookup } from "./websearch.server";
import type {
  MatchDTO,
  LiveDTO,
  TableRowDTO,
  NewsItemDTO,
  SnapshotDTO,
} from "./manutd.types";

export type { MatchDTO, LiveDTO, TableRowDTO, NewsItemDTO, SnapshotDTO };

type CacheEntry = { value: unknown; expires: number };
const cache = new Map<string, CacheEntry>();

async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  try {
    const value = await load();
    cache.set(key, { value, expires: Date.now() + ttlMs });
    return value;
  } catch (err) {
    console.error("[manutd] load failed for", key, err);
    if (hit) return hit.value as T;
    throw err;
  }
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return (await res.json()) as T;
}

function isUnited(name: string | null | undefined) {
  const n = (name ?? "").toLowerCase();
  return TEAM_NAMES.some((t) => n.includes(t));
}

type RawEvent = Record<string, string | null>;

function toMatch(e: RawEvent): MatchDTO {
  const home = e["strHomeTeam"] ?? "";
  const away = e["strAwayTeam"] ?? "";
  const hs = e["intHomeScore"] != null ? Number(e["intHomeScore"]) : null;
  const as = e["intAwayScore"] != null ? Number(e["intAwayScore"]) : null;
  const united = isUnited(home);
  let outcome: MatchDTO["outcome"] = null;
  if (hs != null && as != null) {
    const mine = united ? hs : as;
    const theirs = united ? as : hs;
    outcome = mine > theirs ? "win" : mine === theirs ? "draw" : "loss";
  }
  return {
    id: e["idEvent"] ?? crypto.randomUUID(),
    home,
    away,
    homeBadge: e["strHomeTeamBadge"] ?? null,
    awayBadge: e["strAwayTeamBadge"] ?? null,
    homeScore: hs,
    awayScore: as,
    league: e["strLeague"] ?? "",
    timestamp: e["strTimestamp"] ?? (e["dateEvent"] ? `${e["dateEvent"]}T${e["strTime"] ?? "00:00:00"}` : null),
    isHome: united,
    opponent: united ? away : home,
    opponentBadge: (united ? e["strAwayTeamBadge"] : e["strHomeTeamBadge"]) ?? null,
    outcome,
    scorers: [],
    lineups: [],
  };
}

type EspnRecord = Record<string, unknown>;

function record(value: unknown): EspnRecord {
  return value && typeof value === "object" ? (value as EspnRecord) : {};
}

function list(value: unknown): EspnRecord[] {
  return Array.isArray(value) ? value.map(record) : [];
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function espnMatch(event: EspnRecord): MatchDTO | null {
  const competition = list(event["competitions"])[0];
  if (!competition) return null;
  const competitors = list(competition["competitors"]);
  const home = competitors.find((item) => text(item["homeAway"]) === "home");
  const away = competitors.find((item) => text(item["homeAway"]) === "away");
  if (!home || !away) return null;
  const homeTeam = record(home["team"]);
  const awayTeam = record(away["team"]);
  const homeName = text(homeTeam["displayName"]);
  const awayName = text(awayTeam["displayName"]);
  const homeScore = numberOrNull(record(home["score"])["value"] ?? home["score"]);
  const awayScore = numberOrNull(record(away["score"])["value"] ?? away["score"]);
  const unitedHome = text(homeTeam["id"]) === ESPN_TEAM_ID || isUnited(homeName);
  let outcome: MatchDTO["outcome"] = null;
  if (homeScore != null && awayScore != null) {
    const mine = unitedHome ? homeScore : awayScore;
    const theirs = unitedHome ? awayScore : homeScore;
    outcome = mine > theirs ? "win" : mine === theirs ? "draw" : "loss";
  }
  const homeLogo = list(homeTeam["logos"])[0];
  const awayLogo = list(awayTeam["logos"])[0];
  const league = record(event["league"]);
  return {
    id: text(event["id"]) || crypto.randomUUID(),
    home: homeName,
    away: awayName,
    homeBadge: homeLogo ? text(homeLogo["href"]) || null : null,
    awayBadge: awayLogo ? text(awayLogo["href"]) || null : null,
    homeScore,
    awayScore,
    league: text(league["name"]) || text(record(event["season"])["displayName"]),
    timestamp: text(event["date"]) || null,
    isHome: unitedHome,
    opponent: unitedHome ? awayName : homeName,
    opponentBadge: unitedHome
      ? (awayLogo ? text(awayLogo["href"]) || null : null)
      : (homeLogo ? text(homeLogo["href"]) || null : null),
    outcome,
    scorers: [],
    lineups: [],
  };
}

async function loadEspnSchedule(): Promise<{ live: LiveDTO | null; results: MatchDTO[]; fixtures: MatchDTO[] }> {
  const data = await getJson<EspnRecord>(`${ESPN}/all/teams/${ESPN_TEAM_ID}/schedule`);
  const events = list(data["events"]);
  const results: MatchDTO[] = [];
  const fixtures: MatchDTO[] = [];
  let live: LiveDTO | null = null;
  for (const event of events) {
    const match = espnMatch(event);
    const competition = list(event["competitions"])[0];
    if (!match || !competition) continue;
    const status = record(record(competition["status"])["type"]);
    const state = text(status["state"]);
    if (state === "in") {
      live = { ...match, progress: text(status["detail"]).replace(/[^0-9+]/g, ""), status: text(status["detail"]) };
    } else if (state === "post") {
      results.push(match);
    } else {
      fixtures.push(match);
    }
  }
  return { live, results, fixtures };
}

async function addMatchDetails(match: MatchDTO | LiveDTO | null): Promise<typeof match> {
  if (!match) return match;
  try {
    const schedule = await getJson<EspnRecord>(`${ESPN}/all/summary?event=${encodeURIComponent(match.id)}`);
    const headerCompetition = list(record(schedule["header"])["competitions"])[0];
    const scorers = headerCompetition
      ? list(headerCompetition["details"])
          .filter((detail) => detail["scoringPlay"] === true)
          .map((detail) => {
            const athlete = record(list(detail["participants"])[0]?.["athlete"]);
            const clock = record(detail["clock"]);
            const detailText = text(detail["text"]).toLowerCase();
            return {
              player: text(athlete["displayName"]) || "Непознат стрелец",
              minute: text(clock["displayValue"]) || "—",
              team: text(record(detail["team"])["displayName"]),
              ownGoal: detailText.includes("own goal"),
              penalty: detailText.includes("penalty"),
            };
          })
      : [];
    const lineups = list(schedule["rosters"])
      .map((roster) => ({
        team: text(record(roster["team"])["displayName"]),
        formation: text(roster["formation"]),
        starters: list(roster["roster"])
          .filter((player) => player["starter"] === true)
          .map((player) => ({
            name: text(record(player["athlete"])["displayName"]),
            number: text(player["jersey"]),
          })),
      }))
      .filter((lineup) => lineup.starters.length > 0);
    return { ...match, scorers, lineups };
  } catch (error) {
    console.error("[manutd] match details failed", error);
    return match;
  }
}

async function loadResults(): Promise<MatchDTO[]> {
  const data = await getJson<{ results: RawEvent[] | null }>(`${SDB}/eventslast.php?id=${TEAM_ID}`);
  return (data.results ?? []).map(toMatch);
}

async function loadFixtures(): Promise<MatchDTO[]> {
  const data = await getJson<{ events: RawEvent[] | null }>(`${SDB}/eventsnext.php?id=${TEAM_ID}`);
  return (data.events ?? []).map(toMatch);
}

async function loadLive(): Promise<LiveDTO | null> {
  const data = await getJson<{ livescore: RawEvent[] | null }>(`${SDB}/livescore.php?s=Soccer`);
  const raw = (data.livescore ?? []).find(
    (e) => isUnited(e["strHomeTeam"]) || isUnited(e["strAwayTeam"]),
  );
  if (!raw) return null;
  return {
    ...toMatch(raw),
    progress: raw["strProgress"] ?? "",
    status: raw["strStatus"] ?? "",
  };
}

async function loadTable(): Promise<TableRowDTO[]> {
  const now = new Date();
  const year = now.getUTCFullYear();
  const startYear = now.getUTCMonth() >= 6 ? year : year - 1;
  const seasons = [`${startYear}-${startYear + 1}`, `${startYear - 1}-${startYear}`];
  for (const season of seasons) {
    const data = await getJson<{ table: RawEvent[] | null }>(
      `${SDB}/lookuptable.php?l=${PL_LEAGUE}&s=${season}`,
    );
    const rows = data.table ?? [];
    if (rows.length > 0) {
      return rows.map((r) => ({
        rank: Number(r["intRank"] ?? 0),
        team: r["strTeam"] ?? "",
        badge: r["strBadge"] ?? null,
        played: Number(r["intPlayed"] ?? 0),
        win: Number(r["intWin"] ?? 0),
        draw: Number(r["intDraw"] ?? 0),
        loss: Number(r["intLoss"] ?? 0),
        goalsFor: Number(r["intGoalsFor"] ?? 0),
        goalsAgainst: Number(r["intGoalsAgainst"] ?? 0),
        points: Number(r["intPoints"] ?? 0),
        isUnited: isUnited(r["strTeam"]),
      }));
    }
  }
  return [];
}

/* ---------- News ---------- */

function decodeEntities(s: string) {
  return s
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

type RawNews = { title: string; link: string; source: string; date: Date | null };

function mkAgo(d: Date | null): string {
  if (!d) return "";
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 60) return mins <= 1 ? "пред една минута" : `пред ${mins} минути`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return hours === 1 ? "пред еден час" : `пред ${hours} часа`;
  const days = Math.round(hours / 24);
  return days === 1 ? "вчера" : `пред ${days} дена`;
}

async function loadRawNews(): Promise<RawNews[]> {
  // when:2d + sorting by date keeps the feed genuinely current (relevance sorting surfaces old articles).
  const res = await fetch(
    "https://news.google.com/rss/search?q=%22Manchester+United%22+when:2d&hl=en-GB&gl=GB&ceid=GB:en",
  );
  if (!res.ok) throw new Error(`news ${res.status}`);
  const xml = await res.text();
  const items = xml.split("<item>").slice(1, 30);
  const parsed = items.map((item) => {
    const pick = (tag: string) => {
      const m = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
      return m ? decodeEntities(m[1]!.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, "").trim()) : "";
    };
    const title = pick("title");
    const source = pick("source");
    const rawDate = pick("pubDate");
    const parsedDate = rawDate ? new Date(rawDate) : null;
    return {
      title: source ? title.replace(new RegExp(`\\s*-\\s*${source}$`), "") : title,
      link: pick("link"),
      source,
      date: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null,
    };
  });

  const maxAge = 4 * 24 * 60 * 60_000;
  const fresh = parsed.filter((n) => n.title && n.date && Date.now() - n.date.getTime() < maxAge);
  const list = (fresh.length >= 3 ? fresh : parsed.filter((n) => n.title))
    .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));

  const seen = new Set<string>();
  const unique: RawNews[] = [];
  for (const n of list) {
    const key = n.title.toLowerCase().slice(0, 60);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(n);
    if (unique.length === 8) break;
  }
  return unique;
}

async function loadEspnNews(): Promise<RawNews[]> {
  const data = await getJson<EspnRecord>(`${ESPN}/eng.1/news?team=${ESPN_TEAM_ID}&limit=8`);
  return list(data["articles"]).map((article) => {
    const links = record(article["links"]);
    const web = record(links["web"]);
    const published = text(article["published"]);
    const date = published ? new Date(published) : null;
    return {
      title: text(article["headline"]),
      link: text(web["href"]),
      source: "ESPN",
      date: date && !Number.isNaN(date.getTime()) ? date : null,
    };
  }).filter((item) => item.title);
}


type AiMessage = {
  role: string;
  content: string | null;
  tool_calls?: { id: string; type: string; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
  name?: string;
};

async function callAiRaw(messages: AiMessage[], maxTokens: number, tools?: unknown[]) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages,
      max_tokens: maxTokens,
      ...(tools ? { tools } : {}),
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("[manutd] AI error", res.status, text);
    throw new Error(res.status === 429 ? "rate_limited" : "ai_failed");
  }
  const json = (await res.json()) as { choices?: { message?: AiMessage }[] };
  return json.choices?.[0]?.message ?? { role: "assistant", content: "" };
}

async function callAi(messages: { role: string; content: string }[], maxTokens = 1200) {
  const msg = await callAiRaw(messages as AiMessage[], maxTokens);
  return msg.content ?? "";
}


async function loadNews(): Promise<NewsItemDTO[]> {
  let raw: RawNews[];
  try {
    raw = await loadRawNews();
  } catch (error) {
    console.error("[manutd] Google News unavailable, using fallback", error);
    raw = await loadEspnNews();
  }
  if (raw.length === 0) return [];
  const prompt = `Преведи ги следниве наслови на вести за Манчестер Јунајтед на македонски јазик.
За секој наслов дај краток наслов (до 9 збора) и една проста реченица објаснување, со точна фудбалска терминологија на македонски (натпревар, стартна постава, трансфер, повреда, тренер, полувреме, пенал, црвен картон).
Не преведувај буквално - пиши природно, како што би кажал спортски новинар. Имињата на играчите и клубовите остави ги во оригинал (латиница) само ако немаат вообичаен македонски запис.
Врати ИСКЛУЧИВО JSON низа од објекти со полиња "title" и "summary", ист број и ист редослед како влезот.

Влез:
${raw.map((n, i) => `${i + 1}. ${n.title}`).join("\n")}`;

  const content = await callAi([
    { role: "system", content: "Ти си спортски новинар кој пишува кратко и јасно на македонски јазик. Враќаш само валиден JSON." },
    { role: "user", content: prompt },
  ]);
  const match = content.match(/\[[\s\S]*\]/);
  let parsed: { title?: string; summary?: string }[] = [];
  if (match) {
    try {
      parsed = JSON.parse(match[0]) as { title?: string; summary?: string }[];
    } catch (err) {
      console.error("[manutd] news JSON parse failed", err);
    }
  }
  return raw.slice(0, 6).map((n, i) => {
    const t = parsed[i];
    const translated = Boolean(t?.title);
    return {
      title: t?.title || n.title,
      summary: t?.summary || "",
      source: n.source,
      link: n.link,
      published: mkAgo(n.date),
      publishedAt: n.date ? n.date.toISOString() : "",
      serbianOnly: !translated,
    };
  });

}

/* ---------- Snapshot ---------- */

export async function getSnapshotData(): Promise<SnapshotDTO> {
  const [espn, fallbackLive, fallbackResults, fallbackFixtures, table, news] = await Promise.all([
    cached("espn-schedule", 2 * 60_000, loadEspnSchedule).catch(() => ({ live: null, results: [], fixtures: [] })),
    cached("live", 2 * 60_000, loadLive).catch(() => null),
    cached("results", 15 * 60_000, loadResults).catch(() => [] as MatchDTO[]),
    cached("fixtures", 15 * 60_000, loadFixtures).catch(() => [] as MatchDTO[]),
    cached("table", 30 * 60_000, loadTable).catch(() => [] as TableRowDTO[]),
    cached("news", 30 * 60_000, loadNews).catch(() => [] as NewsItemDTO[]),
  ]);

  const live = espn.live ?? fallbackLive;
  const results = espn.results.length > 0 ? espn.results : fallbackResults;
  const fixtures = espn.fixtures.length > 0 ? espn.fixtures : fallbackFixtures;

  const sortedResults = [...results].sort(
    (a, b) => new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime(),
  );
  const sortedFixtures = [...fixtures].sort(
    (a, b) => new Date(a.timestamp ?? 0).getTime() - new Date(b.timestamp ?? 0).getTime(),
  );

  const last = sortedResults[0] ?? null;
  const detailedMatch = await cached(
    `match-details-${live?.id ?? last?.id ?? "none"}`,
    live ? 60_000 : 6 * 60 * 60_000,
    () => addMatchDetails(live ?? last),
  ).catch(() => live ?? last);

  return {
    live: live ? (detailedMatch as LiveDTO) : null,
    last: live ? last : (detailedMatch as MatchDTO | null),
    next: sortedFixtures[0] ?? null,
    fixtures: sortedFixtures.slice(0, 6),
    results: sortedResults.slice(0, 6),
    table,
    form: sortedResults
      .slice(0, 5)
      .reverse()
      .map((m) => m.outcome)
      .filter((o): o is "win" | "draw" | "loss" => o != null),
    news,
    updatedAt: new Date().toISOString(),
  };
}

const SEARCH_TOOLS = [
  {
    type: "function",
    function: {
      name: "search_web",
      description:
        "Пребарај го интернетот во живо за актуелни факти (тековен клуб на играч, трансфери, тренер, повреди, резултати). Користи кратко прашање на англиски.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Search query in English" } },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_news",
      description: "Најнови вести (наслови со датум) за дадена тема. Прашање на англиски.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "News query in English" } },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "wikipedia",
      description: "Енциклопедиски податоци за играч, клуб или тренер. Име на англиски.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Page title in English" } },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
];

async function runSearchTool(name: string, query: string) {
  try {
    if (name === "search_news") return { news: await searchNews(query) };
    if (name === "wikipedia") return { wikipedia: await wikiLookup(query) };
    return await liveLookup(query);
  } catch (err) {
    console.error("[manutd] tool failed", name, err);
    return { error: "Пребарувањето не успеа." };
  }
}

export async function answerQuestion(
  question: string,
  history: { role: string; content: string }[],
  extraContext?: string,
) {
  let context = "";
  try {
    const snap = await getSnapshotData();
    context = JSON.stringify({
      live: snap.live,
      last: snap.last,
      next: snap.next,
      fixtures: snap.fixtures,
      results: snap.results,
      table: snap.table.slice(0, 20),
      news: snap.news.map((n) => n.title),
    });
  } catch (err) {
    console.error("[manutd] context load failed", err);
  }

  const system = `Ти си пријателски помошник за постар навивач на Манчестер Јунајтед од Македонија.
Правила:
- Одговарај ИСКЛУЧИВО на македонски јазик, со кирилица.
- Кратки, едноставни реченици. Најмногу 4-5 реченици. Без англиски изрази и без стручен жаргон.
- Користи точна македонска фудбалска терминологија (натпревар, стартна постава, полувреме, судија, пенал, црвен картон, трансфер, повреда).
- ТОЧНОСТА Е НАЈВАЖНА. Твоето внатрешно знаење е застарено. За СЕКОЕ прашање за играч, тренер, состав, трансфер, повреда, резултат, табела или било што актуелно, ЗАДОЛЖИТЕЛНО прво повикај ги алатките за пребарување (search_web, search_news, wikipedia) и одговарај само врз основа на најдените податоци.
- Ако корисникот те исправи или побара да провериш повторно, направи НОВО пребарување со поинакви зборови пред да одговориш. Никогаш не повторувај стар одговор без проверка.
- Ако податоците од пребарувањето се спротивни на тоа што мислиш дека знаеш, верувај им на пребаните податоци (тие се понови).
- Ако по пребарувањето не најдеш сигурен податок, кажи искрено: „Не најдов сигурен податок за тоа.“ Никогаш не измислувај клуб, име или бројка.
- Не одбивај да одговориш само затоа што нешто го нема во податоците подолу.
- Денешен датум: ${new Date().toISOString().slice(0, 10)}.
Тековни податоци за клубот (JSON): ${context || "нема достапни податоци"}${
    extraContext ? `\n\n${extraContext}` : ""
  }`;

  const messages: AiMessage[] = [
    { role: "system", content: system },
    ...history.slice(-8).map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: question },
  ];

  for (let round = 0; round < 4; round++) {
    const msg = await callAiRaw(messages, 900, SEARCH_TOOLS);
    const calls = msg.tool_calls ?? [];
    if (calls.length === 0) return msg.content ?? "";
    messages.push({ role: "assistant", content: msg.content ?? null, tool_calls: calls });
    const results = await Promise.all(
      calls.map(async (c) => {
        let query = "";
        try {
          query = String((JSON.parse(c.function.arguments || "{}") as { query?: string }).query ?? "");
        } catch {
          query = "";
        }
        const out = query ? await runSearchTool(c.function.name, query) : { error: "no query" };
        return { id: c.id, name: c.function.name, out };
      }),
    );
    for (const r of results) {
      messages.push({
        role: "tool",
        tool_call_id: r.id,
        name: r.name,
        content: JSON.stringify(r.out).slice(0, 6000),
      });
    }
  }

  const final = await callAiRaw(messages, 900);
  return final.content ?? "";
}


/* ---------- Full news article (Macedonian) ---------- */

const articleCache = new Map<string, string>();

export async function expandNewsArticle(item: {
  title: string;
  summary: string;
  source: string;
  link: string;
  published?: string;
}): Promise<string> {
  const key = item.link || item.title;
  const hit = articleCache.get(key);
  if (hit) return hit;

  let facts = "";
  try {
    const found = await liveLookup(`Manchester United ${item.title}`);
    facts = JSON.stringify(found).slice(0, 6000);
  } catch (err) {
    console.error("[manutd] article lookup failed", err);
  }

  const today = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Europe/Skopje" }).format(new Date());

  const content = await callAi(
    [
      {
        role: "system",
        content:
          "Ти си спортски новинар кој пишува на едноставен, јасен македонски јазик за постари читатели. Пишуваш само на кирилица, со точна фудбалска терминологија.",
      },
      {
        role: "user",
        content: `Напиши целосна кратка вест на македонски за оваа тема за Манчестер Јунајтед.
Денешен датум: ${today}
Наслов: ${item.title}
Кратко: ${item.summary}
Извор: ${item.source}
Кога е објавено: ${item.published || "неодамна"}
Најдени податоци од интернет (може да се на англиски): ${facts || "нема"}

Правила:
- 3 до 4 кратки пасуси, вкупно околу 150 збора.
- Едноставни реченици, без англиски изрази.
- Пиши САМО за актуелната состојба денес. Не користи старо внатрешно знаење за трансфери или состав од претходни сезони.
- Само проверени факти од податоците погоре; ако нешто не е сигурно, не го пиши.
- Без наслов, без списоци, само текст во пасуси одвоени со празен ред.`,
      },
    ],

    900,
  );
  const text = content.trim();
  if (text) articleCache.set(key, text);
  return text;
}
