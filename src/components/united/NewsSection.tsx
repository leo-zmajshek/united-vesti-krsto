import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import type { NewsItemDTO, SnapshotDTO } from "@/lib/manutd.types";
import { Card, Section, SectionHeading, SerbianFlagTag } from "./ui";
import { askAboutNews, expandNews } from "@/lib/manutd.functions";

type Msg = { role: "user" | "assistant"; content: string };

function NewsCard({ item }: { item: NewsItemDTO }) {
  const expand = useServerFn(expandNews);
  const ask = useServerFn(askAboutNews);

  const [open, setOpen] = useState(false);
  const [article, setArticle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);

  async function onExpand() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (article || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await expand({
        data: {
          title: item.title,
          summary: item.summary,
          source: item.source,
          link: item.link,
          published: item.published,
        },
      });

      if (res.error) setError(res.error);
      else setArticle(res.article);
    } catch {
      setError("Не успеав да ја отворам веста. Пробајте повторно.");
    } finally {
      setLoading(false);
    }
  }

  async function onAsk(e: React.FormEvent) {
    e.preventDefault();
    const text = question.trim();
    if (!text || asking) return;
    setQuestion("");
    const history = messages.slice(-6);
    setMessages((m) => [...m, { role: "user", content: text }]);
    setAsking(true);
    try {
      const res = await ask({
        data: {
          question: text,
          article: article || item.summary,
          title: item.title,
          history,
        },
      });
      setMessages((m) => [
        ...m,
        { role: "assistant", content: res.error ? res.error : res.answer },
      ]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Не успеав да одговорам. Пробајте повторно." }]);
    } finally {
      setAsking(false);
    }
  }

  return (
    <Card>
      <h3 className="text-xl font-bold leading-snug break-words sm:text-2xl" suppressHydrationWarning>
        {item.title}
      </h3>
      {item.summary ? (
        <p className="mt-2 text-lg leading-relaxed sm:text-xl" suppressHydrationWarning>
          {item.summary}
        </p>
      ) : null}
      {item.source || item.published ? (
        <p className="mt-2 text-base text-muted-foreground sm:text-lg">
          {[item.source ? `Извор: ${item.source}` : "", item.published].filter(Boolean).join(" · ")}
        </p>
      ) : null}
      {item.serbianOnly ? <SerbianFlagTag /> : null}


      <button
        type="button"
        onClick={onExpand}
        aria-expanded={open}
        className="mt-4 min-h-14 w-full rounded-xl bg-primary px-5 py-4 text-lg font-bold text-primary-foreground sm:text-xl"
      >
        {open ? "Затвори ја веста" : "Прочитај повеќе"}
      </button>

      {open ? (
        <div className="mt-4 rounded-2xl border-2 border-border bg-background p-4">
          {loading ? (
            <div className="space-y-3" aria-live="polite">
              <p className="text-lg text-muted-foreground sm:text-xl">Ја подготвувам веста…</p>
              <div className="h-5 w-full animate-pulse rounded bg-muted" />
              <div className="h-5 w-5/6 animate-pulse rounded bg-muted" />
              <div className="h-5 w-4/6 animate-pulse rounded bg-muted" />
            </div>
          ) : error ? (
            <p className="text-lg text-destructive sm:text-xl">{error}</p>
          ) : (
            <div className="space-y-3">
              {article.split(/\n{2,}/).map((p, i) => (
                <p key={i} className="text-lg leading-relaxed sm:text-xl">
                  {p}
                </p>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setChatOpen(true)}
            className="mt-5 min-h-14 w-full rounded-xl bg-secondary px-5 py-4 text-lg font-bold text-secondary-foreground sm:text-xl"
          >
            Прашај за оваа вест
          </button>
        </div>
      ) : null}

      {chatOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/60 p-0 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Прашај за веста"
        >
          <div className="flex max-h-[88dvh] w-full max-w-xl flex-col rounded-t-3xl border-2 border-border bg-card sm:rounded-3xl">
            <div className="flex items-start gap-3 border-b-2 border-border p-4">
              <p className="min-w-0 flex-1 text-lg font-bold leading-snug break-words sm:text-xl">{item.title}</p>
              <button
                type="button"
                onClick={() => setChatOpen(false)}
                className="shrink-0 rounded-xl bg-secondary px-4 py-3 text-base font-bold text-secondary-foreground sm:text-lg"
              >
                Затвори
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {messages.length === 0 ? (
                <p className="text-lg text-muted-foreground sm:text-xl">
                  Прашајте што сакате за оваа вест, на македонски.
                </p>
              ) : (
                messages.map((m, i) =>
                  m.role === "user" ? (
                    <p
                      key={i}
                      className="ml-auto max-w-[85%] rounded-2xl bg-primary px-4 py-3 text-lg font-semibold text-primary-foreground sm:text-xl"
                    >
                      {m.content}
                    </p>
                  ) : (
                    <p key={i} className="max-w-[95%] text-lg leading-relaxed text-foreground sm:text-xl">
                      {m.content}
                    </p>
                  ),
                )
              )}
              {asking ? <p className="text-lg text-muted-foreground">Размислувам…</p> : null}
            </div>

            <form onSubmit={onAsk} className="border-t-2 border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={2}
                placeholder="Напишете прашање…"
                className="w-full rounded-xl border-2 border-border bg-background p-3 text-lg text-foreground sm:text-xl"
              />
              <button
                type="submit"
                disabled={asking || question.trim().length === 0}
                className="mt-3 min-h-14 w-full rounded-xl bg-primary px-5 py-4 text-lg font-bold text-primary-foreground disabled:opacity-50 sm:text-xl"
              >
                Прашај
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </Card>
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
              <NewsCard item={n} />
            </li>
          ))
        )}
      </ul>
    </Section>
  );
}
