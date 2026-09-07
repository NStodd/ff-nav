# Navigation — how the map layer works

This describes the navigation store, the MapLibre GL integration in `MapScreen.vue`, and how position data flows in from onboarding. It's reference documentation for the current implementation, not a changelog — see `PLANNING.md` for the history of how it got built.

---

## The two pieces

- **`src/stores/navigation.js`** — a Pinia store holding position/destination/route/ETA state and the geolocation watcher. Framework-agnostic: it has no idea MapLibre exists.
- **`src/views/MapScreen.vue`** — owns the MapLibre GL `Map` instance and translates the store's state into map layers, markers, and camera moves. All the map-library-specific code lives here; nothing outside this file imports `maplibre-gl`.

Splitting it this way means the store could survive a future map-library swap untouched, and the store's state (position, route, ETA) is available to non-map UI later — e.g. a `HudOverlay.vue` ETA readout — without those components needing to know MapLibre exists either.

---

## Data flow: onboarding → map

Position data enters the app in two different ways, at two different points in the flow:

1. **`LocationPermissionStep.vue`** (onboarding) calls `navigator.geolocation.getCurrentPosition()` **once**, as a permission-and-capability check. On success it writes the result straight into the navigation store via `navigation.setPosition({ lat, lng })`, then emits `advance`. It does not start the store's continuous watcher — that would keep a geolocation subscription alive for the rest of onboarding (ability reveal, done fanfare) for no reason.
2. **`MapScreen.vue`**, in `onMounted`, calls `navigation.startWatching()`, which opens a `navigator.geolocation.watchPosition()` subscription that stays open for as long as the map screen is mounted, and calls `navigation.stopWatching()` in `onUnmounted`.

Because both write to the same `navigation.position` ref, the map screen already has a position the instant it mounts (from step 1) and gets live updates once `watchPosition` starts reporting (step 2) — there's no gap where the map has to wait for a fresh fix. If a user skips the location step entirely (denied permission, hit "SKIP FOR NOW"), `navigation.position` is simply `null` until `startWatching()` produces a fix on the map screen itself; `MapScreen.vue` falls back to a hardcoded center (see below) until then.

```
LocationPermissionStep          MapScreen
  getCurrentPosition()  ──┐
  navigation.setPosition()│
         │                │
         ▼                ▼
    navigation store: position ref
                           │
                           ▼
              MapScreen watch(position) →
              moves user marker, flyTo() on first fix
                           │
              MapScreen onMounted →
              navigation.startWatching() → watchPosition()
              keeps position fresh for the rest of the session
```

---

## `src/stores/navigation.js`

| State | Shape | Notes |
|---|---|---|
| `position` | `{ lat, lng } \| null` | Current fix. Not persisted to `localStorage` — unlike `player.js`, a stale position on refresh is actively wrong, not just inconvenient. |
| `heading` | degrees \| `null` | Direction of travel, from `coords.heading` (Milestone 6). `null` whenever the device hasn't reported one yet — most browsers only populate this while actually moving at a meaningful speed, so `null` at rest is the common case, not an error. Drives the user marker's rotation in `MapScreen.vue`. |
| `destination` | `{ lat, lng } \| null` | Set by `setDestination()`. **Persisted** to `localStorage` (`crystalpath-destination`) via a `watch(destination, ...)` inside the store — a stale destination on refresh is still the place the player was headed, unlike a stale position. Restored synchronously at store setup, before any position fix exists. |
| `route` | `[[lng, lat], ...]` | GeoJSON coordinate order (**lng first**), because it's fed directly into a MapLibre `LineString` geometry — don't flip it to `[lat, lng]` without also updating `MapScreen.vue`'s `syncRoute()`. |
| `eta` | seconds \| `null` | Raw OSRM `duration` field. |
| `watcherId` | geolocation watch ID \| `null` | Internal; not returned from the store's public surface beyond `startWatching`/`stopWatching`. |
| `pois` | `[{ id, lat, lng, name, category }, ...]` | Points revealed by the Adventurer archetype's ability (SCOUT/SCAN/TRAILBLAZE/SPYGLASS). Accumulates across sweeps — nothing ever un-reveals a POI. |
| `revealing` | boolean | True while a `revealPOIs()` sweep is in flight; guards against overlapping requests if the ability button is mashed faster than the network responds. |
| `rerouting` | boolean | Same guard as `revealing`, for `attemptReroute()`. |
| `fetchingRoute` | boolean | Same guard, for `fetchRoute()` — prevents a position update's catch-up fetch (see below) from racing a destination-tap's own fetch. |
| `shareStatus` | string \| `null` | Transient feedback from `shareETA()`'s fallback paths, auto-cleared after 3s. `null` most of the time — a successful `navigator.share()` call has its own OS-level confirmation, so this is only ever set on the clipboard-copy/unsupported paths. |
| `routeError` | string \| `null` | Transient feedback when `fetchRoute()` fails even after its one retry, or when the geolocation watcher itself errors (permission denied/unavailable). Auto-clears after 5s. Surfaced by `MapScreen.vue`'s `.route-error-toast`. |
| `privacyActive` | boolean | True for the duration of a `goDark()` blackout (6s). Not currently read by any component — `MapScreen.vue` infers the same window from `position` going `null` — but exposed for a future HUD indicator. |

