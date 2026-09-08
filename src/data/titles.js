// Milestone 8, phase 3: titles/badges. The simplest of §8's three "deeper
// growth" pieces, on purpose: unlike quests.js, a title needs no reward and
// no "claimed" tracking, because it isn't a one-time event — it's a status,
// true or false right now, recomputed fresh every time the profile screen
// renders. Nothing here is persisted at all.
//
// Genre-agnostic on purpose, unlike quests: "Pathfinder" isn't a fantasy or
// sci-fi idea, it's a real achievement, so one catalog serves all four
// genres rather than a genre-voiced set the way quests.js's 20 entries are.
//
// Most objective types are the same fields quests.js already derives from
// (profile.js's per-class stats); `level` is the one addition, since a
// class's level isn't a stored field — it's computed from `xp` via
// `profile.levelOf()` — so it's passed in separately rather than read off
// `stats` directly.

export const TITLES = [
  { id: 'pathfinder',          label: 'Pathfinder',
    objective: { type: 'tripsCompleted', count: 10 } },
  { id: 'wanderer',            label: 'Wanderer',
    objective: { type: 'distanceMeters', count: 50000 } },
  { id: 'adept',               label: 'Adept',
    objective: { type: 'level', count: 3 } },
  { id: 'collector',           label: 'Collector',
    objective: { type: 'pickupsCollected', count: 25 } },
  { id: 'master-cartographer', label: 'Master Cartographer',
    objective: { type: 'poisDiscovered', count: 100 } },
]

export function isTitleEarned(title, stats, level) {
  if (title.objective.type === 'level') return level >= title.objective.count
  return (stats?.[title.objective.type] ?? 0) >= title.objective.count
}

export function earnedTitles(stats, level) {
  return TITLES.filter(t => isTitleEarned(t, stats, level))
}
