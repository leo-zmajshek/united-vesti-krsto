/* Macedonian formatting helpers (client-safe). */

const MONTHS = [
  "јануари",
  "февруари",
  "март",
  "април",
  "мај",
  "јуни",
  "јули",
  "август",
  "септември",
  "октомври",
  "ноември",
  "декември",
];

const DAYS = ["недела", "понеделник", "вторник", "среда", "четврток", "петок", "сабота"];

export function parseTs(ts: string | null): Date | null {
  if (!ts) return null;
  const iso = ts.includes("T") ? (ts.endsWith("Z") ? ts : `${ts}Z`) : `${ts}T00:00:00Z`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatTime(ts: string | null): string {
  const d = parseTs(ts);
  if (!d) return "";
  return d.toLocaleTimeString("mk-MK", { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(ts: string | null): string {
  const d = parseTs(ts);
  if (!d) return "";
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function formatDateTime(ts: string | null): string {
  const d = parseTs(ts);
  if (!d) return "Датумот сè уште не е потврден";
  return `${formatDate(ts)} во ${formatTime(ts)}`;
}

export function isToday(ts: string | null): boolean {
  const d = parseTs(ts);
  if (!d) return false;
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

export function hoursUntil(ts: string | null): number {
  const d = parseTs(ts);
  if (!d) return Number.POSITIVE_INFINITY;
  return (d.getTime() - Date.now()) / 3_600_000;
}

export function countdown(ts: string | null): string {
  const d = parseTs(ts);
  if (!d) return "";
  const diff = d.getTime() - Date.now();
  if (diff <= 0) return "Почнува секој момент";
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  if (days > 0) return `Уште ${days} ${days === 1 ? "ден" : "дена"} и ${hours} ${hours === 1 ? "час" : "часа"}`;
  if (hours > 0) return `Уште ${hours} ${hours === 1 ? "час" : "часа"} и ${mins} мин.`;
  return `Уште ${mins} минути`;
}

export const OUTCOME_LABEL = {
  win: "ПОБЕДА",
  draw: "НЕРЕШЕНО",
  loss: "ПОРАЗ",
} as const;

export const OUTCOME_SHORT = {
  win: "П",
  draw: "Н",
  loss: "И",
} as const;
