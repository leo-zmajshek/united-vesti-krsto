/* Browser-safe ESPN feed helpers + match merge logic.
   ESPN blocks datacenter IPs (403 from the published server), but answers
   normally from a real browser and sends `Access-Control-Allow-Origin: *`,
   so the client can top up the server snapshot with cups, Europe and friendlies. */

import type { LiveDTO, MatchDTO, SnapshotDTO } from "./manutd.types";

const ESPN = "https://site.api.espn.com/apis/site/v2/sports/soccer";
const ESPN_TEAM_ID = "360";
const TEAM_NAMES = ["manchester united", "man united", "man utd"];

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

function isUnited(name: string | null | undefined) {
  const n = (name ?? "").toLowerCase();
  return TEAM_NAMES.some((t) => n.includes(t));
}

/* ---------- Merge helpers (shared with the server snapshot) ---------- */

export function matchKey(match: MatchDTO): string {
  const day = match.timestamp ? new Date(match.timestamp).toISOString().slice(0, 10) : "unknown";
  const opponent = match.opponent.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${day}|${opponent}`;
}

export function matchScore(match: MatchDTO): number {
  let score = 0;
  if (match.homeScore !== null && match.awayScore !== null) score += 4;
  if (/^\d+$/.test(match.id)) score += 2; // ESPN-style numeric event id (details lookup)
  if (match.scorers.length > 0 || match.lineups.length > 0) score += 2;
  if (match.league) score += 1;
  if (match.opponentBadge) score += 1;
  if (match.timestamp) score += 1;
  return score;
}

/** Merge match lists from all providers so every competition shows up, not just one provider's. */
export function mergeMatches(lists: MatchDTO[][]): MatchDTO[] {
  const byKey = new Map<string, MatchDTO>();
  for (const source of lists) {
    for (const match of source) {
      const key = matchKey(match);
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, match);
        continue;
      }
      const winner = matchScore(match) > matchScore(existing) ? match : existing;
      const other = winner === match ? existing : match;
      byKey.set(key, {
        ...winner,
        league: winner.league || other.league,
        opponentBadge: winner.opponentBadge ?? other.opponentBadge,
        homeBadge: winner.homeBadge ?? other.homeBadge,
        awayBadge: winner.awayBadge ?? other.awayBadge,
        timestamp: winner.timestamp ?? other.timestamp,
        scorers: winner.scorers.length > 0 ? winner.scorers : other.scorers,
        lineups: winner.lineups.length > 0 ? winner.lineups : other.lineups,
      });
    }
  }
  return [...byKey.values()];
}

/* ---------- ESPN parsing ---------- */

export function parseEspnMatch(event: EspnRecord): MatchDTO | null {
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
  const homeBadge = homeLogo ? text(homeLogo["href"]) || null : null;
  const awayBadge = awayLogo ? text(awayLogo["href"]) || null : null;
  return {
    id: text(event["id"]) || `${homeName}-${awayName}-${text(event["date"])}`,
    home: homeName,
    away: awayName,
    homeBadge,
    awayBadge,
    homeScore,
    awayScore,
    league: text(league["name"]) || text(record(event["season"])["displayName"]),
    timestamp: text(event["date"]) || null,
    isHome: unitedHome,
    opponent: unitedHome ? awayName : homeName,
    opponentBadge: unitedHome ? awayBadge : homeBadge,
    outcome,
    scorers: [],
    lineups: [],
  };
}

export function parseEspnSchedule(data: unknown): {
  live: LiveDTO | null;
  results: MatchDTO[];
  fixtures: MatchDTO[];
} {
  const events = list(record(data)["events"]);
  const results: MatchDTO[] = [];
  const fixtures: MatchDTO[] = [];
  let live: LiveDTO | null = null;
  for (const event of events) {
    const match = parseEspnMatch(event);
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

export function parseEspnMatchDetails(data: unknown): Pick<MatchDTO, "scorers" | "lineups"> {
  const summary = record(data);
  const headerCompetition = list(record(summary["header"])["competitions"])[0];
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
  const lineups = list(summary["rosters"])
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
  return { scorers, lineups };
}

/* ---------- Browser fetching ---------- */

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`ESPN request failed: ${res.status}`);
  return res.json();
}

/**
 * Fetch the full ESPN schedule from the browser and merge it into the
 * server snapshot, so competitions the server provider cannot see
 * (cups, Europe, friendlies) appear with scorers and lineups.
 */
export async function enrichSnapshotWithEspn(snapshot: SnapshotDTO): Promise<SnapshotDTO> {
  const espn = parseEspnSchedule(await getJson(`${ESPN}/all/teams/${ESPN_TEAM_ID}/schedule`));

  const results = mergeMatches([snapshot.results, espn.results]).sort(
    (a, b) => new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime(),
  );
  const fixtures = mergeMatches([snapshot.fixtures, espn.fixtures]).sort(
    (a, b) => new Date(a.timestamp ?? 0).getTime() - new Date(b.timestamp ?? 0).getTime(),
  );

  const live = espn.live ?? snapshot.live;
  const last = results[0] ?? snapshot.last;
  const focus = live ?? last;

  let detailed = focus;
  if (focus && focus.scorers.length === 0 && focus.lineups.length === 0 && /^\d+$/.test(focus.id)) {
    try {
      const details = parseEspnMatchDetails(
        await getJson(`${ESPN}/all/summary?event=${encodeURIComponent(focus.id)}`),
      );
      detailed = { ...focus, ...details };
    } catch {
      /* details are optional */
    }
  }

  return {
    ...snapshot,
    live: live ? ({ ...(detailed as LiveDTO), progress: live.progress, status: live.status }) : null,
    last: live ? last : (detailed as MatchDTO | null),
    next: fixtures[0] ?? snapshot.next,
    fixtures: fixtures.slice(0, 6),
    results: results.slice(0, 6),
    form: results
      .slice(0, 5)
      .reverse()
      .map((m) => m.outcome)
      .filter((o): o is "win" | "draw" | "loss" => o != null),
    availability: "fresh",
  };
}
