import type { SnapshotDTO } from "@/lib/manutd.types";
import { Badge, Card, Section, SectionHeading } from "./ui";
import { OUTCOME_SHORT, formatDateTime, leagueMk, teamMk } from "@/lib/mk";

const FORM_CLASS = {
  win: "bg-success text-success-foreground",
  draw: "bg-warning text-warning-foreground",
  loss: "bg-destructive text-destructive-foreground",
} as const;

const OUTCOME_WORD = {
  win: "победа",
  draw: "нерешено",
  loss: "изгубено",
} as const;

export function NextMatchSection({ snapshot }: { snapshot: SnapshotDTO }) {
  const next = snapshot.next;
  return (
    <Section>
      <SectionHeading id="next" title="Следен натпревар" />
      <div className="mt-5">
        {next ? (
          <Card>
            <div className="flex items-center gap-3 sm:gap-4">
              <Badge src={next.opponentBadge} alt={next.opponent} size={56} />
              <div className="min-w-0">
                <p className="text-xl font-black break-words sm:text-2xl">
                  {teamMk(next.opponent)}
                </p>
                <p className="mt-1 text-lg sm:text-xl">
                  {next.isHome ? "Игра дома" : "Игра во гости"}
                </p>
                <p className="mt-1 text-base text-muted-foreground sm:text-xl">
                  {leagueMk(next.league)}
                </p>
              </div>
            </div>
            <p className="mt-4 border-t-2 border-border pt-4 text-xl font-bold text-primary sm:text-2xl">
              {formatDateTime(next.timestamp)}
            </p>
          </Card>
        ) : (
          <Card>
            <p className="text-lg sm:text-xl">Сè уште нема закажан нареден натпревар.</p>
          </Card>
        )}
      </div>
    </Section>
  );
}

/* The competition behind "form" changes with the calendar: in August it is
   pre-season friendlies, once the season starts it is the league. Naming it from
   the data keeps the heading honest instead of hardcoding one competition. */
function formCompetition(matches: { league: string }[]): string {
  const names = [...new Set(matches.map((m) => leagueMk(m.league)).filter(Boolean))];
  if (names.length === 0) return "";
  if (names.length > 1) return "сите натпревари";
  return names[0]!.replace(/натпревар$/, "натпревари");
}

