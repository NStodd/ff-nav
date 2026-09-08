<template>
  <div class="map-screen">
    <div ref="mapEl" class="map-mount" />

    <button class="start-over" @click="startOver">&#8592; START OVER</button>
    <button class="profile-link" @click="router.push({ name: 'profile', params: { genreId: store.chosenGenre.id } })">PROFILE &#9658;</button>

    <!-- Direction F, phase 3: multi-stop routes. A toggle rather than a
         drag-drop map picker — arm it, then the next map tap adds a stop
         instead of replacing the destination. Placed below the top ~130px
         band the Android re-verification pass flagged as unreliable to tap
         on-device (see PRODUCTION.md), not stacked with start-over/profile. -->
    <button v-if="navigation.hasRoute" class="add-stop" :class="{ armed: addingStop }" @click="addingStop = !addingStop">
      {{ addingStop ? 'TAP MAP TO ADD ✕' : '+ ADD STOP' }}
    </button>

    <div v-if="navigation.waypoints.length" class="waypoint-chips">
      <div v-for="(wp, i) in navigation.waypoints" :key="wp.id" class="waypoint-chip">
        <span>{{ i + 1 }}</span>
        <button @click="navigation.removeWaypoint(wp.id)" aria-label="Remove stop">&times;</button>
      </div>
    </div>

    <!-- Milestone 6: one reusable Toast, rendered twice — a status lane
         (share/route-error feedback, routeError taking priority since the
         two already shared this slot before this pass) and a growth lane
         (XP), rather than three near-identical bespoke blocks. -->
    <Toast :text="statusToastText" :tone="statusToastTone" :color="store.chosenClass.color" top="1rem" />
    <Toast :text="xpToast" tone="gold" top="3.4rem" />

    <HudOverlay @ability="onAbility" :cooldownMs="cooldownMs" />
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Map as MapLibreMap, Marker, Popup, NavigationControl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { usePlayerStore } from '@/stores/player.js'
import { useNavigationStore, PRIVACY_BLACKOUT_MS } from '@/stores/navigation.js'
import { useProfileStore } from '@/stores/profile.js'
import { iconForCategory } from '@/data/poiIcons.js'
import { iconForManeuver } from '@/data/maneuverIcons.js'
import { questsForGenre, isQuestComplete } from '@/data/quests.js'
import { MAP_LAYER_GROUPS } from '@/data/mapLayerGroups.js'
import { worldSkinFor, applyWorldSkin } from '@/data/worldSkins.js'
import HudOverlay from '@/components/HudOverlay.vue'
import Toast from '@/components/Toast.vue'

// Free, no-API-key vector basemap. See Navigation.md for attribution requirements
// and how to swap this for a self-hosted style later.
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

// Arbitrary placeholder center used only until the first real position fix arrives.
const FALLBACK_CENTER = [-75.1652, 39.9526]

const ROUTE_SOURCE_ID = 'route'
const ROUTE_LAYER_ID  = 'route-line'

const router      = useRouter()
const store       = usePlayerStore()
const navigation  = useNavigationStore()
const profile     = useProfileStore()

const BASE_ABILITY_COOLDOWN_MS = 4000

// Stats-have-real-effect layer: AGI shortens the cooldown, STR scales an
// ability's magnitude (reveal radius, privacy blackout duration), and both
// also grow with the class's level — see profile.js for the formulas. Reads
// reactively off `profile.classes` (XP awarded elsewhere in this file mutates
// it in place), so leveling up mid-session changes these immediately.
const cooldownMs = computed(() => Math.round(
  BASE_ABILITY_COOLDOWN_MS * profile.cooldownMultiplier(store.chosenClass.id, store.chosenClass),
))

// Milestone 6: the two messages that share Toast's "status" slot — a route
// failure is strictly more important than routine share feedback, so it
// wins the slot outright rather than the two ever needing to queue.
const statusToastText = computed(() => navigation.routeError ?? navigation.shareStatus)
const statusToastTone = computed(() => navigation.routeError ? 'error' : 'default')

