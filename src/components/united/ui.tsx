import type { ReactNode } from "react";

export function SectionHeading({ id, title, hint }: { id: string; title: string; hint?: string }) {
  return (
    <div id={id} className="scroll-mt-32 pt-2">
      <h2 className="text-3xl font-black uppercase tracking-tight text-foreground sm:text-4xl">{title}</h2>
      <div className="mt-2 h-1.5 w-24 rounded-full bg-primary" />
      {hint ? <p className="mt-2 text-lg text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function Section({ children }: { children: ReactNode }) {
  return <section className="border-t-4 border-border px-4 py-8 sm:px-6">{children}</section>;
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

export function SerbianFlagTag() {
  return (
    <span className="mt-2 inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-base font-semibold text-secondary-foreground">
      <svg viewBox="0 0 9 6" width="24" height="16" aria-hidden="true" className="rounded-[2px]">
        <rect width="9" height="2" y="0" fill="#C6363C" />
        <rect width="9" height="2" y="2" fill="#0C4076" />
        <rect width="9" height="2" y="4" fill="#FFFFFF" />
      </svg>
      Dostupno samo na srpskom
    </span>
  );
}
