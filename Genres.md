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

### Sprite reuse — and sprite variation

Four pixel-grid silhouettes started out reused verbatim across all four genres' rosters, reinterpreted only by color. That's still the *default* — a class's `sprite` field is independent per-class data, so nothing technically requires reuse, but starting from the shared shape is far less work than drawing four new ones, and the archetype table above already does the heavy lifting of keeping tone consistent. FF (the original genre) is kept as the unmodified reference for all four archetypes; each of the other three genres has since departed from a couple of them where a small, targeted change fits that class's actual ability better than the shared default:

| Archetype | Base shape | FF | Star Voyager | Wild Frontier | High Seas |
|---|---|---|---|---|---|
| Adventurer | Fighter's, visible face | unchanged | Pilot: skin `'2'` → `'w'` (helmet visor) | Gunslinger: gold bandolier stripe | Buccaneer: hood/hat-brim shadow |
| Speedrunner | Thief's, hooded | unchanged | Smuggler: full flight mask, no visible face | Outrider: staggered legs (mid-stride) | unchanged |
| Connector | White Mage's, robed | unchanged | Diplomat: raised antenna (UPLINK, literal) | Wagon Master: held lantern (SIGNAL FIRE, literal) | Quartermaster: raised flagpole (SIGNAL FLAG, literal) |
| Sovereign | Black Mage's, hooded/masked | unchanged | Overseer: faceless, no eye-slits (an AI doesn't need to see to watch you) | Outlaw: peaked hood (a bandit's low-pulled hat) | Captain: faceless, no eye-slits |

Every variant is a **small, targeted mutation of the proven base shape** — same row-length pattern, same `PixelSprite.vue` character vocabulary, only specific rows changed — rather than a from-scratch silhouette. That's a deliberate risk-reduction choice: a wholly new pose is much likelier to render as a garbled mess than a couple of changed rows on top of a shape that's already shipping correctly. See `PixelSprite.vue` for the character-to-color mapping (`'1'` = class color, `'2'` = skin, `'w'`/`'g'`/`'G'`/`'d'` = fixed white/gray/gold/dark, `'0'` = transparent) and note that rows within one sprite don't all need the same length — mixed lengths were already present in the original Fighter sprite (rows 0-5 are 8 chars, rows 6-11 are 9) and several variants above lean on this too (a longer row trailing off to one side draws a thin accessory — a staff, an antenna, a flagpole — beside the body without needing a second layer).

**`/dev/sprites`** (`src/views/SpritePlayground.vue`) is the design-review tool this table came out of: it renders every candidate archetype pose across all four genres' real class colors side by side, plus the POI category icons (see `Navigation.md`'s known gaps) in both a neutral tint and every genre's brand color. Candidate poses not adopted into the table above still live in `src/data/spriteAlternates.js` for reference.

---

## How to add a fifth genre

1. **Pick the four classes.** Reuse the archetype table above (recommended — keeps tonal variety consistent) or diverge if the genre calls for it.
2. **Create `src/data/<name>Classes.js`** exporting an array in the exact shape documented above. Start from the relevant archetype's base sprite (see "Sprite reuse — and sprite variation" above) and either reuse it verbatim or mutate specific rows if the class's ability suggests something more literal — check any new pose in `/dev/sprites` against all four genres' colors before adopting it.
3. **Pick colors carefully — check them against the dark background before calling it done, not after.** `--ff-night` is `#0A0A14`, near-black. A color needs real lightness (~35-45%) and saturation to read as a color rather than flat gray against it — this bit us once already (see `PLANNING.md` §9: Wild Frontier's Outlaw shipped with a color that rendered gray, caught only by screenshotting and fixed after the fact). For genre #4 (`PLANNING.md` §10) all four colors were screenshot-checked *before* declaring it done and needed no fix-up — do that, not the §9 way.
4. **Add the entry to `GENRES`** in `src/data/genres.js`, importing the new roster file. Set `status: 'coming-soon'` with `entryRoute: null` and `classes: []` if you want a placeholder card first, or go straight to `'available'` with `entryRoute: 'class-select'` if the roster's ready.
5. **Verify the full loop**: genre-select shows the new card → clicking it routes to `/<id>` and renders all four classes correctly → confirm → onboarding (all four steps, in the class's voice) → `/<id>/map` with the HUD showing the right sprite/color/ability. No component code should need to change for any of this.

---

## Known constraints (not bugs, just scope)

- **Stat labels are fixed.** `ClassCard.vue` and `HudOverlay.vue` hardcode `STR` / `EXP` / `AGI` as the three pip rows — every genre's classes must fit that same three-stat schema regardless of thematic fit (a pirate's "STR" reads fine; forcing a fifth genre into exactly these three labels might not always).
- **`HudPlayground.vue`'s class picker only previews the FF roster.** The `/dev/hud` design-tuning tool (see `Navigation.md`) wasn't extended to let you preview the other three genres' classes — it still imports `CLASSES` directly rather than reading from `GENRES`.
- **The "CRYSTAL PATH" brand title doesn't change per genre.** This is deliberate — it's the product name, not part of the reskin — but worth knowing it's not something `OnboardingLayout.vue`/`ClassSelectScreen.vue` derive from `genre.name`.
