# Sprites — how the system works, and how to add your own

This is reference documentation for the pixel-sprite system: the data format, how it renders, and a step-by-step guide to hand-drawing a new one. For the genre/class architecture sprites live inside, see [`Genres.md`](Genres.md); for the build history of the icon/sprite design-review pass, see `PLANNING.md` §17.

---

## How it works

### The format

A sprite is a plain JavaScript array of strings — one string per row, one character per pixel. No image files, no build step, no asset pipeline. Every class's `sprite:` field (in `classes.js`, `scifiClasses.js`, `westernClasses.js`, `pirateClasses.js`) is one of these arrays.

Each character maps to a color:

| Char | Renders as |
|---|---|
| `0` | transparent (nothing drawn) |
| `1` | the sprite's own `color` prop — usually the class's identity color |
| `2` | skin tone, `#F5CBA7` |
| `w` | white, `#FFFFFF` |
| `g` | gray, `#888888` |
| `G` | gold, `#F0C060` |
| `d` | dark, `#333333` |

Any other character still renders — as white, silently, via the `?? '#fff'` fallback in the color map — rather than throwing or leaving a gap. That's convenient for prototyping but means a typo doesn't announce itself; see "Common pitfalls" below.

### How it renders — `PixelSprite.vue`

```js
props: { rows: Array, color: String, pixelSize: Number (default 4) }
```

On mount and whenever `rows`/`color`/`pixelSize` change, it draws onto a `<canvas>`: canvas width is `(longest row's length) × pixelSize`, height is `(number of rows) × pixelSize`, and each character becomes one `pixelSize × pixelSize` (minus a 1px gap) filled square via `ctx.fillRect()`. `image-rendering: pixelated` keeps the scaling crisp at any size instead of blurring. This is the *only* place the character-to-color mapping is implemented for character sprites — `poiIcons.js`'s map icons and `SpritePlayground.vue`'s icon preview both duplicate a copy of the same `COLOR_MAP` locally rather than importing it, since they're drawing to a plain `<canvas>` directly instead of going through this component. `maneuverIcons.js` (the turn-by-turn arrow/roundabout/merge/arrive glyphs, Direction F) uses the same format too, but *is* rendered through `PixelSprite.vue` directly — it's plain Vue-owned DOM (inside `HudOverlay.vue`), not a MapLibre marker, so there was no need to duplicate the draw loop a third time the way the map-marker icons did.

Rows don't have to be the same length. Several shipped sprites already mix row lengths (present in the very first Fighter sprite in `CLAUDE.md`'s original spec) — the draw loop just walks each row's own length independently.

### Where sprites live, and at what sizes they actually render

One `sprite:` array per class, 16 total across 4 genre files. Nothing scales or crops a sprite differently per screen — the same array renders everywhere for that class, just at a different `pixelSize`:

| Screen | Component | `pixelSize` |
|---|---|---|
| Class-select grid | `ClassCard.vue` | 4 |
| Onboarding — welcome | `WelcomeStep.vue` | 6 |
| Onboarding — ability reveal | `AbilityRevealStep.vue` | 5 |
| Onboarding — done/fanfare | `DoneStep.vue` | 8 |
| Map HUD | `HudOverlay.vue` | 6 (`spriteSize` prop) |
| Profile screen — your class | `ProfileScreen.vue` | 8 |
| Profile screen — "other paths walked" list | `ProfileScreen.vue` | 3 |

**A sprite has to read correctly across that whole range, especially the small end (3-4px).** A shape that looks great at 8px can turn into an unreadable smear at 3px — always check the small sizes, not just the biggest/clearest one.

### Design conventions already established