Getters: `hasRoute` (boolean), `etaFormatted` (`"N min"` / `"<1 min"` / `null`), `currentManeuver` (Direction F, phase 2 — see below).

Actions:
- `setPosition(latLng)` — direct write, used by `LocationPermissionStep`.
- `startWatching()` / `stopWatching()` — wrap `watchPosition`/`clearWatch`. `startWatching()` is a no-op if already watching (checks `watcherId`), so it's safe to call from `onMounted` without worrying about double-subscriptions. The error callback (previously silent) now sets `routeError` with permission-aware copy — a denied/unavailable location fix used to fail with no on-screen indication at all.
- `setDestination(latLng, prefs = {})` — stores the destination (persisted, see the state table above) and, if a position is already known, immediately calls `fetchRoute()`. If no position is known yet, the destination is stored and the route fetch happens later — see `MapScreen.vue`'s position watcher below, which now catches up on exactly this case.
- `fetchRoute(origin, dest, prefs = {}, _isRetry = false)` — calls the public OSRM demo server with `alternatives=true&steps=true` and picks among the returned routes via `pickRoute()` (see below) instead of always taking the first one, then sets `route`/`eta`/`routeDistanceMeters` from the pick. Guarded by `fetchingRoute` against overlapping calls. Wrapped in try/catch (previously unguarded — a network failure or malformed response threw uncaught): on a non-OK response or an empty `routes` array it throws, is caught, and retries once after `ROUTE_RETRY_DELAY_MS` (1.5s); a second failure sets `routeError` instead of throwing again. `_isRetry` is an internal recursion flag, not part of the call signature any caller should pass.
- **`pickRoute(routes, prefs)`** and **`analyzeRoute(route)`** — module-private helpers implementing the Speedrunner-family personalization questions (`priority`/`avoid`, from Thief's onboarding — see `classes.js`) as real route selection, entirely client-side. This exists because the public OSRM server can't do it natively: every `exclude=` value it's asked for fails outright (`"Exclude flag combination is not supported."`, confirmed against the live server — not assumed), and its `walking`/`cycling` profile URLs silently return identical driving-only results instead of routing differently. `analyzeRoute()` walks a route's `steps` (present because of `steps=true`) to count real turns (any `maneuver.type` besides depart/arrive/continue/new name) and flag likely highway (`ref`/`name` matching `I 676`, `US 30`-style patterns) or ferry (`name` containing "ferry", excluding street names like "Grays Ferry Avenue" that merely contain the word) steps. `pickRoute()` then filters by `avoid` (only narrowing when at least one candidate actually stays "clean" — never eliminating every option) and sorts what's left by `distance` (`priority: 'shortest'`), `turns` (`'fewest_turns'`), or `duration` (`'fastest'`, the default — this is also what happens for every class that's never asked these questions at all, since `prefs` defaults to `{}`). **`tolls` is collected as a preference but has no effect** — OSRM's route API doesn't expose toll status per step in this dataset, so there's nothing left to detect it from.
- `revealPOIs(radiusMeters, interestText = '')` — queries the public Overpass API for `amenity`/`shop`/`tourism` nodes within `radiusMeters` of `position`, dedupes against ids already in `pois`, and appends. No-ops without a position fix or while a sweep is already `revealing`. Swallows network/API errors (an empty sweep, not a thrown one) — see `MapScreen.vue`'s `onAbility()` below for how this gets triggered. `interestText` is the Adventurer archetype's open-ended personalization answer (Fighter's `destinations` question, e.g. "hidden trails, forgotten ruins") — a small keyword table appends `leisure=park`/`natural=*`/`historic=*` node filters to the query when it mentions nature or history words, and the found POIs' `category` derivation was extended to read those tags too, so a nature-minded Fighter's sweep actually returns different, more relevant results rather than the same generic set re-labeled.
- `attemptReroute(prefs = {})` — re-queries OSRM for the current `position`→`destination` pair with `alternatives=true&steps=true`; if any come back geometrically different from what's in `route`, picks among *those* (not the full set, which would include the one already showing) via the same `pickRoute()` used by `fetchRoute()`, and swaps to it. Returns whether a swap happened, otherwise leaves `route`/`eta`/`routeDistanceMeters` untouched. No-ops (returns `false`) without both a position and a destination, or while already `rerouting`. OSRM's public demo server doesn't factor in live traffic, so "found a faster route" is really "found a different route OSRM considers roughly comparable" — the visible effect (a route that changes without being asked) is the same either way.
- `shareETA()` — builds a share payload (current ETA if there's a route, plus a real Google Maps link — directions to `destination` if one's set, otherwise a search pin on `position`) and hands it to `navigator.share()` when available, falling back to `navigator.clipboard.writeText()`, falling back again to just setting `shareStatus` to say sharing isn't supported. There's no in-app party roster to share *to* — this hands off to whatever the OS/device already offers for getting a link to another person, rather than fabricating a fake party of mock contacts with nowhere real to send anything.
- `goDark(durationMs = 6000)` — wipes everything this store already holds that could be called "trail data": `pois`, `destination`, `route`, `eta`, and `position` itself, then stops the live geolocation watcher and restarts it automatically after `durationMs`. Nothing here is fake or simulated — `position` genuinely going `null` is what makes the user's own marker actually disappear from the map (`MapScreen.vue`'s position watcher removes it), which is the most literal, honest reading of "vanish"/"scuttle" available without inventing telemetry there's no server to back.
- `reset()` — stops watching and clears all state, `pois` included. Called from `MapScreen.vue`'s "START OVER" button alongside `player.reset()`.

