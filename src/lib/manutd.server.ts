/* Server-only helpers: football data (TheSportsDB free tier) + AI translation. */

const TEAM_ID = "133612";
const TEAM_NAMES = ["manchester united", "man united", "man utd"];
const PL_LEAGUE = "4328";
const SDB = "https://www.thesportsdb.com/api/v1/json/3";
const ESPN = "https://site.api.espn.com/apis/site/v2/sports/soccer";
const ESPN_TEAM_ID = "360";

import { searchNews, wikiLookup, liveLookup } from "./websearch.server";
import {
  loadFootballDataMatches,
  loadFootballDataTable,
  loadFootballDataSquad,
  normalizeSquadPosition,
} from "./football-data.server";
import { mergeMatches } from "./espn-feed";
import { teamMk, leagueMk } from "./mk";

import type {
  MatchDTO,
  LiveDTO,
  TableRowDTO,
  NewsItemDTO,
  SnapshotDTO,
  SquadDTO,
  SquadPlayerDTO,
} from "./manutd.types";

export type { MatchDTO, LiveDTO, TableRowDTO, NewsItemDTO, SnapshotDTO, SquadDTO };

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

/* ESPN rejects browser-like clients from datacenter IPs; a plain non-browser
   agent gets through, so try a few agents before falling back to a text proxy. */
const ESPN_AGENTS = ["curl/8.7.1", "okhttp/4.12.0", "ESPN/1.0 (+https://espn.com)"];

async function getJson<T>(url: string): Promise<T> {
  const isEspn = url.includes("espn.com");
  const agents = isEspn ? ESPN_AGENTS : [null];
  let lastStatus = 0;
  for (const agent of agents) {
    const res = await fetch(url, {
      headers: { accept: "application/json", ...(agent ? { "user-agent": agent } : {}) },
      signal: AbortSignal.timeout(8_000),
    });
    if (res.ok) return (await res.json()) as T;
    lastStatus = res.status;
  }
  if (isEspn) return getJsonViaProxy<T>(url);
  throw new Error(`Request failed: ${lastStatus}`);
}

