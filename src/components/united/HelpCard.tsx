import { useEffect, useState } from "react";
import { Card } from "./ui";

type HelpItem = {
  title: string;
  body: string;
};

const HELP_ITEMS: HelpItem[] = [
  {
    title: "Што е ова?",
    body:
      "Ова е ваша лична страница за Манчестер Јунајтед. Само допрете ја иконата на телефонот и веднаш ќе видите дали Јунајтед игра, кој е резултатот, кога е следниот натпревар и што се пишува за клубот.",
  },
  {
    title: "Во живо",
    body:
      "На врвот на страницата стои најважното: ако Јунајтед моментално игра, тука е резултатот во живо. Ако нема натпревар, ќе ви покаже кога е следниот или каков бил последниот.",
  },
  {
    title: "Распоред",
    body:
      "Во овој дел ги гледате минатите и идните натпревари. Горе се петте последни натпревари со броеви: П значи победа, Н значи нерешено, И значи изгубено. Под нив се следните натпревари што доаѓаат.",
  },
  {
    title: "Табела",
    body:
      "Овде ја гледате позицијата на Јунајтед во Премиер лигата. Редот на Јунајтед е обоен со црвена боја за да го најдете лесно.",
  },
  {
    title: "Вести",
    body:
      "Најновите информации за клубот, преведени на македонски. Докоснете „Прочитај повеќе“ за да ја отворите целата вест. Докоснете „Прашај за оваа вест“ ако сакате да разговарате за неа.",
  },
  {
    title: "Прашај",
    body:
      "Докоснете го црвеното копче „Прашај“ или „Прашај што сакаш за Јунајтед“. Можете да пишувате или да зборувате (докоснете го микрофонот). Прашајте за играчи, натпревари, тренер — што сакате.",
  },
  {
    title: "Како да ја ставам на почетниот екран?",
    body:
      "Во Chrome (Google) прелистувачот, отворете го менито горе-десно (три точки) и изберете „Додај на почетен екран“. Така ќе имате икона како апликација — едно допирање и сте тука.",
  },
];

export function HelpCard() {
  const [open, setOpen] = useState(false);

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

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/70 p-0 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Упатство за користење"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-t-3xl border-4 border-primary bg-card sm:rounded-3xl">
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
                    <p className="mt-2 text-lg leading-relaxed text-foreground sm:text-xl">{item.body}</p>
                  </Card>
                ))}
              </div>

              <div className="mt-6 rounded-2xl bg-primary p-4 text-primary-foreground">
                <p className="text-lg font-bold sm:text-xl">
                  Кратко: отворете ја страницата, читајте го црвениот дел на врвот, а за остатокот скролувајте надолу. Ако имате прашање, докоснете „Прашај“.
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
      ) : null}
    </>
  );
}
