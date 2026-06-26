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

- [ ] Scaffold project with `npm create vue@latest`
- [ ] Set up `src/assets/main.css` with CSS vars and font import
- [ ] Create `src/data/classes.js` with all four class definitions
- [ ] Create Pinia store `src/stores/player.js`
- [ ] Create router `src/router/index.js`
- [ ] Strip `App.vue` to bare `<RouterView />`
- [ ] Build `PixelSprite.vue` and verify sprites render correctly
- [ ] Build `StarField.vue`
- [ ] Build `PixelDivider.vue`
- [ ] Build `ClassCard.vue` with selection state and stat pips
- [ ] Build `ClassSelectScreen.vue` composing all components
- [ ] Add stub `OnboardingScreen.vue`
- [ ] Run `npm run dev` and verify the full flow end to end

---

## Notes & decisions

- **No TypeScript for now** — keep the barrier low during early prototyping; add it later.
- **No CSS framework** — the pixel aesthetic requires tight control; utility classes would fight it.
- **Sprite data lives in `classes.js`**, not in components — components are generic renderers.
- **Pinia over Vuex** — simpler API, native Vue 3, good DevTools support.
- **Canvas over SVG for sprites** — `image-rendering: pixelated` on canvas gives the cleanest pixel scaling; SVG `<rect>` grids work but are heavier in the DOM.
- The `--cc` CSS variable trick (set on card root, used in scoped styles) avoids needing inline styles for every color-dependent rule while keeping the component reusable across classes.

---

## Milestone 2 — Onboarding flow (all classes)

These steps are **shared across all four classes** and should be built once as generic infrastructure before adding any class-specific behavior.

### Common infrastructure checklist

- [ ] Expand `src/stores/player.js` to persist `chosenClass` to `localStorage` so a page refresh doesn't reset selection
- [ ] Add a navigation guard in `src/router/index.js` that redirects `/onboarding` → `/` if no class is chosen
- [ ] Build `OnboardingLayout.vue` — a wrapper that provides the pixel-border chrome, StarField background, and step progress indicator shared by all onboarding steps
- [ ] Build `PixelButton.vue` — reusable styled button component used throughout onboarding and beyond
- [ ] Build `DialogBox.vue` — FF-style text box with typewriter reveal effect; used for class intro narration and permission prompts
- [ ] Add `onboardingSteps` array to each class entry in `classes.js` — an ordered list of step IDs the class uses (e.g. `['intro', 'ability', 'location-permission', 'done']`)
- [ ] Implement step routing inside `OnboardingScreen.vue` driven by `store.onboardingStep` and `store.chosenClass.onboardingSteps`
- [ ] Build `AbilityRevealStep.vue` — animated panel that shows the class ability name, description, and a demo or icon; shared layout, class-specific content pulled from `classes.js`
- [ ] Build `LocationPermissionStep.vue` — requests geolocation permission with class-flavored copy (each class gets a one-liner in `classes.js`, e.g. Fighter: "SCOUT needs your coordinates, warrior.")
- [ ] Build `WelcomeStep.vue` — short intro narration rendered via `DialogBox`; copy lives in `classes.js` per class
- [ ] Build `DoneStep.vue` — transition out of onboarding → main map view; plays a brief "fanfare" CSS animation before pushing to `/map`
- [ ] Add `/map` route and stub `MapScreen.vue`

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

- [ ] Choose and integrate a map library (Leaflet or MapLibre GL) — add to `classes.js` notes once decided
- [ ] Build `MapScreen.vue` with map mount, user location marker, and basic route display
- [ ] Build `HudOverlay.vue` — persistent overlay containing: class sprite (small), current ability button, and a mini stat panel
- [ ] Build `AbilityButton.vue` — glowing pixel button that triggers the active class ability; disabled state when on cooldown
- [ ] Add `navigation` Pinia store (`src/stores/navigation.js`) for route state, destination, ETA
- [ ] Wire geolocation to the navigation store (watch position)
- [ ] Style the map tiles to approximate a dark pixel aesthetic (custom tile layer or CSS filter)

---

## Milestone 4 — Class-specific features

Implement each class's unique ability and any class-exclusive UI after Milestone 3 is stable.

### Fighter — SCOUT
- [ ] POI radius reveal: query nearby POIs within configurable radius and render as pixel-art map markers
- [ ] Add `scoutRadius` to Fighter entry in `classes.js`

### Thief — SHADOW STEP
- [ ] Mid-journey reroute: detect faster route silently and apply without prompt
- [ ] Brief "shadow" animation on the route line when switch occurs

### White Mage — CURE
- [ ] Party store (`src/stores/party.js`) — list of party members with ETA data
- [ ] One-tap ETA share: generate shareable link or deep-link with current ETA + destination
- [ ] `PartyPanel.vue` — slide-up drawer showing party member ETAs

### Black Mage — FIRE
- [ ] Fireball animation: CSS/canvas projectile arc across the map (purely cosmetic)
- [ ] Privacy mode toggle: strip identifying info from any shared data
