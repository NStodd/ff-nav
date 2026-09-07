# Crystal Path

A real navigation app with an 8-bit RPG shell. You pick a genre (Final Fantasy, Star Voyager, Wild Frontier, or High Seas) and one of four classes within it, and the whole app — onboarding, the map, the HUD — reskins around that choice. Underneath the theme it's real turn-by-turn routing (OSRM), real point-of-interest discovery (Overpass/OpenStreetMap), and real map tiles (CARTO) — not a mockup with placeholder data.

The design goal driving everything since Milestone 5: **be a genuinely useful navigation tool first**, with engagement mechanics that reward real usage (driving somewhere, discovering places, finishing trips) without ever competing for a driver's attention. Nothing here is a modal — feedback is a glanceable toast or a screen you navigate to on your own terms, never something that pops up over the map mid-trip.

---

## What it's built from

- **Four genres, one shell.** Final Fantasy, Star Voyager, Wild Frontier, and High Seas each reskin the exact same flow — pick a class, sit through onboarding, land on the map. Nothing downstream branches on which genre you're in; only the content differs. See [`Genres.md`](Genres.md).
- **Four classes per genre, sharing four archetypes.** Every genre's roster maps onto the same four roles — Adventurer, Speedrunner, Connector, Sovereign — so "Fighter" (FF), "Pilot" (Star Voyager), "Gunslinger" (Wild Frontier), and "Buccaneer" (High Seas) are reflavored versions of the same idea, right down to a shared ability shape:

  | Archetype | Ability shape | FF | Star Voyager | Wild Frontier | High Seas |
  |---|---|---|---|---|---|
  | Adventurer | Reveals nearby POIs | Fighter — SCOUT | Pilot — SCAN | Gunslinger — TRAILBLAZE | Buccaneer — SPYGLASS |
  | Speedrunner | Silently reroutes | Thief — SHADOW STEP | Smuggler — JUMP DRIVE | Outrider — BACKTRAIL | Corsair — FULL SAIL |
  | Connector | Shares your ETA | White Mage — CURE | Diplomat — UPLINK | Wagon Master — SIGNAL FIRE | Quartermaster — SIGNAL FLAG |
  | Sovereign | Wipes your trail / privacy | Black Mage — FIRE | Overseer — PURGE | Outlaw — VANISH | Captain — SCUTTLE |

- **Real backends, not fakes.** Routing via OSRM (`router.project-osrm.org` in dev), POI discovery via the Overpass API (`overpass-api.de` in dev), map tiles from CARTO's free "Dark Matter" vector style. Both endpoints are swappable via env vars before real traffic — see [Backends](#backends) below.
- **Growth that isn't cosmetic.** A separate profile store tracks XP, levels, and lifetime stats per class, independent of which genre/class you currently have selected. STR/AGI/EXP aren't just pips — they scale an ability's magnitude, its cooldown, and how fast you level, respectively. See [`Profile.md`](Profile.md).
- **A party roster with a real effect.** Add people during onboarding or from your profile screen; the Connector archetype's ETA-share message actually addresses them by name. No accounts, no sync — a local roster that changes what gets shared, not a promise of a real multiplayer system yet.
- **Saved destinations and turn-by-turn.** Save your current destination with a tap from the map and pick it back up later from your profile screen; once a route is active, a persistent HUD strip shows the next real maneuver (from OSRM's own step data) with a live countdown distance, not just an ETA. Multi-stop routes are next.

---

## Project structure

```
src/
  data/
    genres.js            # GENRES — the single source of truth for which genres exist
    classes.js            # Final Fantasy's 4-class roster
    scifiClasses.js        westernClasses.js        pirateClasses.js   # the other 3 genres' rosters
    poiIcons.js           # category → pixel-icon map for map markers
    spriteAlternates.js   # candidate alternate character poses (see /dev/sprites)
  stores/                 # Pinia — three independent stores, deliberately not importing each other
    player.js             # current genre/class choice, onboarding progress, preferences — resets on "start over"
    navigation.js          # live map state — position, route, ETA, abilities — never persisted (except destination)
    profile.js             # durable cross-session growth — XP, levels, lifetime stats, the party roster
  components/             # onboarding steps, HUD, shared pixel-UI primitives (PixelSprite, PixelButton, DialogBox, ...)
  views/
    GenreSelectScreen.vue  ClassSelectScreen.vue   OnboardingScreen.vue   # the setup flow
    MapScreen.vue          ProfileScreen.vue                              # the app proper
    HudPlayground.vue      SpritePlayground.vue                           # /dev/* design-review tools, not user-facing
  router/index.js         # /, /:genreId, /:genreId/onboarding, /:genreId/map, /:genreId/profile
```

Each Pinia store owns a distinct lifetime: `player` resets when you start over, `navigation` is live/ephemeral map state, `profile` outlives both. Cross-store data (personalization preferences, the party roster) flows through the view layer as explicit function parameters rather than stores importing each other directly.

---

## Documentation map

This repo's docs are reference material for how things actually work, not just a changelog — read the one for the area you're touching:

| Doc | Covers |
|---|---|
| [`Genres.md`](Genres.md) | The genre/class architecture and the recipe for adding a new genre |
| [`Sprites.md`](Sprites.md) | The pixel-sprite format and a step-by-step guide to hand-drawing new ones |
| [`Navigation.md`](Navigation.md) | The navigation store, MapLibre integration, and the HUD layer |
| [`Profile.md`](Profile.md) | Growth (XP/levels/stat effects), arrival detection, the party roster, saved destinations |
| [`PRODUCTION.md`](PRODUCTION.md) | What's release-blocking vs. an acceptable v1 limitation before shipping for real |
| [`PLANNING.md`](PLANNING.md) | Chronological build log — what was built, in what order, and why |
| [`Issues.md`](Issues.md) | Bugs investigated in depth (e.g. the Android permissions crash) |
| [`SETUP.md`](SETUP.md) / [`RUNNING.md`](RUNNING.md) | Original scaffold notes / how to run the project |

---

## Running it

```bash
npm install
npm run dev          # Vite dev server
npm run tauri dev    # full Tauri desktop app (needs the Rust toolchain)
```

Two dev-only routes exist outside the normal genre/class flow: **`/dev/hud`** (live HUD styling tool with copy-to-clipboard CSS) and **`/dev/sprites`** (POI icon and character-sprite design review).

### Backends

By default the app talks to public, no-API-key demo servers (OSRM's and Overpass's own community instances) — fine for development, explicitly not for production per their own docs. Copy `.env.example` to `.env.local` and set `VITE_OSRM_BASE`/`VITE_OVERPASS_BASE` to point at a self-hosted or paid instance; see [`PRODUCTION.md`](PRODUCTION.md) for the full reasoning.

---

## Tech stack

Vue 3 (Composition API, `<script setup>`) · Vite · Vue Router 4 · Pinia · MapLibre GL (CARTO vector tiles) · Tauri 2 (Android + desktop) · Playwright for verification against real backends — no mocking.
