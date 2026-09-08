import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

// Overridable via VITE_OSRM_BASE/VITE_OVERPASS_BASE (see .env.example) so
// pointing this at a self-hosted instance before real traffic is a config
// change, not a code change. Unset in dev, where these fall back to the
// public demo servers — no-API-key, but rate-limited, no uptime guarantee,
// and explicitly not for production use per OSRM's own docs; the Overpass
// mirror is the same story. See Navigation.md's known gaps.
const OSRM_BASE     = import.meta.env.VITE_OSRM_BASE ?? 'https://router.project-osrm.org/route/v1/driving'
const OVERPASS_BASE = import.meta.env.VITE_OVERPASS_BASE ?? 'https://overpass-api.de/api/interpreter'
const DEST_KEY = 'crystalpath-destination'
const WAYPOINTS_KEY = 'crystalpath-waypoints'
// One retry, after a short delay, before a route fetch gives up and surfaces
// `routeError` — the public OSRM demo server is flaky enough (timeouts,
// occasional rate limiting) that a single retry clears most transient
// failures without looping indefinitely against a real outage.
const ROUTE_RETRY_DELAY_MS = 1500
// How long the Sovereign archetype's privacy ability keeps live position
// tracking paused for — see goDark() below. Exported so MapScreen.vue can
// scale it by the profile store's power multiplier before passing an
// override to goDark(), the same way it scales the Adventurer's reveal radius.
export const PRIVACY_BLACKOUT_MS = 6000
// How close counts as "arrived" — see the position watcher below. Real GPS
// jitter on foot/in a car is easily 10-20m, so this has to be generous enough
// not to miss an arrival, not so generous it fires a block early.
const ARRIVAL_RADIUS_M = 40

// OSRM natively supports more than two coordinates in one request — a
// multi-stop trip is just a longer semicolon-separated list, and its
// response already comes back with one `legs[]` entry per hop. analyzeRoute()
// and flattenSteps() below already walk `route.legs` generically, so neither
// needed any change to support this; only the URL construction and the
// waypoint list itself are new.
function buildCoordsString(origin, waypointList, dest) {
  return [origin, ...waypointList, dest].map(p => `${p.lng},${p.lat}`).join(';')
}

function haversineMeters(a, b) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// Route selection from the Speedrunner-family's `priority`/`avoid`
// personalization preferences (Thief's routing questionnaire — see
// classes.js's `personalization` config). The public OSRM demo server can't
// actually honor these natively: every `exclude=` value it's asked for comes
// back `"Exclude flag combination is not supported."`, and the `walking`/
// `cycling` profile segments silently return identical driving-only results
// instead of routing differently. So none of this happens server-side —
// `fetchRoute()`/`attemptReroute()` ask for `alternatives=true&steps=true`
// and this scores the candidates client-side using real step data (maneuver
// types for turn counts, `ref`/`name` for a highway heuristic) instead.
// `tolls` has no equivalent left to detect from — OSRM's route API doesn't
// expose toll status per step in this dataset — so it's collected as a
// preference but has no effect; see Navigation.md's known gaps.
// OSRM's `ref` field uses a space, not a hyphen, for interstate/US-route
// numbers ("I 676", "US 30") — confirmed against the live public server,
// not assumed, since a hyphen-only pattern would silently never match.
const HIGHWAY_PATTERN = /\b(I[-\s]?\d+|US[-\s]?\d+|Interstate|Expressway|Freeway|Turnpike|Motorway)\b/i
const NON_TURN_MANEUVERS = new Set(['depart', 'arrive', 'continue', 'new name'])

// Turn-by-turn (Direction F, phase 2). OSRM's `steps=true` response is
// already being fetched for analyzeRoute()/pickRoute()'s scoring above —
// this reuses the exact same data instead of a second request, just keeps
// it around afterward instead of discarding it once scoring is done.
function flattenSteps(route) {
  return (route.legs ?? []).flatMap(leg => leg.steps ?? [])
}

function maneuverLatLng(step) {
  const [lng, lat] = step.maneuver.location
  return { lat, lng }
}

