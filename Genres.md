# Genres — how the genre system works

This is reference documentation for the genre layer: the architecture, the four genres that exist today, and the recipe for adding a new one. For the map/navigation layer see `Navigation.md`; for the chronological build history (including the exact order things were built and bugs hit along the way) see `PLANNING.md` §3, §4, and §8–§10.

---

## The idea

Crystal Path isn't a single Final-Fantasy-themed app — it's a shell (routing, onboarding engine, map, HUD) that any number of RPG-flavored **genres** can plug into. A genre is a themed reskin of the exact same flow: pick one of four classes, sit through a four-step onboarding narration, land on a map with a HUD. Nothing about that flow is genre-specific in code — only the *content* (class names, colors, sprites, copy) changes per genre.

Four genres exist today, all fully playable:

| Genre | id | Landing tagline | Brand color |
|---|---|---|---|
| Final Fantasy | `ff` | Navigation Chronicles | `#F0C060` (gold) |
| Star Voyager | `scifi` | Deep Space Routing | `#3498DB` (blue) |
| Wild Frontier | `western` | Trail Navigation | `#C87F32` (tan) |
| High Seas | `pirate` | Open Water Routing | `#1ABC9C` (turquoise) |

---

## Architecture

### `GENRES` (`src/data/genres.js`)

The single source of truth for which genres exist. Each entry:

```js
{
  id:          'scifi',              // route param value, e.g. /scifi
  name:        'Star Voyager',       // shown on the genre-select card
  tagline:     'Deep Space Routing', // shown under the class-select header
  description: '...',                // shown on the genre-select card
  color:       '#3498DB',            // the genre's own brand color — never reused by one of its classes
  status:      'available',          // 'available' | 'coming-soon'
  entryRoute:  'class-select',       // route name to push to when selected; null while coming-soon
  classes:     SCIFI_CLASSES,        // imported from its own roster file
}
```

`status: 'coming-soon'` is still a real, supported state (a locked card with no `classes`/`entryRoute`) — it's just that nothing currently uses it. It's how genre #5 should start if you want to reserve a landing-page slot before the roster is designed.

### Each genre's class roster (`src/data/{classes,scifiClasses,westernClasses,pirateClasses}.js`)