### Turn-by-turn (Direction F, phase 2)

`fetchRoute()`/`attemptReroute()` were already requesting `steps=true` from OSRM for `analyzeRoute()`'s scoring — the per-step maneuver data was just discarded once scoring finished. It's now retained on two internal refs, `steps` (the flattened `legs[].steps[]` array for whichever route is currently showing) and `currentStepIndex`, neither of which is part of the store's public surface — the only thing exposed is the `currentManeuver` getter:

```js
{ iconKey, instruction, distanceMeters, isArrival } | null
```

`null` whenever there's no route or no `steps` data yet (defensive — every real OSRM response includes at least a depart+arrive pair, but nothing guarantees that forever).

**Advancing "the current maneuver" is threshold-based, not full map-matching.** A `watch([position, steps], ...)` compares live position against the maneuver location (`step.maneuver.location`, GeoJSON `[lng, lat]`) the banner is currently counting down to; once within `STEP_ADVANCE_RADIUS_M` (30m), `currentStepIndex` advances to the next step. This is a deliberate, disclosed approximation — projecting live position onto the route's own polyline (real map-matching) would be more accurate on curved roads or a route with maneuvers close together, but is a meaningfully bigger algorithm than this pass needs, the same "small heuristic instead of a bigger system that isn't available" tradeoff `pickRoute()`'s highway/ferry regexes already make. Index 0 (OSRM's own "depart" step — not an actionable instruction) is skipped straight to index 1 as soon as there's a second step, so the banner never opens by describing the step you're already standing on.

