// Milestone 8, phase 2: quests. See PLANNING.md §8 for the full design
// reasoning — the short version: this app has no server and refuses to fake
// mechanics it doesn't back with real behavior, so every objective here
// resolves to something profile.js already tracks per class (trips, distance,
// abilities, POIs discovered, pickups collected). Progress is *derived* from
// those existing counters, never duplicated into its own tracked state — the
// same lesson the xpGranted-drift bug back in Milestone 5 already taught this
// codebase. Only completion (`claimedQuestIds`, in profile.js) is new state.
//
// `objective.type` must be a key `profile.js`'s `blankClassProgress()`
// actually produces. A `visitPlace` type (a real lat/lng + radius, checked
// like ARRIVAL_RADIUS_M already is) was scoped in the original plan but
// deliberately deferred — it needs a genuinely new real-time tracking
// mechanism, not just a read of an existing counter, and this pass stays
// scoped to what's free to derive.
//
// Content-authoring only, not new engineering, once the mechanism works for
// one genre — all four got a matching set from the start, the same "prove it
// generalizes immediately" approach every other content system in this app
// (classes, sprites, personalization) has used, as opposed to world-skinning
// (§9), which is genuinely novel per-genre design work and piloting on FF
// first for exactly that reason.

export const QUESTS = [
  // --- Final Fantasy ---
  { id: 'ff-first-steps',    genreId: 'ff', title: 'First Steps',
    flavor: 'Every legend begins with a single road taken.',
    objective: { type: 'tripsCompleted', count: 1 }, reward: { xp: 50 } },
  { id: 'ff-long-road',      genreId: 'ff', title: 'The Long Road',
    flavor: 'Five thousand strides from home, the horizon still calls.',
    objective: { type: 'distanceMeters', count: 5000 }, reward: { xp: 150 } },
  { id: 'ff-honed-instincts', genreId: 'ff', title: 'Honed Instincts',
    flavor: 'A blade means nothing until it has been drawn ten times in earnest.',
    objective: { type: 'abilitiesUsed', count: 10 }, reward: { xp: 100 } },
  { id: 'ff-cartographer',   genreId: 'ff', title: 'Cartographer of the Unknown',
    flavor: 'Chart twenty places no map yet remembers.',
    objective: { type: 'poisDiscovered', count: 20 }, reward: { xp: 150 } },
  { id: 'ff-treasure-seeker', genreId: 'ff', title: 'Treasure Seeker',
    flavor: 'Five relics claimed from the paths you have walked.',
    objective: { type: 'pickupsCollected', count: 5 }, reward: { xp: 75 } },

  // --- Star Voyager ---
  { id: 'scifi-first-departure', genreId: 'scifi', title: 'First Departure',
    flavor: 'Log your first successful transit.',
    objective: { type: 'tripsCompleted', count: 1 }, reward: { xp: 50 } },
  { id: 'scifi-deep-space-cruise', genreId: 'scifi', title: 'Deep Space Cruise',
    flavor: 'Cover 5,000 meters of charted vector.',
    objective: { type: 'distanceMeters', count: 5000 }, reward: { xp: 150 } },
  { id: 'scifi-system-mastery', genreId: 'scifi', title: 'System Mastery',
    flavor: 'Execute ship systems ten times without failure.',
    objective: { type: 'abilitiesUsed', count: 10 }, reward: { xp: 100 } },
  { id: 'scifi-sensor-sweep', genreId: 'scifi', title: 'Sensor Sweep',
    flavor: 'Catalog twenty unregistered signal sources.',
    objective: { type: 'poisDiscovered', count: 20 }, reward: { xp: 150 } },
  { id: 'scifi-salvage-run', genreId: 'scifi', title: 'Salvage Run',
    flavor: 'Recover five data caches from the field.',
    objective: { type: 'pickupsCollected', count: 5 }, reward: { xp: 75 } },

  // --- Wild Frontier ---
  { id: 'western-ride-out', genreId: 'western', title: 'Ride Out',
    flavor: "Saddle up. One trail's all it takes to start.",
    objective: { type: 'tripsCompleted', count: 1 }, reward: { xp: 50 } },
  { id: 'western-long-haul', genreId: 'western', title: 'Long Haul',
    flavor: 'Five thousand meters of dust behind you.',
    objective: { type: 'distanceMeters', count: 5000 }, reward: { xp: 150 } },
  { id: 'western-quick-draw', genreId: 'western', title: 'Quick Draw',
    flavor: 'Ten times drawn, ten times true.',
    objective: { type: 'abilitiesUsed', count: 10 }, reward: { xp: 100 } },
  { id: 'western-lay-of-the-land', genreId: 'western', title: 'Lay of the Land',
    flavor: "Scout twenty spots the maps don't show.",
    objective: { type: 'poisDiscovered', count: 20 }, reward: { xp: 150 } },
  { id: 'western-bounty-collected', genreId: 'western', title: 'Bounty Collected',
    flavor: 'Five marks claimed along the way.',
    objective: { type: 'pickupsCollected', count: 5 }, reward: { xp: 75 } },

  // --- High Seas ---
  { id: 'pirate-set-sail', genreId: 'pirate', title: 'Set Sail',
    flavor: 'Your first voyage — may the wind favor it.',
    objective: { type: 'tripsCompleted', count: 1 }, reward: { xp: 50 } },
  { id: 'pirate-open-water', genreId: 'pirate', title: 'Open Water',
    flavor: 'Five thousand meters of open sea behind the hull.',
    objective: { type: 'distanceMeters', count: 5000 }, reward: { xp: 150 } },
  { id: 'pirate-seasoned-hand', genreId: 'pirate', title: 'Seasoned Hand',
    flavor: 'Ten times called upon, ten times answered.',
    objective: { type: 'abilitiesUsed', count: 10 }, reward: { xp: 100 } },
  { id: 'pirate-chart-the-coast', genreId: 'pirate', title: 'Chart the Coast',
    flavor: 'Mark twenty ports and coves unknown to the charts.',
    objective: { type: 'poisDiscovered', count: 20 }, reward: { xp: 150 } },
  { id: 'pirate-buried-treasure', genreId: 'pirate', title: 'Buried Treasure',
    flavor: 'Five hauls of loot, claimed and stowed.',
    objective: { type: 'pickupsCollected', count: 5 }, reward: { xp: 75 } },
]

export function questsForGenre(genreId) {
  return QUESTS.filter(q => q.genreId === genreId)
}

// `stats` is whatever profile.progressFor(classId) returns — reading
// `objective.type` straight off it is the "derive, don't duplicate" rule in
// practice. Missing/undefined reads as 0 rather than throwing, so a quest
// referencing a field an older persisted profile hasn't been backfilled with
// yet degrades to "not started" instead of breaking.
export function questProgress(quest, stats) {
  const current = stats?.[quest.objective.type] ?? 0
  const target  = quest.objective.count
  return { current: Math.min(current, target), target, complete: current >= target }
}

export function isQuestComplete(quest, stats) {
  return questProgress(quest, stats).complete
}
