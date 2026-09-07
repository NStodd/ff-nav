# Crystal Path — Claude Code Spec

## Project overview

Build **Crystal Path**, a navigation app with an 8-bit Final Fantasy I aesthetic. Users choose one of four RPG-style classes during onboarding, and the entire UX is tailored to their choice.

This file covers the initial milestone: the **class selection screen** and the **scaffolding** needed to support a full onboarding flow afterward.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Vue 3 (Composition API, `<script setup>`) |
| Build tool | Vite |
| Router | Vue Router 4 |
| State | Pinia |
| Styling | Scoped `<style>` blocks in SFCs — no CSS framework |
| Font | Press Start 2P (Google Fonts) |
| Language | JavaScript (no TypeScript for now) |

---

## Scaffold the project

```bash
npm create vue@latest crystal-path -- --router --pinia --no-ts --no-jsx --no-eslint
cd crystal-path
npm install
```

After scaffolding, delete everything inside `src/views/`, `src/components/`, and clear `src/App.vue` down to a bare router-view shell.

---

## Directory structure

```
src/
  assets/
    main.css              # global reset + pixel font import
  data/
    classes.js            # all class definitions (sprites, stats, copy)
  stores/
    player.js             # Pinia store — chosen class + onboarding progress
  router/
    index.js              # routes
  components/
    PixelSprite.vue       # canvas-based sprite renderer
    ClassCard.vue         # individual class card
    PixelDivider.vue      # decorative dot-row divider
    StarField.vue         # animated background stars
  views/
    ClassSelectScreen.vue # the class selection screen
    OnboardingScreen.vue  # placeholder — post-selection flow (stub only)
```

---

## Global styles (`src/assets/main.css`)

```css
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --ff-night:    #0A0A14;
  --ff-dark:     #12122A;
  --ff-panel:    #1A1A2E;
  --ff-border:   #2A2A4A;
  --ff-text:     #E8E0C8;
  --ff-muted:    #9090A8;
  --ff-gold:     #F0C060;
  --ff-gold-dark:#B8860B;

  --c-fighter:   #C0392B;
  --c-thief:     #1E8449;
  --c-wmage:     #1A5276;
  --c-bmage:     #6C3483;
}

body {
  background: var(--ff-night);
  color: var(--ff-text);
  font-family: 'Press Start 2P', monospace;
}

#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
```

Import in `src/main.js`:
```js
import './assets/main.css'
```

---

## Data (`src/data/classes.js`)

Export a `CLASSES` array. Each entry has:

```js
export const CLASSES = [
  {
    id: 'fighter',
    name: 'Fighter',
    tag: 'Adventurer',
    color: '#C0392B',
    description: 'Seeks paths untravelled. Finds glory in the unknown.',
    ability: 'SCOUT',
    abilityDesc: 'Reveals hidden POIs within a radius around you.',
    stats: { str: 5, exp: 3, agi: 2 },   // values 1–5
    sprite: [
      // each string is one row; characters: '1'=class color, '2'=skin,
      // 'w'=white, 'g'=gray, 'G'=gold, 'd'=dark, '0'=transparent
      '00022200',
      '00222220',
      '00222220',
      '00212120',
      '00222220',
      '0G11111G',
      '011111110',
      '011111110',
      '001g1g100',
      '001111100',
      '011111110',
      '011111110',
    ],
  },
  {
    id: 'thief',
    name: 'Thief',
    tag: 'Speedrunner',
    color: '#1E8449',
    description: 'In and out. Fastest route, every time, no wasted steps.',
    ability: 'SHADOW STEP',
    abilityDesc: 'Silently switches to a faster route mid-journey.',
    stats: { str: 2, exp: 4, agi: 5 },
    sprite: [
      '000d1d000',
      '00d111d00',
      '00122120',
      '00111110',
      '001d1d100',
      '0g1111g0',
      '0g111110',
      '011g1g10',
      '001111100',
      '011111110',
      '011d1d110',
      '011d0d110',
    ],
  },
  {
    id: 'wmage',
    name: 'White Mage',
    tag: 'Connector',
    color: '#1A5276',
    description: 'Navigate together. The world is better explored with others.',
    ability: 'CURE',
    abilityDesc: 'One-tap ETA share with any party member.',
    stats: { str: 1, exp: 5, agi: 3 },
    sprite: [
      '001www100',
      '01wwwww10',
      '01w2w2w10',
      '01wwwww10',
      '001www100',
      '011111110',
      '011111110',
      '001111100',
      '001111100',
      '011111110',
      '01100110',
      '01100110',
    ],
  },
  {
    id: 'bmage',
    name: 'Black Mage',
    tag: 'Sovereign',
    color: '#6C3483',
    description: 'Total control. Maximum privacy. Also: fire.',
    ability: 'FIRE',
    abilityDesc: 'Launches a fireball across the map. Non-negotiable.',
    stats: { str: 5, exp: 2, agi: 3 },
    sprite: [
      '001111100',
      '011111110',
      '11ddddd11',
      '11ww1ww11',
      '011www110',
      '001111100',
      '001111100',
      '011111110',
      '001111100',
      '001100100',
      '001001100',
      '000111000',
    ],
  },
]
```