// Direction F, phase 3: whether the next map click adds a waypoint instead
// of replacing the destination — see the "+ ADD STOP" button and the click
// handler in onMounted() below.
const addingStop = ref(false)

const mapEl = ref(null)
let map            = null
let userMarker     = null
let destMarker     = null
let userMarkerAdded = false
let hasCentered     = false
const poiMarkers = new Map() // poi id -> Marker, so revealPOIs() re-renders never duplicate one

// Two-element wrapper (outer/inner) rather than one div: MapLibre applies its
// own positioning `translate()` directly to whatever element it's given —
// the same conflict already noted for POI markers below. Rotating the user
// marker for heading (see the heading watcher near the bottom of this file)
// needs its own transform on a child, not fighting MapLibre's on the same
// element.
function markerEl(color) {
  const outer = document.createElement('div')
  const inner = document.createElement('div')
  inner.className = 'crystal-marker'
  inner.style.setProperty('--cc', color)
  outer.appendChild(inner)
  return outer
}

const POI_ICON_COLOR_MAP = { '2': '#F5CBA7', w: '#FFFFFF', g: '#888888', G: '#F0C060', d: '#333333' }
const POI_ICON_PIXEL_SIZE = 3
const DEST_MARKER_PIXEL_SIZE = 3

// Milestone 6: the destination used to be the exact same square shape as the
// user marker, just recolored gold — indistinguishable at a glance without
// reading color, which also just fails outright for color-blind users. Reuses
// the "arrive" maneuver icon (maneuverIcons.js) — the same pixel-art flag
// glyph turn-by-turn shows for the final instruction, drawn the same way
// poiMarkerEl() below draws POI icons, since a destination pin is
// conceptually the same "you're heading here" idea either way.
function destMarkerEl(color) {
  const icon = iconForManeuver('arrive')
  const canvas = document.createElement('canvas')
  canvas.className = 'dest-marker-canvas'
  const cols = Math.max(...icon.rows.map(r => r.length))
  canvas.width  = cols * DEST_MARKER_PIXEL_SIZE
  canvas.height = icon.rows.length * DEST_MARKER_PIXEL_SIZE
  const ctx = canvas.getContext('2d')
  icon.rows.forEach((row, ri) => {
    for (let ci = 0; ci < row.length; ci++) {
      const ch = row[ci]
      if (ch === '0') continue
      ctx.fillStyle = ch === '1' ? color : (POI_ICON_COLOR_MAP[ch] ?? '#fff')
      ctx.fillRect(ci * DEST_MARKER_PIXEL_SIZE, ri * DEST_MARKER_PIXEL_SIZE, DEST_MARKER_PIXEL_SIZE, DEST_MARKER_PIXEL_SIZE)
    }
  })
  return canvas
}

// Renders the POI's actual category icon (see poiIcons.js) rather than a
// generic marker shape — a café and a museum now look like a café and a
// museum, tinted to the active class's color the same way every other
// marker is. Falls back to POI_ICONS.fallback's sparkle for anything
// Overpass returns that isn't in the category map yet.
function poiMarkerEl(color, category) {
  const icon = iconForCategory(category)
  const canvas = document.createElement('canvas')
  canvas.className = 'poi-marker-canvas'
  canvas.style.setProperty('--cc', color)
  const cols = Math.max(...icon.rows.map(r => r.length))
  canvas.width  = cols * POI_ICON_PIXEL_SIZE
  canvas.height = icon.rows.length * POI_ICON_PIXEL_SIZE
  const ctx = canvas.getContext('2d')
  icon.rows.forEach((row, ri) => {
    for (let ci = 0; ci < row.length; ci++) {
      const ch = row[ci]
      if (ch === '0') continue
      ctx.fillStyle = ch === '1' ? color : (POI_ICON_COLOR_MAP[ch] ?? '#fff')
      ctx.fillRect(ci * POI_ICON_PIXEL_SIZE, ri * POI_ICON_PIXEL_SIZE, POI_ICON_PIXEL_SIZE, POI_ICON_PIXEL_SIZE)
    }
  })
  return canvas
}

