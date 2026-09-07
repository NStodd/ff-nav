# Production readiness checklist

Everything here is a known, deliberately-deferred gap between "works, verified against real backends, in development" and "safe to put in front of real users at scale." Nothing on this list is a bug — each item is called out in `Navigation.md`/`Profile.md`'s own "known gaps" sections at the point it was found; this file just consolidates the ones that specifically block a real release, so there's one place to check before shipping instead of re-deriving it from scattered doc sections.

---

## Backends

- [ ] **Self-host or contract a production OSRM instance.** `router.project-osrm.org` (the default when `VITE_OSRM_BASE` is unset) is OSRM's own free community demo server — rate-limited, no uptime SLA, and explicitly called out in OSRM's own docs as unsuitable for production traffic. Swapping it out is a config change, not a code change: set `VITE_OSRM_BASE` in `.env.local` (see `.env.example`) to any OSRM-API-compatible `/route/v1/driving` base URL.
- [ ] **Self-host or contract a production Overpass instance**, same reasoning — `overpass-api.de` (the default when `VITE_OVERPASS_BASE` is unset) is a free public mirror with the same rate-limit/uptime caveats. Set `VITE_OVERPASS_BASE`.
- [ ] **Confirm CARTO's "Dark Matter" free vector tile tier covers expected traffic**, or move to a paid tier / self-hosted style. `MapScreen.vue`'s `MAP_STYLE` constant is a one-line swap; nothing else in the codebase is CARTO-specific. The `AttributionControl` MapLibre adds by default must stay visible regardless of which tile source is used — it's a hard requirement of the free tier, not just this one.
- [ ] **A production OSRM instance with real `exclude=` support would remove the biggest workaround in the codebase.** `pickRoute()`/`analyzeRoute()` in `navigation.js` exist entirely because the public demo server rejects every `exclude=` value it's given and silently no-ops the `walking`/`cycling` profile segments. A properly configured self-hosted instance (with `exclude` classes set up in its `.lua` profile) would let "avoid highways/ferries" become exact routing constraints instead of a post-hoc `ref`/`name` regex heuristic over the response — see `Navigation.md`'s known gaps for exactly how that heuristic can misfire.

## Tauri / app shell

- [ ] **`tauri.conf.json` has `"security": { "csp": null }`** — CSP is fully disabled. This is a real hardening gap (an injected script would have no CSP to fight), left untouched this pass deliberately: writing a correct CSP blind, without a native Tauri window available to test map tile loading / worker script loading / Overpass and OSRM fetches against it in this environment, risks silently breaking the map instead of hardening it. Needs a real device/emulator test pass before setting a real policy (at minimum: `connect-src` for the OSRM/Overpass/CARTO hosts in use, `worker-src` for MapLibre's worker, `img-src` for tile requests).
- [ ] **Android**: Milestone 4/5 features (all four archetype abilities, the profile screen, party onboarding) have only been verified via desktop Playwright against a real browser. The original Android crash (missing `ACCESS_COARSE_LOCATION`/`ACCESS_FINE_LOCATION` manifest permissions — see `Issues.md`) is fixed and confirmed, but nothing built since that fix has been re-verified on-device/on-emulator.

## `navigation.js` — resolved this pass, listed for traceability

These were open items in `Navigation.md` before the production-hardening pass; now fixed and verified (Playwright, against the real dev server and live OSRM backend):

- [x] Destination-before-position race — a destination set (by a map click, or restored from `localStorage`) before any position fix existed never got a route fetched, and nothing retried once a fix arrived. Fixed: `MapScreen.vue`'s position watcher now checks `destination && !hasRoute` on every position update and catches up.
- [x] `navigation.destination` didn't survive a page refresh. Fixed: persisted to `localStorage` (`crystalpath-destination`) via a `watch()` inside the store, restored synchronously at store setup.
- [x] `fetchRoute()` had no error handling at all — a network failure or malformed OSRM response threw uncaught. Fixed: wrapped in try/catch, retries once after a 1.5s delay, surfaces a `routeError` toast on a second failure. Guarded by a `fetchingRoute` flag against overlapping calls.
- [x] Geolocation watch errors (permission denied, position unavailable) failed completely silently — the map just never got a fix with no on-screen indication why. Fixed: routed through the same `routeError` toast channel with permission-aware copy.

## Still open, not yet scheduled

- **`shareETA()`'s `navigator.share()` path is unverified on a real mobile browser/WebView** — desktop Chromium/Playwright don't implement the Web Share API, so only the clipboard-copy fallback has been exercised.
- **Arrival radius (40m) and every XP/multiplier constant in `profile.js` are unvalidated against real-world play** — reasonable starting points, not tuned.
- **`pickRoute()`'s `tolls` preference has no effect** — OSRM's route API doesn't expose per-step toll status in this dataset, so there's nothing to detect it from even client-side. Would need a different data source (e.g. a routing engine with toll annotations, or a tolls-aware POI dataset) to actually implement, not just a self-hosted OSRM.
- **No automatic staleness cleanup for revealed POIs** — `pois` only grows; `goDark()` is the only thing that clears it.

See `Navigation.md` and `Profile.md` for the full reasoning behind each of these; this file only tracks what's release-blocking versus what's a reasonable v1 limitation.