**`describeManeuver(step)`** builds the instruction text from `maneuver.type`/`modifier` and the step's road `name` — OSRM's route API returns those fields, not a ready-made English sentence (that needs a language plugin the public demo doesn't run), so this is a small hand-written mapping, same spirit as the highway/ferry pattern matching above. **`maneuverIconKey(step)`** buckets OSRM's 8 modifiers (sharp/slight left, left, sharp/slight right, right, straight, uturn) down to the handful of icons actually worth drawing distinctly at HUD size — `left`/`right`/`straight`/`uturn`/`roundabout`/`merge`/`arrive` — leaving the "slight" vs "sharp" nuance in the text, where it's actually legible; see `maneuverIcons.js` and `Sprites.md` for the icon set itself.

Both `fetchRoute()` and `attemptReroute()` repopulate `steps` (and reset `currentStepIndex` to 0) on a successful fetch. A mid-trip reroute deliberately does **not** try to carry progress forward into the new route's step indices — restarting from 0 (which the watcher immediately advances past index 0 on the next position update) is simpler and safer than guessing which of the new route's steps correspond to distance already covered. `steps`/`currentStepIndex` are cleared alongside `route`/`eta` everywhere else that already clears those: arrival, `goDark()`, `reset()`.

**Rendered by `HudOverlay.vue`**, not a separate component — see "The HUD layer" below for why.

---

## `MapScreen.vue`

### Map style

```js
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
```

This is CARTO's free, no-API-key "Dark Matter" vector style — chosen specifically because it's *already* dark-themed, unlike the Leaflet-plus-CSS-filter approach `CLAUDE.md` originally sketched (which was written before the MapLibre decision). No `filter:` CSS hacks needed.

**Attribution is a hard requirement of the free tier**, not a nicety — the `AttributionControl` MapLibre adds by default (bottom-right, "MapLibre | © CARTO, © OpenStreetMap contributors") must stay visible. Don't strip it to save space.

If this ever needs to move off the shared CARTO endpoint (self-hosted tiles, a paid provider, an offline style for the Tauri desktop build), it's a one-line change — swap the `MAP_STYLE` URL. Everything else (markers, route layer, click handling) is written against the MapLibre API, not against CARTO specifically.

### The Vite dev-server gotcha

`vite.config.ts` has:

```js
optimizeDeps: {
  exclude: ['maplibre-gl'],
},
```

**Do not remove this.** MapLibre GL constructs its web worker's URL relative to its own package file at runtime (`new Worker(new URL('./maplibre-gl-worker...', import.meta.url))`-style). Vite's dependency pre-bundling flattens `maplibre-gl` into `node_modules/.vite/deps/maplibre-gl.js`, which breaks that relative URL — the worker 404s, and the map silently renders as a solid black rectangle with no console error beyond a failed request for `maplibre-gl-worker.mjs`. If the map ever goes black again in dev, this is the first thing to check, along with clearing `node_modules/.vite` after any maplibre-gl version bump.

### Rendering pipeline

- **User marker** — an outer/inner div pair (`markerEl()`; the outer element is what MapLibre positions via its own `translate()`, so a second transform for heading rotation has to live on the inner one instead, or the two would fight over the same CSS property). The inner `.crystal-marker` (Milestone 6) is a CSS `clip-path` arrow/chevron, not the plain square it used to be — a shape that actually looks directional once rotated, tinted with `store.chosenClass.color` via `--cc`. Created once in `onMounted`, repositioned by a `watch(() => navigation.position, ...)` with `{ immediate: true }` so it also handles the case where a position already exists from onboarding before the map even mounts. The same watcher also does the **destination-before-position catch-up**: if `navigation.destination` is already set (typically restored from `localStorage` on a reload) but `hasRoute` is still false when a position fix lands, it calls `fetchRoute()` right there — the fetch `setDestination()` couldn't make earlier because no position existed yet. A separate `watch(() => navigation.heading, ...)` rotates the inner element (`rotate(${heading ?? 0}deg)`, with a CSS `transition` smoothing the updates) — `heading` defaults to `0` (pointing north) whenever the device hasn't reported one, a disclosed simplification rather than a claim of accuracy with no data behind it.
- **Camera** — the same position watcher does a one-time `map.flyTo()` on the *first* fix only (`hasCentered` flag), so subsequent position updates move the marker without yanking the camera around while the user is looking at something else.
- **Destination marker** — created lazily the first time `navigation.destination` becomes non-null. Was the same square shape as the user marker, just recolored gold; as of Milestone 6, `destMarkerEl()` instead draws the "arrive" maneuver icon from `maneuverIcons.js` onto a small canvas (the same technique `poiMarkerEl()` uses for POI icons) — a distinct pin/flag silhouette, not only a different color, and literal reuse of the exact glyph turn-by-turn shows for the final instruction, since it's the same "you're heading here" idea either way.
- **Route line** — a GeoJSON source (`route`, `lineMetrics: true`) + line layer (`route-line`) added once in the map's `load` event. `syncRoute()` just calls `.setData()` on the existing source whenever `navigation.route` changes; the source/layer themselves are never recreated. Painted with a static `line-gradient` (Milestone 6) — muted near the origin, full `store.chosenClass.color` at the destination end — rather than a flat single color, so the line itself shows which end is "ahead" without any animation. Chosen over a width-taper variant that tested equally directional but made the origin end too thin to read well, via `/dev/map`'s side-by-side comparison against a real fetched route (see that section below).
- **Setting a destination** — currently just a raw `map.on('click', ...)` handler that calls `navigation.setDestination({ lat: e.lngLat.lat, lng: e.lngLat.lng })`. There's no destination search/POI picker yet; clicking the map *is* the interaction for now.

### Fallback center

```js
const FALLBACK_CENTER = [-75.1652, 39.9526] // Philadelphia — arbitrary, no significance
```

Used only as the map's initial `center` when `navigation.position` is still `null` at mount time (permission denied/skipped). Purely so the map isn't centered on `[0, 0]` (middle of the Gulf of Guinea) before a real fix arrives.

---

## The HUD layer

`src/components/HudOverlay.vue` is the persistent bottom panel: class sprite (`PixelSprite`), stat pips (same rendering as `ClassCard`), ETA (reads `navigation.etaFormatted`), a saved-destination ☆/★ toggle (Direction F, phase 1 — see `Profile.md`), and an `AbilityButton`. It reads `usePlayerStore()`/`useNavigationStore()`/`useProfileStore()` directly rather than taking props — same convention as every other view/overlay in this codebase.

**The turn-by-turn strip (Direction F, phase 2)** lives in this same component, stacked above `.hud-panel` inside `.hud-overlay`'s own fixed-position container — `.hud-overlay` became a column flex instead of a single row to fit it, rather than introducing a second independently-positioned fixed element that would need a guessed pixel offset to sit above a panel of variable height. Rendered only when `navigation.currentManeuver` isn't `null`: a maneuver icon (`PixelSprite` again, fed rows from `maneuverIcons.js` via `iconForManeuver()` — reusing the actual sprite renderer rather than a third duplicate canvas-draw loop, since this is Vue-rendered DOM, not a MapLibre marker), the instruction text (wraps up to 2 lines rather than truncating — the street name is the part worth keeping legible), and a distance-to-maneuver readout rounded to the nearest 10m (`"in 250 m"`, or `"now"` under 30m). Recolors gold (`.arriving` class) for the final "arrive" instruction, matching the ARRIVED trip-completion toast's own accent.

`AbilityButton.vue` emits `activate` when clicked (unless `disabled` or mid-cooldown) and, if `cooldownMs > 0`, runs its own `requestAnimationFrame` loop to animate a depleting "veil" overlay and re-disables itself — the cooldown is entirely self-contained, `MapScreen.vue` doesn't manage timers. As of Milestone 6, the veil is joined by a small numeric countdown (`{{ remainingSeconds }}s`, derived from the same `cooldownPct` the veil's width already tracks) — the color sweep alone communicated "still cooling down" but not "how much longer," which matters more the longer a class's cooldown runs. `MapScreen.vue` listens for `HudOverlay`'s bubbled `@ability` event via `onAbility()`, which dispatches on `store.chosenClass.abilityType`: `'reveal'` classes (the Adventurer archetype — Fighter/Pilot/Gunslinger/Buccaneer) call `navigation.revealPOIs()`; `'reroute'` classes (the Speedrunner archetype — Thief/Smuggler/Outrider/Corsair) call `navigation.attemptReroute()` and, if it actually swapped routes, `pulseRoute()` (a `requestAnimationFrame` tween of the route layer's `line-width` up and back down over ~650ms — the "shadow step" flash, purely cosmetic, `syncRoute()` already handles the line's actual data); `'share-eta'` classes (the Connector archetype — White Mage/Diplomat/Wagon Master/Quartermaster) call `navigation.shareETA()`, with `MapScreen.vue`'s status-lane `Toast` (see below) surfacing its transient `shareStatus` feedback; `'privacy'` classes (the Sovereign archetype — Black Mage/Overseer/Outlaw/Captain) call `navigation.goDark()`. All four archetypes are wired in as of milestone 4's fourth phase.