function syncPOIs() {
  if (!map) return
  // Full reconciliation, not just additions — the Sovereign archetype's
  // ability wipes `navigation.pois` back to [], and those markers need to
  // actually leave the map, not just stop growing.
  const currentIds = new Set(navigation.pois.map(p => p.id))
  for (const [id, marker] of poiMarkers) {
    if (currentIds.has(id)) continue
    marker.remove()
    poiMarkers.delete(id)
  }
  for (const poi of navigation.pois) {
    if (poiMarkers.has(poi.id)) continue
    const marker = new Marker({ element: poiMarkerEl(store.chosenClass.color, poi.category) })
      .setLngLat([poi.lng, poi.lat])
      .setPopup(new Popup({ offset: 12 }).setText(poi.name ?? poi.category))
      .addTo(map)
    poiMarkers.set(poi.id, marker)
  }
}

function syncRoute() {
  if (!map?.getSource(ROUTE_SOURCE_ID)) return
  map.getSource(ROUTE_SOURCE_ID).setData({
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: navigation.route },
  })
}

// Direction F, phase 3. Numbered rather than a generic pin — order is the
// one piece of information a stop marker actually needs to convey at a
// glance, since the route line itself already shows the path between them.
function waypointMarkerEl(number) {
  const el = document.createElement('div')
  el.className = 'waypoint-marker'
  el.textContent = String(number)
  return el
}

const waypointMarkers = new Map() // waypoint id -> Marker

function syncWaypoints() {
  if (!map) return
  const current = navigation.waypoints
  const currentIds = new Set(current.map(w => w.id))
  for (const [id, marker] of waypointMarkers) {
    if (currentIds.has(id)) continue
    marker.remove()
    waypointMarkers.delete(id)
  }
  current.forEach((wp, i) => {
    const label = String(i + 1)
    if (waypointMarkers.has(wp.id)) {
      // Removing an earlier stop shifts every later one's number — update
      // the existing marker's label in place rather than recreating it.
      const marker = waypointMarkers.get(wp.id)
      if (marker.getElement().textContent !== label) marker.getElement().textContent = label
      marker.setLngLat([wp.lng, wp.lat])
      return
    }
    const marker = new Marker({ element: waypointMarkerEl(label) }).setLngLat([wp.lng, wp.lat]).addTo(map)
    waypointMarkers.set(wp.id, marker)
  })
}

const ROUTE_BASE_WIDTH = 4
let pulseRafId = null

// Speedrunner archetype's ability: a brief, silent flash on the route line —
// no popup, no prompt — when attemptReroute() actually swaps to a different
// route. Purely cosmetic; syncRoute() above already handles the line's data.
function pulseRoute() {
  if (!map?.getLayer(ROUTE_LAYER_ID)) return
  if (pulseRafId) cancelAnimationFrame(pulseRafId)
  const peakWidth = 10
  const duration  = 650
  const start     = performance.now()
  const tick = (now) => {
    const t = Math.min(1, (now - start) / duration)
    map.setPaintProperty(ROUTE_LAYER_ID, 'line-width', peakWidth - (peakWidth - ROUTE_BASE_WIDTH) * t)
    if (t < 1) {
      pulseRafId = requestAnimationFrame(tick)
    } else {
      pulseRafId = null
    }
  }
  pulseRafId = requestAnimationFrame(tick)
}