// OSRM's route API returns maneuver.type/modifier, not a ready-made English
// sentence (that needs a language plugin the public demo doesn't run) — same
// "build our own small mapping instead of assuming server support" approach
// pickRoute()'s highway/ferry detection already takes. Deliberately terse:
// this is read at a glance, not read in full, per the driver-attention
// principle everywhere else in this app.
function describeManeuver(step) {
  const { type, modifier } = step.maneuver
  const name = step.name || null
  const onward = name ? ` onto ${name}` : ''
  switch (type) {
    case 'arrive':    return 'Arrive at your destination'
    case 'depart':    return `Head onto ${name || 'the route'}`
    case 'roundabout':
    case 'rotary':    return `Enter the roundabout${step.maneuver.exit ? `, take exit ${step.maneuver.exit}` : ''}`
    case 'merge':     return `Merge${onward}`
    case 'fork':      return `Keep ${modifier || 'straight'} at the fork${onward}`
    case 'turn':
      if (modifier === 'straight') return `Continue${onward}`
      if (modifier === 'uturn')    return `Make a U-turn${onward}`
      return `Turn ${modifier || ''}${onward}`.replace(/\s+/g, ' ').trim()
    case 'continue':
    case 'new name':  return `Continue${onward}`
    default:          return onward ? `Continue${onward}` : 'Continue'
  }
}

// Buckets OSRM's 8 modifiers down to the handful of icons actually worth
// drawing distinctly — see maneuverIcons.js. Nuance ("slight" vs "sharp")
// stays in the text, not the icon; a pixel arrow can't read that finely at
// HUD size anyway.
function maneuverIconKey(step) {
  const { type, modifier } = step.maneuver
  if (type === 'arrive') return 'arrive'
  if (type === 'roundabout' || type === 'rotary') return 'roundabout'
  if (type === 'merge') return 'merge'
  if (modifier === 'uturn') return 'uturn'
  if (modifier && modifier.includes('left')) return 'left'
  if (modifier && modifier.includes('right')) return 'right'
  return 'straight'
}

// How close counts as "you've reached this maneuver, start counting down to
// the next one." A threshold-based advance, not full map-matching (projecting
// live position onto the route polyline) — a meaningfully bigger algorithm
// than this pass needs; honest about being an approximation the same way
// pickRoute()'s highway/ferry regexes are.
const STEP_ADVANCE_RADIUS_M = 30

function analyzeRoute(route) {
  let turns = 0
  let highwaySteps = 0
  let ferrySteps = 0
  for (const leg of route.legs ?? []) {
    for (const step of leg.steps ?? []) {
      if (step.maneuver?.type && !NON_TURN_MANEUVERS.has(step.maneuver.type)) turns++
      const ref  = step.ref ?? ''
      const name = step.name ?? ''
      if (HIGHWAY_PATTERN.test(ref) || HIGHWAY_PATTERN.test(name)) highwaySteps++
      // "contains the word ferry" over-matches real street names that happen
      // to include it (confirmed against live data: "Grays Ferry Avenue" is
      // an ordinary street, not a ferry crossing) — requiring "ferry" as the
      // route's own mode/class would need OSRM's `annotations` data, which
      // the public demo doesn't expose per-step. This heuristic is a
      // deliberate false-positive-prone stand-in, not a precise detector.
      if (/\bferry\b/i.test(name) && !/ferry\s+(ave|avenue|st|street|rd|road|dr|drive|ln|lane)\b/i.test(name)) ferrySteps++
    }
  }
  return { route, turns, highwaySteps, ferrySteps, distance: route.distance, duration: route.duration }
}

