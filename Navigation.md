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
| `destination` | `{ lat, lng } \| null` | Set by `setDestination()`. |
| `route` | `[[lng, lat], ...]` | GeoJSON coordinate order (**lng first**), because it's fed directly into a MapLibre `LineString` geometry — don't flip it to `[lat, lng]` without also updating `MapScreen.vue`'s `syncRoute()`. |
| `eta` | seconds \| `null` | Raw OSRM `duration` field. |
| `watcherId` | geolocation watch ID \| `null` | Internal; not returned from the store's public surface beyond `startWatching`/`stopWatching`. |

Getters: `hasRoute` (boolean), `etaFormatted` (`"N min"` / `"<1 min"` / `null`).

Actions:
- `setPosition(latLng)` — direct write, used by `LocationPermissionStep`.
- `startWatching()` / `stopWatching()` — wrap `watchPosition`/`clearWatch`. `startWatching()` is a no-op if already watching (checks `watcherId`), so it's safe to call from `onMounted` without worrying about double-subscriptions.
- `setDestination(latLng)` — stores the destination and, if a position is already known, immediately calls `fetchRoute()`. If no position is known yet, the destination is stored but no route is fetched — nothing re-triggers `fetchRoute()` later when a position does arrive. (Acceptable today since `MapScreen.vue` doesn't let you set a destination before *some* position exists in practice — the fallback center still allows map clicks, so this is a real gap if someone clicks before their first fix. See "Known gaps" below.)
- `fetchRoute(origin, dest)` — calls the public OSRM demo server (see below), sets `route` and `eta` from the first returned route.
- `reset()` — stops watching and clears all state. Called from `MapScreen.vue`'s "START OVER" button alongside `player.reset()`.

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

- **User marker** — a small CSS square (`.crystal-marker`, global un-scoped style block since MapLibre injects marker DOM outside Vue's tree) tinted with `store.chosenClass.color` via the `--cc` variable. Created once in `onMounted`, repositioned by a `watch(() => navigation.position, ...)` with `{ immediate: true }` so it also handles the case where a position already exists from onboarding before the map even mounts.
- **Camera** — the same position watcher does a one-time `map.flyTo()` on the *first* fix only (`hasCentered` flag), so subsequent position updates move the marker without yanking the camera around while the user is looking at something else.
- **Destination marker** — created lazily the first time `navigation.destination` becomes non-null, styled in gold (`#F0C060`) rather than the class color, since it isn't the class's identity, it's a target.
- **Route line** — a GeoJSON source (`route`) + line layer (`route-line`) added once in the map's `load` event, painted in `store.chosenClass.color`. `syncRoute()` just calls `.setData()` on the existing source whenever `navigation.route` changes; the source/layer themselves are never recreated.
- **Setting a destination** — currently just a raw `map.on('click', ...)` handler that calls `navigation.setDestination({ lat: e.lngLat.lat, lng: e.lngLat.lng })`. There's no destination search/POI picker yet; clicking the map *is* the interaction for now.

### Fallback center

```js
const FALLBACK_CENTER = [-75.1652, 39.9526] // Philadelphia — arbitrary, no significance
```

Used only as the map's initial `center` when `navigation.position` is still `null` at mount time (permission denied/skipped). Purely so the map isn't centered on `[0, 0]` (middle of the Gulf of Guinea) before a real fix arrives.

---

## The HUD layer

`src/components/HudOverlay.vue` is the persistent bottom panel: class sprite (`PixelSprite`), stat pips (same rendering as `ClassCard`), ETA (reads `navigation.etaFormatted`), and an `AbilityButton`. It reads `usePlayerStore()`/`useNavigationStore()` directly rather than taking props — same convention as every other view/overlay in this codebase.

`AbilityButton.vue` emits `activate` when clicked (unless `disabled` or mid-cooldown) and, if `cooldownMs > 0`, runs its own `requestAnimationFrame` loop to animate a depleting "veil" overlay and re-disables itself — the cooldown is entirely self-contained, `MapScreen.vue` doesn't manage timers. `MapScreen.vue` listens for `HudOverlay`'s bubbled `@ability` event via `onAbility()`, currently a no-op — that's the hook point for the four class abilities (milestone 4), not implemented yet.

### Tuning the HUD's look

Every visual property of `HudOverlay`/`AbilityButton` (background alpha, blur, padding, gap, border glow, stat-pip size, ability-button width) reads from a `--hud-*` CSS custom property with a fallback default. Two ways to change them:

1. **Permanent**: edit the defaults in `src/assets/main.css`'s `:root` block, right below the `--ff-*` palette tokens.
2. **Live preview first**: open **`/dev/hud`** (`src/views/HudPlayground.vue`) — a standalone dev route (bypasses the genre/class router guard) with sliders for every token, a 4-class picker to preview each color scheme, a fake-ETA slider, and a "COPY CSS" button that puts a ready-to-paste `:root { ... }` block matching your slider positions on the clipboard. It renders the real `HudOverlay` against the real `player`/`navigation` stores — see the comment at the top of that file for why it assigns state directly to the store refs instead of calling `selectGenre()`/`selectClass()` (those persist to `localStorage`, and a dev tool shouldn't clobber a real in-progress selection; the override only lasts the session).

### Known gaps (deferred, not oversights)

- **No class abilities wired in.** SCOUT/SHADOW STEP/CURE/FIRE all depend on this map layer existing, which it now does, but none of them are implemented yet — `MapScreen.vue`'s `onAbility()` is currently empty.
- **Destination-before-position race**: if a destination is clicked before any position fix exists, `setDestination()` stores it but never fetches a route, and nothing retries once a position does arrive. Low-probability in practice (a fix from onboarding usually already exists) but worth fixing before this ships for real — likely by having `fetchRoute` re-run from a `watch` on `position` when a destination is already set, rather than only from inside `setDestination`.
- **OSRM's public router (`router.project-osrm.org`) is a community demo server** — rate-limited, no uptime guarantee, explicitly not for production use per OSRM's own docs. Fine for development; will need a self-hosted or paid routing backend before release.
- **`navigation` state isn't persisted.** Refreshing the map screen loses the current route/destination (though `player`'s `chosenGenre`/`chosenClass` survive, so you land back on the same map, just without a route). This is intentional for `position` (see table above) but the same reasoning doesn't necessarily apply to `destination` — revisit if refresh-losing-your-route turns out to be annoying in practice.