One file per genre, each exporting an array of exactly this shape (this is `CLASSES`'s original shape from the very first FF-only milestone — every later genre matches it exactly):

```js
{
  id:              'diplomat',
  name:            'Diplomat',
  tag:             'Liaison',                 // short flavor tag shown under the name
  color:           '#2E86C1',                 // this class's identity color — the --cc var everywhere
  description:     '...',                     // class-select card body copy
  ability:         'UPLINK',                  // ability name, shown in ability-reveal step and HUD
  abilityDesc:     '...',                     // ability flavor text
  stats:           { str: 1, exp: 5, agi: 3 }, // each 1-5, rendered as pips
  onboardingSteps: ['intro', 'ability', 'location', 'done'],
  intro:           '...',                     // WelcomeStep narration, in the class's voice
  locationPrompt:  '...',                     // LocationPermissionStep's flavor one-liner
  sprite:          [ /* 12 rows of pixel-map chars, see PixelSprite.vue */ ],
}
```

### Everything downstream is genre-generic

None of the following contain a single `if (genre === ...)` branch — they all just read `store.chosenGenre` / `store.chosenClass`:

- **Router** (`src/router/index.js`) — routes are `/`, `/:genreId`, `/:genreId/onboarding`, `/:genreId/map`. The guard resolves `to.params.genreId` against `GENRES` and checks `status === 'available'`; unknown or locked IDs bounce to `/`.
- **`GenreSelectScreen.vue` / `GenreCard.vue`** — render whatever's in `GENRES`, full stop.
- **`ClassSelectScreen.vue`** — resolves `genre = GENRES.find(g => g.id === route.params.genreId)`, renders `genre.classes` and `genre.tagline`.
- **The onboarding step engine** (`OnboardingScreen.vue` + the four step components under `src/components/onboarding/`) — resolves the current step from `store.chosenClass.onboardingSteps[store.onboardingStep]`; every step reads its content from `store.chosenClass`.
- **`MapScreen.vue` / `HudOverlay.vue`** — read `store.chosenClass.sprite/color/ability/stats` and tint everything via the `--cc` CSS variable.

This is why adding genres 2, 3, and 4 each took **zero component changes** — see the "Verified" notes in `PLANNING.md` §8/§9/§10.

### The player store (`src/stores/player.js`)

Holds `chosenGenre` and `chosenClass`, persisted to `localStorage` under separate keys (`crystalpath-genre`, `crystalpath-class`) — storing only the ids, not the full objects, so `GENRES`/roster files stay the single source of truth and can't drift out of sync with a stale cached object.

---

## The four archetypes

Every genre's four classes map onto the same four narrative archetypes, which is what makes the tone contrast land the same way regardless of theme. Reusing this table (rather than inventing new archetypes per genre) is deliberate — it's also why the same four sprite silhouettes could be reused for every genre with just a recolor.

| Archetype | Voice | FF | Star Voyager | Wild Frontier | High Seas |
|---|---|---|---|---|---|
| Adventurer | Bold, eager, glory-seeking | Fighter — SCOUT | Pilot (Ace) — SCAN | Gunslinger (Drifter) — TRAILBLAZE | Buccaneer (Voyager) — SPYGLASS |
| Speedrunner | Terse, efficiency-obsessed | Thief — SHADOW STEP | Smuggler (Runner) — JUMP DRIVE | Outrider (Rider) — BACKTRAIL | Corsair (Raider) — FULL SAIL |
| Connector | Warm, communal | White Mage — CURE | Diplomat (Liaison) — UPLINK | Wagon Master (Guide) — SIGNAL FIRE | Quartermaster (Boatswain) — SIGNAL FLAG |
| Sovereign | Ominous, dry, controlling | Black Mage — FIRE | Overseer (Sovereign) — PURGE | Outlaw (Renegade) — VANISH | Captain (Sovereign) — SCUTTLE |

All four archetypes share the same ability *shape* across genres too, just reflavored: Adventurer reveals hidden POIs, Speedrunner silently reroutes, Connector shares ETA, Sovereign does something aggressive/privacy-related (cosmetic fireball, trail wipe, trail wipe, trail wipe — FF is the odd one out here, since FIRE was designed before the "privacy ability" pattern solidified with Overseer/Outlaw/Captain).

### Sprite reuse

Four pixel-grid silhouettes get reused across all four genres' rosters, reinterpreted by color and occasionally by character mapping:

- **Adventurer shape** (Fighter's) — visible face by default; Pilot's version swaps the skin-tone `'2'` cells for `'w'` (a helmet visor, since a spacesuit doesn't show skin).
- **Speedrunner shape** (Thief's) — hooded/low-profile, fits a scarf-wearing smuggler, a duster-coated outrider, or a bandana'd corsair equally well.
- **Connector shape** (White Mage's) — long robe/coat, works unchanged for a diplomat's uniform, a wagon master's coat, or a quartermaster's coat.
- **Sovereign shape** (Black Mage's) — hooded/masked, fits an AI overseer, a masked outlaw, or a tricorn-hatted captain.

See `PixelSprite.vue` for the character-to-color mapping (`'1'` = class color, `'2'` = skin, `'w'`/`'g'`/`'G'`/`'d'` = fixed white/gray/gold/dark, `'0'` = transparent).

---

## How to add a fifth genre

1. **Pick the four classes.** Reuse the archetype table above (recommended — keeps tonal variety consistent) or diverge if the genre calls for it.
2. **Create `src/data/<name>Classes.js`** exporting an array in the exact shape documented above. Reuse one of the four existing sprite silhouettes per class unless the genre specifically needs a new one.
3. **Pick colors carefully — check them against the dark background before calling it done, not after.** `--ff-night` is `#0A0A14`, near-black. A color needs real lightness (~35-45%) and saturation to read as a color rather than flat gray against it — this bit us once already (see `PLANNING.md` §9: Wild Frontier's Outlaw shipped with a color that rendered gray, caught only by screenshotting and fixed after the fact). For genre #4 (`PLANNING.md` §10) all four colors were screenshot-checked *before* declaring it done and needed no fix-up — do that, not the §9 way.
4. **Add the entry to `GENRES`** in `src/data/genres.js`, importing the new roster file. Set `status: 'coming-soon'` with `entryRoute: null` and `classes: []` if you want a placeholder card first, or go straight to `'available'` with `entryRoute: 'class-select'` if the roster's ready.
5. **Verify the full loop**: genre-select shows the new card → clicking it routes to `/<id>` and renders all four classes correctly → confirm → onboarding (all four steps, in the class's voice) → `/<id>/map` with the HUD showing the right sprite/color/ability. No component code should need to change for any of this.

---

## Known constraints (not bugs, just scope)

- **Stat labels are fixed.** `ClassCard.vue` and `HudOverlay.vue` hardcode `STR` / `EXP` / `AGI` as the three pip rows — every genre's classes must fit that same three-stat schema regardless of thematic fit (a pirate's "STR" reads fine; forcing a fifth genre into exactly these three labels might not always).
- **`HudPlayground.vue`'s class picker only previews the FF roster.** The `/dev/hud` design-tuning tool (see `Navigation.md`) wasn't extended to let you preview the other three genres' classes — it still imports `CLASSES` directly rather than reading from `GENRES`.
- **The "CRYSTAL PATH" brand title doesn't change per genre.** This is deliberate — it's the product name, not part of the reskin — but worth knowing it's not something `OnboardingLayout.vue`/`ClassSelectScreen.vue` derive from `genre.name`.