export function ScheduleSection({ snapshot }: { snapshot: SnapshotDTO }) {
  const formMatches = snapshot.results
    .filter((m) => m.outcome)
    .slice(0, 5)
    .reverse();
  const formLeague = formCompetition(formMatches);
  return (
    <Section>
      <SectionHeading id="schedule" title="Распоред на натпревари" hint="Што следи и што помина." />

      {formMatches.length > 0 ? (
        <div className="mt-6">
          <h3 className="text-xl font-bold sm:text-2xl">
            Форма во последните {formMatches.length} натпревари
            {formLeague ? (
              <span className="font-normal text-muted-foreground"> · {formLeague}</span>
            ) : null}
          </h3>
          <div className="mt-3 flex flex-wrap gap-2 sm:gap-3">
            {formMatches.map((m, i) => (
              <span
                key={m.id}
                className={`flex h-12 w-12 items-center justify-center rounded-full text-xl font-black sm:h-14 sm:w-14 sm:text-2xl ${FORM_CLASS[m.outcome!]}`}
                aria-label={`Натпревар ${i + 1}: ${OUTCOME_SHORT[m.outcome!]}`}
              >
                {OUTCOME_SHORT[m.outcome!]}
                <sup className="ml-0.5 text-sm">{i + 1}</sup>
              </span>
            ))}
          </div>
          <ul className="mt-3 space-y-1">
            {formMatches.map((m, i) => (
              <li key={m.id} className="text-base text-muted-foreground sm:text-lg">
                <span className="font-bold text-foreground">{i + 1}*</span>{" "}
                {m.isHome ? "Дома против " : "Во гости кај "}
                {teamMk(m.opponent)} — {m.homeScore ?? "-"}:{m.awayScore ?? "-"} (
                {OUTCOME_WORD[m.outcome!]}){m.league ? ` · ${leagueMk(m.league)}` : ""}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-base text-muted-foreground sm:text-lg">
            П = победа, Н = нерешено, И = изгубено
          </p>
        </div>
      ) : null}

      <h3 className="mt-8 text-xl font-bold sm:text-2xl">Наскоро</h3>
      <ul className="mt-3 space-y-3">
        {snapshot.fixtures.length === 0 ? (
          <li className="text-lg text-muted-foreground">Нема закажани натпревари.</li>
        ) : (
          snapshot.fixtures.map((m) => (
            <li key={m.id}>
              <Card className="flex items-center gap-3">
                <Badge src={m.opponentBadge} alt={m.opponent} size={44} />
                <div className="min-w-0">
                  <p className="text-lg font-bold break-words sm:text-xl">
                    {m.isHome ? "Дома против " : "Во гости кај "}
                    {teamMk(m.opponent)}
                  </p>
                  <p className="text-base text-muted-foreground sm:text-lg">
                    {formatDateTime(m.timestamp)} · {leagueMk(m.league)}
                  </p>
                </div>
              </Card>
            </li>
          ))
        )}
      </ul>

      <h3 className="mt-8 text-xl font-bold sm:text-2xl">Изиграни натпревари</h3>
      <ul className="mt-3 space-y-3">
        {snapshot.results.length === 0 ? (
          <li className="text-lg text-muted-foreground">Нема податоци.</li>
        ) : (
          snapshot.results.map((m) => (
            <li key={m.id}>
              <Card className="flex items-center gap-3">
                <Badge src={m.opponentBadge} alt={m.opponent} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-bold break-words sm:text-xl">
                    {m.isHome ? "Дома против " : "Во гости кај "}
                    {teamMk(m.opponent)}
                  </p>
                  <p className="text-base text-muted-foreground sm:text-lg">
                    {formatDateTime(m.timestamp)} · {leagueMk(m.league)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xl font-black tabular-nums sm:text-2xl">
                    {m.homeScore ?? "-"}:{m.awayScore ?? "-"}
                  </p>
                  {m.outcome ? (
                    <span
                      className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-sm font-bold sm:text-base ${FORM_CLASS[m.outcome]}`}
                    >
                      {OUTCOME_SHORT[m.outcome]}
                    </span>
                  ) : null}
                </div>
              </Card>
            </li>
          ))
        )}
      </ul>
    </Section>
  );
}

export function TableSection({ snapshot }: { snapshot: SnapshotDTO }) {
  return (
    <Section>
      <SectionHeading id="table" title="Табела" hint="Премиер лига." />
      <div className="mt-5 overflow-hidden rounded-2xl border-2 border-border bg-card">
        {snapshot.table.length === 0 ? (
          <p className="p-4 text-lg text-muted-foreground">Табелата моментално не е достапна.</p>
        ) : (
          <table className="w-full table-fixed text-base sm:text-lg">
            <thead>
              <tr className="bg-secondary text-secondary-foreground">
                <th className="w-9 px-2 py-3 text-left font-bold">#</th>
                <th className="px-2 py-3 text-left font-bold">Тим</th>
                <th className="w-12 px-1 py-3 text-right font-bold">Од</th>
                <th className="w-14 px-2 py-3 text-right font-bold">Бод</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.table.map((r) => (
                <tr
                  key={`${r.rank}-${r.team}`}
                  className={`border-t border-border ${r.isUnited ? "bg-primary text-primary-foreground" : ""}`}
                >
                  <td className="px-2 py-3 font-bold tabular-nums">{r.rank}</td>
                  <td className="px-2 py-3 font-semibold break-words">{teamMk(r.team)}</td>
                  <td className="px-1 py-3 text-right tabular-nums">{r.played}</td>
                  <td className="px-2 py-3 text-right text-lg font-black tabular-nums sm:text-xl">
                    {r.points}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Section>
  );
}
