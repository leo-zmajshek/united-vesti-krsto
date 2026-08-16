import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { getSnapshot } from "@/lib/manutd.functions";
import { StatusBlock } from "@/components/united/StatusBlock";
import {
  NewsSection,
  NextMatchSection,
  ScheduleSection,
  StatsSection,
  TableSection,
} from "@/components/united/Sections";

const snapshotQuery = queryOptions({
  queryKey: ["united-snapshot"],
  queryFn: () => getSnapshot(),
  staleTime: 20_000,
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Манчестер Јунајтед — резултати и вести на македонски" },
      {
        name: "description",
        content:
          "Резултат во живо, последен натпревар, следен натпревар, распоред, табела, статистики и вести за Манчестер Јунајтед — сè на македонски, на една страница.",
      },
      { property: "og:title", content: "Манчестер Јунајтед — сè на едно место, на македонски" },
      {
        property: "og:description",
        content: "Резултат во живо, распоред, табела и вести за Манчестер Јунајтед на македонски јазик.",
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
        <p className="mt-3 text-xl text-muted-foreground">Проверете го интернетот и обидете се повторно.</p>
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

const NAV = [
  { href: "#status", label: "Во живо" },
  { href: "#schedule", label: "Распоред" },
  { href: "#table", label: "Табела" },
  { href: "#stats", label: "Статистики" },
  { href: "#news", label: "Вести" },
];

function Home() {
  const { data: snapshot, refetch } = useSuspenseQuery(snapshotQuery);

  useEffect(() => {
    const interval = snapshot.live ? 30_000 : 180_000;
    const id = setInterval(() => void refetch(), interval);
    return () => clearInterval(id);
  }, [snapshot.live, refetch]);

  return (
    <main className="min-h-screen bg-background pb-16">
      <header className="px-4 pt-6 text-center sm:px-6" style={{ background: "var(--gradient-hero)" }}>
        <h1 className="pb-5 text-4xl font-black uppercase leading-none tracking-tight text-primary-foreground sm:text-5xl">
          Манчестер
          <br />
          Јунајтед
        </h1>
      </header>

      <nav
        aria-label="Брзи кратенки"
        className="sticky top-0 z-20 border-b-4 border-primary bg-card/95 backdrop-blur"
      >
        <ul className="flex gap-2 overflow-x-auto px-3 py-3">
          {NAV.map((item) => (
            <li key={item.href} className="shrink-0">
              <a
                href={item.href}
                className="block rounded-xl bg-secondary px-4 py-3 text-lg font-bold text-secondary-foreground"
              >
                {item.label}
              </a>
            </li>
          ))}
          <li className="shrink-0">
            <Link
              to="/chat"
              className="block rounded-xl bg-primary px-4 py-3 text-lg font-bold text-primary-foreground"
            >
              Прашај
            </Link>
          </li>
        </ul>
      </nav>

      <StatusBlock snapshot={snapshot} />
      <NextMatchSection snapshot={snapshot} />
      <ScheduleSection snapshot={snapshot} />
      <TableSection snapshot={snapshot} />
      <StatsSection snapshot={snapshot} />
      <NewsSection snapshot={snapshot} />

      <div className="px-4 py-8 sm:px-6">
        <Link
          to="/chat"
          className="block rounded-2xl bg-primary px-6 py-6 text-center text-2xl font-black text-primary-foreground"
        >
          Прашај што сакаш за Јунајтед
        </Link>
      </div>
    </main>
  );
}
