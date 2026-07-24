# Crystal Path — Implementation Planning

Detailed breakdown of the five global milestones that must exist before any class-specific work begins. Each section explains what the piece is, why it belongs in the shared layer, and how to implement it step by step.

---

## Finished

### 1. Persistence & routing guards

**Files changed:** `src/stores/player.js`, `src/router/index.js`

**Store (`src/stores/player.js`)**
- Added `import { CLASSES } from '@/data/classes'` and a `STORAGE_KEY` constant (`'crystalpath-class'`).
- On store init, reads the saved id from `localStorage` and re-hydrates `chosenClass` by looking it up in `CLASSES`. Storing only the id (not the full object) keeps `classes.js` as the single source of truth — a cached stale object can't drift from the definition.
- `selectClass()` now calls `localStorage.setItem(STORAGE_KEY, cls.id)` after setting the ref.
- `reset()` now calls `localStorage.removeItem(STORAGE_KEY)` so a restart returns cleanly to class select.

**Router (`src/router/index.js`)**
- Added a `router.beforeEach()` guard. `usePlayerStore()` is called *inside* the guard, not at module level — the router module is imported before `app.use(pinia)` runs, so calling it at module level would throw. Deferring to the guard body means Pinia is always active by the time the store is accessed.
- Guard logic: `class-select` always passes (`return true`). Any other route with no chosen class redirects to `{ name: 'class-select' }`. The happy path (class is set) falls through via implicit `undefined`, which Vue Router 4 treats as a pass.

### 2. Shared onboarding chrome

**Files created:** `src/components/PixelButton.vue`, `src/components/DialogBox.vue`, `src/components/OnboardingLayout.vue`

**`PixelButton.vue`**
- Props: `variant` (`'primary'` | `'ghost'`, default `'primary'`), `disabled` (boolean), `classColor` (optional hex string for class-tinted variant).
- Emits: `click`.
- Uses the `--cc` CSS variable pattern (same as `ClassCard`) — when `classColor` is passed, the border and text adopt the class color and the hover background uses `color-mix()` to tint at 15% opacity. This keeps all color-dependent rules in scoped CSS rather than inline styles.
- Disabled state: `opacity: 0.4`, `pointer-events: none`, `cursor: not-allowed`. Applied via `.pixel-btn--disabled` class so the visual state and the `disabled` attribute are always in sync.

**`DialogBox.vue`**
- Props: `text` (string, required), `speed` (ms per character, default 40), `autoStart` (boolean, default true), `classColor` (optional hex for border tint via `--cc`).
- Emits: `done` (fired when the full string is revealed).
- Typewriter: a `setInterval` appends one character at a time to a `displayed` ref. On completion the interval is cleared and `done` is emitted.
- Skip-on-click: if the animation is still running, a click handler jumps `displayed` to the full text, clears the interval, and emits `done` immediately. Clicking after `done` is a no-op.
- Cursor: a blinking `▌` appears inline while typing; a blinking `▼` (positioned bottom-right) appears when done, signalling the user to continue. Both use `@keyframes blink` with `step-end` so the transition is instant — consistent with pixel aesthetic.
- `start()` and `skip()` are exposed via `defineExpose` so a parent step component can imperatively restart the animation (e.g. when the text prop changes and `autoStart` is false).
- `onUnmounted` clears the interval to prevent memory leaks if the component is destroyed mid-animation.
- `watch(() => props.text, ...)` restarts the animation automatically when the text prop changes, supporting reuse across multiple narration beats within a single step.

**`OnboardingLayout.vue`**
- Props: `totalSteps` (number), `currentStep` (number), `classColor` (optional hex).
- Slot: default slot receives the step content, rendered inside `.frame-content`.
- Composes `StarField` (full-bleed background) and `PixelDivider` (under the title in the frame header).
- Frame border uses a layered shadow: `border` (2px, class color), `outline` (4px, `--ff-night` offset inward), and `box-shadow` (6px solid ring + a diffuse glow in the class color at 30% opacity via `color-mix()`). This creates the classic FF window-within-window border look without extra DOM elements.
- Progress dots in the footer: a `v-for` over `totalSteps`. Each dot is `.past` (filled muted), `.active` (filled class color), or default (empty). The `active` class is `n - 1 === currentStep`; `past` is `n - 1 < currentStep`.

### 3. Genre landing layer

**Files created:** `src/data/genres.js`, `src/components/GenreCard.vue`, `src/views/GenreSelectScreen.vue`
**Files changed:** `src/router/index.js`, `src/views/ClassSelectScreen.vue`, `src/views/OnboardingScreen.vue`

Crystal Path was originally scoped as a single genre (Final Fantasy). This adds a genre layer above class selection so the app can host multiple RPG-genre onboarding flows later, with only Final Fantasy fully built today.

