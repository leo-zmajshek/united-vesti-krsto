import { useEffect, useState } from "react";

const GREETINGS: { heading: string; sub: string }[] = [
  { heading: "Добро утро, Крсто!", sub: "Еве што е ново кај Јунајтед додека пиеш кафе." },
  { heading: "Здраво, Крсто!", sub: "Сè за Црвените ѓаволи на едно место." },
  { heading: "Добар ден, Крсто!", sub: "Погледни го најновото од Олд Трафорд." },
  { heading: "Добра вечер, Крсто!", sub: "Резултати, распоред и вести — сè на македонски." },
  { heading: "Крсто, добредојде!", sub: "Твојот Манчестер Јунајтед те чека." },
  { heading: "Ајде, Јунајтед!", sub: "Крсто, еве како стојат работите денес." },
];

function pick() {
  const hour = new Date().getHours();
  const timely = hour < 11 ? 0 : hour < 17 ? 2 : 3;
  const pool = [timely, 1, 4, 5];
  return pool[Math.floor(Math.random() * pool.length)]!;
}

export function GreetingCard() {
  const [index, setIndex] = useState(1);

  useEffect(() => {
    setIndex(pick());
  }, []);

  const g = GREETINGS[index]!;

  return (
    <section className="px-4 pt-5 sm:px-6">
      <div
        className="rounded-2xl border-2 border-border bg-card p-5 text-card-foreground"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <p className="text-2xl font-black leading-tight text-primary sm:text-4xl">{g.heading}</p>
        <p className="mt-2 text-lg leading-relaxed sm:text-xl">{g.sub}</p>
      </div>
    </section>
  );
}