- **9 columns × 12 rows** is the de facto canvas size every shipped sprite uses (from `CLAUDE.md`'s original spec onward). Not a hard requirement — `PixelSprite.vue` sizes its canvas off whatever it's given — just the size everything today was designed against, so matching it keeps a new sprite visually consistent with the rest of a class-select grid or HUD row sitting next to it.
- **Recolor-by-default, bespoke-when-it-earns-it.** All four genres' rosters reuse the same four archetype silhouettes (Adventurer/Speedrunner/Connector/Sovereign) recolored per genre — that's the default, not a limitation. Ten of the sixteen classes have since diverged with small, targeted row edits (`spriteAlternates.js` holds the candidates), each change tied to something concrete about that class — Star Voyager's Diplomat got a raised antenna because its ability is literally called UPLINK, not because "it needed to look different." See `Genres.md`'s "Sprite reuse — and sprite variation" table for the full list and reasoning. **Mutating an existing sprite's rows is lower-risk than drawing free-hand** — you inherit a silhouette that's already proven to render cleanly at 3-4px, and the diff is easy to reason about.
- **A class's own `color` is what `'1'` renders as**, not a fixed value baked into the sprite — the same rows array would look different under a different class's color. Keep that in mind if you're eyeballing contrast: check it against the actual class color it'll ship with, not whatever's in the sandbox by default.

---

## Creating a new sprite, step by step

### 1. Pick a starting point

Don't start from a blank grid unless you're confident free-hand. Two better options:

- **Mutate an existing sprite.** Copy one of the 16 real `sprite:` arrays (or a candidate from `spriteAlternates.js`) and change only the rows you need to. This is what every adopted alternate pose did.
- **Start blank, but sketch off-screen first.** If the class genuinely needs a new silhouette, sketch it on paper or in a spreadsheet (see below) before typing a single character string — catching "this reads as a blob" is much cheaper on graph paper than after it's already in code.

### 2. Draw it

Pick whichever matches how you think:

- **A spreadsheet (Google Sheets/Excel)** — make each cell one pixel, color-fill a small palette matching the 7 real characters (transparent/class-color/skin/white/gray/gold/dark), then read the finished grid back into characters row by row. This is the fastest option for most people: no software to learn, and the grid constraint (freeze a 9-column width) matches the format exactly.
- **A pixel-art editor** (Aseprite, or even a zoomed-in MS Paint with grid snapping) — set your palette to those same 7 exact colors before drawing, so there's no ambiguity converting back. Export/inspect as a small PNG and read each pixel's color into its character by hand; a 9×12 grid is small enough to do this in a few minutes.

Either way, you're converting to text eventually — there's no automated image-to-sprite importer, and building one for a 9×12 grid would be more work than reading it off by hand once.

### 3. Build and check it in the sandbox

Open **`/dev/sprites`** (run `npm run dev`, no genre/class selection needed — it's a standalone dev route) and use the **"Sprite sandbox — build your own"** section at the top:

- **"Start from"** dropdown loads any of the 16 real classes' current sprites as a base — pick one close to what you're making and hit **LOAD**, or leave it on "blank canvas."
- Paste or type your rows into the text box, one row per line, using the `0 1 2 w g G d` vocabulary above.
- Set the **color swatch** to the actual class color it'll ship with — not an arbitrary preview color — since contrast only means something against the real color.
- Check the **live preview**, then specifically check the **small real-size row** (4/6/8px) underneath it — that row exists precisely so a sprite that looks fine zoomed in doesn't ship broken at HUD/card size.
- Fix anything flagged by the **warning line** below the preview (an unrecognized character — it'll otherwise silently render white).

### 4. Copy it out and commit it

Click **COPY AS JS ARRAY** — it copies (and always also displays, in case clipboard access isn't available) the rows formatted exactly as they need to look inside a class file:

```js
[
  '000000000',
  '001111100',
  ...
]
```

Paste that as the class's `sprite:` field (or, if you want it reviewable alongside other candidates before deciding, add it to `spriteAlternates.js` first — see its existing entries for the shape).

### 5. Verify before calling it done

- **Run `node --check` on whatever data file you edited.** A stray unescaped quote in a nearby flavor-text field has broken the build before (an apostrophe in a `partyPrompt` string) — cheap insurance every time a class data file changes.
- **Screenshot it in the app itself at real size**, not just in the sandbox — `ClassCard.vue`'s grid and `HudOverlay.vue`'s small sprite are the two places most likely to expose a sprite that only worked at the sandbox's default preview size.
- **Check the color against the game's near-black background, not just conceptually.** A color that sounds right for the flavor can still render as flat gray/colorless on `--ff-night` if it's too dark or desaturated — this actually happened once (Wild Frontier's Outlaw shipped a `#3D2B56` violet that read as gray until it was brightened to `#7A2048`; see `PLANNING.md` §9). Every existing class color sits around 35-45% lightness with real saturation — match that range.

---

## Common pitfalls

- **An unrecognized character doesn't error — it renders white.** There's no validation in `PixelSprite.vue` itself; the sandbox's warning line is the only place that flags it before it ships.
- **Row length mismatches are allowed, not a bug** — several shipped sprites already do this — but an *accidental* one (a stray extra/missing character) usually reads as a shape that's subtly off-center rather than obviously broken. Worth a deliberate second look if your rows aren't all the same length and you didn't mean them not to be.
- **A shape that reads fine at 8px can be unreadable at 3-4px.** Always check the small end of the size table above — that's most of where this sprite will actually be seen (`ClassCard`, `HudOverlay`, and the profile screen's "other paths walked" row are all 3-6px).
- **The sandbox never touches real game data.** Nothing you do at `/dev/sprites` persists or affects the live app — you have to explicitly copy the result into a class file for it to matter, so there's no risk in experimenting there.
