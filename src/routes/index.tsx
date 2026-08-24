import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { getSnapshot } from "@/lib/manutd.functions";
import { StatusBlock } from "@/components/united/StatusBlock";
import { NextMatchSection, ScheduleSection, TableSection } from "@/components/united/Sections";
import { NewsSection } from "@/components/united/NewsSection";
import { GreetingCard } from "@/components/united/GreetingCard";
import { HelpCard } from "@/components/united/HelpCard";

const snapshotQuery = queryOptions({
  queryKey: ["united-snapshot"],
  queryFn: () => getSnapshot(),
  staleTime: 5 * 60_000,
  refetchOnMount: false,
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Манчестер Јунајтед — резултати и вести на македонски" },
      {
        name: "description",
        content:
          "Резултат во живо, состави, стрелци, распоред, табела и вести за Манчестер Јунајтед — сè на македонски, на една страница.",
      },
      { property: "og:title", content: "Манчестер Јунајтед — сè на едно место, на македонски" },
      {
        property: "og:description",
        content:
          "Резултат во живо, распоред, табела и вести за Манчестер Јунајтед на македонски јазик.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#a01a1a" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(snapshotQuery),
  errorComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
      <div>
        <h1 className="text-3xl font-black">Податоците не се вчитаа</h1>
        <p className="mt-3 text-xl text-muted-foreground">
          Проверете го интернетот и обидете се повторно.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 rounded-xl bg-primary px-6 py-4 text-xl font-bold text-primary-foreground"
        >
          Обиди се повторно
        </button>
      </div>
    </div>
  ),
  notFoundComponent: () => <p className="p-6 text-xl">Страницата не е најдена.</p>,
  component: Home,
});

/* The first button used to always read "Во живо", promising a live match that
   usually is not on. It now names whatever the status block is actually showing. */
function navFor(isLive: boolean) {
  return [
    { href: "#status", label: isLive ? "Во живо" : "Резултат" },
    { href: "#schedule", label: "Распоред" },
    { href: "#table", label: "Табела" },
    { href: "#news", label: "Вести" },
  ];
}

function Home() {
  const { data: snapshot, refetch } = useSuspenseQuery(snapshotQuery);
  const queryClient = useQueryClient();

  // ESPN blocks our server's IP, so the browser tops the snapshot up with
  // cups, European and friendly matches after hydration.
  //
  // The refetch below replaces the cache with the server-only snapshot, and the
  // top-up used to be re-fetched from scratch afterwards — so every five minutes
  // the cup and friendly matches vanished for a second or two while the request
  // was in flight. Keeping the last ESPN payload lets us re-merge immediately and
  // refresh it in the background, so nothing disappears mid-read.
  const espnCache = useRef<unknown>(null);
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const { parseEspnSchedule, mergeEspnIntoSnapshot, fetchEspnSchedule } =
          await import("@/lib/espn-feed");
        if (espnCache.current) {
          const merged = await mergeEspnIntoSnapshot(
            snapshot,
            parseEspnSchedule(espnCache.current),
          );
          if (!cancelled) queryClient.setQueryData(snapshotQuery.queryKey, merged);
        }
        const fresh = await fetchEspnSchedule();
        if (cancelled) return;
        espnCache.current = fresh;
        const merged = await mergeEspnIntoSnapshot(snapshot, parseEspnSchedule(fresh));
        if (!cancelled) queryClient.setQueryData(snapshotQuery.queryKey, merged);
      } catch {
        /* keep the server snapshot */
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [snapshot.updatedAt, queryClient]);

  useEffect(() => {
    const interval = snapshot.live ? 30_000 : 5 * 60_000;
    const id = setInterval(() => void refetch(), interval);
    return () => clearInterval(id);
  }, [snapshot.live, refetch]);

  return (
    <main className="min-h-dvh bg-background pb-10">
      <header
        className="px-4 pt-5 text-center sm:px-6"
        style={{ background: "var(--gradient-hero)" }}
      >
        <h1 className="pb-4 text-3xl font-black uppercase leading-none tracking-tight text-primary-foreground sm:text-5xl">
          Манчестер
          <br />
          Јунајтед
        </h1>
      </header>

      <nav
        aria-label="Брзи кратенки"
        className="sticky top-0 z-20 border-b-4 border-primary bg-card/95 backdrop-blur"
      >
        <ul className="flex gap-2 overflow-x-auto px-3 py-2.5 [-webkit-overflow-scrolling:touch] [scrollbar-width:none]">
          {navFor(Boolean(snapshot.live)).map((item) => (
            <li key={item.href} className="shrink-0">
              <a
                href={item.href}
                className="block rounded-xl bg-secondary px-4 py-3 text-base font-bold text-secondary-foreground sm:text-lg"
              >
                {item.label}
              </a>
            </li>
          ))}
          <li className="shrink-0">
            <Link
              to="/sostav"
              className="block rounded-xl bg-secondary px-4 py-3 text-base font-bold text-secondary-foreground sm:text-lg"
            >
              Играчи
            </Link>
          </li>
          <li className="shrink-0">
            <Link
              to="/chat"
              className="block rounded-xl bg-primary px-4 py-3 text-base font-bold text-primary-foreground sm:text-lg"
            >
              Прашај
            </Link>
          </li>
          <HelpCard />
        </ul>
      </nav>

      <GreetingCard />
      {snapshot.availability === "stale" ? (
        <p className="mx-4 mt-5 rounded-lg border-2 border-warning bg-warning/15 px-4 py-3 text-center text-lg font-bold sm:mx-6">
          Прикажани се последните зачувани податоци. Новите податоци моментално се недостапни.
        </p>
      ) : null}
      <StatusBlock snapshot={snapshot} />
      <NextMatchSection snapshot={snapshot} />
      <ScheduleSection snapshot={snapshot} />
      <TableSection snapshot={snapshot} />
      <NewsSection snapshot={snapshot} />

      <div className="px-4 py-6 sm:px-6 sm:py-8">
        <Link
          to="/chat"
          className="block rounded-2xl bg-primary px-5 py-5 text-center text-xl font-black text-primary-foreground sm:text-2xl"
        >
          Прашај што сакаш за Јунајтед
        </Link>
      </div>

      <footer className="px-4 pb-[max(2rem,env(safe-area-inset-bottom))] text-center text-base text-muted-foreground sm:px-6 sm:text-lg">
        <p>
          Совет: во Chrome отворете го менито (три точки) и изберете „Додај на почетен екран“ за да
          ја отворате страницата со едно допирање.
        </p>
      </footer>
    </main>
  );
}
