import type { ReactNode } from "react";

export function SectionHeading({ id, title, hint }: { id: string; title: string; hint?: string }) {
  return (
    <div id={id} className="scroll-mt-28 pt-2">
      <h2 className="text-2xl font-black uppercase leading-tight tracking-tight text-foreground sm:text-4xl">
        {title}
      </h2>
      <div className="mt-2 h-1.5 w-20 rounded-full bg-primary" />
      {hint ? <p className="mt-2 text-base text-muted-foreground sm:text-lg">{hint}</p> : null}
    </div>
  );
}

export function Section({ children }: { children: ReactNode }) {
  return (
    <section className="border-t-4 border-border px-4 py-6 sm:px-6 sm:py-8">{children}</section>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border-2 border-border bg-card p-4 text-card-foreground ${className}`}
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      {children}
    </div>
  );
}

export function Badge({ src, alt, size = 56 }: { src: string | null; alt: string; size?: number }) {
  if (!src) {
    return (
      <div
        className="flex items-center justify-center rounded-full bg-muted text-base font-bold text-muted-foreground"
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        {alt.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={`Грб на ${alt}`}
      width={size}
      height={size}
      loading="lazy"
      className="object-contain"
      style={{ width: size, height: size }}
    />
  );
}

/* Was a Serbian flag reading "Dostupno samo na srpskom" — in Latin script, for a
   reader who uses Cyrillic, and shown whenever the AI translation failed rather
   than when a story was actually Serbian. So it announced Serbian on English
   text. This states what is actually true instead. */
export function UntranslatedTag() {
  return (
    <span className="mt-2 inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-base font-semibold text-secondary-foreground">
      <span aria-hidden="true">🌐</span>
      Преводот не успеа — насловот е во оригинал
    </span>
  );
}
