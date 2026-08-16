import type { SnapshotDTO } from "@/lib/manutd.types";
import { Badge, Card, Section, SectionHeading, SerbianFlagTag } from "./ui";
import { OUTCOME_SHORT, formatDateTime, leagueMk, teamMk } from "@/lib/mk";

const FORM_CLASS = {
  win: "bg-success text-success-foreground",
  draw: "bg-warning text-warning-foreground",
  loss: "bg-destructive text-destructive-foreground",
} as const;

export function NextMatchSection({ snapshot }: { snapshot: SnapshotDTO }) {
  const next = snapshot.next;
  return (
    <Section>
      <SectionHeading id="next" title="Следен натпревар" />
      <div className="mt-5">
        {next ? (
          <Card>
            <div className="flex items-center gap-4">
              <Badge src={next.opponentBadge} alt={next.opponent} size={72} />
              <div>
                <p className="text-2xl font-black">{teamMk(next.opponent)}</p>
                <p className="mt-1 text-xl">{next.isHome ? "Игра дома" : "Игра во гости"}</p>
                <p className="mt-1 text-xl text-muted-foreground">{leagueMk(next.league)}</p>
              </div>
            </div>
            <p className="mt-4 border-t-2 border-border pt-4 text-2xl font-bold text-primary">
              {formatDateTime(next.timestamp)}
            </p>
          </Card>
        ) : (
          <Card>
            <p className="text-xl">Сè уште нема закажан нареден натпревар.</p>
          </Card>
        )}
      </div>
    </Section>
  );
}

export function ScheduleSection({ snapshot }: { snapshot: SnapshotDTO }) {
  return (
    <Section>
      <SectionHeading id="schedule" title="Распоред на натпревари" hint="Што следи и што помина." />
      <h3 className="mt-6 text-2xl font-bold">Наскоро</h3>
      <ul className="mt-3 space-y-3">
        {snapshot.fixtures.length === 0 ? (
          <li className="text-xl text-muted-foreground">Нема закажани натпревари.</li>
        ) : (
          snapshot.fixtures.map((m) => (
            <li key={m.id}>
              <Card className="flex items-center gap-4">
                <Badge src={m.opponentBadge} alt={m.opponent} size={48} />
                <div className="min-w-0">
                  <p className="text-xl font-bold">
                    {m.isHome ? "Дома против " : "Во гости кај "}
                    {teamMk(m.opponent)}
                  </p>
                  <p className="text-lg text-muted-foreground">
                    {formatDateTime(m.timestamp)} · {leagueMk(m.league)}
                  </p>
                </div>
              </Card>
            </li>
          ))
        )}
      </ul>

      <h3 className="mt-8 text-2xl font-bold">Изиграни натпревари</h3>
      <ul className="mt-3 space-y-3">
        {snapshot.results.length === 0 ? (
          <li className="text-xl text-muted-foreground">Нема податоци.</li>
        ) : (
          snapshot.results.map((m) => (
            <li key={m.id}>
              <Card className="flex items-center gap-4">
                <Badge src={m.opponentBadge} alt={m.opponent} size={48} />
                <div className="min-w-0 flex-1">
                  <p className="text-xl font-bold">
                    {m.isHome ? "Дома против " : "Во гости кај "}
                    {teamMk(m.opponent)}
                  </p>
                  <p className="text-lg text-muted-foreground">
                    {formatDateTime(m.timestamp)} · {leagueMk(m.league)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-2xl font-black tabular-nums">
                    {m.homeScore ?? "-"}:{m.awayScore ?? "-"}
                  </p>
                  {m.outcome ? (
                    <span
                      className={`mt-1 inline-block rounded-full px-3 py-0.5 text-base font-bold ${FORM_CLASS[m.outcome]}`}
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
          <p className="p-4 text-xl text-muted-foreground">Табелата моментално не е достапна.</p>
        ) : (
          <table className="w-full text-lg">
            <thead>
              <tr className="bg-secondary text-secondary-foreground">
                <th className="px-2 py-3 text-left font-bold">#</th>
                <th className="px-2 py-3 text-left font-bold">Тим</th>
                <th className="px-2 py-3 text-right font-bold">Од</th>
                <th className="px-2 py-3 text-right font-bold">Бод</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.table.map((r) => (
                <tr
                  key={`${r.rank}-${r.team}`}
                  className={`border-t border-border ${r.isUnited ? "bg-primary text-primary-foreground" : ""}`}
                >
                  <td className="px-2 py-3 font-bold tabular-nums">{r.rank}</td>
                  <td className="px-2 py-3 font-semibold">{teamMk(r.team)}</td>
                  <td className="px-2 py-3 text-right tabular-nums">{r.played}</td>
                  <td className="px-2 py-3 text-right text-xl font-black tabular-nums">{r.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Section>
  );
}

export function StatsSection({ snapshot }: { snapshot: SnapshotDTO }) {
  const row = snapshot.table.find((r) => r.isUnited);
  return (
    <Section>
      <SectionHeading id="stats" title="Статистики" hint="Форма во последните натпревари." />
      <div className="mt-5 flex flex-wrap gap-3">
        {snapshot.form.length === 0 ? (
          <p className="text-xl text-muted-foreground">Нема податоци за форма.</p>
        ) : (
          snapshot.form.map((f, i) => (
            <span
              key={i}
              className={`flex h-14 w-14 items-center justify-center rounded-full text-2xl font-black ${FORM_CLASS[f]}`}
            >
              {OUTCOME_SHORT[f]}
            </span>
          ))
        )}
      </div>
      <p className="mt-3 text-lg text-muted-foreground">П = победа, Н = нерешено, И = изгубено</p>

      {row ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Одиграни", value: row.played },
            { label: "Победи", value: row.win },
            { label: "Нерешени", value: row.draw },
            { label: "Порази", value: row.loss },
            { label: "Дадени голови", value: row.goalsFor },
            { label: "Примени голови", value: row.goalsAgainst },
            { label: "Бодови", value: row.points },
            { label: "Место", value: row.rank },
          ].map((s) => (
            <Card key={s.label} className="text-center">
              <p className="text-4xl font-black tabular-nums text-primary">{s.value}</p>
              <p className="mt-1 text-lg text-muted-foreground">{s.label}</p>
            </Card>
          ))}
        </div>
      ) : null}
    </Section>
  );
}

export function NewsSection({ snapshot }: { snapshot: SnapshotDTO }) {
  return (
    <Section>
      <SectionHeading id="news" title="Вести" hint="Најново за клубот." />
      <ul className="mt-5 space-y-4">
        {snapshot.news.length === 0 ? (
          <li className="text-xl text-muted-foreground">Моментално нема вести.</li>
        ) : (
          snapshot.news.map((n) => (
            <li key={n.link}>
              <Card>
                <h3 className="text-2xl font-bold leading-snug">{n.title}</h3>
                {n.summary ? <p className="mt-2 text-xl leading-relaxed">{n.summary}</p> : null}
                {n.source ? <p className="mt-2 text-lg text-muted-foreground">Извор: {n.source}</p> : null}
                {n.serbianOnly ? <SerbianFlagTag /> : null}
              </Card>
            </li>
          ))
        )}
      </ul>
    </Section>
  );
}
