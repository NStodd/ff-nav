# Crystal Path — Implementation Planning

Chronological build log (**## Finished**, §1–§27) of everything shipped so far, followed by the original detailed spec for the shared-layer milestones (numbered sections below the log) written before that work began. The log now covers class-specific work too (§12–§15, milestone 4's four archetype abilities) — the "before any class-specific work begins" framing was accurate when this file was created but the log outgrew it.

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

### 11. Onboarding-step persistence

**Files changed:** `src/stores/player.js`

Closes the general resilience gap flagged in `Issues.md`'s Android investigation: `chosenGenre`/`chosenClass` already survived a reload (§4), but `onboardingStep` didn't, so any unexpected same-route reload (an HMR hiccup, a WebView hiccup, anything short of a full process restart) dropped a user mid-onboarding back to `intro`.

- Added a `crystalpath-step` `localStorage` key, same pattern as the other two: read once on store init, written by `advanceOnboarding()`/`goBackOnboarding()`, cleared by `reset()`.
- The saved value is only trusted if a class also resolved from storage, and is clamped to `[0, chosenClass.onboardingSteps.length - 1]` — so a stale index from a different class (or a roster whose step count changed) can't point past the end of the array.
- `selectClass()` now explicitly zeroes and persists the step alongside the class id, so confirming a class always starts its onboarding at `intro` even if a stray step value were somehow still sitting in storage.

**Verified with Playwright:** advanced to the personalize step (step 1) as Fighter, confirmed `localStorage.crystalpath-step === '1'`, reloaded the page — resumed on the personalize screen (not intro), same value in storage after reload. Note this specifically covers a same-route reload; a true cold app restart on Android still boots at `/` regardless (Tauri doesn't restore WebView navigation history across process restarts) — that's a different, unrelated behavior this change doesn't touch.

### 12. Milestone 4, phase 1: the Adventurer archetype's reveal ability

**Files changed:** `src/data/classes.js`, `src/data/scifiClasses.js`, `src/data/westernClasses.js`, `src/data/pirateClasses.js`, `src/stores/navigation.js`, `src/views/MapScreen.vue`

First class ability implemented, and — matching the pattern §8–§10 already proved — built once and it works for all four genres' Adventurer archetype simultaneously, not just Fighter.

**Data layer:** every one of the 16 classes gained an `abilityType` field (`'reveal'` | `'reroute'` | `'share-eta'` | `'privacy'`, one per archetype, per `Genres.md`'s archetype table) so `MapScreen.vue` can dispatch on data instead of a class id. The four Adventurer classes (Fighter, Pilot, Gunslinger, Buccaneer) additionally got `abilityRadius: 600` (meters) — a generic name rather than `classes.js`'s originally-planned `scoutRadius`, since the field now lives on four classes across four files, not one.

**`src/stores/navigation.js`:** new `pois` ref and `revealPOIs(radiusMeters)` action. Queries the public Overpass API (`overpass-api.de`, same free/no-key/dev-only tier as OSRM and the CARTO tiles already in use — see the code comment for the same production caveat) for `amenity`/`shop`/`tourism` nodes within the radius of the current position, dedupes against already-revealed ids, and appends. Fails silently (empty sweep, not a thrown error) on a network/API hiccup — this is a flavor ability, not a critical path.

**`src/views/MapScreen.vue`:** `onAbility()` now reads `store.chosenClass.abilityType` and calls `navigation.revealPOIs()` for `'reveal'` classes; the other three archetypes are tagged but not wired up yet (later phases, one at a time). Revealed POIs render as small diamond markers (a rotated inner `<div>` — MapLibre applies its own positioning `transform` directly to the element it's given, which would otherwise clobber a rotation set on that same element) in the class color, each with a click-to-open popup showing the POI's name.

**Verified with Playwright** (geolocation set to Center City Philadelphia): full run through Fighter's onboarding to `/ff/map`, clicked SCOUT — 40 `.poi-marker` elements rendered (the query's cap), screenshotted to confirm they're real, correctly-placed POIs around actual Philadelphia streets, not placeholder data. Zero console/page errors.

### 13. Milestone 4, phase 2: the Speedrunner archetype's reroute ability

**Files changed:** `src/stores/navigation.js`, `src/views/MapScreen.vue`

Second archetype ability — SHADOW STEP/JUMP DRIVE/BACKTRAIL/FULL SAIL, all sharing `abilityType: 'reroute'` from §12's data pass, so this one also landed for all four genres at once.

**`src/stores/navigation.js`:** new `attemptReroute()` action. Re-asks OSRM for the current `position`→`destination` pair with `alternatives=true`; if the response includes a route whose coordinates differ from what's currently drawn, swaps to it (updates `route`/`eta`) and returns `true`, otherwise leaves everything untouched and returns `false`. OSRM's public demo doesn't model live traffic, so this is closer to "offers a genuinely different route" than "found a faster one" — same visible effect (the line changes without being asked) for far less infrastructure than a real traffic feed. Guarded by a new `rerouting` ref against overlapping calls, same pattern as `revealing`.

**`src/views/MapScreen.vue`:** `onAbility()` now also handles `'reroute'` — calls `attemptReroute()` and, only if it actually swapped, plays `pulseRoute()`: a `requestAnimationFrame` tween of the route layer's `line-width` up to a peak and back down over ~650ms. Purely cosmetic flourish for the "silently switches to a faster route" flavor text — no popup, no prompt, just a brief flash on the line itself. Cleaned up on unmount alongside the existing `map.remove()` so a pending tween can't fire against a destroyed map instance.

**Verified with Playwright**, and this one took real work to verify meaningfully: OSRM rarely offers a second alternative for short trips inside Philadelphia's regular street grid, so a handful of test destinations round-tripped with only one route (confirmed via a direct `curl` sweep of candidate coordinates first, then reproduced identically through the app — the code correctly no-ops and returns `false` in that case, verified separately). Found a destination ~1.7km out that OSRM does offer two alternatives for; zoomed the map out three steps and used a Web Mercator projection to click its exact pixel (a plain corner-click doesn't reach that far at the post-flyTo zoom). Confirmed via the network response that two distinct routes came back, then diffed before/after screenshots of the rendered map — the diff isolates a small, localized change right at the route's start (consistent with the two alternatives' near-identical durations, 314.4s vs 315.9s: a one-block detour, not a wholesale reroute). Zero console/page errors throughout.

### 14. Milestone 4, phase 3: the Connector archetype's ETA-share ability

**Files changed:** `src/stores/navigation.js`, `src/views/MapScreen.vue`

Third archetype ability — CURE/UPLINK/SIGNAL FIRE/SIGNAL FLAG (White Mage/Diplomat/Wagon Master/Quartermaster), `abilityType: 'share-eta'` from §12.

`CLAUDE.md`'s original milestone-4 sketch for this one called for a `src/stores/party.js` party roster and a `PartyPanel.vue` drawer of party members' ETAs — dropped in favor of something that actually works without a backend: this app has no server to sync a real party roster against, so an in-app "party" would just be mock data with nowhere real to go. Instead, **`shareETA()`** hands off to whatever the device already has for reaching another person: `navigator.share()` (the OS share sheet) when available, with a real Google Maps link — directions to the current `destination` if one's set, otherwise a search pin on `position` — plus the live ETA in the message text. Falls back to `navigator.clipboard.writeText()` when the Share API isn't available (every desktop browser), and to a plain "not supported" status if neither is. `shareStatus` carries transient feedback for those two fallback paths (auto-cleared after 3s) — a real share sheet has its own OS-level confirmation, so it's only the fallback paths that need an in-app toast at all. `MapScreen.vue` renders that toast as a small class-tinted banner, fading in/out via a `<Transition>`.

**Verified with Playwright** (desktop Chromium has no Web Share API, so this exercises the clipboard fallback — the share-sheet path itself is standard browser API usage but hasn't been confirmed on a real mobile WebView; see `Navigation.md`'s known gaps): clicked CURE with no destination set — clipboard held `"I'm on my way. https://www.google.com/maps/search/?api=1&query=<position>"`, toast read "Copied to clipboard." and auto-cleared after 3s. Set a destination and clicked CURE again — clipboard correctly switched to the `/maps/dir/` link for that destination with the live ETA in the text (`"I'm on my way — ETA 1 min. ..."`). Zero console/page errors.

### 15. Milestone 4, phase 4: the Sovereign archetype's privacy ability — milestone 4 complete

**Files changed:** `src/stores/navigation.js`, `src/views/MapScreen.vue`

Fourth and final archetype ability — FIRE/PURGE/VANISH/SCUTTLE (Black Mage/Overseer/Outlaw/Captain), `abilityType: 'privacy'` from §12. Every class in every genre now has a working ability.

Unlike the other three, this one needed no network call — everything "your trail data" could mean is already sitting in the navigation store. **`goDark(durationMs = 6000)`** wipes `pois`, `destination`, `route`, `eta`, and `position` itself, stops the live geolocation watcher, and restarts it automatically after the duration. Setting `position` to `null` is what does the real work: it's not a cosmetic flag, it's the actual signal `MapScreen.vue` already needed a reason to handle — the player's own marker genuinely leaves the map for the blackout, which is about as literal a reading of "vanish"/"scuttle"/"non-negotiable" as this store can honestly produce without inventing telemetry there's no server behind.

**`src/views/MapScreen.vue`** needed three real fixes to make wiping actually visible, not just three new lines calling a new action:
- `syncPOIs()` was add-only; it now does a full reconciliation (removes markers whose id fell out of `navigation.pois`, not just adds new ones) — `revealPOIs()` never needed this since it only ever grows the array, but `goDark()` resetting it to `[]` does.
- The `destination` watcher only ever handled the truthy case; it now removes `destMarker` when `destination` goes `null`.
- The `position` watcher only ever handled the truthy case too; it now removes the user marker and resets the one-shot `hasCentered` flag when `position` goes `null`, so returning from a blackout gets a fresh `flyTo()` instead of silently reusing the old camera state.

**Verified with Playwright**: as Black Mage, set a destination (2 markers: user + destination), clicked FIRE — both markers gone immediately (0). Confirmed still gone 3.5s into the 6s blackout. At +7.5s (past the blackout), exactly 1 marker back — the user marker, with no destination marker (it was wiped, not just hidden). Screenshot confirms the map cleanly shows just the returned position with no leftover route/ETA. Zero console/page errors.

**Milestone 4 is now complete**: all sixteen classes across all four genres have a working, network-verified ability — reveal (§12), reroute (§13), share-eta (§14), privacy (§15) — built once each and landing for all four genres simultaneously every time, the same "zero genre-specific branching" property that's held since §4.

### 16. Profile store: growth, stat effects, and arrival detection

**Files created:** `src/stores/profile.js`, `Profile.md`
**Files changed:** `src/stores/navigation.js`, `src/views/MapScreen.vue`

First milestone-5-shaped work, opened by a product-direction conversation rather than continuing straight down the milestone-4 checklist: the app should be a real navigation tool first, with engagement mechanics that don't compete for a driver's attention, and both classes and the player's own profile should grow from real usage rather than staying static after Milestone 4 gave every class a one-shot ability. Full detail lives in `Profile.md`, kept separate from `Navigation.md` since this is a durable, cross-session concern (survives `player.reset()`/`navigation.reset()`) rather than live map or current-choice state — this entry covers what changed and why, not the resulting API surface.

**New store, not bolted onto an existing one:** `profile.js` persists under its own `crystalpath-profile` key, keyed by class id (verified unique across all sixteen classes already, so no genre-scoping needed). Tracks per-class `xp`/`tripsCompleted`/`distanceMeters`/`abilitiesUsed`/`poisDiscovered`, plus a `party` array (see below).

**Leveling** — five levels (capped to match the existing 1-5 stat-pip visual language), cumulative XP thresholds `[0, 100, 300, 600, 1000]`. XP comes from ability use (10 base), POI discovery (2 base each), and — the one genuinely new *navigation* feature in this pass — **trip completion** (25 base + 5/km).

**Stats now do something.** STR scales an ability's magnitude (reveal radius, privacy blackout duration) via `powerMultiplier()`; AGI scales cooldown reduction via `cooldownMultiplier()`, applied generically to all four archetypes since `AbilityButton.vue`'s cooldown was already a single prop; EXP scales XP gain itself, so the flavor stat's name and its mechanical effect are literally the same idea. All three read the class's *current* level, so leveling up mid-session changes ability behavior on the very next press — this needed no extra plumbing since Pinia's reactivity already propagates a nested-object mutation in `profile.classes` through to `MapScreen.vue`'s `computed(cooldownMs)`.

**Arrival detection, added to `navigation.js`:** nothing previously distinguished "still en route" from "actually there." Added `routeDistanceMeters` (OSRM's `distance` field, previously discarded) and a `watch([position, destination], ...)` — watching both, not just position, so setting a destination that's already close by counts as arrived immediately rather than waiting for a position update that may not come. 40m arrival radius. `tripJustCompleted` is a one-shot signal requiring an explicit `acknowledgeTripCompletion()`, not a self-clearing timer like `shareStatus` — the caller needs to read `distanceMeters` off it before it's gone.

**One real bug caught during verification:** the first pass had every `record*` function return XP based on the *base* table amount, but the XP toast is meant to show what was actually granted after the EXP-stat multiplier — a Fighter's first SCOUT (40 POIs found, a big haul) showed "+90 XP" in the toast while the store had actually added 104. Fixed by having `addXP()` return the real post-multiplier `xpGranted` and having every caller display that instead of recomputing its own estimate — exactly the kind of drift a player would notice immediately, caught here by comparing the toast text against a direct read of `localStorage.crystalpath-profile` in the same test run rather than trusting the UI alone.

**Verified with Playwright:** fresh profile, used SCOUT as Fighter (40 POIs found) — toast read "+104 XP — LEVEL UP!", matching a direct localStorage read exactly (0 → 104, level 1 → 2). Confirmed the now-shorter cooldown (level 2, agi 2 → ~3560ms) had already cleared at +3.9s, which a flat 4000ms base would not have. Set a destination essentially on top of the current position — arrival fired immediately (no need to wait for a position update), toast read "+29 XP" matching 104 → 133 exactly, `tripsCompleted` incremented, `distanceMeters` recorded via the haversine fallback (the OSRM request hadn't resolved yet when arrival — correctly — fired off the destination-set watch, not a subsequent position update). Zero console/page errors.

**Next up, in order:**
- A profile/character screen — level, lifetime stats, and the party roster are all tracked correctly but nothing in the UI shows them yet; the XP toast is the only visible sign of progress today.
- A "form your party" onboarding step (or in-game screen) that actually calls `addPartyMember()` — the data layer exists, nothing populates it yet. The Connector archetype's existing personalization prompts ("who travels with you most often?") are the natural lead-in copy for this.
- Wire the party roster into `shareETA()`'s messaging, and the personalization preferences already collected in onboarding (travel mode, avoidances, journey interests) into real OSRM query params and POI-category weighting in `revealPOIs()` — both currently collected and stored, neither currently read by anything.

### 17. POI icons and per-genre sprite variation

**Files created:** `src/data/poiIcons.js`, `src/data/spriteAlternates.js`, `src/views/SpritePlayground.vue`
**Files changed:** `src/views/MapScreen.vue`, `src/router/index.js`, `src/data/scifiClasses.js`, `src/data/westernClasses.js`, `src/data/pirateClasses.js`, `Genres.md`

Opened by wanting actual pixel-art options to react to rather than descriptions of them — built `/dev/sprites` (same "standalone dev route, bypasses the genre/class guard" pattern as `/dev/hud`) as a living design-review page, not a one-off mockup: it reads live off `GENRES`/class data for its "live now" sections, so it stays accurate as the underlying data changes rather than needing to be manually kept in sync.

**POI icons, in two passes.** v1 covered all nine categories (food/cafe/bar/shop/lodging/culture/nature/fuel/fallback) as 9x9 pixel grids; screenshotting and zooming in showed six read cleanly but shop (looked like a small appliance), lodging (looked like a gate), and fuel (looked like a domino) didn't. v2 redesigned those three — a price tag, a crescent moon, and a fuel droplet respectively, all converging on icons real map/dashboard apps already use for these categories rather than inventing new ones. `POI_ICONS` in `poiIcons.js` holds the adopted set plus a `iconForCategory()` lookup keyed off the same category string `revealPOIs()` already derives (amenity ?? shop ?? tourism); `ICON_CANDIDATES` keeps the rejected v1s and one more alternate each for the record.

**Wired into the live map, not just the review page:** `MapScreen.vue`'s `poiMarkerEl()` used to draw a generic rotated-diamond div for every POI regardless of category; it now draws the actual category icon on a small canvas (same draw-loop pattern as `PixelSprite.vue`), tinted to the active class's color. Verified with Playwright on the real `/western/map` after TRAILBLAZE: 40 rendered `.poi-marker-canvas` elements, screenshotted and zoomed into individual markers to confirm specific icons (a fork, a mug with foam and a handle, a cup with steam) render as designed rather than as blocky noise.

**Per-genre sprite variation — the reuse-by-recolor default is now just the default, not a rule.** Ten of sixteen classes' sprites are independent data already; nothing technically stopped a genre from diverging, it just hadn't happened yet. Designed two candidate alternate poses per archetype (eight sprites, `spriteAlternates.js`) as small, targeted mutations of the already-shipping base shape — changed rows only, same row-length pattern — specifically to keep the risk of a garbled render low compared to a from-scratch silhouette. Adopted ten of them, one genre at a time, each pick tied to that class's actual ability rather than picked arbitrarily: Star Voyager's Diplomat carries a raised antenna (literal UPLINK), Wild Frontier's Wagon Master holds a lantern (literal SIGNAL FIRE), High Seas' Quartermaster raises a flagpole (literal SIGNAL FLAG), Star Voyager's Overseer and High Seas' Captain both went faceless (an AI and a cold commander both fit "no visible eyes"), Wild Frontier's Outlaw got a peaked hood, Wild Frontier's Gunslinger a bandolier stripe, Wild Frontier's Outrider a mid-stride leg stagger, High Seas' Buccaneer a hood/hat-brim shadow. FF stays the unmodified reference for all four archetypes; Star Voyager's Pilot and High Seas' Corsair were left alone since their existing looks already fit. Full table and reasoning in `Genres.md`'s "Sprite reuse — and sprite variation" section.

**Verified with Playwright:** `/dev/sprites`'s "live now" rows render every genre's actual current sprite (pulled from `GENRES`, not a stale static copy) without errors; the real `/western` class-select screen shows all four Wild Frontier classes with their adopted features visible (the sash, the lantern nub, the peaked hood) at normal card size, not just in the zoomed-in review tool. Zero console/page errors across both.

### 18. Closing the loop: personalization actually changes routing and reveals

**Files changed:** `src/stores/navigation.js`, `src/views/MapScreen.vue`, `src/data/poiIcons.js`

Onboarding has been asking Thief-family classes routing questions (`travel_mode`/`priority`/`avoid`) and Fighter-family classes what places call to them since Milestone 2, and none of it had ever been read by anything. Before writing any code, checked what the public OSRM demo server could actually honor — directly against the live server, not assumed: every `exclude=` value it's asked for (`motorway`, `ferry`, `toll`) comes back `"Exclude flag combination is not supported."` outright, and its `/route/v1/walking/...` and `/route/v1/cycling/...` URLs silently return byte-identical results to `/driving/`, meaning the demo server has no other profile compiled and isn't erroring, just quietly ignoring the request. Wiring either of those as designed would have been theater at best (`travel_mode`) and a hard failure at worst (`avoid`, since sending `exclude=` at all kills the whole request on this server).

**So the personalization got wired into client-side route *selection* instead of server-side route *computation*.** `fetchRoute()`/`attemptReroute()` now request `alternatives=true&steps=true`; a new `analyzeRoute()`/`pickRoute()` pair (in `navigation.js`, no new file — this is squarely route-selection logic) walks each candidate's steps to count real turns (maneuver types beyond depart/arrive/continue) and flag likely highway (`ref`/`name` matching `I 676`/`US 30`-style patterns — confirmed OSRM uses a space, not a hyphen, against live data) or ferry (`name` containing "ferry", with a carve-out for street names like "Grays Ferry Avenue" that merely contain the word — also a real false positive caught during verification, not theoretical) steps, then filters by `avoid` and sorts by `priority`. `tolls` has nothing left to detect from in this dataset and is documented as a no-op preference, not silently pretended to work.

**Fighter's open-ended "what places call to you?" answer got a real effect too, on the Overpass side this time**: `revealPOIs()` now takes an `interestText` parameter, matches it against a small nature/history keyword table, and appends `leisure=park`/`natural=*`/`historic=*` node filters to the query when it matches — verified by capturing the actual outgoing Overpass request body, not just trusting the code path. `poiIcons.js`'s category map grew `monument`/`castle`/`ruins`/`peak`/`wood`/`water`/etc. so these newly-possible results get a `culture`/`nature` icon instead of falling through to the generic star.

**Verified in two ways**, since live OSRM alternatives turned out to be non-deterministic enough (small variations run-to-run, occasionally only one alternative instead of two) that map-click-based end-to-end testing alone wasn't fully conclusive: (1) a live Playwright run confirmed the default ("fastest") priority correctly selects the lower-*duration* route over a lower-*distance* alternative OSRM also offered; (2) a deterministic offline replay of `pickRoute()`/`analyzeRoute()` against a saved real OSRM response (two routes, one with two highway-classified steps and 9 turns, one with zero highway steps and 6 turns) confirmed `'fastest'` picks the lower-duration route, `'shortest'` picks the different, lower-distance one, and `'fewest_turns'` correctly ranks the 6-turn route first — proving the selection logic itself, independent of live-server variability. Separately, capturing the real Overpass request body confirmed a Fighter whose `destinations` answer mentioned "hidden trails, mountain peaks, and forgotten ancient ruins" actually sent the extra `leisure`/`natural`/`historic` clauses. Zero console/page errors throughout.

### 19. The character/profile screen

**Files created:** `src/views/ProfileScreen.vue`
**Files changed:** `src/router/index.js`, `src/data/genres.js`, `src/views/MapScreen.vue`

Milestone 5's second piece: everything §16 built (level, lifetime stats, the party roster) was tracked correctly and shown nowhere except a two-second XP toast. `/:genreId/profile` gives it a home, reached from a new "PROFILE ▶" button on the map (opposite "← START OVER") and left the same way, back to the map — a real navigation, not an overlay, on purpose: this is a screen you go look at, consistent with the driver-attention principle from the product-direction conversation that opened milestone 5, not something that appears on top of the map mid-trip.

Reuses rather than invents: the sprite/stat-pip rendering follows the exact same convention `HudOverlay.vue`/`ClassCard.vue` already established (a `LEVEL` row is just a fourth five-box pip row alongside `STR`/`EXP`/`AGI`, not a new visual language), and the screen itself follows `ClassSelectScreen.vue`'s structural pattern (`StarField`, corner decorations, a ghost-button back-link, the `CRYSTAL PATH` + `PixelDivider` header).

**New capability, not just display:** a `findClassById(classId)` helper in `genres.js` searches every genre's roster for a class id, powering an "other paths walked" section that shows level on any other class the player has progress with — leaning on the same "class ids are unique across every genre" property `profile.js` already assumed for storage, now made useful for cross-genre display too. The party roster section is genuinely functional here (an inline add-form, a remove button per member), even though nothing in onboarding introduces the idea yet — that's still open, tracked in `Profile.md`'s known gaps.

**Verified with Playwright:** as a Fighter with real prior progress (104 XP from an earlier SCOUT sweep — 40 POIs), the screen correctly showed "LEVEL 2," "104 / 300 XP to level 3," and all four stat tiles matching a direct `localStorage.crystalpath-profile` read exactly. Added a party member ("Sarah," note "climbing partner") — persisted correctly with a generated id; removed it — correctly cleared. Navigated back to the map successfully. Zero console/page errors.

**Next up:** an onboarding step (or first-visit prompt) that actually introduces the party roster — the Connector archetype's existing "who travels with you most often?" question is the natural lead-in — and wiring that roster into `shareETA()`'s message so sharing feels like it's addressed to someone specific.

### 20. Party onboarding, for real this time

**Files created:** `src/components/PartyStep.vue`
**Files changed:** `src/data/classes.js`, `src/data/scifiClasses.js`, `src/data/westernClasses.js`, `src/data/pirateClasses.js`, `src/views/OnboardingScreen.vue`, `src/stores/navigation.js`, `src/views/MapScreen.vue`

§19's "next up" closed out in the same pass it was written: an actual onboarding step that introduces the party roster, and `shareETA()` reading it.

**`'party'` is now in every one of the sixteen classes' `onboardingSteps`** — after `ability` (and after `personalize` for the four FF classes that have one), before `location`. Each class got its own `partyPrompt` line, written in the same per-archetype voice already established by `intro`/`locationPrompt`: bold for Adventurer ("Every legend needs witnesses, warrior. Who's coming with you?"), terse for Speedrunner ("Crew's crew. Who's in?"), warm for Connector ("Tell me who walks beside you. I will watch for them too."), and deliberately reluctant-but-still-optional for Sovereign ("Name whoever may know your position. Choose carefully, or choose no one.") — a privacy-obsessed class getting genuinely enthusiastic about a party roster would have rung false. Sixteen new one-liners, one per class, matching sixteen already-established voices.

**`PartyStep.vue`** is a new, fifth shared onboarding component (alongside `WelcomeStep`/`PersonalizeStep`/`AbilityRevealStep`/`LocationPermissionStep`/`DoneStep`): a `DialogBox` typewriter for the prompt, an inline roster (add/remove, calling `profile.js`'s existing `addPartyMember`/`removePartyMember` directly), and a `Continue` that only waits on the typewriter finishing, not on anyone actually being added — adding a party member was never meant to be mandatory.

**`shareETA(party = [])`** now takes the roster as a parameter (same "caller passes cross-store data in" convention as `prefs`/`interestText` elsewhere in `navigation.js`) and addresses the message to the first member by name when there's anyone in it (`"Sarah — I'm on my way — ETA 12 min."`), falling back to the previous generic text with an empty roster. `MapScreen.vue` passes `profile.party` through on every Connector-archetype ability trigger.

**Verified with Playwright, twice** — once for a Final Fantasy class (White Mage, which also has a `personalize` step, to confirm step ordering doesn't collide) and once for a Star Voyager class (Diplomat, which doesn't) to confirm the wiring holds across genres, not just the one it was built against: in both runs, added "Sarah" during the party step, confirmed she persisted to `localStorage.crystalpath-profile`'s `party` array with a generated id, continued through the rest of onboarding to the map, triggered the Connector ability, and confirmed the actual clipboard contents read `"Sarah — I'm on my way. https://www.google.com/maps/search/...`" — the real, personalized message, not a generic one. Zero console/page errors in either run.

**Milestone 5 (growth, personalization, and the party roster — none of it named as a numbered milestone up front, all of it opened by one product-direction conversation) now covers**: real per-class leveling with stat effects (§16), a screen to see it on (§19), personalization that changes actual routing and reveals (§18), and a party roster that's both manageable (§19) and introduced during onboarding with a real effect on sharing (§20). Open threads: no genre beyond FF has `personalize` content yet: only the party step exists everywhere else. `shareETA()` still only addresses one person even with a larger roster. Neither blocks anything — both are natural continuations whenever picked back up.

### 21. Production hardening

**Files created:** `.env.example`, `PRODUCTION.md`
**Files changed:** `src/stores/navigation.js`, `src/views/MapScreen.vue`, `src/vite-env.d.ts`

Milestone 4/5 built real features against real backends; this pass closes the gaps that separate "works when driven correctly in testing" from "won't quietly break under real, imperfect usage" — the destination-before-position race, `navigation.destination` not surviving a refresh, `fetchRoute()` having zero error handling, and geolocation errors failing completely silently. All four were already named in `Navigation.md`'s own known-gaps section from earlier passes, not newly discovered here.

**Destination persistence + the race, fixed together, since they're the same root cause.** `destination` is now restored from `localStorage` (`crystalpath-destination`) synchronously at store setup, and a single `watch(destination, ...)` keeps that key in sync on every change (set, arrival, `goDark()`, `reset()`) — one watcher instead of teaching every call site to remember to persist/clear it. That restoration is exactly what surfaces the race: a destination can now be present before any position fix exists at store-init time (previously only possible via a fast map click, now also the common "reload with a route already going" case). `setDestination()` already only fetches a route when a position is already known; nothing previously re-triggered that fetch once a position arrived late. Fixed in `MapScreen.vue`'s existing position watcher — it now checks `destination && !hasRoute && !fetchingRoute` on every position update and calls `fetchRoute()` itself, catching up on exactly the fetch `setDestination()` couldn't make earlier.

**`fetchRoute()` hardened**, not rewritten: still the same OSRM call and `pickRoute()` selection, now wrapped in try/catch, throwing on a non-OK response or an empty `routes` array instead of silently proceeding with `undefined`. One retry after a 1.5s delay (the public demo server's failures are mostly transient — rate limiting, a slow timeout — so one retry clears most of them without looping against a real outage), then a `routeError` toast on a second failure. A new `fetchingRoute` guard (same pattern as `revealing`/`rerouting`) stops the position-watcher's catch-up fetch from racing a destination-tap's own fetch.

**Geolocation errors stopped failing silently.** `startWatching()`'s error callback was previously `() => {}` — a denied or unavailable permission just meant the map never got a position, with nothing on screen explaining why. Now routed through the same `routeError` toast channel, with permission-aware copy (`PERMISSION_DENIED` gets its own message).

**Backend URLs became env-configurable**, closing out the last "public demo server" loose end without changing any behavior in dev: `OSRM_BASE`/`OVERPASS_BASE` now read `VITE_OSRM_BASE`/`VITE_OVERPASS_BASE`, falling back to the existing public demo servers when unset. `.env.example` documents both (copy to `.env.local`, already covered by the repo's `*.local` `.gitignore` pattern); `vite-env.d.ts` types them so `import.meta.env.VITE_OSRM_BASE` isn't a silent `any`.

**`PRODUCTION.md`** consolidates what's still release-blocking (self-hosting OSRM/Overpass, CARTO's free-tile limits, Tauri's CSP being `null`, Android re-verification of everything built since the crash fix) versus what's a reasonable v1 limitation (the `tolls` no-op, unvalidated XP constants, the unverified `navigator.share()` path) — one place to check before shipping instead of re-deriving it from `Navigation.md`/`Profile.md`'s scattered gap sections. The CSP specifically was deliberately left `null` rather than guessed at — writing one blind, without a native Tauri window available this session to confirm it doesn't break tile/worker/fetch loading, risked trading a real hardening gap for a real breakage.

**Verified with Playwright against the real dev server and live OSRM backend** (no mocking, matching this session's pattern throughout): (1) pre-set `crystalpath-destination` in `localStorage`, reloaded — confirmed an OSRM request fired once a position fix arrived, with no error toast; (2) clicked a destination, confirmed it persisted to `localStorage`, reloaded, confirmed the same value survived; (3) intercepted and aborted every OSRM request, clicked a destination, confirmed exactly two attempts (initial + one retry) and a `routeError` toast reading "Could not calculate a route. Tap the map to try again." appeared. Zero console/page errors across all three.

### 22. Android re-verification

**Files changed:** none — this was a verification pass, not a code change.

Direction E, finally executed: everything built since the Android crash fix (all of Milestone 4, all of Milestone 5, and the production-hardening pass) had only ever been exercised via desktop Playwright. This walks the real build on a real Android emulator (Pixel 5, API 35) to confirm none of it silently regressed or behaved differently on-device.

**Environment recovery came first, and is worth recording since it'll recur.** The emulator had a stale phantom `emulator-5562 offline` entry (same recurring `adb` quirk from the original crash-debugging session — fixed the same way, restarting the adb server and always targeting `-s emulator-5554` explicitly). More significantly, `npm run tauri android dev` hung indefinitely on "Blocking waiting for file lock on Android" — traced to a **two-day-old orphaned `tauri android dev` process tree** (`npm`/`tauri.js`/`vite` from a previous session) still holding whatever lock the CLI uses for a live dev session; killing that stale process tree (found via `Get-CimInstance Win32_Process` filtering on command line, since PIDs alone didn't distinguish it from anything else) let a fresh invocation proceed immediately. Separately, **`npm run tauri android build` (a one-shot release/debug build, tried as a possible faster alternative) failed outright**: the bundle identifier `com.natrix.ff_navigation` contains an underscore, which newer `@tauri-apps/cli` validation rejects for `build` (though not, apparently, for `dev` — that gap between the two commands wasn't investigated further, and this session left the identifier untouched rather than regenerating `gen/android` and having to manually redo the manifest-permissions fix in the fresh output — see `PRODUCTION.md`'s note if this is picked up later).

**The core result: no crash, anywhere, including at the exact point that used to crash.** Walked a full Fighter run — genre/class select, personalize (real typed text), ability reveal, party step (added "Sarah," confirmed she persisted), and then the location-permission step, the literal step whose missing manifest permissions caused the original uncaught `IllegalStateException` (see `Issues.md`). Confirmed via `logcat` that tapping "ENABLE LOCATION" now correctly launches `GrantPermissionsActivity` (the real system dialog) instead of crashing, screenshotted the actual native Android permission prompt appearing, granted it, and confirmed `getCurrentPosition()` resolved a real fix from the emulator's location provider.

**Everything downstream also checked out against real services, not mocks:** the map rendered real CARTO tiles and real Philadelphia street data (needed real time to load over the network, same as it would on a real connection — not an error, just not instant); a stray tap that landed on the map instead of a button became an accidental bonus test of real OSRM routing on-device (route line, real ETA); SCOUT correctly queried the real Overpass API and rendered ~15 correctly-iconified POI markers in the class color; the profile screen showed LEVEL 2, 104/300 XP, 40 POIs discovered, and the "Sarah" roster entry — all exactly matching what the equivalent desktop Playwright run had already established, confirming Milestone 5's growth/party systems behave identically on-device.

**One genuine new finding, not a regression:** `.start-over` and `.profile-link` (both `top: 1rem`) were unreliable to trigger via `adb shell input tap`/`input touchscreen tap` at their own measured bounding box — repeatedly, at multiple coordinates spanning the button's full height. Debugged via **Chrome DevTools Protocol** (forwarded the WebView's own devtools socket — `webview_devtools_remote_<pid>`, found via `/proc/net/unix` — over `adb forward`, then spoke raw CDP `Runtime.evaluate` over the websocket by hand once Playwright's `connectOverCDP` turned out not to support Android WebView's limited CDP surface): `document.elementFromPoint()` confirmed nothing was covering the button, and a direct `element.click()` navigated correctly every time. So the DOM, the handler, and the router all work — something about adb's synthetic touch injection specifically in the screen's top ~130px isn't reliably reaching the app, and whether that's an artifact of this testing setup or a real concern for an actual finger on actual glass is genuinely unresolved. Logged in `PRODUCTION.md` as a manual-check item rather than guessed at either way.

### 23. Direction F, phase 1: saved destinations

**Files changed:** `src/stores/profile.js`, `src/components/HudOverlay.vue`, `src/views/ProfileScreen.vue`

First piece of Direction F (deepening real navigation capability — saved destinations, turn-by-turn, multi-stop routes, in that order; see `PLANNING.md` §7 for turn-by-turn's own proposed spec). Opened by a question about how to add more profile fields generally, which this pass answers by example: `profile.js`'s data was already an unlabeled mix of **character** data (`classes`, scoped to whichever class is active) and **user** data (`party`, true regardless of class/genre) — saved destinations is user data too, so it's the second field in that bucket, and the store's comments now name the split explicitly (`profile.js`'s own header comments, and `Profile.md`'s "Data shape" section) so the next new field has an obvious home instead of needing to be re-derived from first principles.

**`profile.js`** gained `savedDestinations: [{ id, label, lat, lng }]` plus `addSavedDestination`/`removeSavedDestination`/`renameSavedDestination`/`findSavedDestinationNear` (a small-tolerance coordinate match, not exact float equality, since a saved lat/lng and a live one from a fresh map tap are never bit-identical). No reverse geocoding — same "don't fake support without a real backend for it" stance as `navigation.js`'s `tolls` preference — so a save defaults to the label `"Saved Destination"` and gets renamed later, not guessed at.

**Saving and loading are deliberately two different screens.** `HudOverlay.vue` gained a small ☆/★ toggle next to the ETA readout, shown only once `navigation.destination` exists — an icon-only glanceable state, not a labeled button, and no toast on top of it (the fill state *is* the confirmation). Loading one back is a real navigation to `ProfileScreen.vue`'s new "SAVED PLACES" section (add/rename/remove/`GO`), the same "browsing a list is a look-at-it action, not a map overlay" reasoning every other post-Milestone-5 screen in this app already follows.

**Verified with Playwright against the real dev server**: set a destination via a map click, confirmed the star appeared hollow then filled on click with the correct entry persisted to `localStorage`; navigated to the profile screen and confirmed the entry rendered with the right coordinates; renamed it to "Home" and confirmed the persisted label updated; clicked `GO` and confirmed it navigated back to the map with that exact destination set (and the star immediately showing filled, since it's now recognized as the same saved place); removed it and confirmed the list emptied back to the "nothing saved yet" hint. Zero console/page errors.

### 24. Direction F, phase 2: turn-by-turn

**Files created:** `src/data/maneuverIcons.js`
**Files changed:** `src/stores/navigation.js`, `src/components/HudOverlay.vue`, `src/views/SpritePlayground.vue`

Second piece of Direction F, following the spec already sketched out in §7 below: OSRM's `steps=true` data — already being fetched for `analyzeRoute()`'s scoring and discarded right after — gets retained and surfaced as a real next-maneuver readout, closing the biggest named gap between "renders a route" and "is a real navigation tool."

**`navigation.js`** gained `steps`/`currentStepIndex` (internal) and one new public getter, `currentManeuver` (`{ iconKey, instruction, distanceMeters, isArrival } | null`). Advancing which step is "current" is threshold-based — a `watch([position, steps], ...)` advances the index once live position closes to within 30m of the maneuver it's counting down to — deliberately not full map-matching (projecting position onto the route's own polyline), which would be more accurate but a meaningfully bigger algorithm than this pass needs; same "disclosed heuristic instead of an unavailable bigger system" tradeoff `pickRoute()`'s highway/ferry regexes already made. `describeManeuver()` builds instruction text from `maneuver.type`/`modifier`/`name` by hand, since OSRM's API returns those fields but not a pre-built English sentence (that needs a language plugin the public demo doesn't run). Both `fetchRoute()` and `attemptReroute()` repopulate `steps` on a successful fetch; a mid-trip reroute restarts turn-by-turn from step 0 rather than trying to carry progress forward into the new route's own indices — simpler and safer than guessing, and the watcher catches back up within one position update.

**`maneuverIcons.js`** — 7 pixel icons (left/right/straight/uturn/roundabout/merge/arrive), same character-per-pixel format as `poiIcons.js`/every class sprite. `right` is mirrored from `left` programmatically (`row.split('').reverse().join('')`) rather than hand-drawn twice, guaranteeing they're actually symmetric instead of two icons that were *meant* to match. A first pass, explicitly not a finished design review (same v1→maybe-v2 path `poiIcons.js` itself took) — added to `/dev/sprites`' "live now" sections at both HUD size (4px) and enlarged, for exactly that future review.

**Rendered inside `HudOverlay.vue`, not a new component.** `.hud-overlay` (previously a single flex row centering `.hud-panel`) became a column flex so a `.tbt-strip` could stack above the panel using the same self-positioned fixed container, instead of a second independently-positioned element needing a guessed pixel offset to clear a panel of variable height. The icon reuses `PixelSprite.vue` directly (this is Vue-owned DOM, not a MapLibre marker, so there's no need for a third duplicate canvas-draw loop the way the map's own POI/destination markers need one). One real UI bug caught during verification: the instruction text's first pass used a single-line `text-overflow: ellipsis`, which truncated exactly the part that matters — "Turn right onto Ra…" cut off the street name itself. Fixed with `-webkit-line-clamp: 2` so it wraps instead of truncating the one piece of information a driver actually needs.

**Verified with Playwright against the real dev server and live OSRM backend**: clicked a destination that produced a real 7-step route (confirmed by capturing the actual OSRM response), confirmed the strip showed "Turn right onto Ranstead Street — in 110 m" (step 1's real data, correctly skipping past the unactionable "depart" step); moved the mocked position to step 1's own maneuver coordinates and confirmed the instruction advanced to step 2's ("Turn right onto South 16th Street") — the real threshold-advance logic working against a real fetched route, not a synthetic one. Zero console/page errors.

### 25. Milestone 6, phase 1: navigation screen visual iteration

**Files created:** `src/components/Toast.vue`
**Files changed:** `src/stores/navigation.js`, `src/views/MapScreen.vue`, `src/components/HudOverlay.vue`, `src/components/AbilityButton.vue`

Six of §6's eight implementation steps, picked for being genuinely mechanical (fix a real duplication, give a marker a real distinct shape) rather than open-ended exploration — the two skipped (a dedicated `/dev/map` comparison tool, the route line's directional treatment) didn't need deciding-by-comparison the way the sprite/icon work earlier did, so building a tool to decide would have been overhead without a real decision behind it. Named "phase 1" rather than "done," matching how Direction F got split — the two skipped items are still open, not abandoned.

**Toast consolidation** (`Toast.vue`, new) — replaces three near-identical bespoke `<Transition>` blocks (share/route-error/XP) with one reusable component, rendered twice: a status lane (`routeError` takes priority over `shareStatus`, preserving the priority they already had) and a growth lane for XP, kept at a separate offset on purpose — using the Connector archetype's ability without the Web Share API available grants XP *and* sets `shareStatus` in the same action, a real simultaneous case, not a hypothetical one, so collapsing to a single slot would have actually lost information rather than just tidying duplication.

**Destination marker** — `destMarkerEl()` now draws the "arrive" maneuver icon from `maneuverIcons.js` (Direction F's own turn-by-turn glyph, reused rather than a fourth new asset) onto a canvas, the same technique `poiMarkerEl()` already uses for POI icons. Replaces the old plain-square-recolored-gold marker, which was only distinguishable from the user's own marker by color.

**User marker heading** — `navigation.js` gained a `heading` ref, captured from `coords.heading` in the existing `watchPosition` callback (`null` whenever the device hasn't reported one, which is the common case at rest, not an error). `MapScreen.vue`'s `markerEl()` became a two-element wrapper (outer/inner) so a rotation transform on the inner element doesn't fight MapLibre's own positioning `translate()` on the outer one — the same conflict already noted for POI markers' rotation back in §12. `.crystal-marker` itself changed from a plain square to a CSS `clip-path` arrow, since a rotated square doesn't actually look like it's pointing anywhere.

**`AbilityButton.vue`** gained a numeric cooldown countdown (`remainingSeconds`, derived from the existing `cooldownPct`) alongside the veil — a color sweep alone doesn't communicate "how much longer," which matters more as AGI/level scale a cooldown down to where the veil's rate of change gets harder to judge.

**Verified with Playwright at three viewport sizes** (390×844 phone portrait, 844×390 landscape, 768×1024 tablet) plus the existing desktop-sized checks — the milestone's own verification plan called for real phone-sized screenshots, not just desktop ones, specifically because a screen meant to be glanced at while driving needs judging at the size it's actually used at. **That check paid off immediately**: the route-error toast's original `white-space: nowrap` had no width limit, and at 390px wide the real error message ran clean off both edges of the screen — invisible at every desktop width this session had tested at until now. Fixed with a `max-width`/wrap instead of a fixed nowrap line. Also verified: old toast classes fully gone from the DOM; an XP toast and, separately, a forced route error each render with the correct tone; the ability button's countdown shows a real decrementing number; the destination marker renders as the flag glyph; and — via a page-init script patching `navigator.geolocation.watchPosition` to report a synthetic heading (Playwright's own geolocation mock has no heading field at all) — the user marker's computed CSS transform showed the exact rotation matrix for a 45° heading. Zero unexpected console/page errors (the only two logged were the deliberately-aborted OSRM requests from the error-toast test itself).

### 26. Milestone 6, phase 2: the map design-review tool, and the route-line treatment it decided

**Files created:** `src/views/MapPlayground.vue`
**Files changed:** `src/views/MapScreen.vue`, `src/router/index.js`

Closes out §6's two remaining steps, picked back up together since the second only made sense once the first existed: a route-line directional treatment is exactly the kind of decision that benefits from comparing real rendered options side by side, the same reasoning that justified `/dev/hud` and `/dev/sprites` for their own decisions, so the tool got built this time instead of skipped again.

**`/dev/map` (`MapPlayground.vue`)** — a real MapLibre map fetching a real route from the same public OSRM demo server the app itself uses (a fixed Center City Philadelphia origin/destination), with controls to switch between three candidate route-line treatments, fire the existing reroute-pulse animation for a side-by-side comparison, drag a heading slider against a duplicated user-marker element, and fire sample toasts over the map. Switching treatments rebuilds the source/layer from scratch (`line-gradient` needs `lineMetrics: true` set at source-creation time, and doesn't reliably toggle via `setPaintProperty` alone) — a cost that only matters for a comparison tool flipping between options repeatedly, not for the real map setting its paint once.

**The decision**, made by actually looking at three screenshots against the same real fetched route rather than by description: a flat single-color baseline (no directional cue at all), a static `line-gradient` fading from muted-near-origin to full-class-color-at-destination, and the same gradient plus a width taper (thin at the origin, thick at the destination). The plain gradient won — the width-taper variant tested "more noticeable" as predicted in §6's own spec, but that noticeability came at a real cost: the origin end got thin enough to be hard to see, which is a legibility regression, not just a stylistic tradeoff, for no benefit over the gradient alone (the color fade already conveys direction by itself). Applied to the real `MapScreen.vue`: the route source gained `lineMetrics: true`, and the flat `line-color` paint property became a `line-gradient` expression over `['line-progress']`. `pulseRoute()` (the Speedrunner archetype's reroute flash) needed no changes — it only ever touched `line-width`, which stays independent of the gradient.

**Verified with Playwright**: `/dev/map` renders a real fetched route with zero console errors across all three treatments, the pulse animation fires visibly distinct from the static gradient, the heading slider rotates the demo marker, and sample toasts render correctly layered over the map. Then, separately, confirmed the real `/ff/map` screen renders the exact same gradient effect end-to-end against a real destination tap — muted near the player, vivid at the destination — with zero console errors.

### 27. Direction F, phase 3: multi-stop routes — Direction F complete

**Files changed:** `src/stores/navigation.js`, `src/views/MapScreen.vue`, `src/views/ProfileScreen.vue`, `Navigation.md`, `Profile.md`

Closes out Direction F (saved destinations §23, turn-by-turn §24, this). The real work here turned out smaller than expected, because OSRM already does the hard part: `/route/v1/driving/{p1};{p2};{p3};...` is a normal documented request, the response comes back with one `legs[]` entry per hop, and `analyzeRoute()`/`flattenSteps()` were already written to walk `route.legs` generically — confirmed live before writing any new code (a real 3-coordinate request against the public demo server came back with `legs.length === 2`, exactly as expected), rather than assumed. Turn-by-turn in particular needed **zero changes**: `currentStepIndex`'s threshold-based advance never knew or cared about leg boundaries to begin with, so a multi-leg route's steps just flatten into the same array a single-leg one always did.

**`destination` stays the single final stop** — a new `waypoints` array (`[{ id, lat, lng }, ...]`, persisted the same way `destination` is) holds intermediate stops, purely additive rather than turning `destination` itself into an array and rippling that change through every place that already assumes exactly one (the destination marker, the saved-destination star, arrival XP). `addWaypoint()`/`removeWaypoint()` both re-fetch immediately; `setDestination()` clears `waypoints` (a fresh destination starts a fresh trip).

**One small, deliberate compromise to the "stores don't reach into each other" rule**: the two internally-triggered refetches (reaching a waypoint, adding/removing one) need *some* `prefs` to hand `pickRoute()`, but this store still doesn't import `player.js`. `fetchRoute()`/`attemptReroute()` now record whatever `prefs` they were last called with into a closure variable (`lastPrefs`, not a ref, nothing external reads it) — every caller-initiated fetch still gets its `prefs` passed in explicitly exactly as before; this only covers the store's own follow-up fetches, which have no caller to ask.

**Reaching an intermediate stop isn't finishing the trip.** A second watcher, structurally identical to the existing final-arrival one but checking `waypoints[0]` instead of `destination`, silently drops a reached waypoint and re-fetches toward whatever's left — no XP, no `tripJustCompleted`, the same "no popup, just keep going" spirit as the Speedrunner archetype's reroute.

**Two ways to add a stop, both shipped**: `MapScreen.vue` gained a "+ ADD STOP" toggle (arms the next map click to add a waypoint instead of replacing the destination) plus a removable numbered-chip list and matching numbered map markers (`syncWaypoints()`, the same full reconciliation pattern `syncPOIs()` already uses); `ProfileScreen.vue`'s saved places gained a "+ STOP" action alongside the existing "GO," shown only once a trip is active, so a saved place can extend the current trip instead of only replacing it.

**Verified against real OSRM data end to end, not mocked at any step**: set a destination (confirmed a 2-coordinate request), armed and added a stop (request became 3 coordinates; a numbered marker, a chip, and a still-working turn-by-turn instruction all appeared across the now-2-leg route), reloaded and confirmed the waypoint restored from `localStorage`, removed it via its chip (request back to 2 coordinates), added a second stop and moved simulated position onto its *exact* real coordinates (captured from the live OSRM response) — it was silently dropped and the route recalculated toward the final destination, which remained set rather than completing the trip — and confirmed setting a brand-new destination correctly cleared a pending waypoint. Separately verified `ProfileScreen.vue`'s "+ STOP" action adds a real waypoint marker end to end. Zero console/page errors across every check.

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

---

## 6. Navigation screen visual iteration

**Implemented — see §25 (phase 1: toasts, markers, ability countdown, viewport verification) and §26 (phase 2: the `/dev/map` design-review tool and the route-line gradient it led to).** Left as-written below as the spec that was actually built against, not edited after the fact to match the implementation exactly.

A dedicated design pass on `MapScreen.vue`/`HudOverlay.vue`'s look and feel, distinct from everything built so far there — Milestone 3-5 made the map/HUD functionally correct and verified via Playwright, but nothing has had the kind of iterative visual-review treatment `poiIcons.js` and the alternate sprites got via `/dev/sprites` (§17). This is that treatment, applied to the screen the player spends the most time looking at.

**Scope constraint, stated up front because it's easy to drift past:** this is a presentation pass, not an interaction-model redesign. The driver-attention principle established in the product-direction conversation that opened Milestone 5 — toasts, never modals; a navigation, not an overlay, for anything requiring more than a glance — applies here as a hard constraint, not a preference. Anything proposed below that would add required reading time or new motion competing for attention should be cut, not softened.

### Why now

Milestone 4 (all four abilities) and the production-hardening pass are both done — the map/HUD's *behavior* is stable. This is the natural point to step back and refine presentation before Milestone 7 (turn-by-turn, below) adds a new element that has to visually coexist with everything already on screen.

### Implementation steps

- [ ] Build a design-review tool for the map/HUD together (same precedent as `/dev/hud`'s sliders and `/dev/sprites`' comparison rows) — a way to compare route-line/marker/toast treatments side by side before committing, rather than judging changes one Playwright screenshot at a time.
- [ ] **Route line treatment.** Currently a flat `line-width: 4` in the class color. Consider a directional cue (a subtle gradient or leading pulse showing which end is "ahead") distinct from the existing reroute flash (`pulseRoute()`), which needs to stay visually distinguishable from whatever this becomes.
- [ ] **User marker.** Currently a static tinted square (`.crystal-marker`). Once device heading is available, consider a directional indicator (small arrow/cone) rather than a shape that looks identical whether stationary or moving at speed.
- [ ] **Destination marker.** Currently the same square shape as the user marker, only recolored gold — the two are only distinguishable by color, which fails for color-blind users and is a bad glance-test generally. Wants a genuinely distinct silhouette (pin/flag/pixel glyph).
- [ ] **POI marker legibility at real size.** `poiIcons.js`'s icons were verified via zoomed screenshots (§17) — confirm they still read correctly at actual in-app render size on a phone-sized viewport, not just under zoom.
- [ ] **Toast stack consolidation.** `.share-toast`, `.route-error-toast`, and `.xp-toast` are three independently-positioned, near-identical `<Transition>` blocks in `MapScreen.vue`, manually offset (`top: 1rem` vs `top: 3.4rem`) to avoid colliding. Three of these is the point where a single managed toast-queue component (one `<Transition-group>`, a small queue of `{ text, tone }` entries) stops being premature and starts being warranted — particularly since Milestone 7 below may want to reuse the same queue rather than becoming a fourth bespoke toast.
- [ ] **`HudOverlay` at real phone viewports.** Verified so far only at desktop Playwright viewport sizes. Check common phone aspect ratios (tall/narrow portrait, a landscape sanity check) for crowding/wrapping, and safe-area padding (notches, gesture bars) on a real device — ties into Milestone 7 (§7 below) and Direction E (Android re-verification).
- [ ] **`AbilityButton`'s cooldown readout.** The veil (a solid color sweep) communicates "still cooling down" but not "how much longer" — consider adding a numeric countdown for classes/levels with longer cooldowns, where a bare color sweep is hard to judge at a glance.
- [ ] Once decisions are made, update `main.css`'s `--hud-*` token defaults and `Navigation.md`'s "Tuning the HUD's look" section to match.

### Verification plan

Playwright screenshots at 2+ phone-sized viewports (a tall handheld portrait plus a landscape sanity check) in addition to the desktop-sized checks used so far, plus a real Android on-device pass — a screen meant to be glanced at while driving needs judging on real glass, not a description of one.

---

## 7. Turn-by-turn screen

**Implemented — see §24.** The design questions below were answered as: a persistent HUD strip (not a separate screen state), minimal detail (next maneuver + distance only, no look-ahead list), and no audio this pass. Left as-written below as the spec that was actually built against, not edited after the fact to match the implementation exactly.

The clearest gap between "renders a route" and "is a real navigation tool": nothing today tells the player what to actually do next, only that a route and an ETA exist. OSRM's response already includes full per-step maneuver data (`steps[].maneuver.type`/`modifier`, `.distance`, `.name`) — `analyzeRoute()` (`navigation.js`, §18) already reads it for route scoring — but none of it is surfaced to the player once a route is picked. This closes that gap.

### Design questions to settle before building

Worth deciding deliberately rather than guessing, possibly via a short back-and-forth when this milestone starts:

- **Persistent strip vs. a distinct "in maneuver" screen state?** A HUD strip that's always present once `hasRoute` is true keeps with the existing "one screen, layered overlays" pattern; a separate state risks feeling like a mode switch. Leans toward the former given everything else on this screen is additive, not modal.
- **How much detail is safe to show at once?** Just the next maneuver + a distance countdown ("in 200m, turn left onto Market St"), or a short look-ahead list of the next 2-3 turns? More detail is more useful stopped at a light, more distracting doing 50 down a highway — the driver-attention principle argues for defaulting minimal (next maneuver only) and treating anything more as an opt-in, not a default.
- **Room to reserve for audio/voice cues later?** Out of scope to build this pass, but worth deciding whether the layout should reserve space for a mute/audio toggle now rather than retrofitting one later.

### Implementation steps

- [ ] Extend `navigation.js`'s route state to retain per-step maneuver data (currently discarded by `fetchRoute()`/`attemptReroute()` right after `analyzeRoute()` reads it for scoring) — a `steps` ref shaped off OSRM's own `legs[].steps[]`, kept alongside `route`/`eta`.
- [ ] A `currentManeuver` getter/computed: the step whose end point is the nearest one still ahead of live `position`, recalculated on every position update — this is the actual "in 200m" countdown logic, and needs to reset correctly whenever `attemptReroute()` swaps to a different route (a stale instruction for a route no longer being followed is worse than no instruction).
- [ ] A small pixel-art maneuver icon set (left/right turn, continue straight, arrive, roundabout, merge — matching OSRM's `maneuver.type`/`modifier` vocabulary), designed and compared the same way `poiIcons.js` was — a design-review pass before committing, not drawn once and shipped.
- [ ] A new `TurnByTurnBanner.vue` component — positioned deliberately against `HudOverlay` and whatever the toast stack becomes in Milestone 6, not bolted on wherever there's empty space.
- [ ] Arrival-adjacent copy: the final maneuver should read as "arrive at destination," not silently disappear or freeze on the second-to-last instruction.

### Verification plan

A Playwright test that scripts geolocation along a real fetched route's own coordinates step by step (not just a single start/end pair), confirming the banner's instruction and distance update correctly as simulated position advances past each maneuver, and that it updates (not just persists) correctly across a reroute.

---

## 8. Quests, pickups, and deeper progression (proposed)

Not started. Everything Direction F built deepened *navigation*; this deepens the *genre/RPG layer* the other direction — the abstraction `Genres.md` describes (a shell four RPG-flavored genres plug into) has stayed at "class, sprite, ability, growth" since Milestone 5. Quests, pickups, and richer growth are the next layer of that abstraction, not a new one bolted on beside it.

**The constraint that shapes everything below, stated up front:** this app has no server, no accounts, and (per the product-direction conversation that opened Milestone 5) a firm commitment to being a real navigation tool that never fakes support it doesn't have. So nothing here invents mechanics divorced from real movement — a "quest" has to resolve to *trips taken, distance covered, places actually reached, abilities actually used*, the same real, already-tracked events `profile.js` has recorded since Milestone 5. This is a content and presentation layer over real behavior, not a new simulation running alongside it.

### Pickups — the smallest, most natural piece

Right now `revealPOIs()` (the Adventurer archetype's ability) finds real POIs and puts markers on the map, and that's the end of it — nothing happens if you actually drive to one. Pickups close that loop: reaching a revealed POI collects it.

- A `watch([position, pois], ...)` in `navigation.js`, structurally identical to the waypoint-arrival watcher Direction F just added — on proximity to any not-yet-collected POI, remove it from `pois` and record the collection.
- Reward: small XP via a new `profile.recordPickupCollected(classId, classData)`, mirroring `recordAbilityUsed`/`recordPOIsDiscovered` exactly. A new lifetime counter (`pickupsCollected`) alongside the four `profile.js` already tracks.
- Genre flavor is a label/icon swap only, not a new mechanic — a rune, a data cache, a bounty tip, a buried-treasure marker are the same "found and collected" event underneath. Ties directly into "represent the map in the chosen genre" below: the reused `iconForCategory()`/`poiMarkerEl()` pipeline just needs a genre-aware variant.

### Quests — grounded in stats the app already tracks

**Key design decision, worth stating plainly: quest progress should be *derived* from `profile.js`'s existing counters wherever an objective type already has one, not duplicated into new tracked state.** "Discover 15 POIs" is just `profile.progressFor(classId).poisDiscovered >= 15` read live — no separate progress counter to keep in sync or let drift, the same lesson the `xpGranted`-drift bug from Milestone 5 already taught this codebase once. The only *new* persisted state needed is which quests have been **claimed** (so a reward isn't re-granted every time the underlying stat is re-checked) — a small `claimedQuestIds` set, not a shadow copy of every objective's progress.

Proposed shape, `src/data/quests.js` (one file, `genreId`-tagged entries — quest volume per genre is likely small, unlike the 4-classes-per-file split that earned separate files):

```js
{
  id:        'ff-scout-the-old-city',  // globally unique, like class ids
  genreId:   'ff',
  title:     'Scout the Old City',
  flavor:    'The archives speak of streets no map remembers...',
  objective: { type: 'poisDiscovered', count: 15 },  // or tripsCompleted, distanceMeters,
                                                       // abilitiesUsed, pickupsCollected —
                                                       // anything profile.js already counts
  reward:    { xp: 150 },
}
```

**One objective type has no existing counter to derive from: visiting a specific real place** (`{ type: 'visitPlace', lat, lng, radiusMeters, label }`) — a real landmark, tied to real geography, checked with the same haversine-against-a-radius pattern `ARRIVAL_RADIUS_M` already established. This is the one genuinely new tracking mechanism this milestone needs; everything else reads what already exists.

**Design questions to settle before building:**
- **A Quest Log screen, or a section on `ProfileScreen.vue`?** `ProfileScreen.vue` is already "your durable progress, one screen" — leans toward a new section there for a first pass (active + completed lists), same reasoning that put saved destinations there instead of a new screen, with a dedicated screen only if quest volume grows enough to crowd it out.
- **Are quests genre-locked, or does switching genres abandon in-progress ones?** Given quest flavor is genre-voiced narrative, an FF quest reads oddly once you're playing Star Voyager — but the underlying stat (POIs discovered) isn't genre-scoped in `profile.js` today (it's per-class, and class ids are already genre-agnostic once picked). Leans toward: a quest's *objective* keeps counting regardless of current genre (the stat doesn't care), but its *card* only appears in its own genre's quest list — consistent with `profile.js`'s "class ids are unique across every genre" property already being load-bearing elsewhere (`findClassById()`).
- **How many quests per genre for a first pass?** Three to five, covering a spread of objective types (one trip-based, one POI-based, one distance-based, one `visitPlace`), rather than a large content push before the mechanism itself is proven out — same "build the shell, prove it generalizes, then fill in content" order every genre-generic system in this app has followed.

### Deeper character growth

Smaller, more speculative pieces worth having a real answer for even if not all built in the same pass:

- **Titles/badges** — a short list of unlocked labels (e.g. "Pathfinder" at 10 trips), shown on `ProfileScreen.vue` next to the level pips. Derived the same way quest progress is (a threshold check against existing counters), so this is nearly free once quests' "derive, don't duplicate" pattern exists.
- **Cosmetic unlocks** — `spriteAlternates.js` already holds designed-but-unused alternate poses for several classes; gating one behind a level or quest completion (instead of everything being freely available from level 1) gives growth something visible to show for itself beyond stat multipliers. Needs a small "which sprite is currently equipped" field somewhere — `profile.js`, per class, since it's a per-class cosmetic choice.
- **Skill points / stat reallocation** — explicitly the most speculative piece here, flagged rather than scoped: today STR/EXP/AGI are fixed per class, and the multiplier formulas (`powerMultiplier`/`cooldownMultiplier`) already read live level, not just base stats. Whether players should get to *choose* where growth goes, versus it staying automatic, is a real product question, not an engineering one — worth a deliberate call before building rather than guessing.

### Verification plan

Same real-data discipline as everything else in this app: no mocked quest completion. A Playwright run that plays through enough real ability/trip/POI activity to actually cross a quest's threshold, confirms the quest screen reflects it un-prompted (derived state, not a manual trigger), claims the reward once, and confirms replaying the same activity doesn't grant it twice. Pickups verified against a real Overpass-revealed POI and a real simulated arrival at its exact coordinates, matching the pattern already established for waypoint arrival.

---

## 9. Genre world-skinning (proposed)

Not started. Every genre-generic system built so far — classes, sprites, abilities, onboarding copy — reskins the *character* layer. The map itself has stayed genre-neutral: all four genres render the identical CARTO "Dark Matter" style, the same palette regardless of whether you're playing a knight, a pilot, a gunslinger, or a pirate. This closes that gap — but with a hard constraint stated up front, because it's the one most likely to get this wrong: **the map has to stay a real, accurate map underneath.** Real street names, real POI positions, real routing don't get hidden, renamed, or fictionalized — only *how the same real data is painted* changes. A gorgeous fantasy map a driver can't actually trust is a worse navigation tool than the plain dark one shipping today; this app's whole premise since the Milestone 5 product-direction conversation has been refusing that tradeoff.

### The technical approach: repaint the real tiles, don't replace them

MapLibre's vector tiles (CARTO's Dark Matter style included) separate *data* (roads, water, buildings, labels — real OpenStreetMap geometry) from *style* (the paint rules deciding how each data layer renders). Today `MapScreen.vue` loads Dark Matter's style wholesale and never touches it again. The plan is to keep using the exact same real tile data, but apply a **genre-specific palette override** on top of it once the style loads — `map.setPaintProperty(layerId, property, genreColor)` for the handful of layers that matter (background, water, land cover, road classes, buildings, labels), not a wholesale replacement style. This is a real, supported MapLibre pattern (restyling shared basemap data), not a workaround.

**Already checked against the real style, not guessed at** (same "verify against the live thing before writing code" discipline this session has used against OSRM and Overpass all along): Dark Matter's real style JSON has 93 layers, cleanly grouped — 1 `background`, 8 water, 4 landcover, 2 landuse, 2 building, 51 road (many are tunnel/bridge/case variants per road class, not one layer per class), 4 boundary, 17 label/place, plus aeroway/rail. Colors are set via plain `paint.background-color`/`line-color`/`fill-color` — some flat hex, some zoom-interpolated `stops` arrays, both overridable via `setPaintProperty()`. **Zero dedicated POI layers exist in the base style at all** — confirms POI/destination/user markers are entirely this app's own `Marker` layer already, completely untouched by any base-style reskin, which settles the "do POI icons need genre variants" question below in favor of leaving them alone. The road layer's real id list needs enumerating (not one clean `road` id to target) rather than guessed at when this is actually built, but nothing here contradicts the approach — it's a real, feasible plan, not a hopeful one.

### A concrete, cheap win already sitting in the codebase: `StarField.vue`

Star Voyager's onboarding screens already render an animated starfield background — built for a completely different screen, but nothing about it is onboarding-specific. Layering a low-opacity `StarField.vue` behind the map canvas specifically for the `scifi` genre (and only that genre) is a real, already-tested piece of atmosphere for near-zero new work, and a good pilot for "genre-specific decorative layer" as a concept distinct from "genre-specific palette."

### Design questions to settle before building

- **FF (fantasy) as the pilot genre, then the same mechanism for the other three** — this was the explicit ask, and matches every other genre-generic system's own history (`Genres.md` §8-§10: build once, verify it generalizes, then roll out) rather than trying to design all four palettes simultaneously before any of them are proven against a real rendered map.
- **How far does "genre feel" extend beyond palette?** Line style (dashed/organic road edges reading as "old map" for fantasy vs. crisp grid lines for sci-fi) and label typography are both real MapLibre-supported levers, not just color — worth a `/dev/map` comparison pass (the tool already exists from Milestone 6) before committing, the same way the route-line gradient decision was actually made by looking at rendered options rather than by description.
- **Do POI icons need genre-specific variants, or does the existing category-based set (`poiIcons.js`) stay universal?** A café is a café regardless of genre; leans toward keeping the functional icon set universal and reserving genre reskinning for the *base map* and *pickups* (which are already flavor items, not functional wayfinding), so the things a driver relies on to actually find a real place don't change meaning across genres.
- **Performance/readability regression risk is real, not hypothetical** — a heavily-stylized "old parchment map" could easily become harder to read at a glance while driving than the current plain dark theme, which was chosen partly *because* high contrast and minimal visual noise are safer at a glance. Every genre palette needs the same real-phone-viewport screenshot discipline Milestone 6 used, not just a desktop screenshot, before shipping.

### Implementation steps

- [x] Fetch and inspect Dark Matter's real style JSON — layer ids, paint properties, what's actually overridable. Done above.
- [ ] Extend `/dev/map` (Milestone 6) with a genre-palette picker, so candidate palettes get compared against the same real fetched route the route-line decision was made against — reusing the tool rather than building a second one.
- [ ] A `worldSkin` entry per genre (likely in `genres.js` alongside each genre's existing `color`/`tagline`, or a sibling `worldSkins.js` if the palette objects get large) — background/water/land/road/building/label color overrides, applied in `MapScreen.vue` once the base style's `load` event fires.
- [ ] Pilot on FF only; screenshot at real phone viewports before deciding it's ready to generalize.
- [ ] Roll the same mechanism to Star Voyager (pairing with the `StarField.vue` overlay idea above), Wild Frontier, and High Seas — content work at that point, not new engineering, if the FF pilot's mechanism holds.

### Verification plan

`/dev/map` screenshots comparing each genre's palette against the same real route, at real phone viewport sizes (per Milestone 6's own established practice) — plus confirming on the real map screen that street names, POI names, and routing accuracy are all completely unaffected by the reskin. A palette change that so much as looks like it could be hiding real map information is a failure of this milestone, not a stylistic quibble.