onMounted(() => {
  navigation.startWatching()

  map = new MapLibreMap({
    container: mapEl.value,
    style: MAP_STYLE,
    center: navigation.position ? [navigation.position.lng, navigation.position.lat] : FALLBACK_CENTER,
    zoom: 13,
  })
  map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right')

  map.on('load', () => {
    // §9 world-skinning, phase 2: apply the FF pilot palette from
    // worldSkins.js (see PLANNING.md §31) directly to the live map, not
    // just /dev/map. A no-op for every genre besides FF today —
    // worldSkinFor() returns null for the other three until they get their
    // own palette, so this line does nothing for them, same as before this
    // existed. No watcher needed: the chosen genre is fixed for the life
    // of this screen (changing it means starting over, which unmounts
    // this component entirely), so a one-time apply on load is enough.
    applyWorldSkin(map, MAP_LAYER_GROUPS, worldSkinFor(store.chosenGenre.id))

    // `lineMetrics: true` is required for `line-gradient` below (it needs
    // per-vertex distance-along-the-line data) — decided via /dev/map's
    // side-by-side comparison against a flat line and a width-taper variant;
    // the plain gradient won for being an equally clear directional cue
    // without either option's downsides (no added motion, and no thin,
    // hard-to-see segment at the origin end the way the taper had).
    map.addSource(ROUTE_SOURCE_ID, {
      type: 'geojson',
      lineMetrics: true,
      data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } },
    })
    map.addLayer({
      id: ROUTE_LAYER_ID,
      type: 'line',
      source: ROUTE_SOURCE_ID,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-width':    4,
        'line-opacity':  0.9,
        // Muted near the origin (already traveled), full class color at the
        // destination end (ahead) — a static fade, not an animation, so it
        // adds a directional cue without adding motion to compete for a
        // driver's attention.
        'line-gradient': [
          'interpolate', ['linear'], ['line-progress'],
          0, 'rgba(255, 255, 255, 0.2)',
          1, store.chosenClass.color,
        ],
      },
    })
    syncRoute()
  })

  map.on('click', (e) => {
    const latLng = { lat: e.lngLat.lat, lng: e.lngLat.lng }
    if (addingStop.value) {
      // Direction F, phase 3: armed via the "+ ADD STOP" toggle — this one
      // tap adds a waypoint instead of replacing the destination, then
      // disarms itself so a normal map tap goes back to its usual meaning.
      navigation.addWaypoint(latLng)
      addingStop.value = false
      return
    }
    // Only Thief-family classes' personalization asks `priority`/`avoid`
    // questions — every other class's `preferences` just won't have those
    // keys, so pickRoute() in navigation.js falls back to plain "fastest"
    // for them, same as before this existed.
    navigation.setDestination(latLng, store.preferences)
  })

  userMarker = new Marker({ element: markerEl(store.chosenClass.color) })
  syncWaypoints() // waypoints can already be restored from localStorage by the time this mounts
})

onUnmounted(() => {
  navigation.stopWatching()
  if (pulseRafId) cancelAnimationFrame(pulseRafId)
  if (xpToastTimer) clearTimeout(xpToastTimer)
  map?.remove()
})

watch(() => navigation.position, (pos) => {
  if (!map) return
  if (!pos) {
    // Sovereign archetype's ability paused tracking — the marker actually
    // leaves the map for the blackout, and re-centers fresh on return rather
    // than snapping silently back (hasCentered reset below).
    if (userMarkerAdded) {
      userMarker.remove()
      userMarkerAdded = false
    }
    hasCentered = false
    return
  }
  userMarker.setLngLat([pos.lng, pos.lat])
  if (!userMarkerAdded) {
    userMarker.addTo(map)
    userMarkerAdded = true
  }
  if (!hasCentered) {
    hasCentered = true
    map.flyTo({ center: [pos.lng, pos.lat], zoom: 15 })
  }
  // A destination can now arrive before the first position fix does — a
  // restored one from localStorage on a fresh reload is the common case, but
  // a fast tap right after mount could beat a slow GPS lock too. Neither path
  // could fetch a route at the time (setDestination() only fetches when
  // `position.value` is already set), so once a position does land, catch up
  // on the fetch it missed instead of leaving `destination` set with no route
  // ever drawn for it.
  if (navigation.destination && !navigation.hasRoute && !navigation.fetchingRoute) {
    navigation.fetchRoute(pos, navigation.destination, store.preferences)
  }
}, { immediate: true })

