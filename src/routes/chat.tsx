import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { askUnited } from "@/lib/manutd.functions";
import { TopNav } from "@/components/united/TopNav";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Прашај за Манчестер Јунајтед — помошник на македонски" },
      {
        name: "description",
        content:
          "Поставете прашање за Манчестер Јунајтед и добијте краток и јасен одговор на македонски јазик.",
      },
      { property: "og:title", content: "Прашај за Манчестер Јунајтед" },
      {
        property: "og:description",
        content:
          "Помошник кој одговара на македонски за сè што ве интересира за Манчестер Јунајтед.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChatPage,
});

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Кога играат следниот натпревар?",
  "Кој е тренер на Јунајтед?",
  "Како играа последно?",
  "Кој е најдобар стрелец?",
];

function ChatPage() {
  const ask = useServerFn(askUnited);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(question: string) {
    const text = question.trim();
    if (!text || loading) return;
    setError(null);
    setInput("");
    const history = messages.slice(-8);
    setMessages((m) => [...m, { role: "user", content: text }]);
    setLoading(true);
    try {
      const res = await ask({ data: { question: text, history } });
      if (res.error) setError(res.error);
      else setMessages((m) => [...m, { role: "assistant", content: res.answer }]);
    } catch (err) {
      console.error(err);
      setError("Нема врска со интернет. Пробајте повторно.");
    } finally {
      setLoading(false);
    }
  }

  function startVoice() {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      setError("Говорот не е достапен на овој телефон. Напишете го прашањето.");
      return;
    }
    const rec = new Ctor();
    rec.lang = "mk-MK";
    rec.interimResults = false;
    rec.onresult = (e) => {
      const text = e.results?.[0]?.[0]?.transcript ?? "";
      setListening(false);
      if (text) void send(text);
    };
    rec.onerror = () => {
      setListening(false);
      setError("Не го слушнав прашањето. Пробајте повторно.");
    };
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  }

  return (
    <main className="flex min-h-dvh flex-col bg-background">
      {/* Header and shortcuts stick together, so he can see where he is and
          jump anywhere without scrolling back up. */}
      <div className="sticky top-0 z-20">
        <header
          className="flex items-center gap-3 px-4 py-3"
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
            Прашај за Јунајтед
          </h1>
        </header>
        <TopNav variant="page" current="chat" />
      </div>

      <div className="flex-1 space-y-4 px-4 py-5">
        {messages.length === 0 ? (
          <div>
            <p className="text-lg leading-relaxed sm:text-xl">
              Прашајте што сакате за Манчестер Јунајтед. Одговорот доаѓа на македонски, кратко и
              јасно.
            </p>
            <ul className="mt-4 space-y-3">
              {SUGGESTIONS.map((s) => (
                <li key={s}>
                  <button
                    onClick={() => void send(s)}
                    className="min-h-14 w-full rounded-2xl border-2 border-border bg-card px-4 py-4 text-left text-lg font-semibold sm:text-xl"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded-2xl px-4 py-3 text-lg leading-relaxed sm:text-xl ${
              m.role === "user"
                ? "ml-6 bg-secondary text-secondary-foreground"
                : "mr-2 border-2 border-border bg-card text-card-foreground"
            }`}
          >
            {m.content}
          </div>
        ))}

        {loading ? <p className="text-lg text-muted-foreground">Размислувам…</p> : null}
        {error ? (
          <p className="rounded-2xl bg-destructive px-4 py-3 text-lg text-destructive-foreground">
            {error}
          </p>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="sticky bottom-0 border-t-4 border-border bg-card px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <label htmlFor="q" className="sr-only">
          Вашето прашање
        </label>
        <textarea
          id="q"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={2}
          placeholder="Напишете прашање…"
          className="w-full rounded-2xl border-2 border-input bg-background px-4 py-3 text-lg sm:text-xl"
        />
        <div className="mt-3 flex gap-3">
          <button
            type="button"
            onClick={startVoice}
            className="min-h-14 shrink-0 rounded-2xl border-2 border-primary px-4 py-4 text-lg font-bold text-primary sm:text-xl"
          >
            {listening ? "Слушам…" : "🎤 Кажи"}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="min-h-14 flex-1 rounded-2xl bg-primary px-5 py-4 text-lg font-black text-primary-foreground disabled:opacity-60 sm:text-xl"
          >
            Прашај
          </button>
        </div>
      </form>
    </main>
  );
}

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  start: () => void;
  onresult: (e: { results?: { [k: number]: { [k: number]: { transcript?: string } } } }) => void;
  onerror: () => void;
  onend: () => void;
};
