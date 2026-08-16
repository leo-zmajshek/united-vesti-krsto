# Манчестер Јунајтед — One-Tap News Center

A single page, in Macedonian, that your grandfather opens from a home-screen icon and instantly understands: is there a match now, what happened last, when is the next one, plus a short news strip.

## What he sees on arrival

No menus, no buttons to press, no login. One vertical page, very large type, high contrast, Man Utd red accents.

1. **Status block (top, biggest)** — one of three states, auto-chosen:
   - LIVE: big score, minute, badge "ВО ЖИВО", goal scorers, and the starting lineup (formation list).
   - Soon (match today / within 24h): "ДЕНЕС ВО 21:00" with countdown, opponent, competition, lineup once announced.
   - Otherwise: result of the last match (score, scorers, competition, date) — labelled победа / нерешено / пораз with a color cue.
2. **Next match card** — opponent crest, date and time in local Belgrade/Skopje time, competition, home/away in plain words ("дома" / "во гости").
3. **Recent form** — last 5 matches as П / Н / Пор circles, tappable-free, just visual.
4. **Schedule/archive** — the next few fixtures and the last several results in one simple scrollable list, dates written out in Macedonian.
5. **News strip (secondary, bottom)** — 3–5 short headlines with a one-sentence Macedonian summary each.

Auto-refresh every 30s during a live match, otherwise every few minutes. Pull-to-refresh works but is never required.

## Language

Macedonian throughout, with proper football wording (натпревар, полувреме, стартна постава, судија, гол, автогол, пенал, црвен картон). Where only a Serbian-language source exists for a news item, that item is shown with a small "СРП" tag so he knows it is Serbian.

## Data

Free football data source (API-Football free tier, which is the only free option that carries lineups and live events; I will fall back to football-data.org for fixtures if needed). It needs a free API key — I will ask you for it during the build and store it securely; nothing is exposed in the browser.

News: fetched from public club news feeds and rewritten into short, simple Macedonian sentences by AI (Lovable AI), cached so it does not re-translate on every visit.

## Home-screen icon

The app is installable: a manifest, Man Utd-red icon and splash screen, standalone display so it opens without a browser bar. I will include a one-page instruction (in Macedonian) you can follow once on his phone: open the link in Chrome → menu → "Додај на почетен екран".

## Technical notes

- Lovable Cloud enabled for: secure storage of the football API key, a cache table for fixtures/results/lineups and translated news (so his phone never waits on a slow provider and we stay inside free-tier request limits), and scheduled refresh.
- Server functions call the football API and the AI translation; the browser only reads cached, already-Macedonian data.
- Single route `/` — no other pages, no navigation. Loading state is a skeleton of the same layout, never a spinner-only screen.
- PWA manifest + service worker for offline last-known state: if he has no signal, he still sees the last score with a "нема интернет" note instead of an error.
- Text sizes tuned for elderly eyes: status score ~72px, body ≥20px, generous spacing, no thin fonts.
