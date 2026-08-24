import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { getSnapshot } from "@/lib/manutd.functions";
import { StatusBlock } from "@/components/united/StatusBlock";
import { NextMatchSection, ScheduleSection, TableSection } from "@/components/united/Sections";
import { NewsSection } from "@/components/united/NewsSection";
import { GreetingCard } from "@/components/united/GreetingCard";
import { TopNav } from "@/components/united/TopNav";

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

      <div className="sticky top-0 z-20">
        <TopNav variant="home" isLive={Boolean(snapshot.live)} />
      </div>

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
