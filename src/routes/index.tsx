import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { getSnapshot } from "@/lib/manutd.functions";
import { StatusBlock } from "@/components/united/StatusBlock";
import { NextMatchSection, ScheduleSection, TableSection } from "@/components/united/Sections";
import { NewsSection } from "@/components/united/NewsSection";
import { GreetingCard } from "@/components/united/GreetingCard";
import { HelpCard } from "@/components/united/HelpCard";
import { NAV_SECTION_IDS, pickActiveSection, type NavSection } from "@/lib/nav-sections";

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
   usually is not on. It now names whatever the status block is actually showing.
   Ids are shared with the scroll-spy below so the two cannot drift apart. */
function navFor(isLive: boolean) {
  return [
    { id: "status", label: isLive ? "Во живо" : "Резултат" },
    { id: "schedule", label: "Распоред" },
    { id: "table", label: "Табела" },
    { id: "news", label: "Вести" },
  ];
}

/* Which section is he actually looking at. A plain scroll read beats
   IntersectionObserver here: the sections have very different heights and the
   last one is shorter than the viewport, so "which section has passed under the
   nav" is both simpler and more predictable than band intersection. */
function useActiveSection(navListRef: React.RefObject<HTMLUListElement | null>) {
  const [active, setActive] = useState<string>(NAV_SECTION_IDS[0]);

  useEffect(() => {
    const update = () => {
      const list = navListRef.current;
      // Measure the sticky nav rather than hardcoding its height, which changes
      // with the phone's font-size setting.
      const line = (list ? list.getBoundingClientRect().bottom : 0) + 12;
      const sections: NavSection[] = [];
      for (const id of NAV_SECTION_IDS) {
        const el = document.getElementById(id);
        if (el) sections.push({ id, top: el.getBoundingClientRect().top });
      }
      // The final section is shorter than the viewport, so its top never crosses
      // the line; reaching the bottom of the page counts as reaching it.
      const atBottom =
        window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4;
      setActive(pickActiveSection(sections, line, atBottom));
    };

    /* Measured straight from the scroll handler rather than coalesced through
       requestAnimationFrame. Four read-only getBoundingClientRect calls are
       cheap, React skips the render when the section has not changed, and rAF is
       paused whenever the page is not being rendered — which made this
       impossible to test and added a failure mode for no real gain. */
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    // Android can restore a backgrounded install at a scroll position we never
    // observed, so re-measure when the page comes back.
    document.addEventListener("visibilitychange", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [navListRef]);

  return active;
}

function Home() {
  const { data: snapshot, refetch } = useSuspenseQuery(snapshotQuery);
  const queryClient = useQueryClient();

  const navListRef = useRef<HTMLUListElement | null>(null);
  const activeSection = useActiveSection(navListRef);

  /* Only about three of the buttons fit on a phone, so the highlight can end up
     off-screen. Nudge the nav's own scrollLeft — never the page — and only when
     the button is actually clipped.

     Deliberately not a smooth scroll: smooth scrolling is driven by the same
     animation clock that is paused while a page is not being rendered, and a
     nav that slides sideways under his finger mid-scroll is more distracting
     than one that simply already shows the right button. */
  useEffect(() => {
    const list = navListRef.current;
    if (!list) return;
    const link = list.querySelector<HTMLElement>(`a[href="#${activeSection}"]`);
    if (!link) return;
    const listBox = list.getBoundingClientRect();
    const linkBox = link.getBoundingClientRect();
    if (linkBox.left < listBox.left + 8) {
      list.scrollBy({ left: linkBox.left - listBox.left - 12 });
    } else if (linkBox.right > listBox.right - 8) {
      list.scrollBy({ left: linkBox.right - listBox.right + 12 });
    }
  }, [activeSection]);

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
        <ul
          ref={navListRef}
          className="flex gap-2 overflow-x-auto px-3 py-2.5 [-webkit-overflow-scrolling:touch] [scrollbar-width:none]"
        >
          {navFor(Boolean(snapshot.live)).map((item) => {
            const current = item.id === activeSection;
            return (
              <li key={item.id} className="shrink-0">
                <a
                  href={`#${item.id}`}
                  aria-current={current ? "true" : undefined}
                  /* A black outline reads clearly against both the grey buttons
                     and the red one, unlike a fill or colour change. */
                  className={`block rounded-xl bg-secondary px-4 py-3 text-base font-bold text-secondary-foreground transition-shadow sm:text-lg ${
                    current ? "ring-[3px] ring-foreground" : "ring-0"
                  }`}
                >
                  {item.label}
                </a>
              </li>
            );
          })}
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
