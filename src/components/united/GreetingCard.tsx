const GREETINGS: { heading: string; sub: string }[] = [
  { heading: "Добро утро, Крсто!", sub: "Еве што е ново кај Јунајтед додека пиеш кафе." },
  { heading: "Добар ден, Крсто!", sub: "Погледни го најновото од Олд Трафорд." },
  { heading: "Добра вечер, Крсто!", sub: "Резултати, распоред и вести — сè на македонски." },
  { heading: "Ајде, Јунајтед!", sub: "Крсто, еве како стојат работите денес." },
];

/* Previously the server rendered a fixed greeting and the browser then replaced
   it with a random one, so the first line Krsto reads rewrote itself a moment
   after the page appeared. This is derived from the clock instead, evaluated in
   Skopje time on both the server and the phone so both agree — no randomness,
   nothing to swap in after hydration. */
function greetingForNow(): { heading: string; sub: string } {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Skopje",
      hour: "2-digit",
      hour12: false,
    }).format(new Date()),
  );
  if (!Number.isFinite(hour)) return GREETINGS[3]!;
  if (hour < 11) return GREETINGS[0]!;
  if (hour < 17) return GREETINGS[1]!;
  return GREETINGS[2]!;
}

export function GreetingCard() {
  const g = greetingForNow();

  return (
    <section className="px-4 pt-5 sm:px-6">
      <div
        className="rounded-2xl border-2 border-border bg-card p-5 text-card-foreground"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        {/* The hour can tick over between the server render and hydration. */}
        <p
          className="text-2xl font-black leading-tight text-primary sm:text-4xl"
          suppressHydrationWarning
        >
          {g.heading}
        </p>
        <p className="mt-2 text-lg leading-relaxed sm:text-xl" suppressHydrationWarning>
          {g.sub}
        </p>
      </div>
    </section>
  );
}
