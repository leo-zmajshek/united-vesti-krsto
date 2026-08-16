# Манчестер Јунајтед — One-Tap News Center

A single long page, in Macedonian, that your grandfather opens from a home-screen icon and instantly understands: is there a match now, what happened last, when is the next one, plus schedule, standings, stats and news. Exactly one other page exists: a chatbot he can ask anything.

## The one-pager

No login, no menus to hunt through. One vertical page, very large type, high contrast, Man Utd red accents. Each section has a big, clearly separated heading with a colored divider so he can tell where one block ends and the next begins.

At the very top, a sticky row of large shortcut buttons that jump down the page: **Во живо / Последен натпревар · Распоред · Табела · Статистики · Вести · Прашај** (the last one opens the chatbot page). Big touch targets, no dropdowns.

Sections, in order:

1. **Status block (biggest, first thing he sees)** — one of three states, auto-chosen:
   - LIVE: huge score, minute, "ВО ЖИВО" badge, goal scorers, and the starting lineup.
   - Match today / within 24h: "ДЕНЕС ВО 21:00" with countdown, opponent, competition, lineup once announced.
   - Otherwise: last match result (score, scorers, competition, date), labelled победа / нерешено / пораз with a color cue.
2. **Следен натпревар** — opponent crest, date and local time, competition, "дома" / "во гости".
3. **Распоред на натпревари** — next fixtures and recent results in one simple list, dates written out in Macedonian.
4. **Табела** — Premier League standings with Man Utd's row highlighted; other competitions' group tables when relevant.
5. **Статистики** — form of last 5 matches (П / Н / Пор circles), top scorers, assists, a few simple season numbers.
6. **Вести** — 3–5 short headlines with a one-sentence Macedonian summary each.

Auto-refresh every 30s during a live match, otherwise every few minutes. Pull-to-refresh works but is never required.

## The chatbot page

One button ("Прашај што сакаш") opens the only other page. Large text box plus a microphone option for voice input, so he does not have to type. He can ask anything about Manchester United — history, players, "кога играат следно", "кој е тренерот" — and gets a short, plain-spoken Macedonian answer.

The assistant is pre-briefed with his context: elderly Macedonian-speaking fan, low smartphone literacy, wants short simple answers, no English jargon, correct Macedonian football terms. It also receives the current live match/fixture/standings data so its answers match what the one-pager shows. A big "Назад" button returns him to the one-pager.

## Language

Macedonian throughout, with proper football wording (натпревар, полувреме, стартна постава, судија, гол, автогол, пенал, црвен картон). Where only a Serbian-language source exists for a news item, that item is shown with a small Serbian flag plus the text "Dostupno samo na srpskom" so he knows it is Serbian.

## Data

Free football data source (API-Football free tier, the only free option carrying lineups and live events; football-data.org as fallback for fixtures and tables). It needs a free API key — I will ask you for it during the build and store it securely; nothing is exposed in the browser.

News: fetched from public club news feeds and rewritten into short, simple Macedonian sentences by AI (Lovable AI), cached so it does not re-translate on every visit. The chatbot also runs on Lovable AI.

## Home-screen icon

Installable app: manifest, Man Utd-red icon and splash screen, standalone display so it opens without a browser bar. I will include a short Macedonian instruction you follow once on his phone: open the link in Chrome → menu → "Додај на почетен екран".

## Technical notes

- Lovable Cloud enabled for: secure storage of the football API key and AI key, a cache table for fixtures/results/lineups/tables and translated news (so his phone never waits on a slow provider and we stay inside free-tier limits), and scheduled refresh.
- Server functions call the football API and the AI; the browser only reads cached, already-Macedonian data.
- Two routes only: `/` (one-pager) and `/chat`. Nav shortcuts are in-page anchors with smooth scroll, not separate pages.
- Loading shows a skeleton of the same layout, never a bare spinner.
- PWA service worker for offline last-known state: with no signal he still sees the last score plus a "нема интернет" note instead of an error.
- Text sizes tuned for elderly eyes: status score ~72px, section headings ~34px, body ≥20px, generous spacing, no thin fonts.
