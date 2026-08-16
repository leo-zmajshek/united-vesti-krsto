import { Link } from "@tanstack/react-router";
import type { SnapshotDTO } from "@/lib/manutd.server";
import { Badge, Card } from "./ui";
import { OUTCOME_LABEL, countdown, formatDateTime, formatTime, hoursUntil, isToday } from "@/lib/mk";

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
    <div className="flex items-center justify-between gap-3">
      <div className="flex flex-1 flex-col items-center gap-2 text-center">
        <Badge src={homeBadge} alt={home} size={64} />
        <span className="text-xl font-bold leading-tight">{home}</span>
      </div>
      <div className="shrink-0 text-center">
        <div className="text-6xl font-black tabular-nums sm:text-7xl">
          {homeScore ?? "-"}
          <span className="mx-2 opacity-60">:</span>
          {awayScore ?? "-"}
        </div>
      </div>
      <div className="flex flex-1 flex-col items-center gap-2 text-center">
        <Badge src={awayBadge} alt={away} size={64} />
        <span className="text-xl font-bold leading-tight">{away}</span>
      </div>
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
          <p className="mt-4 text-center text-xl text-muted-foreground">{live.league}</p>
        </Card>
      </div>
    );
  }

  const upcomingSoon = next && (isToday(next.timestamp) || hoursUntil(next.timestamp) <= 24);

  if (upcomingSoon && next) {
    return (
      <div id="status" className="scroll-mt-32 px-4 py-6 sm:px-6">
        <Card className="border-primary">
          <p className="text-center text-2xl font-black uppercase text-primary">
            {isToday(next.timestamp) ? `Денес во ${formatTime(next.timestamp)}` : formatDateTime(next.timestamp)}
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
            {next.league} · {next.isHome ? "дома" : "во гости"}
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
          <p className="mt-4 text-center text-xl text-muted-foreground">
            {last.league} · {formatDateTime(last.timestamp)}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div id="status" className="scroll-mt-32 px-4 py-6 sm:px-6">
      <Card>
        <p className="text-center text-2xl font-bold">Моментално нема податоци за натпревар.</p>
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
