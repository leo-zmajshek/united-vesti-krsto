# Fix: published site misses the newest matches

## What's actually happening

Confirmed from production logs (last hour) and direct provider tests:

- The published server gets `403` from ESPN on every call (schedule and news) and `429` from TheSportsDB (live, results, fixtures).
- Only the authenticated football-data provider answers there — and its free plan returns Premier League only.
- Result: the published page's newest match is the last Premier League game, while the preview (which can still reach ESPN) shows the 15 Aug friendly against AC Milan, goals and lineups included.

So this is not a caching or display bug: the published environment simply cannot reach the sources that carry cups, Europe and friendlies.

Verified: ESPN answers normally when called from a browser and sends `Access-Control-Allow-Origin: *`, so a request made from your grandfather's phone is not blocked — only the datacenter server is.

## The fix

1. **Fetch the blocked source from the browser instead of the server**
   - Keep the server snapshot exactly as it is (football-data: Premier League matches, table, plus news) so the page still renders instantly and works without JavaScript.
   - After the page loads, the browser fetches the full ESPN schedule and match details itself and merges them into the snapshot using the existing dedupe/merge logic, so cups, European and friendly games appear with scorers and lineups.
   - Reuse the current merge scoring so the richer entry wins and no match is duplicated.

2. **Make the merge shared, not duplicated**
   - Move the match-normalising and merge helpers into a browser-safe module imported by both the server snapshot and the new client enrichment.

3. **Repair the news feed on the published site**
   - ESPN's news endpoint also returns `403` there; fall back to the RSS-based news path on the server, and let the client enrichment top it up when ESPN is reachable.

4. **Keep the honest status line**
   - Show the existing "last saved data" banner only when nothing fresh loaded, not when the client merge is still in flight.

5. **Verify on the published site**
   - Publish, then open the live URL in a clean tab at Android phone width and confirm the newest match (currently the AC Milan friendly) shows with the same score as the preview, plus schedule, table and news.

## Technical notes

- New client module (for example `src/lib/espn.client.ts`) plus a small hook that runs after hydration and writes the merged snapshot into the React Query cache under `["united-snapshot"]`.
- Shared merge helpers extracted from `src/lib/manutd.server.ts` into a plain module with no server-only imports.
- No schema or secret changes required; `FOOTBALL_DATA_API_KEY` stays the server-side base layer.
