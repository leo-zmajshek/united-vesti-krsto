/* Shared DTO types (client-safe). */

export type MatchDTO = {
  id: string;
  home: string;
  away: string;
  homeBadge: string | null;
  awayBadge: string | null;
  homeScore: number | null;
  awayScore: number | null;
  league: string;
  timestamp: string | null;
  isHome: boolean;
  opponent: string;
  opponentBadge: string | null;
  /** Decided by the shootout when level after extra time. */
  outcome: "win" | "draw" | "loss" | null;
  /** Penalty shootout score, null when there was none. Never included in the
      homeScore/awayScore above. */
  homePens: number | null;
  awayPens: number | null;
  scorers: GoalEventDTO[];
  lineups: TeamLineupDTO[];
};

export type LiveDTO = MatchDTO & {
  /** Match minute, e.g. "67" or "45+2"; empty when unknown. */
  progress: string;
  /** Raw provider status, kept for logs and the assistant. */
  status: string;
  /** "break" is the pause before extra time or before the shootout. */
  phase: "playing" | "halftime" | "break" | "penalties";
};

export type GoalEventDTO = {
  player: string;
  minute: string;
  team: string;
  ownGoal: boolean;
  penalty: boolean;
};

export type TeamLineupDTO = {
  team: string;
  formation: string;
  starters: { name: string; number: string }[];
};

export type TableRowDTO = {
  rank: number;
  team: string;
  badge: string | null;
  played: number;
  win: number;
  draw: number;
  loss: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  isUnited: boolean;
};

export type NewsItemDTO = {
  title: string;
  summary: string;
  source: string;
  link: string;
  published: string;
  publishedAt: string;
  /** Translation into Macedonian failed; the title below is still the original. */
  untranslated: boolean;
};

export type SnapshotDTO = {
  live: LiveDTO | null;
  last: MatchDTO | null;
  next: MatchDTO | null;
  fixtures: MatchDTO[];
  results: MatchDTO[];
  table: TableRowDTO[];
  /** Every row still on zero — the season has not kicked off yet. */
  tableIsPreseason: boolean;
  updatedAt: string;
  availability: "fresh" | "stale" | "unavailable";
};

/* Squad page. Deliberately static basics — no live stats, no per-match numbers.
   Fields are limited to what BOTH providers can supply, so the page looks the
   same whether football-data or the ESPN fallback answered. */
export type SquadPositionDTO = "goalkeeper" | "defender" | "midfielder" | "forward" | "unknown";

export type SquadPlayerDTO = {
  name: string;
  position: SquadPositionDTO;
  shirt: number | null;
  age: number | null;
  country: string;
  /** Small headshot URL, or null when no verified photo exists. */
  photo: string | null;
};

export type SquadDTO = {
  coach: string;
  players: SquadPlayerDTO[];
};
