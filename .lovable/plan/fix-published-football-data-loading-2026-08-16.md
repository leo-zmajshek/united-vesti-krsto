# Fix published football-data loading

The published server is reaching the page correctly, but its upstream football feeds are failing: ESPN returns `403` from the production server and TheSportsDB returns `429` for live, results, and fixtures. The current catch handlers turn those failures into an empty snapshot, which is why the page loads without useful information.

## Implementation

1. **Replace the fragile fallback chain**
   - Keep ESPN only as a best-effort source, since it works locally but blocks the published server.
   - Stop making three parallel TheSportsDB calls on every cold start; its shared free endpoint is currently rate-limiting the published environment.
   - Add a reliable authenticated football-data provider as the production source for fixtures, results, live state, and standings, with its key stored as an encrypted backend secret and never sent to the browser.
   - Preserve rich scorer and lineup details when a provider supplies them; show the core match data normally when those optional details are unavailable.

2. **Make snapshots resilient**
   - Fetch independent sections with explicit timeouts and isolated error handling so a news, standings, or match-detail failure cannot blank the main match information.
   - Cache successful responses longer and retain the last successful snapshot for temporary provider outages or rate limits.
   - Return a clear data-availability state instead of silently returning an all-empty snapshot.

3. **Improve the user-facing failure state**
   - Keep the existing Macedonian interface, but distinguish “temporarily using last update” from “no data has ever loaded.”
   - Keep automatic refresh conservative outside live matches to avoid unnecessary upstream requests.

4. **Verify the actual published path**
   - Test the snapshot server function and home page locally.
   - Publish the fix, invoke the production server function, and inspect production logs to confirm the previous ESPN `403` / TheSportsDB `429` path no longer prevents match data from rendering.
   - Check the rendered page at Android phone width and confirm last match, next match, schedule, and table contain data.

## Technical notes

- Changes will be concentrated in the server-side football provider/cache layer, the snapshot DTO/state, and the small home-page fallback message.
- The `createServerFn` module remains a thin RPC wrapper; provider and caching logic stays in server-only modules.
- If no suitable football API credential is currently configured, the build will pause once for secure key entry through Lovable’s secret form.
