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

const TZ = "Europe/Skopje";

function parts(d: Date) {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    weekday: "short",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const map: Record<string, string> = {};
  for (const p of f.formatToParts(d)) map[p.type] = p.value;
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    day: Number(map["day"]),
    month: Number(map["month"]) - 1,
    year: Number(map["year"]),
    hour: map["hour"] === "24" ? "00" : map["hour"]!,
    minute: map["minute"]!,
    weekday: weekdays[map["weekday"] ?? "Sun"] ?? 0,
  };
}

export function formatTime(ts: string | null): string {
  const d = parseTs(ts);
  if (!d) return "";
  const p = parts(d);
  return `${p.hour}:${p.minute}`;
}

export function formatDate(ts: string | null): string {
  const d = parseTs(ts);
  if (!d) return "";
  const p = parts(d);
  return `${DAYS[p.weekday]}, ${p.day} ${MONTHS[p.month]}`;
}

export function formatDateTime(ts: string | null): string {
  const d = parseTs(ts);
  if (!d) return "Датумот сè уште не е потврден";
  return `${formatDate(ts)} во ${formatTime(ts)}`;
}

export function isToday(ts: string | null): boolean {
  const d = parseTs(ts);
  if (!d) return false;
  const a = parts(d);
  const b = parts(new Date());
  return a.day === b.day && a.month === b.month && a.year === b.year;
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

const TEAM_NAMES_MK: Record<string, string> = {
  "manchester united": "Манчестер Јунајтед",
  "manchester city": "Манчестер Сити",
  "liverpool": "Ливерпул",
  "arsenal": "Арсенал",
  "chelsea": "Челзи",
  "tottenham hotspur": "Тотенхем",
  "tottenham": "Тотенхем",
  "everton": "Евертон",
  "aston villa": "Астон Вила",
  "newcastle united": "Њукасл",
  "west ham united": "Вест Хем",
  "brighton": "Брајтон",
  "brighton and hove albion": "Брајтон",
  "crystal palace": "Кристал Палас",
  "fulham": "Фулам",
  "brentford": "Брентфорд",
  "wolverhampton wanderers": "Вулверхемптон",
  "wolves": "Вулверхемптон",
  "nottingham forest": "Нотингем Форест",
  "bournemouth": "Борнмут",
  "leeds united": "Лидс",
  "burnley": "Бернли",
  "sunderland": "Сандерленд",
  "hull city": "Хал Сити",
  "leicester city": "Лестер",
  "southampton": "Саутемптон",
  "ipswich town": "Ипсвич",
  "sheffield united": "Шефилд Јунајтед",
  "ac milan": "Милан",
  "inter milan": "Интер",
  "real madrid": "Реал Мадрид",
  "barcelona": "Барселона",
  "bayern munich": "Бајерн Минхен",
  "juventus": "Јувентус",
  "paris saint-germain": "Пари Сен Жермен",
  "borussia dortmund": "Борусија Дортмунд",
  "atletico madrid": "Атлетико Мадрид",
  "napoli": "Наполи",
  "roma": "Рома",
  "ajax": "Ајакс",
  "porto": "Порто",
  "benfica": "Бенфика",
  "celtic": "Селтик",
  "rangers": "Рејнџерс",
};

export function teamMk(name: string): string {
  return TEAM_NAMES_MK[name.trim().toLowerCase()] ?? name;
}

const LEAGUES_MK: Record<string, string> = {
  "english premier league": "Премиер лига",
  "premier league": "Премиер лига",
  "uefa champions league": "Лига на шампиони",
  "uefa europa league": "Лига на Европа",
  "english league cup": "Лига куп",
  "english fa cup": "ФА куп",
  "club friendlies": "Пријателски натпревар",
  "uefa europa conference league": "Конференциска лига",
};

export function leagueMk(name: string): string {
  return LEAGUES_MK[name.trim().toLowerCase()] ?? name;
}