### Toasts (`Toast.vue`)

Was three separately-positioned, near-identical `<Transition>` blocks in `MapScreen.vue` (share status, route error, XP) each with its own copy of the same fade/position CSS. Milestone 6 replaced them with one reusable `Toast.vue` (`text`/`tone`/`color`/`top` props), rendered twice: a **status lane** (`top: 1rem`) showing `navigation.routeError ?? navigation.shareStatus` — `routeError` wins the slot outright when both are set, preserving the priority the two already had before this pass, just without two full copies of the styling — and a **growth lane** (`top: 3.4rem`) for the local `xpToast` ref, kept at its own offset specifically so a share-status message and a growth message can still both be visible at once (a real case: using the Connector archetype's ability without the Web Share API grants XP *and* sets `shareStatus` in the same action). `tone` (`'default'` | `'error'` | `'gold'`) picks the border/text color; `'default'` additionally takes a `color` prop for the active class's own color, since that one isn't fixed. Found via a real narrow-viewport screenshot, not assumed: the original `white-space: nowrap` had no width limit, so a long message (routeError's own text, at a 390px-wide phone viewport) ran clean off both edges of the screen — `Toast.vue` now wraps at `max-width: 88vw` instead.

### Tuning the HUD's look

Every visual property of `HudOverlay`/`AbilityButton` (background alpha, blur, padding, gap, border glow, stat-pip size, ability-button width) reads from a `--hud-*` CSS custom property with a fallback default. Two ways to change them:

