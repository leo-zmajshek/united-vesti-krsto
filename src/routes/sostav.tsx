import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getSquad } from "@/lib/manutd.functions";
import { POSITION_GROUPS_MK, agePhraseMk, countryMk, positionMk } from "@/lib/mk";
import type { SquadPlayerDTO } from "@/lib/manutd.types";

/* Static basics only — no live stats and no refresh loop. The squad changes a
   handful of times a season, so it is cached hard on the server and this page
   simply reads it. */
const squadQuery = queryOptions({
  queryKey: ["united-squad"],
  queryFn: () => getSquad(),
  staleTime: 12 * 60 * 60_000,
  refetchOnMount: false,
});

export const Route = createFileRoute("/sostav")({
  head: () => ({
    meta: [
      { title: "Играчите на Манчестер Јунајтед — состав на македонски" },
      {
        name: "description",
        content:
          "Целиот состав на Манчестер Јунајтед: голмани, одбрана, средина и напад, со број на дрес, возраст и државја на секој играч.",
      },
      { property: "og:title", content: "Играчите на Манчестер Јунајтед" },
      { property: "og:type", content: "website" },
      { name: "theme-color", content: "#a01a1a" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(squadQuery),
  errorComponent: () => (
    <SquadShell>
      <p className="text-xl sm:text-2xl">Списокот на играчи не се вчита.</p>
      <p className="mt-2 text-lg text-muted-foreground sm:text-xl">
        Проверете го интернетот и обидете се повторно.
      </p>
    </SquadShell>
  ),
  component: SquadPage,
});

function SquadShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-background pb-10">
      <header
        className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3"
        style={{ background: "var(--gradient-hero)" }}
      >
        <Link
          to="/"
          className="shrink-0 rounded-xl bg-card px-4 py-3 text-base font-bold text-card-foreground sm:text-lg"
          aria-label="Назад на почетната страница"
        >
          ← Назад
        </Link>
        <h1 className="min-w-0 text-xl font-black leading-tight text-primary-foreground sm:text-2xl">
          Играчите на Јунајтед
        </h1>
      </header>
      <div className="px-4 py-6 sm:px-6">{children}</div>
    </main>
  );
}

function PlayerRow({ player }: { player: SquadPlayerDTO }) {
  const details = [positionMk(player.position), agePhraseMk(player.age), countryMk(player.country)]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="flex items-center gap-4 border-t-2 border-border px-4 py-4 first:border-t-0 sm:px-5">
      {/* Face plus number, not one or the other: the photo is what he recognises
          at a glance, the number is what he matches against a lineup. Players
          without a verified photo keep the plain number circle. */}
      <div className="relative shrink-0">
        {player.photo ? (
          <img
            src={player.photo}
            alt={player.name}
            width={72}
            height={72}
            loading="lazy"
            decoding="async"
            /* Wikipedia headshots are portrait, so anchor the crop to the top
               to keep the face in frame rather than centring on the chest. */
            className="h-[72px] w-[72px] rounded-full border-2 border-border bg-muted object-cover [object-position:50%_15%]"
          />
        ) : (
          <span
            className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-primary text-3xl font-black tabular-nums text-primary-foreground"
            aria-hidden="true"
          >
            {player.shirt ?? "–"}
          </span>
        )}
        {player.photo && player.shirt != null ? (
          <span
            className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-primary text-base font-black tabular-nums text-primary-foreground"
            aria-hidden="true"
          >
            {player.shirt}
          </span>
        ) : null}
      </div>
      <div className="min-w-0">
        {/* Player names keep the provider's Latin spelling — he reads it fine,
            and transliterating gives wrong-looking Macedonian. */}
        <p className="text-xl font-bold leading-tight break-words sm:text-2xl">
          {player.shirt != null ? <span className="sr-only">Број {player.shirt}. </span> : null}
          {player.name}
        </p>
        <p className="mt-1 text-base text-muted-foreground sm:text-lg">{details}</p>
      </div>
    </li>
  );
}

function SquadPage() {
  const { data: squad } = useSuspenseQuery(squadQuery);

  if (squad.players.length === 0) {
    return (
      <SquadShell>
        <p className="text-xl sm:text-2xl">Списокот на играчи моментално не е достапен.</p>
        <p className="mt-2 text-lg text-muted-foreground sm:text-xl">
          Пробајте повторно за неколку минути.
        </p>
      </SquadShell>
    );
  }

  const groups = POSITION_GROUPS_MK.map((group) => ({
    ...group,
    // Squad lists read best by shirt number; players without one go last.
    players: squad.players
      .filter((p) => p.position === group.key)
      .sort((a, b) => (a.shirt ?? 999) - (b.shirt ?? 999)),
  })).filter((group) => group.players.length > 0);

  return (
    <SquadShell>
      <p className="text-lg leading-relaxed sm:text-xl">
        Целиот состав на Манчестер Јунајтед, поделен по позиции. Бројот е бројот на дресот.
      </p>
      {squad.coach ? (
        <div
          className="mt-5 rounded-2xl border-2 border-border bg-card p-4 text-card-foreground sm:p-5"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <p className="text-base font-semibold uppercase tracking-wide text-muted-foreground sm:text-lg">
            Тренер
          </p>
          <p className="mt-1 text-xl font-black sm:text-2xl">{squad.coach}</p>
        </div>
      ) : null}

      {groups.map((group) => (
        <section key={group.key} className="mt-8">
          <h2 className="text-2xl font-black uppercase leading-tight tracking-tight sm:text-3xl">
            {group.title}
          </h2>
          <div className="mt-2 h-1.5 w-20 rounded-full bg-primary" />
          <ul
            className="mt-4 overflow-hidden rounded-2xl border-2 border-border bg-card"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            {group.players.map((player) => (
              <PlayerRow key={`${player.name}-${player.shirt ?? "x"}`} player={player} />
            ))}
          </ul>
        </section>
      ))}

      <p className="mt-8 text-base text-muted-foreground sm:text-lg">
        Фотографиите се од Википедија. За некои играчи нема слика, па стои само бројот на дресот.
      </p>

      <div className="mt-6">
        <Link
          to="/"
          className="block rounded-2xl bg-primary px-5 py-5 text-center text-xl font-black text-primary-foreground sm:text-2xl"
        >
          Назад на почетната страница
        </Link>
      </div>
    </SquadShell>
  );
}
