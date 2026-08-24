import type {
  LiveDTO,
  MatchDTO,
  SquadDTO,
  SquadPlayerDTO,
  SquadPositionDTO,
  TableRowDTO,
} from "./manutd.types";

const BASE_URL = "https://api.football-data.org/v4";
const UNITED_TEAM_ID = 66;

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" ? (value as JsonRecord) : {};
}

function array(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map(record) : [];
}

function string(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function number(value: unknown): number | null {
  const parsed = Number(value);
  return value !== null && value !== "" && Number.isFinite(parsed) ? parsed : null;
}

async function request(path: string, apiKey: string): Promise<JsonRecord> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { "X-Auth-Token": apiKey, accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`football-data ${response.status}`);
  return record(await response.json());
}

function toMatch(raw: JsonRecord): MatchDTO | null {
  const homeTeam = record(raw["homeTeam"]);
  const awayTeam = record(raw["awayTeam"]);
  const home = string(homeTeam["name"]);
  const away = string(awayTeam["name"]);
  if (!home || !away) return null;

  const score = record(raw["score"]);
  const fullTime = record(score["fullTime"]);
  const halfTime = record(score["halfTime"]);
  const homeScore = number(fullTime["home"] ?? halfTime["home"]);
  const awayScore = number(fullTime["away"] ?? halfTime["away"]);
  const homeId = number(homeTeam["id"]);
  const unitedHome = homeId === UNITED_TEAM_ID || home.toLowerCase().includes("manchester united");
  let outcome: MatchDTO["outcome"] = null;
  if (homeScore !== null && awayScore !== null) {
    const unitedScore = unitedHome ? homeScore : awayScore;
    const opponentScore = unitedHome ? awayScore : homeScore;
    outcome = unitedScore > opponentScore ? "win" : unitedScore === opponentScore ? "draw" : "loss";
  }

  const competition = record(raw["competition"]);
  return {
    id: String(raw["id"] ?? crypto.randomUUID()),
    home,
    away,
    homeBadge: string(homeTeam["crest"]) || null,
    awayBadge: string(awayTeam["crest"]) || null,
    homeScore,
    awayScore,
    league: string(competition["name"]),
    timestamp: string(raw["utcDate"]) || null,
    isHome: unitedHome,
    opponent: unitedHome ? away : home,
    opponentBadge: string(unitedHome ? awayTeam["crest"] : homeTeam["crest"]) || null,
    outcome,
    scorers: [],
    lineups: [],
  };
}

export async function loadFootballDataMatches(apiKey: string): Promise<{
  live: LiveDTO | null;
  results: MatchDTO[];
  fixtures: MatchDTO[];
}> {
  const now = new Date();
  const from = new Date(now.getTime() - 120 * 24 * 60 * 60_000).toISOString().slice(0, 10);
  const to = new Date(now.getTime() + 180 * 24 * 60 * 60_000).toISOString().slice(0, 10);
  const data = await request(
    `/teams/${UNITED_TEAM_ID}/matches?dateFrom=${from}&dateTo=${to}`,
    apiKey,
  );
  const results: MatchDTO[] = [];
  const fixtures: MatchDTO[] = [];
  let live: LiveDTO | null = null;

  for (const raw of array(data["matches"])) {
    const match = toMatch(raw);
    if (!match) continue;
    const status = string(raw["status"]);
    if (["IN_PLAY", "PAUSED", "EXTRA_TIME", "PENALTY_SHOOTOUT"].includes(status)) {
      const minute = number(raw["minute"]);
      live = {
        ...match,
        progress: minute === null ? "" : String(minute),
        status,
      };
    } else if (status === "FINISHED") {
      results.push(match);
    } else if (["SCHEDULED", "TIMED", "POSTPONED"].includes(status)) {
      fixtures.push(match);
    }
  }
  return { live, results, fixtures };
}

export async function loadFootballDataTable(apiKey: string): Promise<TableRowDTO[]> {
  const data = await request("/competitions/PL/standings", apiKey);
  const total = array(data["standings"]).find((standing) => string(standing["type"]) === "TOTAL");
  return array(total?.["table"]).map((entry) => {
    const team = record(entry["team"]);
    const teamName = string(team["name"]);
    return {
      rank: number(entry["position"]) ?? 0,
      team: teamName,
      badge: string(team["crest"]) || null,
      played: number(entry["playedGames"]) ?? 0,
      win: number(entry["won"]) ?? 0,
      draw: number(entry["draw"]) ?? 0,
      loss: number(entry["lost"]) ?? 0,
      goalsFor: number(entry["goalsFor"]) ?? 0,
      goalsAgainst: number(entry["goalsAgainst"]) ?? 0,
      points: number(entry["points"]) ?? 0,
      isUnited:
        number(team["id"]) === UNITED_TEAM_ID ||
        teamName.toLowerCase().includes("manchester united"),
    };
  });
}
/* Provider position vocabularies differ: football-data says Defence/Midfield/
   Offence, ESPN says Defender/Midfielder/Forward. Normalise so the page can
   group players the way a fan thinks about a squad. */
export function normalizeSquadPosition(raw: string): SquadPositionDTO {
  const p = raw.toLowerCase();
  if (p.includes("goal")) return "goalkeeper";
  if (p.includes("defen") || p.includes("back")) return "defender";
  if (p.includes("midfield")) return "midfielder";
  if (p.includes("offen") || p.includes("forward") || p.includes("attack") || p.includes("wing"))
    return "forward";
  return "unknown";
}

export function ageFromDateOfBirth(iso: string): number | null {
  if (!iso) return null;
  const born = new Date(iso);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - born.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - born.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < born.getUTCDate())) age -= 1;
  return age >= 14 && age <= 60 ? age : null;
}

/* The snapshot previously carried no players at all, so any question about
   selection, injury or a specific footballer had nothing factual behind it and
   the model improvised. /teams/{id} is on the same free tier as the fixtures,
   and it also backs the squad page. */
export async function loadFootballDataSquad(apiKey: string): Promise<SquadDTO> {
  const data = await request(`/teams/${UNITED_TEAM_ID}`, apiKey);
  const players = array(data["squad"])
    .map((p) => ({
      name: string(p["name"]),
      position: normalizeSquadPosition(string(p["position"])),
      shirt: number(p["shirtNumber"]),
      age: ageFromDateOfBirth(string(p["dateOfBirth"])),
      country: string(p["nationality"]),
    }))
    .filter((p) => p.name);
  return { coach: string(record(data["coach"])["name"]), players };
}