---

## Pinia store (`src/stores/player.js`)

```js
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const usePlayerStore = defineStore('player', () => {
  const chosenClass   = ref(null)   // full class object from CLASSES
  const onboardingStep = ref(0)

  function selectClass(cls) {
    chosenClass.value = cls
  }

  function advanceOnboarding() {
    onboardingStep.value++
  }

  function reset() {
    chosenClass.value    = null
    onboardingStep.value = 0
  }

  return { chosenClass, onboardingStep, selectClass, advanceOnboarding, reset }
})
```

---

## Router (`src/router/index.js`)

```js
import { createRouter, createWebHistory } from 'vue-router'
import ClassSelectScreen from '@/views/ClassSelectScreen.vue'
import OnboardingScreen  from '@/views/OnboardingScreen.vue'

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/',           name: 'class-select', component: ClassSelectScreen },
    { path: '/onboarding', name: 'onboarding',   component: OnboardingScreen  },
  ],
})
```

---

## `App.vue`

```vue
<template>
  <RouterView />
</template>

<script setup>
import { RouterView } from 'vue-router'
</script>
```

---

## Component: `PixelSprite.vue`

Renders a sprite from a rows array onto a `<canvas>`.

**Props:**
- `rows` — `Array<string>` (from `classes.js`)
- `color` — hex string, the class color (replaces `'1'` pixels)
- `pixelSize` — number, default `4`

**Behaviour:**
- Use `onMounted` + `watch([() => props.rows, () => props.color])` to call a `draw()` function.
- Canvas width = `maxRowLength * pixelSize`, height = `rows.length * pixelSize`.
- Pixel color map: `'1'` → `props.color`, `'2'` → `#F5CBA7` (skin), `'w'` → `#FFFFFF`, `'g'` → `#888888`, `'G'` → `#F0C060`, `'d'` → `#333333`, `'0'` → transparent (skip).
- Set `image-rendering: pixelated` on the canvas element.

```vue
<template>
  <canvas ref="canvasEl" :style="{ imageRendering: 'pixelated' }" />
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'

const props = defineProps({
  rows:      { type: Array,  required: true },
  color:     { type: String, required: true },
  pixelSize: { type: Number, default: 4 },
})

const canvasEl = ref(null)

const COLOR_MAP = {
  '2': '#F5CBA7', w: '#FFFFFF', g: '#888888', G: '#F0C060', d: '#333333',
}

function draw() {
  const canvas = canvasEl.value
  if (!canvas) return
  const ps   = props.pixelSize
  const cols = Math.max(...props.rows.map(r => r.length))
  canvas.width  = cols * ps
  canvas.height = props.rows.length * ps
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  props.rows.forEach((row, ri) => {
    for (let ci = 0; ci < row.length; ci++) {
      const ch = row[ci]
      if (ch === '0') continue
      ctx.fillStyle = ch === '1' ? props.color : (COLOR_MAP[ch] ?? '#fff')
      ctx.fillRect(ci * ps, ri * ps, ps - 1, ps - 1)
    }
  })
}

onMounted(draw)
watch([() => props.rows, () => props.color, () => props.pixelSize], draw)
</script>
```

---

## Component: `StarField.vue`

Absolutely-positioned stars rendered as `<div>` elements.

