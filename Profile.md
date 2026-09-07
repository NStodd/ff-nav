# Profile — growth, stat effects, and the party roster

This describes `src/stores/profile.js`: the durable, cross-session layer that sits alongside `player.js` (current genre/class choice) and `navigation.js` (live map state). It's reference documentation for the current implementation, not a changelog — see `PLANNING.md` §16 for the build history.

---

## Why a third store

`player.js` is "what's chosen right now" and resets on "START OVER." `navigation.js` is live map state and is explicitly *not* meant to survive a session. Progression is neither — it's meant to outlive both a reset and a session, tied to the player's real identity, not their current genre/class pick. It gets its own store, persisted under its own `localStorage` key (`crystalpath-profile`), and neither `player.reset()` nor `navigation.reset()` touches it — starting over resets *what you're playing*, not *who you've become*.

This is also why `pois` (in `navigation.js`, ephemeral, wiped by the Sovereign archetype's `goDark()`) and `poisDiscovered` (in `profile.js`, a lifetime counter) are two different things that happen to both count POIs: scuttling your current trail doesn't erase what you've actually found over time.

---

## Data shape

```js
{
  classes: {
    [classId]: {
      xp:              number, // cumulative, drives level
      tripsCompleted:  number,
      distanceMeters:  number, // lifetime, across all trips
      abilitiesUsed:   number,
      poisDiscovered:  number, // lifetime — never decremented, unlike navigation.pois
    },
  },
  party: [
    { id, name, note },        // local-only roster — see "The party roster" below
  ],
}
```

Progress is keyed by class **id**, not by genre+class — every class id is already unique across all four genres' rosters (checked: no collisions), so a player's history with, say, `fighter` stays `fighter`'s regardless of which genre they picked it from. This also means the same class id always shares one progression line even if that's never actually exercised today (each genre's rosters use disjoint ids).

`progressFor(classId)` lazily creates a blank entry on first read — nothing needs to pre-seed all sixteen classes up front.

---

## Leveling

Five levels, cumulative XP thresholds `[0, 100, 300, 600, 1000]` — capped at five to match the 1-5 stat-pip visual language already used everywhere else (`ClassCard.vue`'s STR/EXP/AGI rows), so a level is meant to eventually render as one more row of the same pips rather than inventing a new UI language for it (no level UI exists yet — see "Known gaps").

XP sources (base amounts, before the EXP-stat multiplier below):

| Event | Base XP | Where it's recorded |
|---|---|---|
| Ability used | 10 | `MapScreen.vue`'s `onAbility()`, every archetype |
| POI discovered | 2 each | Same call, only for `'reveal'`-type classes, only for *newly* found POIs |
| Trip completed | 25 + 5/km | `MapScreen.vue`'s watcher on `navigation.tripJustCompleted` |

Every `record*` function returns `{ leveledUp, level, xpGranted }` — `xpGranted` is the actual post-multiplier amount, not the base table value above. Callers displaying a number (the XP toast) use `xpGranted`, not the base — an earlier pass through this showed a toast reading "+90 XP" while the store had actually added 104, which is the kind of drift that's obviously wrong the first time a player notices it doesn't match.

---

## Stats have real effects

STR/EXP/AGI stopped being decorative pips and became multipliers, both read live off `profile.js` from `MapScreen.vue`:

- **`powerMultiplier(classId, classData)`** — `1 + STR × 0.05 + (level−1) × 0.1`. Scales an ability's *magnitude*: the Adventurer archetype's reveal radius, the Sovereign archetype's blackout duration. The Speedrunner and Connector archetypes don't have a magnitude dial (their abilities succeed-or-don't, not "succeed more"), so this multiplier isn't applied to them.
- **`cooldownMultiplier(classId, classData)`** — `max(0.4, 1 − AGI × 0.03 − (level−1) × 0.05)`. Scales *every* ability's cooldown, since `AbilityButton.vue`'s cooldown is generic — `MapScreen.vue` computes one `cooldownMs` value per the current class and passes it down as a prop, replacing the old flat 4000ms default for everyone.
- **EXP** doesn't touch ability behavior at all — it scales XP gain itself (`1 + EXP × 0.05`, applied inside `addXP()`). The flavor stat's name and its mechanical effect are the same thing: a high-EXP class levels faster. This was a deliberate one-word alignment between flavor and mechanics rather than three independent, harder-to-explain systems.

All three read `levelOf(classId)` live, so leveling up mid-session (finishing a trip while the map is open) changes cooldown/radius/duration on the very next ability press — verified with Playwright: SCOUT's cooldown was still measurably shorter than the flat 4000ms base within the same test run that had just leveled the class up.

---

## Trip completion (arrival detection)

This didn't exist anywhere in the codebase before this pass — `navigation.js` had a destination and a route, but no notion of *arriving*. Added:

- `routeDistanceMeters` — OSRM's `distance` field from `fetchRoute()`'s response, stored alongside the `duration` it already kept.
- A `watch([position, destination], ...)` inside `navigation.js` (not `MapScreen.vue` — arrival is navigation logic, not view logic) that fires on *either* changing, not just position — a destination set somewhere already close by (you tap your own block) counts as arrived immediately, not only once a later position update closes the gap.
- Arrival radius: 40m, generous enough to absorb realistic GPS jitter on foot or in a car without being so loose it fires early.
- `tripJustCompleted` is a one-shot signal, not an auto-clearing toast-style ref like `shareStatus` — whoever's listening (`MapScreen.vue`, to award XP) needs to read `distanceMeters` off it before it's gone, so the store waits for an explicit `acknowledgeTripCompletion()` rather than clearing itself on a timer and risking a race.
- On arrival: `destination`/`route`/`eta`/`routeDistanceMeters` all clear, same as a manual reset of just the trip (not the whole session).

---

## The party roster

`addPartyMember(name, note)` / `removePartyMember(id)` manage a plain local array — no accounts, no sync, no live location of anyone but the player. Two places call them: `ProfileScreen.vue` (ongoing management) and, since this pass, a dedicated **`PartyStep.vue`** onboarding step — `'party'` in `onboardingSteps`, present on all sixteen classes now, positioned right after the ability reveal (and after `personalize` for the four FF classes that have one). Every class has its own `partyPrompt` flavor line in the same voice as its `intro`/`locationPrompt` (bold for Adventurer, terse for Speedrunner, warm for Connector, ominous-and-skippable for Sovereign — a Black Mage/Overseer/Outlaw/Captain's prompt leans into reluctance rather than pretending privacy-focused classes are suddenly social). The step is never mandatory: "Continue" only requires the typewriter to finish, not that anyone actually got added.

`shareETA()` now reads the roster too — pass it a `party` array and the share text addresses the first member by name (`"Sarah — I'm on my way — ETA 12 min."`) instead of staying generic; multiple members get `"<first> & co."`. `MapScreen.vue` passes `profile.party` through when a Connector-archetype ability fires, the same "caller passes the cross-store data in, this store doesn't reach into another store itself" convention as `prefs`/`interestText` elsewhere in `navigation.js`.

---

## `ProfileScreen.vue` — the character/profile screen

`/:genreId/profile`, reached from a "PROFILE ▶" button on the map screen (opposite "← START OVER," so neither competes with the HUD's own bottom-anchored controls) — and left the same way, back to the map. Deliberately a **navigation**, not an overlay: the point of building this after establishing the driver-attention principle is that progress is something you go look at, not something that appears on top of the map while you're mid-trip.

Shows, for the currently chosen class: the sprite and stats (reusing the same pip rendering convention as `HudOverlay`/`ClassCard` — a `LEVEL` row now sits alongside `STR`/`EXP`/`AGI`, same five-box visual language, not a new one), the XP figure and how much more is needed for the next level (via `xpProgressOf()`), and the four lifetime stat tiles (trips completed, distance traveled, abilities used, POIs discovered) read straight off `progressFor()`.

**"Other paths walked"** — classes with tracked progress other than the current one — uses a new `findClassById()` helper in `genres.js` that searches every genre's roster for a given class id. This is the same "class ids are unique across every genre, verified, not assumed" property `profile.js` already leans on to key progress without genre-scoping; the helper just makes that property useful for display instead of only for storage. Only renders when there's actually another class with progress to show.

---

## Known gaps (deferred, not oversights)

- **`PartyStep.vue`'s prompt copy and the Connector archetype's `personalize` question ("who travels with you most often?") are two separate, unlinked moments that ask a similar thing.** The former is a structured roster you add real names to; the latter is free-text flavor color that goes nowhere. Not wrong exactly — one's mechanical, one's personality — but worth revisiting if it starts feeling redundant to a player who lands on both back to back (currently only the four FF classes have both; every other genre only has the new structured one, since they have no `personalize` step at all).
- **`shareETA()`'s party personalization is name-only and picks whoever's first in the array.** There's no way to choose *which* party member a given share is "for" — the OS share sheet's own recipient picker is still doing the actual addressing; the roster just changes the message text.
- **No level-up animation or distinct call-out.** A level-up currently only adds "— LEVEL UP!" to the same small XP toast text — deliberately minimal per the driver-attention principle (nothing should ask for more than a glance), but there's room for a slightly more satisfying moment without violating that.
- **Arrival radius (40m) and all XP/multiplier constants are unvalidated against real-world play** — chosen as reasonable starting points, not tuned against actual usage.
