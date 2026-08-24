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
  const weekdays: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
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

/* Macedonian counts 1 as a special case and abbreviations read as a different
   register beside spelled-out words, so both are handled explicitly. */
function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function countdown(ts: string | null): string {
  const d = parseTs(ts);
  if (!d) return "";
  const diff = d.getTime() - Date.now();
  if (diff <= 0) return "Почнува секој момент";
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  if (days > 0) return `Уште ${plural(days, "ден", "дена")} и ${plural(hours, "час", "часа")}`;
  if (hours > 0)
    return `Уште ${plural(hours, "час", "часа")} и ${plural(mins, "минута", "минути")}`;
  if (mins <= 1) return "Уште една минута";
  return `Уште ${mins} минути`;
}

export const OUTCOME_LABEL = {
  win: "ПОБЕДА",
  draw: "НЕРЕШЕНО",
  loss: "ПОРАЗ",
} as const;

/* П / Н / З is the shorthand a Macedonian table uses. The old "И" (изгубено)
   was both non-standard and a third word for the one the badge calls ПОРАЗ. */
export const OUTCOME_SHORT = {
  win: "П",
  draw: "Н",
  loss: "З",
} as const;

/* Lower-case form for running text, so one outcome has one name everywhere. */
export const OUTCOME_WORD_MK = {
  win: "победа",
  draw: "нерешено",
  loss: "загуба",
} as const;

const TEAM_NAMES_MK: Record<string, string> = {
  "manchester united": "Манчестер Јунајтед",
  "man utd": "Манчестер Јунајтед",
  "man united": "Манчестер Јунајтед",
  "man u": "Манчестер Јунајтед",
  "manchester city": "Манчестер Сити",
  liverpool: "Ливерпул",
  arsenal: "Арсенал",
  chelsea: "Челзи",
  "tottenham hotspur": "Тотенхем",
  tottenham: "Тотенхем",
  everton: "Евертон",
  "aston villa": "Астон Вила",
  "newcastle united": "Њукасл",
  "west ham united": "Вест Хем",
  brighton: "Брајтон",
  "brighton and hove albion": "Брајтон",
  "crystal palace": "Кристал Палас",
  fulham: "Фулам",
  brentford: "Брентфорд",
  "wolverhampton wanderers": "Вулверхемптон",
  wolves: "Вулверхемптон",
  "nottingham forest": "Нотингем Форест",
  bournemouth: "Борнмут",
  "leeds united": "Лидс",
  burnley: "Бернли",
  sunderland: "Сандерленд",
  "hull city": "Хал Сити",
  "leicester city": "Лестер",
  southampton: "Саутемптон",
  "ipswich town": "Ипсвич",
  "sheffield united": "Шефилд Јунајтед",
  "ac milan": "Милан",
  "inter milan": "Интер",
  "real madrid": "Реал Мадрид",
  barcelona: "Барселона",
  "bayern munich": "Бајерн Минхен",
  juventus: "Јувентус",
  "paris saint-germain": "Пари Сен Жермен",
  "borussia dortmund": "Борусија Дортмунд",
  "atletico madrid": "Атлетико Мадрид",
  napoli: "Наполи",
  roma: "Рома",
  ajax: "Ајакс",
  porto: "Порто",
  benfica: "Бенфика",
  celtic: "Селтик",
  rangers: "Рејнџерс",
  // Premier League clubs the original table missed
  "coventry city": "Ковентри",
  "west ham": "Вест Хем",
  newcastle: "Њукасл",
  spurs: "Тотенхем",
  // Frequent friendly and European opponents
  wrexham: "Рексам",
  rosenborg: "Розенборг",
  copenhagen: "Копенхаген",
  "bayer leverkusen": "Бајер Леверкузен",
  leverkusen: "Бајер Леверкузен",
  "rb leipzig": "РБ Лајпциг",
  leipzig: "РБ Лајпциг",
  "eintracht frankfurt": "Ајнтрахт Франкфурт",
  "vfb stuttgart": "Штутгарт",
  atalanta: "Аталанта",
  lazio: "Лацио",
  fiorentina: "Фиорентина",
  bologna: "Болоња",
  sevilla: "Севиља",
  villarreal: "Виљареал",
  "real betis": "Бетис",
  "athletic bilbao": "Атлетик Билбао",
  "real sociedad": "Реал Сосиедад",
  valencia: "Валенсија",
  "sporting cp": "Спортинг Лисабон",
  "sporting lisbon": "Спортинг Лисабон",
  feyenoord: "Фајенорд",
  "psv eindhoven": "ПСВ Ајндховен",
  psv: "ПСВ Ајндховен",
  marseille: "Марсеј",
  lyon: "Лион",
  monaco: "Монако",
  galatasaray: "Галатасарај",
  fenerbahce: "Фенербахче",
  "shakhtar donetsk": "Шахтјор Доњецк",
  "dinamo zagreb": "Динамо Загреб",
  "red star belgrade": "Црвена Звезда",
  "crvena zvezda": "Црвена Звезда",
  partizan: "Партизан",
  "slavia prague": "Славија Прага",
  "red bull salzburg": "Салцбург",
  salzburg: "Салцбург",
  "club brugge": "Клуб Бриж",
  anderlecht: "Андерлехт",
  panathinaikos: "Панатинаикос",
  olympiacos: "Олимпијакос",
  "aek athens": "АЕК Атина",
  basel: "Базел",
  "young boys": "Јанг Бојс",
  "legia warsaw": "Легија Варшава",
  ferencvaros: "Ференцварош",
  "maccabi tel aviv": "Макаби Тел Авив",
  aberdeen: "Абердин",
};

