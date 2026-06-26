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

5. **Each step emits `advance`** when the user is ready to proceed — the engine calls `store.advanceOnboarding()`. Steps never know their index or what comes next.

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
