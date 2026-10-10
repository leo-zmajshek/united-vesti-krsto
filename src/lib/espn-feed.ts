/* Browser-safe ESPN feed helpers + match merge logic.
   ESPN blocks datacenter IPs (403 from the published server), but answers
   normally from a real browser and sends `Access-Control-Allow-Origin: *`,
   so the client can top up the server snapshot with cups, Europe and friendlies. */

import { teamMk } from "./mk";

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

/* Keyed on the canonical Macedonian club name, not the raw string: providers
   send "Hull City AFC", "Hull City" and "Man Utd" for the same clubs, and
   comparing raw strings let the same fixture through twice. teamMk collapses
   every spelling and alias onto one name. */
export function matchKey(match: MatchDTO): string {
  // A malformed timestamp must not throw: one bad date would take down the page.
  const time = match.timestamp ? new Date(match.timestamp).getTime() : NaN;
  const day = Number.isFinite(time) ? new Date(time).toISOString().slice(0, 10) : "unknown";
  const opponent = teamMk(match.opponent).trim().toLowerCase().replace(/\s+/g, "");
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

/** Merge match lists from all providers so every competition shows up, not just
    one provider's. Lists must be passed in priority order: on an equal score the
    earlier list wins, so the same fixture always renders the same way. Passing a
    different order on the server than in the browser is what made a club's name
    and badge change between visits. */
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
        homePens: winner.homePens ?? other.homePens,
        awayPens: winner.awayPens ?? other.awayPens,
        outcome: winner.homePens == null && other.homePens != null ? other.outcome : winner.outcome,
        scorers: winner.scorers.length > 0 ? winner.scorers : other.scorers,
        lineups: winner.lineups.length > 0 ? winner.lineups : other.lineups,
      });
    }
  }
  return [...byKey.values()];
}

/* ESPN's summary endpoint only understands ESPN event ids. football-data and
   TheSportsDB ids are numeric too, and asking ESPN for one returns an unrelated
   match (football-data's 560600 is a 2020 Brazilian youth game), so the id is
   always resolved through ESPN's own schedule. */
export function espnIdFor(match: MatchDTO, espnMatches: (MatchDTO | null)[]): string | null {
  const key = matchKey(match);
  return espnMatches.find((m) => m && matchKey(m) === key)?.id ?? null;
}

/** Drop upcoming entries that a provider already reports as live or finished. A
    lagging feed otherwise kept a finished match as "next" for hours. */
export function withoutPlayed(fixtures: MatchDTO[], played: (MatchDTO | null)[]): MatchDTO[] {
  const done = new Set(played.filter((m): m is MatchDTO => m != null).map(matchKey));
  return fixtures.filter((m) => !done.has(matchKey(m)));
}

/** United's result, with a level score settled by the shootout when there was one. */
export function outcomeOf(
  homeScore: number | null,
  awayScore: number | null,
  unitedHome: boolean,
  homePens: number | null = null,
  awayPens: number | null = null,
): MatchDTO["outcome"] {
  if (homeScore == null || awayScore == null) return null;
  let home = homeScore;
  let away = awayScore;
  if (home === away && homePens != null && awayPens != null) {
    home = homePens;
    away = awayPens;
  }
  const mine = unitedHome ? home : away;
  const theirs = unitedHome ? away : home;
  return mine > theirs ? "win" : mine === theirs ? "draw" : "loss";
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
  // The shootout sits beside the score, never inside it.
  const homePens = numberOrNull(record(home["score"])["shootoutScore"] ?? home["shootoutScore"]);
  const awayPens = numberOrNull(record(away["score"])["shootoutScore"] ?? away["shootoutScore"]);
  const unitedHome = text(homeTeam["id"]) === ESPN_TEAM_ID || isUnited(homeName);
  const outcome = outcomeOf(homeScore, awayScore, unitedHome, homePens, awayPens);
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
    homePens,
    awayPens,
    scorers: [],
    lineups: [],
  };
}

/* ESPN's live minute is in the competition clock ("45'+2'"). The old code
   stripped digits out of the status text instead, which is "Halftime" at the
   break and so came out empty. */