**`src/data/genres.js`**
- New `GENRES` array, sibling to `CLASSES`, not nested inside it — a genre owns a whole onboarding flow (its own class roster, sprites, copy), so it's a peer data source rather than a property of `classes.js`.
- Each entry: `id`, `name`, `tagline`, `description`, `color`, `status` (`'available'` | `'coming-soon'`), `entryRoute` (route `name` to push to, or `null` for locked genres).
- Ships with one `available` entry (`ff`, pointing at `entryRoute: 'class-select'`) and two `coming-soon` placeholders (`scifi`, `western`) so the landing grid doesn't look sparse with a single card. Their copy is intentionally generic — they're layout placeholders, not designed content.

**`src/components/GenreCard.vue`**
- Modeled on `ClassCard.vue`'s structure (the `--cc` CSS var trick, same border/hover pattern) but simpler — no sprite, no stat pips, since a genre isn't a stat-bearing entity.
- `status !== 'available'` renders a `COMING SOON` badge, drops `tabindex` to `-1`, sets `aria-disabled`, and no-ops the click/keydown handler instead of emitting `select`. Locked cards also skip the hover border-color change so they read as inert.

**`src/views/GenreSelectScreen.vue`**
- Structurally a near-clone of `ClassSelectScreen.vue` (StarField, corner decorations, header, `PixelDivider`) minus the confirm-button footer — genre selection is a direct navigation, not a staged choice like class (no stat comparison to weigh, so no separate confirm step).
- `onSelect(genre)` pushes to `genre.entryRoute` only if the genre is available; the coming-soon no-op already happens inside `GenreCard`, so this is a second line of defense, not the primary guard.

**Router (`src/router/index.js`)**
- `/` is now `genre-select` (this screen). Final Fantasy's flow moved down a level: `/ff` → `class-select`, `/ff/onboarding` → `onboarding`. This makes room for `/starvoyager`, `/frontier`, etc. as future genres get built out, each owning its own path prefix.
- The `beforeEach` guard now passes both `genre-select` and `class-select` through unconditionally; any other named route without `store.chosenClass` redirects to `class-select`. Known limitation: that redirect always lands on the FF class-select screen regardless of which genre's route the user was trying to reach — harmless today since FF is the only genre with downstream routes, but will need a genre-aware redirect once a second genre gets its own onboarding routes.
- No `chosenGenre` was added to the player store. Genre choice isn't state that needs to persist or gate anything yet — it's just which URL prefix the user is under. Revisit if a second genre needs its own persisted flow state.

**Back-navigation fixes**
- `ClassSelectScreen.vue` gained a `PixelButton variant="ghost"` "← GENRES" link (top-left of `.content`) since `/ff` is no longer the app root — without it there'd be no way back to the genre picker.
- `OnboardingScreen.vue`'s stub "← Back" button now pushes `{ name: 'class-select' }` instead of `'/'`, since `'/'` is the genre picker, not the class picker, post-restructure.

### 4. Genre-generic routing & store

**Files changed:** `src/router/index.js`, `src/stores/player.js`, `src/data/genres.js`, `src/views/ClassSelectScreen.vue`, `src/views/OnboardingScreen.vue`

The genre landing layer above (§3) hardcoded a single path prefix (`/ff`) and a static `CLASSES` import — fine for one genre, but every additional genre would have meant duplicating `ClassSelectScreen.vue`/`OnboardingScreen.vue` wholesale. This pass makes the class-select and onboarding screens generic over *any* genre, driven by data and a route param, so a second genre needs a content entry, not new components. No second genre was actually built — `scifi` and `western` remain locked placeholders (`classes: []`) — this is infrastructure only.

**`src/data/genres.js`**
- Each genre entry now carries `classes` — the `ff` entry points at the existing `CLASSES` from `classes.js` (imported, not duplicated); the locked placeholders get `classes: []` since nothing has been designed for them yet.

**Router (`src/router/index.js`)**
- Routes are now `/` (`genre-select`) → `/:genreId` (`class-select`) → `/:genreId/onboarding` (`onboarding`). `/ff` still works, but so would `/scifi` the moment that genre's `status` flips to `'available'` — no route table changes needed per genre.
- The guard resolves `to.params.genreId` against `GENRES` on every navigation: an unknown id or a `'coming-soon'` genre bounces to `genre-select` before the id ever reaches a component (verified: `/bogus-genre` and `/scifi` — currently locked — both redirect to `/`). `class-select` passes once the genre check clears. Any deeper route additionally requires `store.chosenClass` to exist *and* `store.chosenGenre.id` to match the current `genreId` — the second condition is what stops a leftover session for one genre from being treated as valid on another genre's onboarding route.

**Store (`src/stores/player.js`)**
- Added `chosenGenre`, persisted under its own `crystalpath-genre` localStorage key (separate from `crystalpath-class`) via a new `selectGenre()` action. This was deliberately *not* added back in §3 because at the time genre was just a URL prefix; now that class rosters are genre-scoped, the store needs to know which genre's roster `chosenClass` was picked from to rehydrate correctly.
- Rehydration on init now reads the saved genre first, then looks up the saved class id inside *that genre's* `classes` array (not a global `CLASSES` import) — so two genres are free to reuse class ids (e.g. both having a `'fighter'`) without colliding.
- `reset()` clears both keys.