// Milestone 6: the user marker now points in the direction of travel when
// the device reports one, instead of always being a shape that looks
// identical whether stationary or moving at speed. Rotates the *inner*
// element (see markerEl() above) — MapLibre owns the outer element's own
// transform for positioning, and setting a second transform on the same
// element would just overwrite one or the other. `heading` is `null`
// whenever the browser/OS doesn't have one yet (indoors, stationary, no
// compass) — the arrow just keeps pointing north (0deg) in that case rather
// than showing nothing, a known simplification, not a claim of an accurate
// heading with no data behind it.
watch(() => navigation.heading, (heading) => {
  if (!userMarkerAdded) return
  const inner = userMarker.getElement().firstElementChild
  if (inner) inner.style.transform = `rotate(${heading ?? 0}deg)`
})

watch(() => navigation.route, syncRoute)
watch(() => navigation.pois, syncPOIs, { deep: true })
watch(() => navigation.waypoints, syncWaypoints, { deep: true })

watch(() => navigation.destination, (dest) => {
  if (!map) return
  if (!dest) {
    destMarker?.remove()
    return
  }
  if (!destMarker) destMarker = new Marker({ element: destMarkerEl('#F0C060') })
  destMarker.setLngLat([dest.lng, dest.lat]).addTo(map)
})

function startOver() {
  navigation.reset()
  store.reset()
  router.push({ name: 'genre-select' })
}

// Growth feedback — glanceable and gone, same "never a modal, never blocks
// the map" discipline as the share/privacy toasts. Deliberately doesn't say
// anything different for a level-up beyond the exclamation point; a driver
// glancing at the HUD doesn't need to read more than "something good happened."
const xpToast = ref(null)
let xpToastTimer = null
function showXpToast(message) {
  xpToast.value = message
  if (xpToastTimer) clearTimeout(xpToastTimer)
  xpToastTimer = setTimeout(() => { xpToast.value = null }, 2500)
}
function flashXP(xp, leveledUp) {
  showXpToast(leveledUp ? `+${xp} XP — LEVEL UP!` : `+${xp} XP`)
}

function onAbility() {
  const cls = store.chosenClass
  if (cls.abilityType === 'reveal') {
    const radius = Math.round(cls.abilityRadius * profile.powerMultiplier(cls.id, cls))
    // Only Fighter's personalization asks an open-ended "what places call to
    // you?" question today (`destinations`) — every other class's
    // `preferences` won't have that key, so this is `undefined` for them and
    // revealPOIs() just runs its plain baseline sweep, same as before.
    navigation.revealPOIs(radius, store.preferences?.destinations).then((count) => {
      const usedResult = profile.recordAbilityUsed(cls.id, cls)
      const poiResult  = count > 0 ? profile.recordPOIsDiscovered(cls.id, count, cls) : null
      const xp = usedResult.xpGranted + (poiResult?.xpGranted ?? 0)
      flashXP(xp, usedResult.leveledUp || Boolean(poiResult?.leveledUp))
    })
  } else if (cls.abilityType === 'reroute') {
    navigation.attemptReroute(store.preferences).then((switched) => {
      if (switched) pulseRoute()
      const { leveledUp, xpGranted } = profile.recordAbilityUsed(cls.id, cls)
      flashXP(xpGranted, leveledUp)
    })
  } else if (cls.abilityType === 'share-eta') {
    navigation.shareETA(profile.party).then(() => {
      const { leveledUp, xpGranted } = profile.recordAbilityUsed(cls.id, cls)
      flashXP(xpGranted, leveledUp)
    })
  } else if (cls.abilityType === 'privacy') {
    navigation.goDark(Math.round(PRIVACY_BLACKOUT_MS * profile.powerMultiplier(cls.id, cls)))
    const { leveledUp, xpGranted } = profile.recordAbilityUsed(cls.id, cls)
    flashXP(xpGranted, leveledUp)
  }
}