- Generate 80 stars in `onMounted`, store in a `ref` array.
- Each star: `{ x, y, size, delay, duration }` — all random.
- Render with `v-for` as `position: absolute` divs.
- CSS `@keyframes twinkle` fades opacity between `0.15` and `1`.
- The parent (the screen) must be `position: relative; overflow: hidden`.

---

## Component: `PixelDivider.vue`

A row of small square dots.

**Props:** `count` (default 12), `color` (default `var(--ff-gold-dark)`)

Render `count` `<span>` elements inline with `width: 4px; height: 4px; display: inline-block; background: props.color; margin: 0 3px`.

---

## Component: `ClassCard.vue`

**Props:** `classData` (one entry from `CLASSES`), `selected` (boolean)

**Emits:** `select` (no payload — parent reads `classData.id`)

**Template structure:**
```
div.card (role="radio", :aria-checked="selected", @click="$emit('select')", @keydown.enter.space="$emit('select')", tabindex="0")
  div.card-inner
    PixelSprite (:rows="classData.sprite" :color="classData.color" :pixelSize="4")
    div.card-info
      p.class-name  {{ classData.name.toUpperCase() }}
      p.class-tag   ★ {{ classData.tag.toUpperCase() }}
      p.class-desc  {{ classData.description }}
      div.stats (v-for stat in ['str','exp','agi'])
        span.stat-label  {{ stat.toUpperCase() }}
        span.stat-pip    v-for n in 5, :class="{ filled: n <= classData.stats[stat] }"
```

**Styling:**
- Card border: `2px solid var(--ff-border)` by default.
- When `selected`, border becomes `2px solid` the class color (pass as a CSS var or inline style).
- Class color is available as `classData.color` — use `:style="{ '--cc': classData.color }"` on the root div, then reference `var(--cc)` in scoped CSS for hover/selected states.
- Stat pips: `7px × 7px` squares, `border: 1px solid var(--ff-border)`. `.filled` gets `background: var(--cc); border-color: var(--cc)`.

---

## View: `ClassSelectScreen.vue`

Composes all components. Manages `selectedId` locally, commits to store on confirm.

```vue
<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '@/stores/player'
import { CLASSES } from '@/data/classes'
import StarField from '@/components/StarField.vue'
import PixelDivider from '@/components/PixelDivider.vue'
import ClassCard from '@/components/ClassCard.vue'

const router = useRouter()
const store  = usePlayerStore()

const selectedId = ref(null)
const selected   = (id) => selectedId.value === id

function onSelect(id) {
  selectedId.value = id
}

function confirm() {
  const cls = CLASSES.find(c => c.id === selectedId.value)
  store.selectClass(cls)
  router.push({ name: 'onboarding' })
}
</script>
```

**Template structure:**
```
div.screen (position: relative, min-height: 100vh)
  StarField
  corner decorations ×4 (absolute positioned divs, gold border-only corners)
  div.content
    header
      h1 CRYSTAL PATH
      PixelDivider
      p.subtitle NAVIGATION CHRONICLES
    p.prompt — choose your class —
    div.grid (role="radiogroup")
      ClassCard v-for cls in CLASSES
        :classData="cls"
        :selected="selected(cls.id)"
        @select="onSelect(cls.id)"
    button#confirm :disabled="!selectedId" @click="confirm"
      ▶ CONFIRM CLASS
    p.confirm-text (shows selected class name when chosen)
```

---

## View: `OnboardingScreen.vue` (stub)

Just confirm the selection was received and provide a back link for now:

```vue
<template>
  <div style="padding: 2rem; font-family: 'Press Start 2P', monospace; color: #F0C060;">
    <p>Welcome, {{ store.chosenClass?.name }}.</p>
    <p style="margin-top: 1rem; font-size: 10px; color: #9090A8;">Onboarding flow coming soon.</p>
    <button @click="router.push('/')" style="margin-top: 2rem;">← Back</button>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { usePlayerStore } from '@/stores/player'
const router = useRouter()
const store  = usePlayerStore()
</script>
```

---

## Checklist for Claude Code

Work through these in order:

