# Show every Manchester United match, not just Premier League

Right now the app prefers one data provider at a time. The authenticated provider it prefers in production only covers a limited set of competitions (Premier League and Champions League), so cup games — FA Cup, League Cup, Europa League, friendlies — never reach the screen. The other providers do have those games, but they are only used when the preferred one returns nothing at all.

## What changes for Крсто

- Last match, next match and the schedule list show whichever game is actually nearest in time, whatever competition it belongs to.
- Every match row and the big match card show the competition name in Macedonian (Премиер лига, Лига на шампионите, ФА Куп, Лига Куп, Лига Европа, Пријателски меч), so it is obvious what the game is.
- Recent form (last 5) counts all competitions, and each bubble's note names the competition alongside the opponent and result.
- The table section stays Premier League only, with a clear heading saying so.

## Technical approach

1. Merge instead of fall back, in `src/lib/manutd.server.ts`:
   - Fetch all match providers in parallel as today (football-data.org, ESPN team schedule for `all` competitions, TheSportsDB last/next).
   - Combine their results and fixtures into one pool, deduplicate by kickoff date (same UTC day) plus normalized opponent name, preferring the record with the richest data (score, badges, id usable for detail lookups).
   - Sort results descending by timestamp, fixtures ascending; drop the "primary wins, others ignored" branching.
   - Keep live detection as first non-null across providers.
2. Competition labels in `src/lib/mk.ts`: extend the league mapping so raw names from all three providers ("FA Cup", "Emirates FA Cup", "UEFA Europa League", "Carabao Cup", "EFL Cup", "Club Friendlies") map to correct Macedonian names; unknown competitions fall back to a transliterated label rather than English.
3. UI in `src/components/united/StatusBlock.tsx` and `ScheduleSection.tsx`: render the Macedonian competition label as a small badge on the match card, each fixture/result row, and inside the form-bubble footnote.
4. `addMatchDetails` (lineups/goalscorers) only works for ESPN-sourced ids; when the merged match has no ESPN id, skip the detail call silently so nothing breaks.