// Trip completion — a real navigation event (arriving at your destination),
// not a game-only concept — is what actually grants the bulk of a class's XP.
// See navigation.js's position watcher for the arrival check itself; this
// only reacts to its one-shot result and hands the store back once read.
watch(() => navigation.tripJustCompleted, (trip) => {
  if (!trip) return
  const cls = store.chosenClass
  const { leveledUp, xpGranted } = profile.recordTripCompleted(cls.id, trip.distanceMeters, cls)
  showXpToast(leveledUp ? `ARRIVED — +${xpGranted} XP — LEVEL UP!` : `ARRIVED — +${xpGranted} XP`)
  navigation.acknowledgeTripCompletion()
})

// Milestone 8, phase 1: pickups — reaching a POI that SCOUT (or its
// per-genre equivalent) already revealed. Named by the real place when one
// exists (matches the popup text syncPOIs() already gives it), falling back
// to its category the same way that popup does.
watch(() => navigation.pickupJustCollected, (pickup) => {
  if (!pickup) return
  const cls = store.chosenClass
  const { leveledUp, xpGranted } = profile.recordPickupCollected(cls.id, cls)
  const label = pickup.name ?? pickup.category ?? 'a landmark'
  showXpToast(leveledUp ? `Picked up ${label} — +${xpGranted} XP — LEVEL UP!` : `Picked up ${label} — +${xpGranted} XP`)
  navigation.acknowledgePickupCollected()
})

// Milestone 8, phase 2: quests. Auto-claimed the instant an objective
// crosses its threshold — no separate "claim" tap, consistent with every
// other XP source in this app (a manual claim step would be one more
// interaction this app's driver-attention principle doesn't ask for
// anywhere else). Watches the current class's own progress object deeply
// (mutated in place by profile.js, not reassigned, so a shallow watch would
// never fire) and re-checks every quest in the *current* genre on every
// stat change — cheap, since the quest list per genre is small. `immediate`
// so a class whose stats already crossed a threshold before this milestone
// existed gets it granted on the very next map visit, not only the next
// time that same stat happens to change again.
watch(() => profile.progressFor(store.chosenClass.id), (stats) => {
  for (const quest of questsForGenre(store.chosenGenre.id)) {
    if (stats.claimedQuestIds.includes(quest.id)) continue
    if (!isQuestComplete(quest, stats)) continue
    const { leveledUp, xpGranted } = profile.claimQuest(store.chosenClass.id, quest.id, quest.reward.xp, store.chosenClass)
    showXpToast(leveledUp
      ? `Quest complete: ${quest.title} — +${xpGranted} XP — LEVEL UP!`
      : `Quest complete: ${quest.title} — +${xpGranted} XP`)
  }
}, { deep: true, immediate: true })
</script>

<style scoped>
.map-screen {
  position: relative;
  width:  100vw;
  height: 100vh;
  overflow: hidden;
}

.map-mount {
  position: absolute;
  inset: 0;
}

.start-over {
  position: absolute;
  z-index: 1;
  top: 1rem;
  left: 1rem;
  font-family: 'Press Start 2P', monospace;
  font-size: 8px;
  padding: 8px 12px;
  background: var(--ff-panel);
  color: var(--ff-muted);
  border: 2px solid var(--ff-border);
  cursor: pointer;
}

.start-over:hover {
  border-color: var(--ff-gold-dark);
  color: var(--ff-text);
}

/* Deliberately a navigation link, not an overlay — the profile screen is a
   full screen you go look at, not something that appears on top of the map
   mid-drive. Mirrors .start-over's styling but sits opposite it so neither
   competes with the HUD's own bottom-anchored controls. */