**`ClassSelectScreen.vue`**
- No longer imports `CLASSES` directly. Reads `route.params.genreId`, resolves `genre = GENRES.find(...)` as a computed, and renders `genre.classes` / `genre.tagline` instead of the hardcoded FF roster and "NAVIGATION CHRONICLES" subtitle. `confirm()` now calls `store.selectGenre(genre.value)` before `store.selectClass(cls)`, and pushes to `onboarding` with the current `genreId` param.
- The "← GENRES" back link is unchanged (genre-select needs no params).

**`OnboardingScreen.vue`**
- The "← Back" button now pushes `{ name: 'class-select', params: { genreId: store.chosenGenre.id } }` — plain `{ name: 'class-select' }` would resolve to a path missing the required param.

**Verified with Playwright:** genre select → `/ff`; `/bogus-genre` and `/scifi` (locked) both redirect to `/`; full class pick → confirm → `/ff/onboarding`; refresh on onboarding preserves genre + class and shows the right welcome text; Back from onboarding returns to `/ff`; a fresh browser context hitting `/ff/onboarding` directly (no chosen class) redirects to `/ff`. No console/page errors in any case.

### 5. Step-driven onboarding engine

**Files created:** `src/components/onboarding/WelcomeStep.vue`, `src/components/onboarding/AbilityRevealStep.vue`, `src/components/onboarding/LocationPermissionStep.vue`, `src/components/onboarding/DoneStep.vue`, `src/views/MapScreen.vue`
**Files changed:** `src/data/classes.js`, `src/views/OnboardingScreen.vue`, `src/router/index.js`