/* Providers spell the same club differently: football-data returns
   "Manchester United FC" and "Hull City AFC", ESPN "Manchester United",
   TheSportsDB "Hull City", and accents vary ("Atlético Madrid"). An exact
   lower-cased lookup missed all of those, so English names reached the screen
   and the same fixture appeared twice. Normalise both sides instead. */
const CLUB_NOISE = /\b(fc|afc|cf|sc|ac|as|ss|ssc|cd|club|football|the)\b/g;

export function normalizeTeamName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(CLUB_NOISE, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const TEAM_LOOKUP_MK: Record<string, string> = Object.fromEntries(
  Object.entries(TEAM_NAMES_MK).map(([key, value]) => [normalizeTeamName(key), value]),
);

/* Digraphs first, then single letters. Club names only, and only as a fallback
   for clubs missing from the table above — club names are the largest text on
   the page and short enough that this reads well ("Rosenborg" -> "Розенборг").
   Deliberately NOT used for player names: Krsto reads Latin script fine, and
   generic transliteration gives "Луке Шав" for Luke Shaw, so lineups and
   scorers keep the provider's spelling. */
const TRANSLIT_PAIRS: Array<[RegExp, string]> = [
  [/sch/g, "ш"],
  [/sh/g, "ш"],
  [/ch/g, "ч"],
  [/zh/g, "ж"],
  [/kh/g, "х"],
  [/ph/g, "ф"],
  [/th/g, "т"],
  [/ck/g, "к"],
  [/gj/g, "ѓ"],
  [/nj/g, "њ"],
  [/lj/g, "љ"],
  [/dz/g, "ѕ"],
  [/ee/g, "и"],
  [/oo/g, "у"],
  [/ou/g, "у"],
  [/ya/g, "ја"],
  [/yu/g, "ју"],
  [/qu/g, "кв"],
  [/a/g, "а"],
  [/b/g, "б"],
  [/c/g, "к"],
  [/d/g, "д"],
  [/e/g, "е"],
  [/f/g, "ф"],
  [/g/g, "г"],
  [/h/g, "х"],
  [/i/g, "и"],
  [/j/g, "ј"],
  [/k/g, "к"],
  [/l/g, "л"],
  [/m/g, "м"],
  [/n/g, "н"],
  [/o/g, "о"],
  [/p/g, "п"],
  [/q/g, "к"],
  [/r/g, "р"],
  [/s/g, "с"],
  [/t/g, "т"],
  [/u/g, "у"],
  [/v/g, "в"],
  [/w/g, "в"],
  [/x/g, "кс"],
  [/y/g, "и"],
  [/z/g, "з"],
];

export function transliterateMk(input: string): string {
  return input.replace(/[A-Za-z][A-Za-z'’-]*/g, (word) => {
    const capital = word[0] === word[0]!.toUpperCase();
    let out = word.toLowerCase().replace(/['’]/g, "");
    for (const [pattern, replacement] of TRANSLIT_PAIRS) out = out.replace(pattern, replacement);
    // Macedonian does not double consonants the way English spelling does, so
    // "Matt" reads as "Мат", not "Матт".
    out = out.replace(/([бвгдђжзјклљмнњпрстћфхцчџш])\1+/g, "$1");
    return capital ? out.charAt(0).toUpperCase() + out.slice(1) : out;
  });
}

/* Lineups and goalscorers come straight from the data provider, so unlike the
   news text no model ever transliterates them — they were reaching the screen as
   "Harry Maguire", "Bruno Fernandes". Approximate Cyrillic beats Latin script for
   a reader who does not use the Latin alphabet, though some spellings will differ
   from the conventional ones (this yields "Магуире" where Macedonian writes
   "Магвајер"). Applied at render time only; the stored data is untouched. */
export function teamMk(name: string): string {
  const key = normalizeTeamName(name);
  if (!key) return name;
  const known = TEAM_LOOKUP_MK[key];
  if (known) return known;
  // normalizeTeamName has already dropped FC/AFC, so we do not transliterate
  // league suffixes onto the end of every unlisted club.
  return transliterateMk(key.replace(/\b\w/g, (c) => c.toUpperCase()));
}

const LEAGUES_MK: Record<string, string> = {
  "english premier league": "Премиер лига",
  "premier league": "Премиер лига",
  epl: "Премиер лига",
  "uefa champions league": "Лига на шампиони",
  "champions league": "Лига на шампиони",
  "uefa europa league": "Лига на Европа",
  "europa league": "Лига на Европа",
  "uefa europa conference league": "Конференциска лига",
  "uefa conference league": "Конференциска лига",
  "english league cup": "Лига куп",
  "carabao cup": "Лига куп",
  "efl cup": "Лига куп",
  "league cup": "Лига куп",
  "english fa cup": "ФА куп",
  "emirates fa cup": "ФА куп",
  "fa cup": "ФА куп",
  "fa community shield": "Комјунити шилд",
  "community shield": "Комјунити шилд",
  "club friendlies": "Пријателски натпревар",
  friendly: "Пријателски натпревар",
  friendlies: "Пријателски натпревар",
  "club friendly games": "Пријателски натпревар",
  "premier league summer series": "Летна серија",
  "fifa club world cup": "Светско клупско првенство",
};

const LEAGUE_WORDS_MK: Array<[RegExp, string]> = [
  [/fa cup/i, "ФА куп"],
  [/(carabao|efl|league) cup/i, "Лига куп"],
  [/champions league/i, "Лига на шампиони"],
  [/europa league/i, "Лига на Европа"],
  [/conference league/i, "Конференциска лига"],
  [/community shield/i, "Комјунити шилд"],
  [/friendl/i, "Пријателски натпревар"],
  [/premier league/i, "Премиер лига"],
];

export function leagueMk(name: string): string {
  const key = name.trim().toLowerCase();
  if (!key) return "";
  const exact = LEAGUES_MK[key];
  if (exact) return exact;
  for (const [pattern, label] of LEAGUE_WORDS_MK) {
    if (pattern.test(key)) return label;
  }
  return name;
}