.profile-link {
  position: absolute;
  z-index: 1;
  top: 1rem;
  right: 1rem;
  font-family: 'Press Start 2P', monospace;
  font-size: 8px;
  padding: 8px 12px;
  background: var(--ff-panel);
  color: var(--ff-muted);
  border: 2px solid var(--ff-border);
  cursor: pointer;
}

.profile-link:hover {
  border-color: var(--ff-gold-dark);
  color: var(--ff-text);
}

/* Direction F, phase 3. Sits below the top ~130px band the Android
   re-verification pass found unreliable to tap on-device (see
   PRODUCTION.md) — deliberately not stacked with start-over/profile at
   top: 1rem. */
.add-stop {
  position: absolute;
  z-index: 1;
  top: 4.5rem;
  left: 1rem;
  font-family: 'Press Start 2P', monospace;
  font-size: 7px;
  padding: 7px 10px;
  background: var(--ff-panel);
  color: var(--ff-muted);
  border: 2px solid var(--ff-border);
  cursor: pointer;
}

.add-stop.armed {
  border-color: var(--ff-gold-dark);
  color: var(--ff-gold);
}

.waypoint-chips {
  position: absolute;
  z-index: 1;
  top: 6.7rem;
  left: 1rem;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  max-width: 40vw;
}

.waypoint-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  font-family: 'Press Start 2P', monospace;
  font-size: 7px;
  padding: 5px 6px;
  background: var(--ff-panel);
  color: var(--ff-text);
  border: 1px solid var(--ff-border);
}

.waypoint-chip button {
  background: none;
  border: none;
  color: var(--ff-muted);
  cursor: pointer;
  font-size: 9px;
  line-height: 1;
  padding: 0;
}

.waypoint-chip button:hover {
  color: var(--ff-text);
}

</style>

<style>
/* Marker element is injected by MapLibre outside this component's scoped tree. */

/* Milestone 6: was a plain square — identical whether stationary or moving,
   and a rotated square doesn't read as "pointing" anywhere. An arrow shape
   (clip-path chevron) actually looks directional once the heading watcher
   (MapScreen.vue's <script>) rotates it; `transition` smooths GPS heading
   jitter into a glide instead of a snap. This is the *inner* element markerEl()
   wraps the outer marker div with — MapLibre's own position transform lives
   on the outer element untouched. */
.crystal-marker {
  width:  16px;
  height: 16px;
  background: var(--cc);
  clip-path: polygon(50% 0%, 100% 100%, 50% 76%, 0% 100%);
  filter: drop-shadow(0 0 5px var(--cc)) drop-shadow(0 0 2px var(--ff-night));
  transition: transform 0.3s ease;
}

/* A revealed POI (Adventurer archetype's ability) — the category icon itself
   (see poiIcons.js) rendered pixelated, with a soft glow in the marker's
   class color standing in for the border/shadow the old plain-diamond shape
   used to carry. */
.poi-marker-canvas {
  image-rendering: pixelated;
  filter: drop-shadow(0 0 3px var(--cc)) drop-shadow(0 0 1px var(--ff-night));
}

/* The destination pin — see destMarkerEl() in <script>. Reuses the same
   "arrive" maneuver glyph turn-by-turn shows for the final instruction, so a
   flag/pin silhouette replaces the old plain-square-recolored-gold marker;
   distinguishable from the user's arrow marker by shape, not only color. */
.dest-marker-canvas {
  image-rendering: pixelated;
  filter: drop-shadow(0 0 4px var(--ff-gold)) drop-shadow(0 0 2px var(--ff-night));
}

/* An intermediate stop (Direction F, phase 3) — a plain numbered circle,
   deliberately neither the user's class-colored arrow nor the destination's
   gold flag, so a glance sorts "where I am" / "stops along the way" /
   "where I'm finally headed" by shape and color alike, not just position. */
.waypoint-marker {
  width:  18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ff-panel);
  border: 2px solid var(--ff-muted);
  color: var(--ff-text);
  font-family: 'Press Start 2P', monospace;
  font-size: 8px;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.6);
}
</style>
