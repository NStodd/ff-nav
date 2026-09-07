import { defineStore } from 'pinia'
import { ref } from 'vue'

const STORAGE_KEY = 'crystalpath-profile'

// Cumulative XP required to REACH each level. Five levels, matching the
// existing 1-5 stat-pip visual language everywhere else in the app (see
// ClassCard.vue) so a "level" reads as one more row of the same pips, not a
// new UI language.
const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000]
const MAX_LEVEL = LEVEL_THRESHOLDS.length

const ABILITY_XP          = 10
const POI_XP              = 2
const TRIP_BASE_XP        = 25
const TRIP_XP_PER_KM      = 5

function levelForXP(xp) {
  let level = 1
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1
  }
  return level
}

function blankClassProgress() {
  return {
    xp: 0,
    tripsCompleted:   0,
    distanceMeters:   0,
    abilitiesUsed:    0,
    poisDiscovered:   0,
  }
}

export const useProfileStore = defineStore('profile', () => {
  const saved = localStorage.getItem(STORAGE_KEY)
  const initial = saved ? JSON.parse(saved) : { classes: {}, party: [], savedDestinations: [] }

  // "Character" data — scoped to a classId, changes if you play a different
  // class/genre. `classes` (growth/XP/lifetime stats) is the existing example.
  const classes = ref(initial.classes ?? {})   // { [classId]: { xp, tripsCompleted, distanceMeters, abilitiesUsed, poisDiscovered } }

  // "User" data — describes the real person, not the current RPG skin. Same
  // regardless of which class/genre is active. `party` is the existing
  // example; `savedDestinations` (Direction F) is the newest one. See
  // PLANNING.md for the character-vs-user split this store follows when
  // deciding where a new field belongs.
  const party             = ref(initial.party ?? [])             // [{ id, name, note }] — local-only, see PLANNING.md's party-onboarding phase
  const savedDestinations = ref(initial.savedDestinations ?? []) // [{ id, label, lat, lng }] — local-only, no geocoding

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      classes: classes.value, party: party.value, savedDestinations: savedDestinations.value,
    }))
  }

  function progressFor(classId) {
    if (!classes.value[classId]) classes.value[classId] = blankClassProgress()
    return classes.value[classId]
  }

  function levelOf(classId) {
    return levelForXP(progressFor(classId).xp)
  }

  function xpProgressOf(classId) {
    const level = levelOf(classId)
    const xp    = progressFor(classId).xp
    const floor = LEVEL_THRESHOLDS[level - 1]
    const ceil  = LEVEL_THRESHOLDS[level] ?? null // null at max level — nothing left to progress toward
    return { level, xp, floor, ceil, maxed: level >= MAX_LEVEL }
  }

  // classData is the full CLASSES-shape object (needs .stats.exp for the XP
  // multiplier) — pass store.chosenClass straight through from the caller
  // rather than re-deriving it here, since this store has no idea GENRES/
  // CLASSES exist and shouldn't need to.
  // Returns the *actual* XP granted (post-EXP-multiplier), not the base
  // amount passed in — callers displaying a toast need the real number, not
  // an estimate that'll quietly drift from what's actually in `classes`.
  function addXP(classId, amount, classData) {
    const progress = progressFor(classId)
    const before   = levelForXP(progress.xp)
    const expMult  = 1 + (classData?.stats?.exp ?? 3) * 0.05 // EXP stat: how fast THIS class levels
    const granted  = Math.round(amount * expMult)
    progress.xp   += granted
    persist()
    return { leveledUp: levelForXP(progress.xp) > before, level: levelForXP(progress.xp), xpGranted: granted }
  }

  function recordAbilityUsed(classId, classData) {
    const progress = progressFor(classId)
    progress.abilitiesUsed++
    return addXP(classId, ABILITY_XP, classData)
  }

  function recordPOIsDiscovered(classId, count, classData) {
    if (count <= 0) return { leveledUp: false, level: levelOf(classId), xpGranted: 0 }
    const progress = progressFor(classId)
    progress.poisDiscovered += count
    return addXP(classId, POI_XP * count, classData)
  }

  function recordTripCompleted(classId, distanceMeters, classData) {
    const progress = progressFor(classId)
    progress.tripsCompleted++
    progress.distanceMeters += distanceMeters
    const xp = TRIP_BASE_XP + Math.round((distanceMeters / 1000) * TRIP_XP_PER_KM)
    return addXP(classId, xp, classData)
  }

  // Stat-effect formulas — STR scales an ability's magnitude (radius,
  // blackout duration), AGI scales cooldown reduction. Both also grow with
  // level so a well-worn class feels different from a fresh one even at the
  // same base stats. Clamped so neither can erase the base cooldown/effect
  // entirely.
  function powerMultiplier(classId, classData) {
    const level = levelOf(classId)
    const str   = classData?.stats?.str ?? 3
    return 1 + str * 0.05 + (level - 1) * 0.1
  }

  function cooldownMultiplier(classId, classData) {
    const level = levelOf(classId)
    const agi   = classData?.stats?.agi ?? 3
    return Math.max(0.4, 1 - agi * 0.03 - (level - 1) * 0.05)
  }

  function addPartyMember(name, note = '') {
    const member = { id: crypto.randomUUID(), name, note }
    party.value = [...party.value, member]
    persist()
    return member
  }

  function removePartyMember(id) {
    party.value = party.value.filter(m => m.id !== id)
    persist()
  }

  // Direction F, phase 1: a persisted place list — no reverse geocoding
  // available (no extra backend for it, same "don't fake support" stance as
  // navigation.js's tolls preference), so a save gets a placeholder label
  // rather than a guessed address; `renameSavedDestination` is how it becomes
  // "Home" instead of "Saved Destination" — see ProfileScreen.vue's inline
  // rename input.
  function addSavedDestination(lat, lng, label = 'Saved Destination') {
    const entry = { id: crypto.randomUUID(), label, lat, lng }
    savedDestinations.value = [...savedDestinations.value, entry]
    persist()
    return entry
  }

  function removeSavedDestination(id) {
    savedDestinations.value = savedDestinations.value.filter(d => d.id !== id)
    persist()
  }

  function renameSavedDestination(id, label) {
    const entry = savedDestinations.value.find(d => d.id === id)
    if (!entry) return
    entry.label = label
    persist()
  }

  // Used by HudOverlay.vue's save-star toggle to show filled/hollow without
  // needing its own id-tracking — floating-point lat/lng from two different
  // sources (a fresh OSRM-adjacent tap vs. a stored value) are compared with
  // a small tolerance rather than exact equality.
  function findSavedDestinationNear(lat, lng, epsilon = 0.0001) {
    return savedDestinations.value.find(
      d => Math.abs(d.lat - lat) < epsilon && Math.abs(d.lng - lng) < epsilon,
    ) ?? null
  }

  return {
    classes, party, savedDestinations,
    progressFor, levelOf, xpProgressOf,
    recordAbilityUsed, recordPOIsDiscovered, recordTripCompleted,
    powerMultiplier, cooldownMultiplier,
    addPartyMember, removePartyMember,
    addSavedDestination, removeSavedDestination, renameSavedDestination, findSavedDestinationNear,
  }
})