function espnLiveState(competition: EspnRecord): Pick<LiveDTO, "progress" | "status" | "phase"> {
  const status = record(competition["status"]);
  const type = record(status["type"]);
  const name = text(type["name"]).toUpperCase();
  const detail = text(type["shortDetail"]) || text(type["detail"]);
  const phase: LiveDTO["phase"] =
    name.includes("HALFTIME") || /^(HT|half ?time)$/i.test(detail)
      ? "halftime"
      : name.includes("SHOOTOUT") || name.includes("PENALT")
        ? "penalties"
        : "playing";
  const clock = text(status["displayClock"]) || detail;
  return { progress: clock.replace(/[^0-9+]/g, ""), status: detail, phase };
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
      live = { ...match, ...espnLiveState(competition) };
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
          // ESPN marks these with booleans; its `text` field is usually null.
          const detailText = text(detail["text"]).toLowerCase();
          return {
            player: text(athlete["displayName"]) || "Непознат стрелец",
            minute: text(clock["displayValue"]) || "—",
            team: text(record(detail["team"])["displayName"]),
            ownGoal: detail["ownGoal"] === true || detailText.includes("own goal"),
            penalty: detail["penaltyKick"] === true || detailText.includes("penalty"),
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

/** Fetch the raw ESPN schedule payload from the browser. Kept separate from the
    merge so the caller can hold on to the payload and re-merge instantly when a
    new server snapshot arrives, instead of leaving a gap while it re-fetches. */
export async function fetchEspnSchedule(): Promise<unknown> {
  // The plain schedule lists finished matches only; `fixture=true` is the only
  // view with upcoming and in-progress ones, so both are needed.
  const [played, upcoming] = await Promise.all([
    getJson(espnScheduleUrls[0]),
    getJson(espnScheduleUrls[1]).catch(() => ({})),
  ]);
  return combineEspnSchedules(played, upcoming);
}

export const espnScheduleUrls = [
  `${ESPN}/all/teams/${ESPN_TEAM_ID}/schedule`,
  `${ESPN}/all/teams/${ESPN_TEAM_ID}/schedule?fixture=true`,
] as const;

export function combineEspnSchedules(...payloads: unknown[]): { events: EspnRecord[] } {
  const byId = new Map<string, EspnRecord>();
  for (const payload of payloads) {
    for (const event of list(record(payload)["events"])) byId.set(text(event["id"]), event);
  }
  return { events: [...byId.values()] };
}

/**
 * Merge an already-fetched ESPN schedule into the server snapshot, so
 * competitions the server provider cannot see (cups, Europe, friendlies) appear
 * with scorers and lineups.
 */
export async function mergeEspnIntoSnapshot(
  snapshot: SnapshotDTO,
  espn: { live: LiveDTO | null; results: MatchDTO[]; fixtures: MatchDTO[] },
): Promise<SnapshotDTO> {
  // ESPN first, matching the server's priority order, so ties resolve the same way.
  const results = mergeMatches([espn.results, snapshot.results]).sort(
    (a, b) => new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime(),
  );
  const live = espn.live ?? snapshot.live;
  const last = results[0] ?? snapshot.last;
  const merged = withoutPlayed(mergeMatches([espn.fixtures, snapshot.fixtures]), [
    live,
    ...results,
  ]);
  // Same rule as the server: only genuinely future kickoffs may be "next".
  const KICKOFF_GRACE_MS = 3 * 60 * 60_000;
  const fixtures = merged
    .filter((m) => {
      if (!m.timestamp) return false;
      const kickoff = new Date(m.timestamp).getTime();
      return Number.isFinite(kickoff) && kickoff > Date.now() - KICKOFF_GRACE_MS;
    })
    .sort((a, b) => new Date(a.timestamp ?? 0).getTime() - new Date(b.timestamp ?? 0).getTime());

  const focus = live ?? last;

  // Start from whatever the server already found for this match, so a failed
  // browser request can never wipe scorers the server had.
  let detailed = focus;
  const serverFocus = snapshot.live ?? snapshot.last;
  if (focus && serverFocus && matchKey(serverFocus) === matchKey(focus)) {
    detailed = {
      ...focus,
      scorers: focus.scorers.length > 0 ? focus.scorers : serverFocus.scorers,
      lineups: focus.lineups.length > 0 ? focus.lineups : serverFocus.lineups,
    };
  }
  const espnId = focus ? espnIdFor(focus, [espn.live, ...espn.results, ...espn.fixtures]) : null;
  // During a live match goals keep coming, so always refresh; otherwise only
  // when nothing is known yet.
  const needDetails =
    detailed != null &&
    (live != null || (detailed.scorers.length === 0 && detailed.lineups.length === 0));
  if (detailed && espnId && needDetails) {
    try {
      const details = parseEspnMatchDetails(
        await getJson(`${ESPN}/all/summary?event=${encodeURIComponent(espnId)}`),
      );
      detailed = {
        ...detailed,
        // Live, ESPN's list is the truth (a goal can be ruled out by VAR).
        scorers: live || details.scorers.length > 0 ? details.scorers : detailed.scorers,
        lineups: details.lineups.length > 0 ? details.lineups : detailed.lineups,
      };
    } catch {
      /* details are optional */
    }
  }

  return {
    ...snapshot,
    live: live
      ? {
          ...(detailed as LiveDTO),
          progress: live.progress,
          status: live.status,
          phase: live.phase,
        }
      : null,
    last: live ? last : (detailed as MatchDTO | null),
    next: fixtures[0] ?? null,
    fixtures: fixtures.slice(0, 6),
    results: results.slice(0, 6),
    // Freshness belongs to the server, which knows whether its providers
    // answered. Hard-coding "fresh" here overrode a "stale" verdict and meant
    // the "showing last saved data" notice could never appear.
    availability: snapshot.availability,
  };
}