async function getJsonViaProxy<T>(url: string): Promise<T> {
  const res = await fetch(`https://r.jina.ai/${url}`, {
    headers: { accept: "application/json", "x-respond-with": "text" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Proxy request failed: ${res.status}`);
  return JSON.parse(await res.text()) as T;
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
    timestamp:
      e["strTimestamp"] ??
      (e["dateEvent"] ? `${e["dateEvent"]}T${e["strTime"] ?? "00:00:00"}` : null),
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
      ? awayLogo
        ? text(awayLogo["href"]) || null
        : null
      : homeLogo
        ? text(homeLogo["href"]) || null
        : null,
    outcome,
    scorers: [],
    lineups: [],
  };
}

async function loadEspnSchedule(): Promise<{
  live: LiveDTO | null;
  results: MatchDTO[];
  fixtures: MatchDTO[];
}> {
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
      live = {
        ...match,
        progress: text(status["detail"]).replace(/[^0-9+]/g, ""),
        status: text(status["detail"]),
      };
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
  if (!/^\d+$/.test(match.id)) return match; // details endpoint only understands ESPN event ids
  try {
    const schedule = await getJson<EspnRecord>(
      `${ESPN}/all/summary?event=${encodeURIComponent(match.id)}`,
    );
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

async function loadEspnTable(): Promise<TableRowDTO[]> {
  const data = await getJson<EspnRecord>(
    "https://site.web.api.espn.com/apis/v2/sports/soccer/eng.1/standings",
  );
  const group = list(data["children"])[0];
  const entries = group ? list(record(group["standings"])["entries"]) : [];
  return entries.map((entry) => {
    const team = record(entry["team"]);
    const stats = list(entry["stats"]);
    const stat = (name: string) =>
      numberOrNull(stats.find((item) => text(item["name"]) === name)?.["value"]) ?? 0;
    const logo = list(team["logos"])[0];
    const teamName = text(team["displayName"]);
    return {
      rank: stat("rank"),
      team: teamName,
      badge: logo ? text(logo["href"]) || null : null,
      played: stat("gamesPlayed"),
      win: stat("wins"),
      draw: stat("ties"),
      loss: stat("losses"),
      goalsFor: stat("pointsFor"),
      goalsAgainst: stat("pointsAgainst"),
      points: stat("points"),
      isUnited: text(team["id"]) === ESPN_TEAM_ID || isUnited(teamName),
    };
  });
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

/* Only stories that are actually about United. ESPN's team feed is really the
   league feed, so it returns season-preview filler ("Ranking every jersey",
   "12 African players to watch") that reads as stale news to a United fan. */
const UNITED_HEADLINE = /manchester united|man united|man utd|man u\b|old trafford|red devils/i;

function isAboutUnited(title: string): boolean {
  return UNITED_HEADLINE.test(title);
}

const NEWS_MAX_AGE_MS = 3 * 24 * 60 * 60_000;

function isRecent(date: Date | null): boolean {
  return date != null && Date.now() - date.getTime() < NEWS_MAX_AGE_MS;
}

function dedupeNews(items: RawNews[], limit: number): RawNews[] {
  const seen = new Set<string>();
  const unique: RawNews[] = [];
  for (const n of [...items].sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0))) {
    const key = n.title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 45);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(n);
    if (unique.length === limit) break;
  }
  return unique;
}

async function loadRawNews(): Promise<RawNews[]> {
  // when:2d + sorting by date keeps the feed genuinely current (relevance sorting surfaces old articles).
  // A plain browser agent and a timeout matter here: without them the published
  // server's request can hang or be refused, silently falling through to ESPN.
  const res = await fetch(
    "https://news.google.com/rss/search?q=%22Manchester+United%22+when:2d&hl=en-GB&gl=GB&ceid=GB:en",
    {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36",
        accept: "application/rss+xml,application/xml,text/xml",
      },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!res.ok) throw new Error(`news ${res.status}`);
  const xml = await res.text();
  const items = xml.split("<item>").slice(1, 30);
  const parsed = items.map((item) => {
    const pick = (tag: string) => {
      const m = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
      return m
        ? decodeEntities(
            m[1]!
              .replace(/<!\[CDATA\[|\]\]>/g, "")
              .replace(/<[^>]+>/g, "")
              .trim(),
          )
        : "";
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

  // Undated or old items are dropped outright. The previous version fell back to
  // the unfiltered list whenever fewer than three items were fresh, which is how
  // last season's articles reached the page.
  return dedupeNews(
    parsed.filter((n) => n.title && isRecent(n.date)),
    8,
  );
}

async function loadEspnNews(): Promise<RawNews[]> {
  const data = await getJson<EspnRecord>(`${ESPN}/eng.1/news?team=${ESPN_TEAM_ID}&limit=20`);
  const items = list(data["articles"]).map((article) => {
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
  });
  return dedupeNews(
    items.filter((item) => item.title && isAboutUnited(item.title) && isRecent(item.date)),
    8,
  );
}

type AiMessage = {
  role: string;
  content: string | null;
  tool_calls?: { id: string; type: string; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
  name?: string;
};

/* gemini-2.5-flash is two generations behind what the gateway now serves, and its
   weak instruction-following is what let the assistant skip its search tools.
   Override with LOVABLE_AI_MODEL without a redeploy; if the gateway rejects the
   id we fall back once to the known-good model rather than breaking every
   AI feature on the page. */
const AI_MODEL = process.env["LOVABLE_AI_MODEL"] ?? "google/gemini-3.7-flash";
const AI_MODEL_FALLBACK = "google/gemini-2.5-flash";
let aiModel = AI_MODEL;

async function postAi(
  apiKey: string,
  model: string,
  messages: AiMessage[],
  maxTokens: number,
  tools?: unknown[],
) {
  return fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      ...(tools ? { tools } : {}),
    }),
    signal: AbortSignal.timeout(45_000),
  });
}

async function callAiRaw(messages: AiMessage[], maxTokens: number, tools?: unknown[]) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

  let res = await postAi(apiKey, aiModel, messages, maxTokens, tools);

  // An unknown model id comes back as a 4xx. Pin the fallback for the rest of
  // this isolate so we retry once, not on every request.
  if (
    !res.ok &&
    res.status >= 400 &&
    res.status < 500 &&
    res.status !== 429 &&
    aiModel !== AI_MODEL_FALLBACK
  ) {
    console.error(
      `[manutd] model "${aiModel}" rejected (${res.status}); falling back to ${AI_MODEL_FALLBACK}`,
    );
    aiModel = AI_MODEL_FALLBACK;
    res = await postAi(apiKey, aiModel, messages, maxTokens, tools);
  }

  if (!res.ok) {
    const text = await res.text();
    console.error("[manutd] AI error", res.status, text);
    if (res.status === 402) throw new Error("out_of_credit");
    throw new Error(res.status === 429 ? "rate_limited" : "ai_failed");
  }
  const json = (await res.json()) as { choices?: { message?: AiMessage }[] };
  return json.choices?.[0]?.message ?? { role: "assistant", content: "" };
}

async function callAi(messages: { role: string; content: string }[], maxTokens = 1200) {
  const msg = await callAiRaw(messages as AiMessage[], maxTokens);
  return msg.content ?? "";
}

/* Newer gateway models spend part of max_tokens on internal reasoning, so the
   old 1200 ceiling could truncate the JSON array mid-way. A truncated reply
   parsed as nothing, every headline silently fell back to its English original,
   and the UI then mislabelled all of them as Serbian. */
const NEWS_TRANSLATION_TOKENS = 3200;

/* Models wrap JSON in ``` fences or add a sentence before it often enough that
   a bare JSON.parse is not good enough. */
function parseJsonArray(content: string): { title?: string; summary?: string }[] {
  const cleaned = content
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .trim();
  const candidates = [cleaned];
  const first = cleaned.indexOf("[");
  const last = cleaned.lastIndexOf("]");
  if (first !== -1 && last > first) candidates.push(cleaned.slice(first, last + 1));
  for (const candidate of candidates) {
    try {
      const value = JSON.parse(candidate) as unknown;
      if (Array.isArray(value)) return value as { title?: string; summary?: string }[];
      // Some replies wrap the array in an object, e.g. {"items":[...]}.
      if (value && typeof value === "object") {
        const inner = Object.values(value).find((v) => Array.isArray(v));
        if (inner) return inner as { title?: string; summary?: string }[];
      }
    } catch {
      /* try the next candidate */
    }
  }
  return [];
}

/* Deterministic club-name pass. The prompt asks for Macedonian names, but models
   drift and leave "Manchester United" mid-sentence; the table settles it.
   Player names are left to the model, which knows that Carrick is "Керик" —
   blind transliteration would render "Каррик" and trade one awkwardness for
   another. */
const CLUB_PATTERNS: Array<[RegExp, string]> = [
  [/\bManchester United(?:\s+FC)?\b/g, "Манчестер Јунајтед"],
  [/\bMan(?:chester)?\s+Utd\b/g, "Манчестер Јунајтед"],
  [/\bMan United\b/g, "Манчестер Јунајтед"],
  [/\bManchester City(?:\s+FC)?\b/g, "Манчестер Сити"],
  [/\bOld Trafford\b/g, "Олд Трафорд"],
  [/\bPremier League\b/g, "Премиер лига"],
  [/\bChampions League\b/g, "Лигата на шампионите"],
  [/\bEuropa League\b/g, "Лигата на Европа"],
  [/\bHull(?:\s+City)?(?:\s+AFC)?\b/g, "Хал Сити"],
  [/\bLiverpool(?:\s+FC)?\b/g, "Ливерпул"],
  [/\bArsenal(?:\s+FC)?\b/g, "Арсенал"],
  [/\bChelsea(?:\s+FC)?\b/g, "Челзи"],
  [/\bTottenham(?:\s+Hotspur)?\b/g, "Тотенхем"],
  [/\bEverton(?:\s+FC)?\b/g, "Евертон"],
  [/\bNewcastle(?:\s+United)?\b/g, "Њукасл"],
  [/\bLeeds(?:\s+United)?\b/g, "Лидс"],
  [/\bAston Villa\b/g, "Астон Вила"],
  [/\bWest Ham(?:\s+United)?\b/g, "Вест Хем"],
];

function cyrillicizeClubs(text: string): string {
  let out = text;
  for (const [pattern, replacement] of CLUB_PATTERNS) out = out.replace(pattern, replacement);
  return out;
}

async function loadNews(): Promise<NewsItemDTO[]> {
  const primary = await loadRawNews().catch((error) => {
    console.error("[manutd] Google News unavailable, using fallback", error);
    return [] as RawNews[];
  });
  // Top up rather than replace: ESPN alone is thin once league-wide filler is
  // filtered out, and Google News alone can be blocked from the published server.
  let raw = primary;
  if (raw.length < 4) {
    const extra = await loadEspnNews().catch(() => [] as RawNews[]);
    raw = dedupeNews([...raw, ...extra], 8);
  }
  if (raw.length === 0) return [];
  const prompt = `Преведи ги следниве наслови на вести за Манчестер Јунајтед на македонски јазик.
За секој наслов дај краток наслов (до 9 збора) и една проста реченица објаснување, со точна фудбалска терминологија на македонски (натпревар, стартна постава, трансфер, повреда, тренер, полувреме, пенал, црвен картон).
Не преведувај буквално - пиши природно, како што би кажал спортски новинар.
ЗАДОЛЖИТЕЛНО: пиши СЀ на кирилица. Имињата на клубовите и играчите транскрибирај ги на македонски (Manchester United → Манчестер Јунајтед, Michael Carrick → Мајкл Керик, Hull → Хал, Rashford → Рашфорд). Никаква латиница во одговорот.
Врати ИСКЛУЧИВО JSON низа од објекти со полиња "title" и "summary", ист број и ист редослед како влезот. Без коментари и без \`\`\` ознаки.

Влез:
${raw.map((n, i) => `${i + 1}. ${n.title}`).join("\n")}`;

  const content = await callAi(
    [
      {
        role: "system",
        content:
          "Ти си спортски новинар кој пишува кратко и јасно на македонски јазик, само на кирилица. Враќаш само валиден JSON.",
      },
      { role: "user", content: prompt },
    ],
    NEWS_TRANSLATION_TOKENS,
  );
  const parsed = parseJsonArray(content);
  if (parsed.length === 0) {
    // Log what actually came back, so a future failure is diagnosable instead of
    // silently degrading to English.
    console.error(
      `[manutd] news translation did not parse (${content.length} chars): ${content.slice(0, 400)}`,
    );
  }
  return raw.slice(0, 6).map((n, i) => {
    const t = parsed[i];
    const title = t?.title ? cyrillicizeClubs(t.title) : "";
    return {
      title: title || n.title,
      summary: t?.summary ? cyrillicizeClubs(t.summary) : "",
      source: n.source,
      link: n.link,
      published: mkAgo(n.date),
      publishedAt: n.date ? n.date.toISOString() : "",
      // A failed translation is a failed translation. It is not Serbian, and
      // labelling it so put a Serbian flag on English text.
      untranslated: !title,
    };
  });
}

/* ---------- Squad ---------- */

/* Same shape from either provider, so the page renders identically whichever
   answered. ESPN needs no key, which also makes the page testable locally, and
   it goes through the hardened getJson above that works around ESPN blocking
   datacenter IPs. */
async function loadEspnRoster(): Promise<SquadDTO> {
  const data = await getJson<EspnRecord>(`${ESPN}/eng.1/teams/${ESPN_TEAM_ID}/roster`);
  const groups = list(data["athletes"]);
  // ESPN either returns a flat list or groups it by position.
  const athletes = groups.some((g) => Array.isArray(g["items"]))
    ? groups.flatMap((g) => list(g["items"]))
    : groups;
  const players: SquadPlayerDTO[] = athletes
    .map((a) => ({
      name: text(a["displayName"]) || text(a["fullName"]),
      position: normalizeSquadPosition(text(record(a["position"])["displayName"])),
      shirt: numberOrNull(a["jersey"]),
      age: numberOrNull(a["age"]),
      country: text(a["citizenship"]),
    }))
    .filter((p) => p.name);
  // ESPN's team `coach` field returns historical managers, so it is not used.
  return { coach: "", players };
}

export async function getSquadData(footballDataApiKey?: string): Promise<SquadDTO> {
  return cached("squad", 12 * 60 * 60_000, async () => {
    if (footballDataApiKey) {
      try {
        const squad = await loadFootballDataSquad(footballDataApiKey);
        if (squad.players.length > 0) return squad;
      } catch (error) {
        console.error("[manutd] football-data squad failed, trying ESPN", error);
      }
    }
    return loadEspnRoster();
  });
}

/* ---------- Snapshot ---------- */

/* matchKey / matchScore / mergeMatches live in ./espn-feed (shared with the browser top-up). */

let lastSuccessfulSnapshot: SnapshotDTO | null = null;

export async function getSnapshotData(footballDataApiKey?: string): Promise<SnapshotDTO> {
  const authenticatedMatches = footballDataApiKey
    ? cached("football-data-matches", 5 * 60_000, () =>
        loadFootballDataMatches(footballDataApiKey),
      ).catch((error) => {
        console.error("[manutd] authenticated match provider failed", error);
        return { live: null, results: [], fixtures: [] };
      })
    : Promise.resolve({ live: null, results: [], fixtures: [] });
  const authenticatedTable = footballDataApiKey
    ? cached("football-data-table", 30 * 60_000, () =>
        loadFootballDataTable(footballDataApiKey),
      ).catch((error) => {
        console.error("[manutd] authenticated table provider failed", error);
        return [] as TableRowDTO[];
      })
    : Promise.resolve([] as TableRowDTO[]);

  const [
    primary,
    espn,
    fallbackLive,
    fallbackResults,
    fallbackFixtures,
    primaryTable,
    fallbackTable,
    news,
  ] = await Promise.all([
    authenticatedMatches,
    cached("espn-schedule", 2 * 60_000, loadEspnSchedule).catch(() => ({
      live: null,
      results: [],
      fixtures: [],
    })),
    cached("live", 2 * 60_000, loadLive).catch(() => null),
    cached("results", 15 * 60_000, loadResults).catch(() => [] as MatchDTO[]),
    cached("fixtures", 15 * 60_000, loadFixtures).catch(() => [] as MatchDTO[]),
    authenticatedTable,
    cached("espn-table", 30 * 60_000, loadEspnTable)
      .catch(() => cached("table", 30 * 60_000, loadTable))
      .catch(() => [] as TableRowDTO[]),
    cached("news", 30 * 60_000, loadNews).catch(() => [] as NewsItemDTO[]),
  ]);

  const live = primary.live ?? espn.live ?? fallbackLive;
  const results = mergeMatches([espn.results, primary.results, fallbackResults]);
  const fixtures = mergeMatches([espn.fixtures, primary.fixtures, fallbackFixtures]);
  const table = primaryTable.length > 0 ? primaryTable : fallbackTable;

  const sortedResults = [...results].sort(
    (a, b) => new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime(),
  );
  /* DATA-2: a postponed fixture keeps its original date, and the query window
     reaches 120 days back, so sorting fixtures ascending could put a match from
     last spring at position 0 — displayed as "Следен натпревар" with a countdown
     that had already run out. Only genuinely future kickoffs qualify.
     A small grace window keeps a match visible while it is starting. */
  const KICKOFF_GRACE_MS = 3 * 60 * 60_000;
  const upcoming = fixtures.filter((m) => {
    if (!m.timestamp) return false; // date not yet confirmed — hold it back
    const kickoff = new Date(m.timestamp).getTime();
    return Number.isFinite(kickoff) && kickoff > Date.now() - KICKOFF_GRACE_MS;
  });
  const sortedFixtures = [...upcoming].sort(
    (a, b) => new Date(a.timestamp ?? 0).getTime() - new Date(b.timestamp ?? 0).getTime(),
  );

  const last = sortedResults[0] ?? null;
  const detailedMatch = await cached(
    `match-details-${live?.id ?? last?.id ?? "none"}`,
    live ? 60_000 : 6 * 60 * 60_000,
    () => addMatchDetails(live ?? last),
  ).catch(() => live ?? last);

  const hasCoreData = Boolean(live || last || sortedFixtures[0] || table.length > 0);
  if (!hasCoreData && lastSuccessfulSnapshot) {
    return { ...lastSuccessfulSnapshot, availability: "stale" };
  }

  const snapshot: SnapshotDTO = {
    live: live ? (detailedMatch as LiveDTO) : null,
    last: live ? last : (detailedMatch as MatchDTO | null),
    next: sortedFixtures[0] ?? null,
    fixtures: sortedFixtures.slice(0, 6),
    results: sortedResults.slice(0, 6),
    table,
    tableIsPreseason: table.length > 0 && table.every((row) => row.played === 0),
    news,
    updatedAt: new Date().toISOString(),
    availability: hasCoreData ? "fresh" : "unavailable",
  };
  if (hasCoreData) lastSuccessfulSnapshot = snapshot;
  return snapshot;
}

const SEARCH_TOOLS = [
  {
    type: "function",
    function: {
      name: "search_web",
      description:
        "Комбинирано пребарување: најнови вести со датум, текст на најрелевантната вест и енциклопедиски податоци. Најдобра алатка за актуелни факти (тековен клуб на играч, трансфер, тренер, повреда, причина за неиграње). Прашање на англиски.",
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
      description:
        "Википедија: биографија и тековен клуб на играч, тренер или клуб. Точна за „каде игра сега“. Име на англиски.",
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
  footballDataApiKey?: string,
) {
  /* Context is written as short Macedonian lines rather than dumped JSON. The
     raw dump was large, and it taught the model to echo English club names
     ("Manchester United FC") straight back into its answers. */
  const lines: string[] = [];
  try {
    const snap = await getSnapshotData(footballDataApiKey);
    const describe = (m: MatchDTO | null) =>
      m
        ? `${teamMk(m.home)} ${m.homeScore ?? "-"}:${m.awayScore ?? "-"} ${teamMk(m.away)} (${leagueMk(m.league)}, ${m.timestamp ?? "без датум"})`
        : "нема податок";
    if (snap.live)
      lines.push(
        `Во моментот се игра: ${describe(snap.live)}, минута ${snap.live.progress || "?"}.`,
      );
    lines.push(`Последен натпревар: ${describe(snap.last)}.`);
    lines.push(`Следен натпревар: ${describe(snap.next)}.`);
    if (snap.last?.scorers.length) {
      lines.push(
        `Стрелци на последниот натпревар: ${snap.last.scorers.map((g) => `${g.player} ${g.minute}`).join(", ")}.`,
      );
    }
    if (snap.last?.lineups.length) {
      for (const l of snap.last.lineups) {
        lines.push(`Постава (${teamMk(l.team)}): ${l.starters.map((pl) => pl.name).join(", ")}.`);
      }
    }
    const united = snap.table.find((r) => r.isUnited);
    if (united) {
      lines.push(
        `Табела: Јунајтед е ${united.rank}. со ${united.points} бода од ${united.played} натпревари.`,
      );
    }
    if (snap.fixtures.length) {
      lines.push(
        `Следни натпревари: ${snap.fixtures
          .slice(0, 4)
          .map(
            (m) =>
              `${teamMk(m.opponent)} (${m.isHome ? "дома" : "во гости"}, ${m.timestamp ?? "?"})`,
          )
          .join("; ")}.`,
      );
    }
    if (snap.news.length)
      lines.push(`Наслови од вестите: ${snap.news.map((n) => n.title).join(" | ")}.`);
  } catch (err) {
    console.error("[manutd] context load failed", err);
  }

  // The squad is what makes selection questions answerable at all — without it,
  // "why didn't Šeško play" has no factual basis and the model invents one.
  try {
    const squad = await getSquadData(footballDataApiKey);
    if (squad.coach) lines.push(`Тренер на Манчестер Јунајтед: ${squad.coach}.`);
    if (squad.players.length) {
      lines.push(
        `Играчи во тековниот состав на Манчестер Јунајтед (ова е официјалниот список, верувај му): ${squad.players
          .map((pl) => `${pl.name}${pl.shirt ? ` (${pl.shirt})` : ""}`)
          .join(", ")}.`,
      );
    }
  } catch (err) {
    console.error("[manutd] squad load failed", err);
  }

  const context = lines.join("\n");

  /* Grounding is no longer left to the model's discretion. The old prompt
     demanded a search and then closed by telling it not to refuse when the data
     was missing, which cancelled the instruction — that is how it confidently
     placed Šeško at Arsenal while Wikipedia's first line said Manchester United.
     Now one search always runs before the model speaks. */
  let priorResearch = "";
  try {
    const found = await liveLookup(`Manchester United ${question}`);
    priorResearch = JSON.stringify(found).slice(0, 7000);
  } catch (err) {
    console.error("[manutd] pre-search failed", err);
  }

  const system = `Ти си пријателски помошник за постар навивач на Манчестер Јунајтед од Македонија.
Правила:
- Одговарај ИСКЛУЧИВО на македонски јазик, со кирилица. Имињата на клубовите пиши ги на македонски (Манчестер Јунајтед, Ливерпул, Арсенал).
- Кратки, едноставни реченици. Најмногу 4-5 реченици. Без англиски изрази и без стручен жаргон.
- Користи точна македонска фудбалска терминологија (натпревар, стартна постава, полувреме, судија, пенал, црвен картон, трансфер, повреда).
- ТОЧНОСТА Е НАЈВАЖНА. Твоето внатрешно знаење за играчи, трансфери и тренери е ЗАСТАРЕНО и честопати погрешно. Никогаш не се потпирај на него.
- Одговарај САМО врз основа на податоците подолу и на резултатите од алатките за пребарување. Ако тие не даваат одговор, повикај ги алатките (search_web, search_news, wikipedia) уште еднаш со поинакви зборови.
- Ако по пребарувањето не најдеш сигурен податок, кажи точно: „Не најдов сигурен податок за тоа.“ Тоа е ПРАВИЛЕН одговор. Никогаш не измислувај клуб, име, бројка или причина.
- Ако корисникот те исправи, направи НОВО пребарување со поинакви зборови пред да одговориш. Никогаш не повторувај стар одговор без проверка.
- Ако податоците од пребарувањето се спротивни на тоа што мислиш дека знаеш, верувај им на пребаните податоци.
- Денешен датум: ${new Date().toISOString().slice(0, 10)}.

Тековни податоци за клубот:
${context || "нема достапни податоци"}

Резултати од автоматското пребарување за ова прашање:
${priorResearch || "нема"}${extraContext ? `\n\n${extraContext}` : ""}`;

  const messages: AiMessage[] = [
    { role: "system", content: system },
    ...history.slice(-8).map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: question },
  ];

  for (let round = 0; round < 4; round++) {
    const msg = await callAiRaw(messages, 1600, SEARCH_TOOLS);
    const calls = msg.tool_calls ?? [];
    if (calls.length === 0) return msg.content ?? "";
    messages.push({ role: "assistant", content: msg.content ?? null, tool_calls: calls });
    const results = await Promise.all(
      calls.map(async (c) => {
        let query = "";
        try {
          query = String(
            (JSON.parse(c.function.arguments || "{}") as { query?: string }).query ?? "",
          );
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

  const final = await callAiRaw(messages, 1600);
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

  const today = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
    timeZone: "Europe/Skopje",
  }).format(new Date());

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