1. **Permanent**: edit the defaults in `src/assets/main.css`'s `:root` block, right below the `--ff-*` palette tokens.
2. **Live preview first**: open **`/dev/hud`** (`src/views/HudPlayground.vue`) — a standalone dev route (bypasses the genre/class router guard) with sliders for every token, a 4-class picker to preview each color scheme, a fake-ETA slider, and a "COPY CSS" button that puts a ready-to-paste `:root { ... }` block matching your slider positions on the clipboard. It renders the real `HudOverlay` against the real `player`/`navigation` stores — see the comment at the top of that file for why it assigns state directly to the store refs instead of calling `selectGenre()`/`selectClass()` (those persist to `localStorage`, and a dev tool shouldn't clobber a real in-progress selection; the override only lasts the session).

### `/dev/map` — the map-layer design-review tool

`src/views/MapPlayground.vue`, Milestone 6's other deferred item, built once there was an actual decision to make (the route-line treatment) rather than up front — same standalone-dev-route pattern as `/dev/hud`/`/dev/sprites` (bypasses the genre/class router guard). Mounts a real MapLibre map and fetches a real route from the same public OSRM demo server the app itself falls back to (a fixed Center City Philadelphia origin/destination, not a hand-drawn stand-in), then lets you switch between candidate `line-gradient` treatments live, fire the existing reroute-pulse animation to confirm it stays visually distinct from whatever's active, drag a heading slider to check the user marker's rotation, and fire sample status/error/XP toasts layered over the map to see everything at once. Switching treatments rebuilds the source/layer from scratch rather than mutating paint properties in place — `line-gradient` needs `lineMetrics: true` set at source-creation time and doesn't reliably toggle via `setPaintProperty` alone; only matters for this comparison tool; the real `MapScreen.vue` just sets it once. This is what decided the gradient treatment now live on the real map (see "Rendering pipeline" above) over a width-taper variant that looked equally directional in isolation but read worse in practice once compared side by side against the same real route.

### Env-configurable backends

`OSRM_BASE`/`OVERPASS_BASE` read `import.meta.env.VITE_OSRM_BASE`/`VITE_OVERPASS_BASE`, falling back to the public demo servers when unset. Copy `.env.example` to `.env.local` (already covered by the repo's `*.local` `.gitignore` pattern) to point at a self-hosted instance — see `PRODUCTION.md` for why the public servers aren't production-safe and what self-hosting involves.

### Known gaps (deferred, not oversights)

- **`shareETA()`'s `navigator.share()` path is unverified.** Desktop Chromium (and Playwright) doesn't implement the Web Share API, so testing so far has only exercised the clipboard-copy fallback. The share-sheet path is standard browser API usage, but hasn't actually been confirmed on a real mobile browser/WebView.
- **`goDark()` clears more than just this player's own trail.** It wipes `destination`/`route`/`eta` too, not only `position`/`pois` — reasonable for "erase everything on the map that traces back to me" as a solo flourish, but if a future feature has someone *else's* shared destination sitting in this store (see `shareETA()`'s known gap above about there being no real party sync yet), `goDark()` would currently erase that along with the player's own trail. Not a problem today since nothing writes another party member's data into this store yet.
- **No automatic staleness cleanup for revealed POIs.** `pois` only grows on its own — `goDark()` can wipe it manually, but there's still no radius/time-based check, so a player mashing SCOUT while wandering (without ever using the Sovereign archetype) will accumulate markers from everywhere they've ever swept. Fine for a first pass; revisit if that turns out to clutter the map in practice.
- **`pickRoute()`'s `avoid`/`priority` handling is a client-side workaround for what the public OSRM server can't do, not a substitute for real support.** A self-hosted OSRM instance with proper `exclude` classes configured would make "avoid highways/ferries" exact instead of a `ref`/`name` regex heuristic (confirmed false-positive-prone: "Grays Ferry Avenue" isn't a ferry, and any state route whose signage doesn't match the `I \d+`/`US \d+` pattern won't be flagged as a highway either), and `tolls` specifically can't be approximated at all with this dataset — the route API just doesn't expose toll status per step. `fewest_turns`'s turn count is a reasonable proxy but hasn't been validated against how a person actually perceives "annoying number of turns" on a real drive.
- **Production readiness beyond this store** (self-hosting OSRM/Overpass, CARTO's free-tile usage limits, Tauri's CSP, etc.) is tracked in `PRODUCTION.md` rather than repeated here.
- **Turn-by-turn's step-advancement is threshold-based, not map-matched.** Comparing live position straight-line to each maneuver's coordinate (not projected onto the route polyline) works fine on typical city streets but can misbehave on a route with maneuvers close together or a road that loops near itself — a real map-matching algorithm would be needed to fix that properly, and is out of scope for this pass. A mid-trip reroute also restarts turn-by-turn from step 0 rather than trying to carry progress forward into the new route's own step indices — the watcher catches up within one position update, but the banner will briefly show the "depart" step's successor again rather than wherever progress actually was.

Resolved in the production-hardening pass (see `PRODUCTION.md` and `PLANNING.md` §21): the destination-before-position race, `navigation.destination` not surviving a refresh, `fetchRoute()` having no error handling, and geolocation errors failing silently.
