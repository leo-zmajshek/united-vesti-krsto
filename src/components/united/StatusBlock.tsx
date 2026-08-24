import { Link } from "@tanstack/react-router";
import type { MatchDTO, SnapshotDTO } from "@/lib/manutd.types";
import { Badge, Card } from "./ui";
import {
  OUTCOME_LABEL,
  countdown,
  formatDateTime,
  formatTime,
  hoursUntil,
  isToday,
  leagueMk,
  teamMk,
} from "@/lib/mk";

const OUTCOME_CLASS = {
  win: "bg-success text-success-foreground",
  draw: "bg-warning text-warning-foreground",
  loss: "bg-destructive text-destructive-foreground",
} as const;

function ScoreLine({
  home,
  away,
  homeBadge,
  awayBadge,
  homeScore,
  awayScore,
}: {
  home: string;
  away: string;
  homeBadge: string | null;
  awayBadge: string | null;
  homeScore: number | null;
  awayScore: number | null;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="flex flex-1 flex-col items-center gap-2 text-center">
        <Badge src={homeBadge} alt={home} size={52} />
        <span className="text-base font-bold leading-tight break-words sm:text-xl">
          {teamMk(home)}
        </span>
      </div>
      <div className="shrink-0 pt-2 text-center">
        <div className="text-5xl font-black tabular-nums sm:text-7xl">
          {homeScore ?? "-"}
          <span className="mx-1.5 opacity-60 sm:mx-2">:</span>
          {awayScore ?? "-"}
        </div>
      </div>
      <div className="flex flex-1 flex-col items-center gap-2 text-center">
        <Badge src={awayBadge} alt={away} size={52} />
        <span className="text-base font-bold leading-tight break-words sm:text-xl">
          {teamMk(away)}
        </span>
      </div>
    </div>
  );
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function goalSide(goalTeam: string, home: string, away: string): "home" | "away" {
  const g = normalize(goalTeam);
  const h = normalize(home);
  const a = normalize(away);
  if (!g) return "home";
  if (g === h) return "home";
  if (g === a) return "away";
  if (h.includes(g) || g.includes(h)) return "home";
  if (a.includes(g) || g.includes(a)) return "away";
  return "home";
}

function GoalItem({
  goal,
  align,
  teamLabel,
}: {
  goal: { player: string; minute: string; ownGoal: boolean; penalty: boolean };
  align: "left" | "right";
  teamLabel: string;
}) {
  const note = goal.ownGoal ? " (автогол)" : goal.penalty ? " (пенал)" : "";
  const right = align === "right";
  return (
    <li
      className={`flex w-[88%] items-baseline gap-2 rounded-lg bg-muted px-3 py-2 text-base leading-snug sm:text-lg ${
        right
          ? "ml-auto flex-row-reverse border-r-4 border-primary text-right"
          : "mr-auto border-l-4 border-primary"
      }`}
    >
      <span aria-hidden="true">⚽</span>
      <span className="min-w-0 flex-1 font-bold">
        {goal.player}
        {note}
        <span className="sr-only"> за {teamLabel}</span>
      </span>
      <span className="shrink-0 font-black tabular-nums text-primary">{goal.minute}</span>
    </li>
  );
}

function MatchDetails({ match }: { match: MatchDTO }) {
  const hasScorers = match.scorers.length > 0;
  const hasLineups = match.lineups.length > 0;
  if (!hasScorers && !hasLineups) {
    return (
      <p className="mt-5 text-center text-base text-muted-foreground sm:text-lg">
        Стрелците и составите сè уште не се достапни.
      </p>
    );
  }

  const sides = match.scorers.map((goal) => ({
    goal,
    side: goalSide(goal.team, match.home, match.away),
  }));

  const homeLineup = match.lineups.find((l) => goalSide(l.team, match.home, match.away) === "home");
  const awayLineup = match.lineups.find((l) => l !== homeLineup);

  return (
    <div className="mt-6 border-t-2 border-border pt-5">
      {hasScorers ? (
        <section aria-label="Стрелци">
          <h2 className="text-center text-xl font-black sm:text-2xl">Голови</h2>
          <div className="mt-3 flex items-baseline justify-between gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            <span className="min-w-0 flex-1">{teamMk(match.home)}</span>
            <span className="min-w-0 flex-1 text-right">{teamMk(match.away)}</span>
          </div>
          <ul className="mt-2 space-y-2">
            {sides.map(({ goal, side }, i) => (
              <GoalItem
                key={`${side}-${goal.player}-${goal.minute}-${i}`}
                goal={goal}
                align={side === "home" ? "left" : "right"}
                teamLabel={side === "home" ? teamMk(match.home) : teamMk(match.away)}
              />
            ))}
          </ul>
        </section>
      ) : null}
      {hasLineups ? (
        <section aria-label="Стартни состави" className={hasScorers ? "mt-6" : ""}>
          <h2 className="text-center text-xl font-black sm:text-2xl">Стартни состави</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {[homeLineup, awayLineup].filter(Boolean).map((lineup) => (
              <div
                key={lineup!.team}
                className="rounded-xl border-l-4 border-primary bg-muted p-3 sm:p-4"
              >
                <h3 className="text-lg font-black break-words sm:text-xl">
                  {teamMk(lineup!.team)}
                  {lineup!.formation ? ` · ${lineup!.formation}` : ""}
                </h3>
                <ol className="mt-2 space-y-1 text-base sm:text-lg">
                  {lineup!.starters.map((player) => (
                    <li
                      key={`${lineup!.team}-${player.number}-${player.name}`}
                      className="flex gap-2"
                    >
                      <span className="w-7 shrink-0 font-bold tabular-nums text-muted-foreground">
                        {player.number}
                      </span>
                      <span className="min-w-0 break-words">{player.name}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export function StatusBlock({ snapshot }: { snapshot: SnapshotDTO }) {
  const { live, last, next } = snapshot;

  if (live) {
    return (
      <div id="status" className="scroll-mt-32 px-4 py-6 sm:px-6">
        <Card className="border-live">
          <div className="mb-4 flex items-center justify-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-live px-4 py-2 text-xl font-black uppercase tracking-wide text-live-foreground">
              <span className="h-3 w-3 animate-pulse rounded-full bg-live-foreground" />
              Во живо
            </span>
            {live.progress ? <span className="text-2xl font-bold">{live.progress}′</span> : null}
          </div>
          <ScoreLine
            home={live.home}
            away={live.away}
            homeBadge={live.homeBadge}
            awayBadge={live.awayBadge}
            homeScore={live.homeScore}
            awayScore={live.awayScore}
          />
          <p className="mt-4 text-center text-lg text-muted-foreground sm:text-xl">
            {leagueMk(live.league)}
          </p>
          <MatchDetails match={live} />
        </Card>
      </div>
    );
  }

  const upcomingSoon = next && (isToday(next.timestamp) || hoursUntil(next.timestamp) <= 24);

  if (upcomingSoon && next) {
    return (
      <div id="status" className="scroll-mt-32 px-4 py-6 sm:px-6">
        <Card className="border-primary">
          <p className="text-center text-xl font-black uppercase text-primary sm:text-2xl">
            {isToday(next.timestamp)
              ? `Денес во ${formatTime(next.timestamp)}`
              : formatDateTime(next.timestamp)}
          </p>
          <div className="mt-4">
            <ScoreLine
              home={next.home}
              away={next.away}
              homeBadge={next.homeBadge}
              awayBadge={next.awayBadge}
              homeScore={null}
              awayScore={null}
            />
          </div>
          <p className="mt-4 text-center text-2xl font-bold">{countdown(next.timestamp)}</p>
          <p className="mt-1 text-center text-xl text-muted-foreground">
            {leagueMk(next.league)} · {next.isHome ? "дома" : "во гости"}
          </p>
          <p className="mt-3 text-center text-lg text-muted-foreground">
            Стартната постава се објавува околу еден час пред натпреварот.
          </p>
        </Card>
      </div>
    );
  }

  if (last) {
    return (
      <div id="status" className="scroll-mt-32 px-4 py-6 sm:px-6">
        <Card>
          <p className="text-center text-xl font-semibold uppercase tracking-wide text-muted-foreground">
            Последен натпревар
          </p>
          <div className="mt-3">
            <ScoreLine
              home={last.home}
              away={last.away}
              homeBadge={last.homeBadge}
              awayBadge={last.awayBadge}
              homeScore={last.homeScore}
              awayScore={last.awayScore}
            />
          </div>
          {last.outcome ? (
            <p className="mt-4 text-center">
              <span
                className={`inline-block rounded-full px-6 py-2 text-2xl font-black tracking-wide ${OUTCOME_CLASS[last.outcome]}`}
              >
                {OUTCOME_LABEL[last.outcome]}
              </span>
            </p>
          ) : null}
          <p className="mt-4 text-center text-lg text-muted-foreground sm:text-xl">
            {leagueMk(last.league)} · {formatDateTime(last.timestamp)}
          </p>
          <MatchDetails match={last} />
        </Card>
      </div>
    );
  }

  return (
    <div id="status" className="scroll-mt-32 px-4 py-6 sm:px-6">
      <Card>
        <p className="text-center text-2xl font-bold">
          Податоците за натпреварите моментално не се достапни.
        </p>
        <p className="mt-2 text-center text-xl text-muted-foreground">
          Пробајте повторно за неколку минути или{" "}
          <Link to="/chat" className="font-bold text-primary underline">
            прашајте го помошникот
          </Link>
          .
        </p>
      </Card>
    </div>
  );
}