// `prefs` is Thief-family's raw `{ priority, avoid }` shape (or `undefined`/
// `{}` for every other class, which no-ops back to plain "fastest" — OSRM's
// own default ordering — so this is a pure addition for classes that never
// ask these questions, not a behavior change for them).
function pickRoute(routes, prefs = {}) {
  let candidates = routes.map(analyzeRoute)
  const avoid = prefs.avoid ?? []
  if (avoid.includes('highways')) {
    const clean = candidates.filter(c => c.highwaySteps === 0)
    if (clean.length) candidates = clean // only narrow if it doesn't eliminate every option
  }
  if (avoid.includes('ferries')) {
    const clean = candidates.filter(c => c.ferrySteps === 0)
    if (clean.length) candidates = clean
  }
  const priority = prefs.priority ?? 'fastest'
  const sortKey = priority === 'shortest' ? 'distance' : priority === 'fewest_turns' ? 'turns' : 'duration'
  candidates.sort((a, b) => a[sortKey] - b[sortKey])
  return candidates[0].route
}

export const useNavigationStore = defineStore('navigation', () => {
  // Persisted — unlike `position` (see the table in Navigation.md: a stale
  // position on refresh is actively wrong, not just inconvenient), a stale
  // *destination* is still the place the player was headed. Restoring it and
  // re-fetching the route once a fresh position fix arrives (see MapScreen.vue's
  // position watcher) is strictly better than silently losing the trip on
  // every accidental reload.
  const savedDest = localStorage.getItem(DEST_KEY)
  const destination = ref(savedDest ? JSON.parse(savedDest) : null) // { lat, lng } | null

  // Direction F, phase 3: multi-stop routes. Waypoints are intermediate
  // stops between the current position and `destination` — `destination`
  // itself stays the single, final stop everywhere else in the app already
  // assumes one (the destination marker, the saved-destination star,
  // arrival XP), so this is purely additive rather than replacing that
  // concept with an array. Persisted the same way `destination` is, for the
  // same reason: a reload mid-multi-stop-trip should restore the plan, not
  // silently drop it back to a single leg.
  const savedWaypoints = localStorage.getItem(WAYPOINTS_KEY)
  const waypoints = ref(savedWaypoints ? JSON.parse(savedWaypoints) : []) // [{ id, lat, lng }, ...], in visiting order

  const position    = ref(null)  // { lat, lng }
  // Direction/heading of travel in degrees, `null` when the device hasn't
  // reported one yet (stationary, indoors, no compass) — most browsers only
  // populate `coords.heading` while actually moving at a meaningful speed,
  // so `null` is the common case at rest, not an error. MapScreen.vue's user
  // marker falls back to pointing north when this is `null`, a disclosed
  // simplification rather than a claim of accuracy with no data behind it.
  const heading     = ref(null)
  const route       = ref([])    // [ [lng, lat], ... ] — GeoJSON coordinate order
  const eta         = ref(null)  // seconds
  const watcherId   = ref(null)
  const pois        = ref([])    // [{ id, lat, lng, name, category }, ...] — revealed by the Adventurer archetype's ability
  const revealing   = ref(false)
  const rerouting   = ref(false)
  const fetchingRoute = ref(false) // guards fetchRoute() against overlapping calls — see its own comment
  const shareStatus = ref(null)  // transient feedback string for the Connector archetype's ability — see shareETA()
  let shareStatusTimer = null
  const routeError  = ref(null)  // transient feedback when fetchRoute() fails even after its retry
  let routeErrorTimer = null
  const privacyActive = ref(false) // true for the duration of a goDark() blackout
  let privacyTimer = null
  const routeDistanceMeters = ref(null) // OSRM's `distance` field for the current route — used to size trip-completion XP
  const tripJustCompleted   = ref(null) // { distanceMeters } | null — see the position watcher and acknowledgeTripCompletion() below
  // Milestone 8, phase 1: pickups. One-shot signal, same pattern as
  // tripJustCompleted — MapScreen.vue reads it once (to award XP with the
  // real POI name/category) and acknowledges it, rather than this store
  // guessing at a message to show.
  const pickupJustCollected = ref(null) // { id, name, category } | null

  // Turn-by-turn state. `steps` is the flattened OSRM steps array for the
  // *current* route (cleared/replaced whenever `route` itself is); nothing
  // external should need to touch `currentStepIndex` directly, hence
  // `currentManeuver` (below) as the only piece of this actually exposed.
  const steps            = ref([])
  const currentStepIndex = ref(0)

  // Single source of truth for persisting `destination` — every path that
  // sets it (setDestination(), the arrival watcher, goDark(), reset()) just
  // assigns `destination.value` directly and this keeps localStorage in sync
  // automatically, rather than each of those call sites needing to remember
  // to persist/clear it themselves.
  watch(destination, (dest) => {
    if (dest) localStorage.setItem(DEST_KEY, JSON.stringify(dest))
    else localStorage.removeItem(DEST_KEY)
  })

  watch(waypoints, (wps) => {
    if (wps.length) localStorage.setItem(WAYPOINTS_KEY, JSON.stringify(wps))
    else localStorage.removeItem(WAYPOINTS_KEY)
  }, { deep: true })

  // The prefs a caller most recently supplied to fetchRoute()/setDestination()
  // — remembered (not reactive, just a closure variable) so the two
  // internally-triggered refetches below (reaching a waypoint, adding/
  // removing one) can pass *something* sensible to pickRoute() without this
  // store reaching into player.js for `store.preferences` itself. Every other
  // cross-store value here (prefs, interestText, party) is still passed in by
  // the caller for the *first* fetch of any given action; this only covers
  // the refetches this store triggers on its own afterward.
  let lastPrefs = {}

  const hasRoute = computed(() => route.value.length > 0)
  const etaFormatted = computed(() => {
    if (eta.value == null) return null
    const mins = Math.round(eta.value / 60)
    return mins < 1 ? '<1 min' : `${mins} min`
  })

  // The one piece of turn-by-turn state anything outside this store reads —
  // TurnByTurnBanner.vue renders exactly this shape. `null` whenever there's
  // no route or no position fix yet (nothing meaningful to show either way).
  const currentManeuver = computed(() => {
    if (!steps.value.length) return null
    const step = steps.value[Math.min(currentStepIndex.value, steps.value.length - 1)]
    const distanceMeters = position.value
      ? Math.round(haversineMeters(position.value, maneuverLatLng(step)))
      : Math.round(step.distance ?? 0)
    return {
      iconKey:       maneuverIconKey(step),
      instruction:   describeManeuver(step),
      distanceMeters,
      isArrival:     step.maneuver.type === 'arrive',
    }
  })

  // Advances currentStepIndex once live position closes to within
  // STEP_ADVANCE_RADIUS_M of the maneuver it's currently counting down to —
  // see that constant's comment for why this is threshold-based rather than
  // full map-matching. Index 0 (OSRM's "depart" step, not yet an actionable
  // instruction) is skipped whenever there's at least one real maneuver
  // after it, so the banner never opens by announcing the step you're
  // already standing on.
  watch([position, steps], ([pos, stepList]) => {
    if (!pos || !stepList.length) return
    if (currentStepIndex.value === 0 && stepList.length > 1) currentStepIndex.value = 1
    while (
      currentStepIndex.value < stepList.length - 1 &&
      haversineMeters(pos, maneuverLatLng(stepList[currentStepIndex.value])) <= STEP_ADVANCE_RADIUS_M
    ) {
      currentStepIndex.value++
    }
  })

  function setPosition(latLng) {
    position.value = latLng
  }

  function startWatching() {
    if (watcherId.value != null || !navigator.geolocation) return
    watcherId.value = navigator.geolocation.watchPosition(
      (pos) => {
        position.value = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        const h = pos.coords.heading
        heading.value = (h == null || Number.isNaN(h)) ? null : h
      },
      // A denied/unavailable permission previously failed silently — the map
      // just never got a position and nothing on screen said why. This reuses
      // the same routeError toast channel rather than inventing a second
      // transient-message ref, since both are "something backend-ish failed,
      // here's a line of text" cases MapScreen.vue already renders identically.
      (err) => {
        setRouteError(
          err?.code === 1 /* PERMISSION_DENIED */
            ? 'Location access denied — enable it to navigate.'
            : 'Could not get your location.'
        )
      },
      { enableHighAccuracy: true },
    )
  }

  function stopWatching() {
    if (watcherId.value == null) return
    navigator.geolocation.clearWatch(watcherId.value)
    watcherId.value = null
  }

  function setRouteError(message) {
    routeError.value = message
    if (routeErrorTimer) clearTimeout(routeErrorTimer)
    routeErrorTimer = setTimeout(() => { routeError.value = null }, 5000)
  }

  // `_isRetry` is an internal flag (not part of the public call signature any
  // caller should pass) — a bare fetchRoute(origin, dest, prefs) call from
  // MapScreen.vue always starts a fresh attempt. `fetchingRoute` guards
  // against overlapping calls (e.g. a position update landing while a
  // destination-tap fetch is already in flight) rather than queueing or
  // cancelling them — the public demo server is slow enough under load that
  // a dropped duplicate is preferable to two races updating `route` out of
  // order.
  async function fetchRoute(origin, dest, prefs = {}, _isRetry = false) {
    if (fetchingRoute.value) return
    fetchingRoute.value = true
    lastPrefs = prefs
    try {
      const url = `${OSRM_BASE}/${buildCoordsString(origin, waypoints.value, dest)}?overview=full&geometries=geojson&steps=true&alternatives=true`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`OSRM responded ${res.status}`)
      const data = await res.json()
      const routes = data.routes ?? []
      if (!routes.length) throw new Error('No route found')
      const best = pickRoute(routes, prefs)
      route.value = best.geometry.coordinates
      eta.value   = best.duration
      routeDistanceMeters.value = best.distance ?? null
      steps.value = flattenSteps(best)
      currentStepIndex.value = 0
      routeError.value = null
    } catch (err) {
      if (!_isRetry) {
        fetchingRoute.value = false
        await new Promise(r => setTimeout(r, ROUTE_RETRY_DELAY_MS))
        await fetchRoute(origin, dest, prefs, true)
        return
      }
      setRouteError('Could not calculate a route. Tap the map to try again.')
    } finally {
      fetchingRoute.value = false
    }
  }

  // `prefs` is passed in by the caller (MapScreen.vue, reading the player
  // store's `preferences`) rather than read from another store directly here
  // — this store stays independent of `player.js`, same convention as
  // `revealPOIs(radiusMeters)` taking its radius as a parameter instead of
  // reaching into `chosenClass` itself.
  async function setDestination(latLng, prefs = {}) {
    destination.value = latLng
    // A fresh destination starts a fresh trip — any stops planned for the
    // *previous* destination don't carry over to this one. Add stops to the
    // current trip via addWaypoint() afterward, same as always.
    waypoints.value = []
    if (position.value) await fetchRoute(position.value, latLng, prefs)
  }

  // Adds an intermediate stop to the current trip and re-fetches immediately
  // — no-ops without a destination already set, since a waypoint only means
  // anything relative to a trip that's already going somewhere.
  async function addWaypoint(latLng) {
    if (!destination.value) return
    waypoints.value = [...waypoints.value, { id: crypto.randomUUID(), lat: latLng.lat, lng: latLng.lng }]
    if (position.value) await fetchRoute(position.value, destination.value, lastPrefs)
  }

  async function removeWaypoint(id) {
    waypoints.value = waypoints.value.filter(w => w.id !== id)
    if (position.value && destination.value) await fetchRoute(position.value, destination.value, lastPrefs)
  }

  // Arrival detection — a real navigation feature this store never had: every
  // position update checks distance-to-destination, and closing to within
  // ARRIVAL_RADIUS_M counts as a completed trip. `tripJustCompleted` is a
  // one-shot signal (not a toast-style auto-clearing ref like shareStatus)
  // because whoever's listening — MapScreen.vue, to award XP — needs to read
  // `distanceMeters` off it before it's gone; the caller acknowledges it
  // explicitly via acknowledgeTripCompletion() once it has.
  // Watches both refs, not just `position` — a destination set somewhere
  // already close by (you click your own block) should count as arrived too,
  // not only a position update that later closes the gap.
  watch([position, destination], ([pos, dest]) => {
    if (!pos || !dest) return
    if (haversineMeters(pos, dest) <= ARRIVAL_RADIUS_M) {
      tripJustCompleted.value = { distanceMeters: routeDistanceMeters.value ?? haversineMeters(pos, dest) }
      destination.value = null
      waypoints.value = []
      route.value = []
      eta.value = null
      routeDistanceMeters.value = null
      steps.value = []
      currentStepIndex.value = 0
    }
  })

  // Reaching an intermediate stop is not finishing the trip — no XP, no
  // tripJustCompleted, just quietly drop it from the pending list and
  // re-fetch toward whatever's left, the same "no popup, just keep going"
  // spirit as the Speedrunner archetype's silent reroute. Only the *final*
  // destination (the watcher above) completes a trip.
  watch([position, waypoints], ([pos, wps]) => {
    if (!pos || !wps.length) return
    if (haversineMeters(pos, wps[0]) <= ARRIVAL_RADIUS_M) {
      waypoints.value = wps.slice(1)
      if (destination.value) fetchRoute(pos, destination.value, lastPrefs)
    }
  })

  // Milestone 8, phase 1: pickups. `revealPOIs()` (the Adventurer archetype's
  // ability) puts real POIs on the map, but until now nothing happened once
  // you actually reached one — this closes that loop. Only ever collects one
  // per position update (`.find`, not every POI within range at once) so a
  // dense cluster of revealed POIs doesn't fire a burst of simultaneous
  // pickups the instant a sweep lands near several at once.
  watch([position, pois], ([pos, poiList]) => {
    if (!pos || !poiList.length) return
    const hit = poiList.find(p => haversineMeters(pos, p) <= ARRIVAL_RADIUS_M)
    if (hit) {
      pois.value = poiList.filter(p => p.id !== hit.id)
      pickupJustCollected.value = { id: hit.id, name: hit.name, category: hit.category }
    }
  })

  function acknowledgeTripCompletion() {
    tripJustCompleted.value = null
  }

  function acknowledgePickupCollected() {
    pickupJustCollected.value = null
  }

  // Keyword → extra Overpass node filter, for the Adventurer archetype's
  // open-ended "what places call to you?" personalization question (Fighter's
  // `destinations` answer — see classes.js). Food/shop interest needs nothing
  // extra since amenity/shop are already in the baseline query below; nature
  // and history aren't, so a Fighter who wrote "hidden trails, forgotten
  // ruins" actually gets more park/historic results, not just the same
  // generic sweep re-labeled.
  const INTEREST_FILTERS = [
    { words: ['trail', 'hike', 'hiking', 'mountain', 'nature', 'park', 'outdoor', 'forest', 'river', 'lake', 'peak'],
      clause: (r, lat, lng) => `node["leisure"="park"](around:${r},${lat},${lng});node["natural"](around:${r},${lat},${lng});` },
    { words: ['ruin', 'ruins', 'history', 'historic', 'ancient', 'monument', 'landmark', 'castle'],
      clause: (r, lat, lng) => `node["historic"](around:${r},${lat},${lng});` },
  ]

  // Adventurer archetype's ability (SCOUT/SCAN/TRAILBLAZE/SPYGLASS): sweeps a
  // radius around the current position for real POIs via the Overpass API and
  // merges any newly-found ones into `pois`. Silently no-ops without a position
  // fix or on a network/API failure — a failed sweep just finds nothing, rather
  // than surfacing an error for what's a flavor ability, not a critical path.
  // `interestText` is Fighter's free-text `destinations` answer, if any (every
  // other class either has no personalization yet or asks different
  // questions — this is `undefined`/`''` for all of them, which just means no
  // extra filters get appended, not an error).
  async function revealPOIs(radiusMeters, interestText = '') {
    if (!position.value || revealing.value) return 0
    revealing.value = true
    try {
      const { lat, lng } = position.value
      const lowerInterest = interestText.toLowerCase()
      const extraClauses = INTEREST_FILTERS
        .filter(f => f.words.some(w => lowerInterest.includes(w)))
        .map(f => f.clause(radiusMeters, lat, lng))
        .join('')
      const query = `[out:json][timeout:10];(node["amenity"](around:${radiusMeters},${lat},${lng});node["shop"](around:${radiusMeters},${lat},${lng});node["tourism"](around:${radiusMeters},${lat},${lng});${extraClauses});out body 40;`
      const res  = await fetch(OVERPASS_BASE, { method: 'POST', body: `data=${encodeURIComponent(query)}` })
      const data = await res.json()
      const known = new Set(pois.value.map(p => p.id))
      const found = (data.elements ?? [])
        .filter(el => !known.has(el.id))
        .map(el => ({
          id: el.id,
          lat: el.lat,
          lng: el.lon,
          name: el.tags?.name ?? null,
          category: el.tags?.amenity ?? el.tags?.shop ?? el.tags?.tourism ?? el.tags?.historic ?? el.tags?.leisure ?? el.tags?.natural ?? 'poi',
        }))
      pois.value = [...pois.value, ...found]
      return found.length
    } catch {
      // Overpass demo instance is rate-limited and occasionally flaky — see the
      // comment on OVERPASS_BASE above. Nothing revealed this sweep is an
      // acceptable failure mode; the ability button un-cools on its own timer
      // regardless, so the player can just try again.
      return 0
    } finally {
      revealing.value = false
    }
  }

  // Speedrunner archetype's ability (SHADOW STEP/JUMP DRIVE/BACKTRAIL/FULL
  // SAIL): re-asks OSRM for the current origin→destination pair with
  // `alternatives=true` and, if it offers a route geometrically different
  // from the one currently drawn, silently swaps to it — no prompt, matching
  // the ability's flavor text. Returns whether a swap actually happened, so
  // `MapScreen.vue` knows whether to play the reroute's route-line flash.
  // OSRM's demo server doesn't factor in live traffic, so this isn't really
  // "found a faster route" so much as "found a different one" — the same
  // practical effect (a new line appears without asking) for a lot less
  // infrastructure than a live-traffic feed would need. Still honors `prefs`
  // (see pickRoute() above) when choosing *which* different route to switch
  // to, not just whether one exists.
  async function attemptReroute(prefs = {}) {
    if (!position.value || !destination.value || rerouting.value) return false
    rerouting.value = true
    lastPrefs = prefs
    try {
      const dest = destination.value
      // Includes whatever stops are still pending — a reroute mid-multi-stop
      // trip needs to keep visiting them, not silently drop straight to the
      // final destination.
      const url = `${OSRM_BASE}/${buildCoordsString(position.value, waypoints.value, dest)}?overview=full&geometries=geojson&steps=true&alternatives=true`
      const res  = await fetch(url)
      const data = await res.json()
      const routes = data.routes ?? []
      if (routes.length < 2) return false
      const currentKey = JSON.stringify(route.value)
      const different = routes.filter(r => JSON.stringify(r.geometry.coordinates) !== currentKey)
      if (!different.length) return false
      const alt = pickRoute(different, prefs)
      route.value = alt.geometry.coordinates
      eta.value   = alt.duration
      routeDistanceMeters.value = alt.distance ?? null
      // A reroute mid-trip needs its turn-by-turn state reset too — the old
      // steps array belongs to a route that's no longer being followed, and
      // resuming from index 0 (skipped up to 1 by the watcher above on the
      // very next position update) is simpler and safer than trying to guess
      // which of the new route's steps correspond to progress already made.
      steps.value = flattenSteps(alt)
      currentStepIndex.value = 0
      return true
    } catch {
      return false
    } finally {
      rerouting.value = false
    }
  }

  function setShareStatus(message) {
    shareStatus.value = message
    if (shareStatusTimer) clearTimeout(shareStatusTimer)
    shareStatusTimer = setTimeout(() => { shareStatus.value = null }, 3000)
  }

  // Connector archetype's ability (CURE/UPLINK/SIGNAL FIRE/SIGNAL FLAG):
  // "one-tap ETA share with any party member." There's still no backend to
  // run a real party roster against — this still hands off to whatever the
  // device already offers for reaching another person, the OS share sheet
  // (`navigator.share`) when available, falling back to a clipboard copy —
  // but the message itself now addresses the roster by name (`party`, the
  // profile store's local `party` array, passed in by the caller the same
  // way `prefs`/`interestText` are elsewhere in this store) when there's
  // anyone in it, rather than being generic regardless. `shareStatus` carries
  // transient feedback for the fallback path, since a clipboard copy has no
  // OS-level confirmation UI of its own.
  async function shareETA(party = []) {
    if (!position.value) {
      setShareStatus('No position yet.')
      return
    }
    const mapsUrl = destination.value
      ? `https://www.google.com/maps/dir/?api=1&destination=${destination.value.lat},${destination.value.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${position.value.lat},${position.value.lng}`
    const greeting = party.length === 0 ? ''
      : party.length === 1 ? `${party[0].name} — `
      : `${party[0].name} & co. — `
    const text = etaFormatted.value
      ? `${greeting}I'm on my way — ETA ${etaFormatted.value}.`
      : `${greeting}I'm on my way.`

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Crystal Path', text, url: mapsUrl })
        setShareStatus('Shared.')
      } catch (err) {
        if (err?.name !== 'AbortError') setShareStatus('Could not share.')
      }
      return
    }
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(`${text} ${mapsUrl}`)
        setShareStatus('Copied to clipboard.')
      } catch {
        setShareStatus('Could not copy.')
      }
      return
    }
    setShareStatus('Sharing not supported on this device.')
  }

  // Sovereign archetype's ability (FIRE/PURGE/VANISH/SCUTTLE): "wipes your
  // trail data, non-negotiable." Unlike the other three archetypes this
  // doesn't need a network call — everything it erases is already sitting in
  // this store. Clears the revealed-POI trail, the current route/destination
  // (the visible path across the map), and the position fix itself, then
  // pauses live tracking for `durationMs` — the player's own marker actually
  // disappears from the map for that stretch (MapScreen.vue removes it when
  // `position` goes null), which is the most literal reading of "vanish" /
  // "scuttle" available without inventing something to fake.
  function goDark(durationMs = PRIVACY_BLACKOUT_MS) {
    pois.value        = []
    destination.value = null
    waypoints.value   = []
    route.value       = []
    eta.value         = null
    position.value    = null
    heading.value     = null
    routeDistanceMeters.value = null
    steps.value       = []
    currentStepIndex.value = 0
    stopWatching()
    privacyActive.value = true
    if (privacyTimer) clearTimeout(privacyTimer)
    privacyTimer = setTimeout(() => {
      privacyActive.value = false
      startWatching()
    }, durationMs)
  }

  function reset() {
    stopWatching()
    position.value    = null
    heading.value     = null
    destination.value = null
    waypoints.value   = []
    route.value       = []
    eta.value         = null
    pois.value        = []
    routeDistanceMeters.value = null
    tripJustCompleted.value   = null
    pickupJustCollected.value = null
    steps.value       = []
    currentStepIndex.value = 0
    if (shareStatusTimer) clearTimeout(shareStatusTimer)
    shareStatus.value = null
    if (routeErrorTimer) clearTimeout(routeErrorTimer)
    routeError.value = null
    fetchingRoute.value = false
    if (privacyTimer) clearTimeout(privacyTimer)
    privacyActive.value = false
  }

  return {
    position, heading, destination, waypoints, route, eta, pois, revealing, rerouting, fetchingRoute,
    shareStatus, routeError, privacyActive,
    routeDistanceMeters, tripJustCompleted, pickupJustCollected,
    hasRoute, etaFormatted, currentManeuver,
    setPosition, startWatching, stopWatching, setDestination, fetchRoute,
    addWaypoint, removeWaypoint,
    revealPOIs, attemptReroute, shareETA, goDark,
    acknowledgeTripCompletion, acknowledgePickupCollected, reset,
  }
})
