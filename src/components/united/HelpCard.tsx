import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Card } from "./ui";

type HelpItem = {
  title: string;
  body: string;
};

const HELP_ITEMS: HelpItem[] = [
  {
    title: "Што е ова?",
    body: "Ова е ваша лична страница за Манчестер Јунајтед. Само притиснете ја иконата на телефонот и веднаш ќе видите дали Јунајтед игра, каков е резултатот, кога е следниот натпревар и што се пишува за клубот.",
  },
  {
    title: "Во живо",
    body: "На врвот на страницата стои најважното: ако Јунајтед игра во моментот, тука е резултатот во живо. Ако нема натпревар, ќе видите кога е следниот и каков беше последниот.",
  },
  {
    title: "Распоред",
    body: "Овде ги гледате одиграните и следните натпревари. Горе се последните пет натпревари означени со букви: П значи победа, Н значи нерешено, а И значи пораз. Под нив се натпреварите што претстојат.",
  },
  {
    title: "Табела",
    body: "Овде ја гледате позицијата на Јунајтед во Премиер лигата. Редот на Јунајтед е обоен со црвено за полесно да го најдете.",
  },
  {
    title: "Вести",
    body: "Најновите информации за клубот, преведени на македонски. Притиснете „Прочитај повеќе“ за да ја отворите целата вест. Ако сакате нешто да прашате за неа, притиснете „Прашај за оваа вест“.",
  },
  {
    title: "Прашај",
    body: "Притиснете го црвеното копче „Прашај“ или „Прашај што сакаш за Јунајтед“. Можете да напишете прашање или да го кажете на глас (притиснете го микрофонот). Прашајте за играчи, натпревари, тренерот — што ве интересира.",
  },
  {
    title: "Како да ја ставам на почетниот екран?",
    body: "Во прелистувачот Chrome отворете го менито горе десно (трите точки) и изберете „Додај на почетен екран“. Така ќе добиете икона како апликација — едно притискање и веднаш сте тука.",
  },
];

export function HelpCard() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // The nav that holds this button uses `backdrop-blur`, and a non-none
  // backdrop-filter makes that nav the containing block for fixed-position
  // descendants — so `inset-0` would resolve to the 375x76 nav strip instead of
  // the viewport, pushing the dialog off-screen. Render it into <body> instead.
  const dialog = open ? (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/70 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Упатство за користење"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="flex max-h-[90dvh] w-full max-w-2xl flex-col rounded-t-3xl border-4 border-primary bg-card sm:rounded-3xl">
        <div className="flex items-center justify-between border-b-2 border-border px-5 py-4">
          <h2 className="text-2xl font-black text-foreground sm:text-3xl">Упатство за користење</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-xl bg-secondary px-4 py-2 text-lg font-bold text-secondary-foreground"
          >
            Затвори
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5">
          <div className="space-y-4">
            {HELP_ITEMS.map((item) => (
              <Card key={item.title} className="border-l-8 border-l-primary">
                <h3 className="text-xl font-black text-primary sm:text-2xl">{item.title}</h3>
                <p className="mt-2 text-lg leading-relaxed text-foreground sm:text-xl">
                  {item.body}
                </p>
              </Card>
            ))}
          </div>

          <div className="mt-6 rounded-2xl bg-primary p-4 text-primary-foreground">
            <p className="text-lg font-bold sm:text-xl">
              Кратко: отворете ја страницата, прочитајте го црвениот дел на врвот, а за останатото
              повлечете надолу со прстот. Ако имате прашање, притиснете „Прашај“.
            </p>
          </div>
        </div>

        <div className="border-t-2 border-border px-5 py-4">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full rounded-xl bg-primary px-5 py-4 text-xl font-black text-primary-foreground"
          >
            Разбрав — затвори
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <li className="shrink-0">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="block rounded-xl bg-secondary px-4 py-3 text-lg font-bold text-secondary-foreground"
        >
          Упатство
        </button>
      </li>
      {dialog && typeof document !== "undefined" ? createPortal(dialog, document.body) : null}
    </>
  );
}