- [x] Scaffold project with `npm create vue@latest`
- [x] Set up `src/assets/main.css` with CSS vars and font import
- [x] Create `src/data/classes.js` with all four class definitions
- [x] Create Pinia store `src/stores/player.js`
- [x] Create router `src/router/index.js`
- [x] Strip `App.vue` to bare `<RouterView />`
- [x] Build `PixelSprite.vue` and verify sprites render correctly
- [x] Build `StarField.vue`
- [x] Build `PixelDivider.vue`
- [x] Build `ClassCard.vue` with selection state and stat pips
- [x] Build `ClassSelectScreen.vue` composing all components
- [x] Add stub `OnboardingScreen.vue`
- [x] Run `npm run dev` and verify the full flow end to end

**Milestone 1 done** — see `SETUP.md` for the as-built notes. Everything below this point evolved substantially beyond this file's original sketch (a single-genre, four-class app grew into a genre-generic shell with four genres); `PLANNING.md`'s "Finished" log (§1–§15) is the accurate build history and `Navigation.md`/`Genres.md` are the accurate current-state reference — this file is kept as the original spec, not updated to match every implementation detail that diverged from it below.

---

## Notes & decisions

- **No TypeScript for now** — keep the barrier low during early prototyping; add it later. *(Note: the actual scaffold ended up with `main.ts`/`vite.config.ts` and a strict `tsconfig.json` — app code itself stayed plain JS throughout, `.vue` files included, so the spirit of this decision held even though the entry point didn't end up matching it literally.)*
- **No CSS framework** — the pixel aesthetic requires tight control; utility classes would fight it.
- **Sprite data lives in `classes.js`**, not in components — components are generic renderers.
- **Pinia over Vuex** — simpler API, native Vue 3, good DevTools support.
- **Canvas over SVG for sprites** — `image-rendering: pixelated` on canvas gives the cleanest pixel scaling; SVG `<rect>` grids work but are heavier in the DOM.
- The `--cc` CSS variable trick (set on card root, used in scoped styles) avoids needing inline styles for every color-dependent rule while keeping the component reusable across classes.

---

## Milestone 2 — Onboarding flow (all classes)

These steps are **shared across all four classes** and should be built once as generic infrastructure before adding any class-specific behavior.

### Common infrastructure checklist

- [x] Expand `src/stores/player.js` to persist `chosenClass` to `localStorage` so a page refresh doesn't reset selection (grew to also persist `chosenGenre` and `onboardingStep` — see `PLANNING.md` §4 and §11)
- [x] Add a navigation guard in `src/router/index.js` that redirects `/onboarding` → `/` if no class is chosen
- [x] Build `OnboardingLayout.vue` — a wrapper that provides the pixel-border chrome, StarField background, and step progress indicator shared by all onboarding steps
- [x] Build `PixelButton.vue` — reusable styled button component used throughout onboarding and beyond
- [x] Build `DialogBox.vue` — FF-style text box with typewriter reveal effect; used for class intro narration and permission prompts
- [x] Add `onboardingSteps` array to each class entry in `classes.js` — an ordered list of step IDs the class uses (e.g. `['intro', 'ability', 'location-permission', 'done']`)
- [x] Implement step routing inside `OnboardingScreen.vue` driven by `store.onboardingStep` and `store.chosenClass.onboardingSteps`
- [x] Build `AbilityRevealStep.vue` — animated panel that shows the class ability name, description, and a demo or icon; shared layout, class-specific content pulled from `classes.js`
- [x] Build `LocationPermissionStep.vue` — requests geolocation permission with class-flavored copy (each class gets a one-liner in `classes.js`, e.g. Fighter: "SCOUT needs your coordinates, warrior.")
- [x] Build `WelcomeStep.vue` — short intro narration rendered via `DialogBox`; copy lives in `classes.js` per class
- [x] Build `DoneStep.vue` — transition out of onboarding → main map view; plays a brief "fanfare" CSS animation before pushing to `/map`
- [x] Add `/map` route and stub `MapScreen.vue`
- Also built, beyond this file's original scope: a `PersonalizeStep.vue` step (FF classes only) and a genre-select layer above class-select (`GenreSelectScreen.vue`, `src/data/genres.js`) — see `PLANNING.md` §3, §4, and `Genres.md`.

### Per-class onboarding content (add to `classes.js`)

Each class entry should gain:

```js
{
  onboardingSteps: ['intro', 'ability', 'location', 'done'],
  intro: 'Narration copy for DialogBox.',
  locationPrompt: 'Class-flavored one-liner for the location permission ask.',
}
```

| Class | `intro` flavour | `locationPrompt` flavour |
|---|---|---|
| Fighter | Bold, eager, glory-seeking | "SCOUT needs your coordinates, warrior." |
| Thief | Terse, efficiency-obsessed | "Location locked. Route calculated. Move." |
| White Mage | Warm, communal | "Share your light — let your party find you." |
| Black Mage | Ominous, dry | "Your position is required. Resistance is inefficient." |

---

## Milestone 3 — Map screen (common layer)

Build the shared map foundation before layering class-specific HUD elements on top.

- [x] Choose and integrate a map library (Leaflet or MapLibre GL) — chose MapLibre GL over Leaflet for a dark vector style instead of a CSS-filter hack; see `Navigation.md`
- [x] Build `MapScreen.vue` with map mount, user location marker, and basic route display
- [x] Build `HudOverlay.vue` — persistent overlay containing: class sprite (small), current ability button, and a mini stat panel
- [x] Build `AbilityButton.vue` — glowing pixel button that triggers the active class ability; disabled state when on cooldown
- [x] Add `navigation` Pinia store (`src/stores/navigation.js`) for route state, destination, ETA
- [x] Wire geolocation to the navigation store (watch position)
- [x] Style the map tiles to approximate a dark pixel aesthetic (custom tile layer or CSS filter) — CARTO's free "Dark Matter" vector style is already dark, so no filter hack was needed

**Milestone 3 done and verified on a real Android device** — see `PLANNING.md` §6, §7, §15 and `Navigation.md`.

---

## Milestone 4 — Class-specific features

Implement each class's unique ability and any class-exclusive UI after Milestone 3 is stable.

**Done, but built as four *archetype* abilities (`abilityType` on every class, driving generic dispatch in `MapScreen.vue`'s `onAbility()`) rather than four FF-specific ones — by the time this milestone started, the app had grown into a genre-generic shell with sixteen classes across four genres (see `Genres.md`), so each ability landed for all four genres' equivalent class simultaneously. Full detail and Playwright verification notes: `PLANNING.md` §12–§15, `Navigation.md`'s HUD/store sections.**

### Fighter — SCOUT
- [x] POI radius reveal: query nearby POIs within configurable radius and render as pixel-art map markers — real Overpass API query, not mocked data
- [x] Add radius config to Fighter entry in `classes.js` — shipped as `abilityRadius` (not the sketched `scoutRadius`), since it's shared by all four genres' Adventurer-archetype classes, not Fighter alone

### Thief — SHADOW STEP
- [x] Mid-journey reroute: detect faster route silently and apply without prompt — re-queries OSRM with `alternatives=true`; "faster" is really "different," since OSRM's public demo doesn't model live traffic
- [x] Brief "shadow" animation on the route line when switch occurs — a `line-width` pulse tween, not a color/shadow effect specifically, but the same "silent flash, no prompt" intent

### White Mage — CURE
- [ ] ~~Party store (`src/stores/party.js`) — list of party members with ETA data~~ — **deliberately not built.** There's no backend to sync a real party roster against, so an in-app "party" would be mock data with nowhere real to go.
- [x] One-tap ETA share: generate shareable link or deep-link with current ETA + destination — shipped as `shareETA()`, handing off to the OS share sheet (`navigator.share()`) or a clipboard-copy fallback, with a real Google Maps link, instead of a custom deep-link scheme
- [ ] ~~`PartyPanel.vue` — slide-up drawer showing party member ETAs~~ — **deliberately not built**, same reasoning as the party store above

### Black Mage — FIRE
- [ ] ~~Fireball animation: CSS/canvas projectile arc across the map (purely cosmetic)~~ — **not built.** FF's Black Mage is the one class of sixteen whose ability name/flavor ("launches a fireball") doesn't match its actual archetype behavior (privacy/trail-wipe, matching Overseer/Outlaw/Captain in the other three genres) — see `Genres.md`'s archetype table note on this. Implementing the mechanical `'privacy'` archetype behavior generically took priority over a cosmetic, FF-only-flavored animation; revisit if FF-specific flourish on top of the shared behavior is wanted later.
- [x] Privacy mode toggle: strip identifying info from any shared data — shipped as `goDark()`: wipes revealed POIs, route, destination, and position, and pauses live location tracking for 6s (the player's own marker actually disappears from the map for that stretch)
