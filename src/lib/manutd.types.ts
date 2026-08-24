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
  outcome: "win" | "draw" | "loss" | null;
  scorers: GoalEventDTO[];
  lineups: TeamLineupDTO[];
};

export type LiveDTO = MatchDTO & { progress: string; status: string };

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
  news: NewsItemDTO[];
  updatedAt: string;
  availability: "fresh" | "stale" | "unavailable";
};