`OnboardingLayout`, `PixelButton`, and `DialogBox` were built back in §2 but sat unused — `OnboardingScreen.vue` was still the original one-paragraph stub. This pass wires them into the real step engine described in `CLAUDE.md` milestone 3, and replaces the stub entirely (its "← Back" button, and the note about it in §4, is now superseded — a multi-step flow doesn't have a single back target).

**`src/data/classes.js`**
- Each class gained `onboardingSteps: ['intro', 'ability', 'location', 'done']`, `intro` (short narration in the class's voice), and `locationPrompt` (the exact per-class copy from `CLAUDE.md`'s flavor table). `ability`/`abilityDesc` already existed from milestone 1 and needed no changes.

**`src/views/OnboardingScreen.vue`** — full rewrite, no longer a stub
- A `STEP_COMPONENTS` map (`intro`/`ability`/`location`/`done` → component) plus two computeds — `currentStepId` reads `store.chosenClass.onboardingSteps[store.onboardingStep]`, `currentStepComponent` resolves it to a component. No null-guarding: the router guard already guarantees `chosenClass` is set before this screen mounts.
- Renders `<component :is="currentStepComponent" @advance="store.advanceOnboarding()" />` inside `OnboardingLayout`, passing `store.chosenClass.color` through as `classColor` so the frame border/progress dots pick up the class tint automatically (this is why the Fighter run below is red-bordered and the Thief run is green-bordered — no per-step color plumbing needed).
- Steps only ever emit `advance`; they don't know their own index or what comes next, per the spec.

**`WelcomeStep.vue`** — `DialogBox` bound to `chosenClass.intro`; a "CONTINUE ▶" `PixelButton` appears on `@done` and emits `advance`.

**`AbilityRevealStep.vue`** — `PixelSprite` at `pixelSize="8"` as a backdrop, the ability name fades/pulses in via CSS immediately, then after an 800ms `setTimeout` the description `DialogBox` appears; "CONTINUE ▶" shows on its `@done`.

**`LocationPermissionStep.vue`**
- A single `DialogBox` whose `:text` is a ternary between `chosenClass.locationPrompt` and an error string — switching the prop retriggers `DialogBox`'s own `watch(() => props.text, ...)`, so no manual restart call was needed and no second `DialogBox` instance.
- "GRANT ACCESS ▶" calls `navigator.geolocation.getCurrentPosition()`; disabled (`requesting`) while in flight. Success emits `advance` directly. Failure swaps the dialog text to an error message and reveals a ghost-variant "SKIP FOR NOW" button that also emits `advance`.
- Deliberately does **not** write the resolved position anywhere yet — there's no navigation store to put it in until milestone 5 (map foundation) is built. The position is fetched (proving the permission flow works end-to-end) and then discarded. Revisit once `src/stores/navigation.js` exists.

**`DoneStep.vue`** — plays a ~1.4s CSS "fanfare" (scale/opacity keyframes on a `✦ READY ✦` line), then `setTimeout` pushes to `{ name: 'map', params: { genreId: store.chosenGenre.id } }`. Reads `chosenGenre` from the store rather than `useRoute()` — one less import, and the store is already the source of truth here.

**`src/views/MapScreen.vue`** (new stub) + **router** — added `/:genreId/map` → `map`. No guard changes needed: `map` isn't `genre-select` or `class-select`, so it already falls under the existing "must have a matching `chosenClass`" branch. The stub itself just confirms genre/class and offers a "← START OVER" button that calls `store.reset()` and returns to `genre-select` — a full teardown, not a real map (that's milestone 5's job).

**Verified with Playwright, two full runs:** (1) Fighter, geolocation granted via `context.newContext({ geolocation, permissions: ['geolocation'] })` — intro → ability → location → grant → auto-redirect to `/ff/map`. (2) Thief, no geolocation permission granted (so `getCurrentPosition` errors) — same path through to the error dialog → "SKIP FOR NOW" → `/ff/map`. Both runs: correct class-colored frame border/progress dots throughout, sprite rendered at the ability step, zero console/page errors. Screenshots confirmed intro/ability/location/error/map all render correctly.

### 6. Map foundation (MapLibre GL)

**Files created:** `src/stores/navigation.js`, `Navigation.md`
**Files changed:** `src/views/MapScreen.vue` (stub → real), `src/components/onboarding/LocationPermissionStep.vue`, `vite.config.ts`, `package.json` (added `maplibre-gl`)

Real implementation of milestone 5's `MapScreen.vue` + navigation store, using MapLibre GL (chosen over Leaflet for tighter dark-theme control via a vector style rather than a CSS filter hack). **Full write-up, including the data-flow diagram, the store's state shape, and every rendering decision, lives in `Navigation.md` — this entry is deliberately short to avoid duplicating it.**

The two things worth flagging here specifically because they cost real debugging time:
- **`maplibre-gl` v6 has no default export** (`import maplibregl from 'maplibre-gl'` fails at runtime with "does not provide an export named 'default'") — it's named exports only (`Map`, `Marker`, `NavigationControl`, ...). `MapScreen.vue` imports `{ Map as MapLibreMap, Marker, NavigationControl }`.
- **`vite.config.ts` needed `optimizeDeps: { exclude: ['maplibre-gl'] }`** — without it, Vite's dev-server pre-bundling breaks MapLibre's internal worker-script URL and the map renders as a solid black rectangle with no thrown error (just a 404 on `maplibre-gl-worker.mjs` visible in the network tab). `Navigation.md` has the full explanation; this is the kind of thing that looks like a totally unrelated bug if you hit it cold.

`LocationPermissionStep.vue` was also updated: the position fetched during `requestLocation()`'s success callback is now written to `navigation.setPosition()` instead of being discarded (as noted as a gap in §5 above) — closing that loop was the reason the store needed to exist before this pass.

**Verified with Playwright** (geolocation granted via `context.newContext({ geolocation, permissions: ['geolocation'] })`, real network calls to CARTO's tile server and OSRM's public routing API): full run from genre-select through onboarding to `/ff/map`; map renders real street data (confirmed visually, not just "no errors" — screenshots show actual Philadelphia streets/labels); user marker appears at the correct position in class color; clicking the map sets a destination, fetches a route, and renders it as a class-colored line with a correct ETA in the info panel. Zero console/page errors in the final passing run.

### 7. HUD overlay + design-tuning tool

**Files created:** `src/components/HudOverlay.vue`, `src/components/AbilityButton.vue`, `src/views/HudPlayground.vue`
**Files changed:** `src/views/MapScreen.vue` (dropped the placeholder `.info-panel` in favor of `HudOverlay`), `src/assets/main.css` (new `--hud-*` tokens), `src/router/index.js` (added `/dev/hud`)

Closes out the last piece of `CLAUDE.md` milestone 5. Full behavioral detail (props, the cooldown animation mechanics, how the `@ability` event bubbles to `MapScreen.vue`) lives in `Navigation.md`'s new "The HUD layer" section — this entry covers what's specific to *how it was built*, not duplicated there.

The user asked for tools to tune the HUD's look easily, not just the HUD itself, so the design surface was built as **CSS custom properties with `main.css`-level defaults**, overridable per-instance via Vue's normal `style` attribute fallthrough — no HudOverlay-specific plumbing needed for that part. `HudPlayground.vue` (`/dev/hud`) is a live-tweaking page built on top of that: sliders bound to a `computed` style object passed straight to `<HudOverlay :style="hudStyle">`, a 4-class picker, a fake-ETA slider, and a "COPY CSS" button that clipboard-writes a ready-to-paste `:root` block. It previews against the *real* `player`/`navigation` stores (so `HudOverlay` needed zero special-casing for the preview context) but assigns state directly to the store refs instead of calling `selectGenre()`/`selectClass()`, since those actions persist to `localStorage` and a dev tool overwriting a real in-progress class selection would be a bad surprise. The override is session-only; a refresh restores whatever was actually persisted.

The router needed one addition beyond the new route: `/dev/hud` is registered before the genre-select bypass check in the guard, since it's the one route in the app that legitimately needs neither a genre nor a chosen class.

**Verified with Playwright:** on `/dev/hud` — class picker switches sprite/color/ability correctly, every slider visibly changes the rendered HUD, clicking the ability button disables it and confirms cooldown state programmatically, "COPY CSS" produces a clipboard string containing the expected token names. On the real `/ff/map` — `HudOverlay` renders correctly over the live map with the chosen class's sprite, stats, and ability name. Zero console/page errors throughout.

### 8. Second genre: Star Voyager

**Files created:** `src/data/scifiClasses.js`
**Files changed:** `src/data/genres.js` (`scifi` flipped from `coming-soon` to `available`, `entryRoute` set, `classes` populated)

Content only — no component or store changes were needed, which was the actual point of this pass: it's the first real test of whether the genre-generic refactor from §4 (and everything built on top of it since — the step engine, the map, the HUD) genuinely works for a second genre, or only looked generic with one data point.

**`src/data/scifiClasses.js`** — a `SCIFI_CLASSES` array, same shape as `CLASSES`, four roles mapped onto the same archetypes the FF roster uses (bold/adventurous, terse/efficient, warm/communal, ominous/controlling) so the tone contrast reads the same way across genres:

| FF | Star Voyager | Ability |
|---|---|---|
| Fighter (Adventurer) | **Pilot** (Ace) | SCAN — sensor sweep for hidden waypoints |
| Thief (Speedrunner) | **Smuggler** (Runner) | JUMP DRIVE — silent faster-route switch |
| White Mage (Connector) | **Diplomat** (Liaison) | UPLINK — one-tap ETA share |
| Black Mage (Sovereign) | **Overseer** (Sovereign) | PURGE — wipes trail data |

Sprites reuse the FF roster's silhouettes (Pilot←Fighter's armored-body shape, Smuggler←Thief's hooded/low-profile shape, Diplomat←White Mage's robed shape, Overseer←Black Mage's hooded/masked shape) rather than hand-drawing four new ones — the role analogues share enough visual logic (helmeted ace, cloaked runner, robed go-between, masked authority) that reinterpreting the existing pixel grids with new colors held up fine. Pilot's sprite swaps White Mage's skin-tone `'2'` cells for `'w'` (helmet visor instead of exposed face) since it's a spacesuit, not a person.

Genre-level `color` (`#3498DB`, unchanged) stays distinct from all four class colors, matching the existing convention that a genre's brand color isn't shared with any of its classes' identity colors.

**Verified with Playwright:** genre-select shows three cards (Final Fantasy available, Star Voyager now available, Wild Frontier still correctly locked); clicking a still-locked genre card is confirmed inert; full flow through `/scifi` → pick Diplomat → confirm → onboarding (intro/ability/location, all showing the correct sci-fi copy and blue class color) → `/scifi/map` with `HudOverlay` showing the Diplomat sprite, stats, and UPLINK button. Zero console/page errors, zero code changes needed outside the two data files.

### 9. Third genre: Wild Frontier

**Files created:** `src/data/westernClasses.js`
**Files changed:** `src/data/genres.js` (`western` flipped from `coming-soon` to `available`, `entryRoute` set, `classes` populated)

Same recipe as §8, applied to the last remaining locked genre — all three genre cards on the landing page are now real. Same four archetypes again, this time as Gunslinger (Drifter) / TRAILBLAZE, Outrider (Rider) / BACKTRAIL, Wagon Master (Guide) / SIGNAL FIRE, Outlaw (Renegade) / VANISH, reusing the same four sprite silhouettes as the other two rosters.

**One real bug caught during verification, worth remembering:** the Outlaw's first color pick (`#3D2B56`, a dark desaturated violet) rendered as flat gray against the app's near-black background (`--ff-night: #0A0A14`) instead of reading as purple — screenshotted it and the "CRYSTAL PATH" title/CONTINUE button/border all looked colorless. Every other class color in the app (FF and Star Voyager both) sits at roughly 35-45% lightness with real saturation, which is what gives the `--cc`-tinted UI its pop on a dark background; this one was too dark to clear that bar. Fixed by picking a brighter, more saturated color in the same "ominous" family (`#7A2048`, a deep magenta-red) — re-screenshotted to confirm it actually reads as a distinct color before moving on. **Lesson for designing any future genre's palette: check new class colors against the dark background visually, not just conceptually** — a color that sounds right for the flavor ("dark, ominous purple") can still fail to render as a color at all at low lightness/saturation.

**Verified with Playwright:** genre-select now shows zero "coming soon" badges across all three cards; full flow through `/western` → pick Outlaw → confirm → onboarding → `/western/map` with `HudOverlay` showing the corrected color. Zero console/page errors, zero code changes needed outside the two data files (matching §8 — second confirmation the genre-generic architecture holds).

### 10. Fourth genre: High Seas

**Files created:** `src/data/pirateClasses.js`
**Files changed:** `src/data/genres.js` (new `pirate` entry, `status: 'available'` from the start — no locked placeholder stage this time, since the pattern is now proven three times over)

Same recipe as §8/§9 for a fourth genre, id `pirate`, name "High Seas": Buccaneer (Voyager) / SPYGLASS, Corsair (Raider) / FULL SAIL, Quartermaster (Boatswain) / SIGNAL FLAG, Captain (Sovereign) / SCUTTLE — same four archetypes and the same four reused sprite silhouettes as every other genre.

Applied §9's lesson from the start this time: picked all four class colors (`#D35400` burnt orange, `#148F77` teal, `#C9962C` brass gold, `#7B2331` crimson) and the genre's own brand color (`#1ABC9C` turquoise) aiming for the same ~35-45% lightness/real-saturation range the other genres' colors sit at, then screenshotted all four classes' onboarding intro screens *before* calling it done rather than after — confirmed all four read as distinct, vibrant colors against `--ff-night` on the first pass, no fix-up round needed this time.

**Verified with Playwright:** genre-select shows four cards, zero locked; class-select shows all four pirate classes with correct sprites/stats/abilities; walked all four classes' onboarding intro screens to check color contrast; full run through Captain → confirm → onboarding → `/pirate/map` with `HudOverlay` showing the crimson SCUTTLE button. Zero console/page errors, zero code changes needed outside the two data files — third confirmation the genre-generic architecture holds with no per-genre special-casing anywhere in the component/store/router layer.

---

## 1. Persistence & routing guards

### What it is

Right now the Pinia store holds `chosenClass` in memory only. A page refresh wipes it. A routing guard is the complementary piece: a function that runs before every navigation event and redirects the user away from a route they shouldn't reach yet (e.g. `/onboarding` when no class has been chosen).

### Why it's global

Every route beyond the class selection screen depends on knowing which class the user picked. If that value can disappear — through a refresh, a tab restore, or a deep-link — every downstream screen breaks or has to defensively null-check constantly. Solving persistence once in the store means every view can assume `store.chosenClass` is always valid when reached.

The routing guard is the enforcement layer for that assumption. It makes the guarantee explicit and recoverable: rather than a broken screen, the user is returned to the start of the flow cleanly.

### Implementation steps

1. **Add persistence to the player store** — in `src/stores/player.js`, after `chosenClass` is set in `selectClass()`, write the class `id` to `localStorage` (`localStorage.setItem('crystalpath-class', cls.id)`). On store initialization, read that key back and re-hydrate `chosenClass` by looking up the matching entry in `CLASSES`.

2. **Add a `reset()` localStorage clear** — the existing `reset()` function should also call `localStorage.removeItem('crystalpath-class')` so sign-out/restart works cleanly.

3. **Add a navigation guard to the router** — in `src/router/index.js`, use `router.beforeEach()`. The guard checks: if `to.name !== 'class-select'` and `store.chosenClass` is null, redirect to `{ name: 'class-select' }`. Import the player store inside the guard (not at module level — Pinia must be active first).

4. **Test the round-trip** — choose a class, confirm, navigate to `/onboarding`, refresh the page. The user should land back on `/onboarding` with the correct class name displayed, not be kicked to `/`.

---

## 2. Shared onboarding chrome

### What it is

Three small, reusable UI primitives that every onboarding step will be built inside:

- **`OnboardingLayout.vue`** — the wrapping shell for every onboarding step. Provides the background (StarField), pixel-border frame, and a step progress indicator (e.g. `● ● ○ ○` dots).
- **`PixelButton.vue`** — a styled button component with the FF pixel-border aesthetic, hover/active states, and a disabled variant. Replaces the raw `<button>` used everywhere in the stub.
- **`DialogBox.vue`** — an FF-style speech/text box with a typewriter character-reveal animation. Used for narration, ability descriptions, and permission prompts throughout onboarding.

### Why it's global

Every onboarding step, regardless of class, uses the same visual shell. If each step reimplements its own background, border, and progress indicator, the look drifts over time and any design change requires touching every step file. Building the layout once means:

- Steps are thin: they only contain their own content, not structural boilerplate.
- The progress indicator lives in one place and advances automatically as `store.onboardingStep` changes.
- `DialogBox` is the primary narrative device across all four classes — it needs to be robust (typewriter speed, skip-on-click, done callback) before any story copy is written.

### Implementation steps

**`PixelButton.vue`**
1. Props: `label` (string), `disabled` (boolean, default false), `variant` (default `'primary'`, supports `'ghost'`).
2. Emits: `click`.
3. Styling: `2px solid var(--ff-gold)` border, `var(--ff-panel)` background, uppercase `Press Start 2P` text. Hover shifts background to `var(--ff-border)`. Disabled fades opacity to 0.4 and blocks pointer events. Use the `--cc` pattern if a class-colored variant is needed later.

**`DialogBox.vue`**
1. Props: `text` (string), `speed` (ms per character, default 40), `autoStart` (boolean, default true).
2. Emits: `done` (fired when the full text is revealed).
3. Internal state: `displayed` ref (string), `interval` ref.
4. On mount (or watch on `text`): start an `setInterval` that appends one character of `text` to `displayed` each `speed` ms. Clear interval when `displayed.length === text.length` and emit `done`.
5. Click handler: if animation is still running, skip to the end immediately (set `displayed = text`, clear interval, emit `done`).
6. Template: a `<div class="dialog-box">` with a pixel border, inner `<p>` bound to `displayed`, and a blinking `▼` cursor that hides after `done`.

**`OnboardingLayout.vue`**
1. Props: `totalSteps` (number), `currentStep` (number).
2. Slot: default slot is the step content.
3. Template: `div.onboarding-screen` (full viewport, `position: relative`) containing `StarField`, a centered `div.frame` (pixel border using `box-shadow` stacked outlines or a `border` + `outline` trick), the slot, and a `div.progress` row of dot spans (filled vs unfilled based on `currentStep / totalSteps`).
4. The frame should be sized to feel like a menu window — not full screen, approximately 80vw × 70vh centered with `margin: auto`.

---

## 3. Step-driven onboarding engine

### What it is

A small system that maps the current value of `store.onboardingStep` to a Vue component and renders it inside `OnboardingScreen.vue`. Each class declares which steps it uses (and in what order) via an `onboardingSteps` array in `classes.js`. The engine just resolves step index → component and swaps it in.

### Why it's global

Without this, `OnboardingScreen.vue` either hardcodes a single flow (breaking class variation) or grows into a mess of `v-if` chains for each class. The step-driven pattern keeps the screen dumb — it doesn't know what steps exist, only which one is current — and keeps each step self-contained. Adding or reordering steps for a class becomes a data change in `classes.js`, not a template change.

It also makes the `advanceOnboarding()` store action meaningful: any step component can call it when it's done, and the engine handles the transition.

### Implementation steps

1. **Add `onboardingSteps` to `classes.js`** — each class entry gets an array of string step IDs, e.g.:
   ```js
   onboardingSteps: ['intro', 'ability', 'location', 'done']
   ```
   The order here is the order the user sees them.

2. **Build a step component registry** — in `OnboardingScreen.vue` (or a composable `src/composables/useOnboardingSteps.js`), create a map from step ID → component:
   ```js
   import WelcomeStep          from '@/components/onboarding/WelcomeStep.vue'
   import AbilityRevealStep    from '@/components/onboarding/AbilityRevealStep.vue'
   import LocationPermissionStep from '@/components/onboarding/LocationPermissionStep.vue'
   import DoneStep             from '@/components/onboarding/DoneStep.vue'

   const STEP_COMPONENTS = {
     intro:    WelcomeStep,
     ability:  AbilityRevealStep,
     location: LocationPermissionStep,
     done:     DoneStep,
   }
   ```

3. **Resolve the current component** — a computed property derives the active component:
   ```js
   const currentStepId = computed(() =>
     store.chosenClass?.onboardingSteps[store.onboardingStep] ?? null
   )
   const currentStepComponent = computed(() =>
     currentStepId.value ? STEP_COMPONENTS[currentStepId.value] : null
   )
   ```

4. **Render with `<component :is>`** — in the template, inside `OnboardingLayout`:
   ```vue
   <OnboardingLayout
     :totalSteps="store.chosenClass.onboardingSteps.length"
     :currentStep="store.onboardingStep"
   >
     <component :is="currentStepComponent" @advance="store.advanceOnboarding()" />
   </OnboardingLayout>
   ```

5. **Each step emits `advance`** when the user is ready to proceed — the engine calls `store.advanceOnboarding()`. Steps nev er know their index or what comes next.

6. **Guard the last step** — `DoneStep` should watch `store.onboardingStep` reaching the end of the array and push to `/map` instead of emitting `advance`.

---

## 4. The three universal steps

### What they are

Every class travels through the same three substantive onboarding steps before reaching `DoneStep`:

- **`WelcomeStep`** — a `DialogBox` that delivers a short intro narration in the voice of the chosen class.
- **`AbilityRevealStep`** — an animated reveal of the class ability name, description, and a visual treatment (glowing text, pixel icon, or sprite animation).
- **`LocationPermissionStep`** — requests the browser's geolocation permission with class-flavored copy explaining why it's needed.

### Why they're global

Each step is a single component parameterized by data from `classes.js`. The component logic (typewriter animation, ability reveal sequence, permission request API call) is identical across classes — only the text and color change. Building them as data-driven shared components means:

- The four class voices emerge from content, not code branches.
- A bug in the typewriter animation is fixed once, not four times.
- Adding a fifth class later requires only a data entry, not new components.

### Implementation steps

**`WelcomeStep.vue`**
1. Reads `store.chosenClass.intro` for the dialog text.
2. Passes it to `<DialogBox>` and listens for `@done` to show a "CONTINUE ▶" `PixelButton`.
3. Clicking the button emits `advance`.
4. Apply `--cc` using the class color so the dialog border glows in the class color.

**`AbilityRevealStep.vue`**
1. Reads `store.chosenClass.ability` and `store.chosenClass.abilityDesc`.
2. Sequence: (a) fade in the ability name with a CSS `@keyframes` glow pulse in the class color; (b) after 800ms, reveal the description via `DialogBox`; (c) show the "CONTINUE ▶" button on `@done`.
3. Optionally render a larger version of the class sprite (`PixelSprite` with `pixelSize="8"`) as a backdrop.
4. Emits `advance` on continue.

**`LocationPermissionStep.vue`**
1. Reads `store.chosenClass.locationPrompt` for the flavor text.
2. Renders the prompt in a `DialogBox`, then shows a "GRANT ACCESS ▶" `PixelButton`.
3. On click: calls `navigator.geolocation.getCurrentPosition()`. On success: writes the initial position to the navigation store and emits `advance`. On error or denial: shows an error message in a second `DialogBox` with a "SKIP FOR NOW" option that also emits `advance` (location can be requested again later).
4. Disable the button while the permission request is in-flight to prevent double-taps.

---

## 5. Map foundation

### What it is

The primary screen of the app after onboarding. It has three layers:

- **`MapScreen.vue`** — mounts the map library, centers on the user's location, renders the route line and destination marker.
- **Navigation Pinia store** (`src/stores/navigation.js`) — owns route state: current position, destination, calculated route, ETA, and the active geolocation watcher.
- **`HudOverlay.vue`** — a persistent pixel-art panel that floats over the map: the class sprite (small), the ability button, a mini stat bar, and current ETA.

### Why it's global

The map and navigation store are the backbone of the app. Every class-specific feature (SCOUT's POI reveal, SHADOW STEP's reroute, CURE's ETA share, FIRE's fireball animation) is an extension of the map layer — it queries the route, draws on the map canvas, or reads position data. None of those features can be built until the map exists and position data flows through the store.

`HudOverlay` is shared for the same reason: the layout (sprite, ability button, stats) is identical across classes. Class identity is applied via `--cc` and the sprite rows, not a different component per class.

### Implementation steps

**Navigation store (`src/stores/navigation.js`)**
1. State: `position` (lat/lng object), `destination`, `route` (polyline coords array), `eta` (ms), `watcherId` (geolocation watch ID).
2. Action `startWatching()`: calls `navigator.geolocation.watchPosition()`, stores the watcher ID, updates `position` on each callback.
3. Action `stopWatching()`: calls `clearWatch(watcherId)`.
4. Action `setDestination(latLng)`: stores destination and triggers a route fetch.
5. Action `fetchRoute(origin, destination)`: calls a routing API (OSRM public endpoint or similar), parses the response, sets `route` and `eta`.
6. Getters: `etaFormatted` (converts ms to `"X min"`), `hasRoute` (boolean).

**Map library integration**
1. Choose Leaflet (simpler, smaller) or MapLibre GL (vector tiles, better for custom styling). Add to `package.json`.
2. In `MapScreen.vue`: mount the map to a `<div ref="mapEl">` in `onMounted`. Initialize with a dark tile layer. Set view to `navigation.position` when available.
3. Watch `navigation.position` and pan the map smoothly (`map.panTo()`).
4. Watch `navigation.route` and draw/redraw a `L.polyline` (Leaflet) or source/layer (MapLibre) in the class color (`store.chosenClass.color`).
5. Add a pixel-art-style user marker using a canvas-drawn icon (reuse `PixelSprite` logic to export a data URL for the marker icon).

**`HudOverlay.vue`**
1. Position: `position: fixed` over the map, pointer-events passthrough (`pointer-events: none`) except on interactive children.
2. Layout: bottom panel (fixed to viewport bottom) containing a small `PixelSprite`, `AbilityButton`, ETA display, and stat pips.
3. The `AbilityButton` triggers the class ability. Since ability behavior differs per class, it emits an `ability` event upward to `MapScreen.vue`, which handles it via a class-keyed handler map (same pattern as the step engine in Milestone 3).
4. Stat pips are read from `store.chosenClass.stats` — same pip rendering as `ClassCard`.

**`AbilityButton.vue`**
1. Props: `label` (the ability name), `cooldown` (ms, default 0), `disabled`.
2. Emits: `activate`.
3. Internal: after `activate` is emitted, start a cooldown timer. While cooling down, show a pixel progress bar depleting across the button face. Re-enable when timer expires.

**Dark map tile styling**
1. If using Leaflet: apply a CSS filter to the tile layer container (`filter: invert(1) hue-rotate(180deg) brightness(0.7) saturate(0.6)`) — cheap approximation of a dark map.
2. If using MapLibre: use a dark base style (e.g. `maptiler-dark` or a self-hosted style) and override road/label colors to approximate the `--ff-night` / `--ff-text` palette.
