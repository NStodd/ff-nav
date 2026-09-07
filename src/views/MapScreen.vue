<template>
  <div class="map-screen">
    <div ref="mapEl" class="map-mount" />

    <button class="start-over" @click="startOver">&#8592; START OVER</button>
    <button class="profile-link" @click="router.push({ name: 'profile', params: { genreId: store.chosenGenre.id } })">PROFILE &#9658;</button>

    <Transition name="toast-fade">
      <div v-if="navigation.shareStatus" class="share-toast" :style="{ '--cc': store.chosenClass.color }">
        {{ navigation.shareStatus }}
      </div>
    </Transition>

    <Transition name="toast-fade">
      <div v-if="navigation.routeError" class="route-error-toast">
        {{ navigation.routeError }}
      </div>
    </Transition>

    <Transition name="toast-fade">
      <div v-if="xpToast" class="xp-toast" :style="{ '--cc': store.chosenClass.color }">
        {{ xpToast }}
      </div>
    </Transition>

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
import HudOverlay from '@/components/HudOverlay.vue'

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

const mapEl = ref(null)
let map            = null
let userMarker     = null
let destMarker     = null
let userMarkerAdded = false
let hasCentered     = false
const poiMarkers = new Map() // poi id -> Marker, so revealPOIs() re-renders never duplicate one

function markerEl(color) {
  const el = document.createElement('div')
  el.className = 'crystal-marker'
  el.style.setProperty('--cc', color)
  return el
}

const POI_ICON_COLOR_MAP = { '2': '#F5CBA7', w: '#FFFFFF', g: '#888888', G: '#F0C060', d: '#333333' }
const POI_ICON_PIXEL_SIZE = 3

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
    map.addSource(ROUTE_SOURCE_ID, {
      type: 'geojson',
      data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } },
    })
    map.addLayer({
      id: ROUTE_LAYER_ID,
      type: 'line',
      source: ROUTE_SOURCE_ID,
      paint: {
        'line-color':   store.chosenClass.color,
        'line-width':   4,
        'line-opacity': 0.85,
      },
    })
    syncRoute()
  })

  map.on('click', (e) => {
    // Only Thief-family classes' personalization asks `priority`/`avoid`
    // questions — every other class's `preferences` just won't have those
    // keys, so pickRoute() in navigation.js falls back to plain "fastest"
    // for them, same as before this existed.
    navigation.setDestination({ lat: e.lngLat.lat, lng: e.lngLat.lng }, store.preferences)
  })

  userMarker = new Marker({ element: markerEl(store.chosenClass.color) })
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

watch(() => navigation.route, syncRoute)
watch(() => navigation.pois, syncPOIs, { deep: true })

watch(() => navigation.destination, (dest) => {
  if (!map) return
  if (!dest) {
    destMarker?.remove()
    return
  }
  if (!destMarker) destMarker = new Marker({ element: markerEl('#F0C060') })
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

/* Feedback for the Connector archetype's ability — only ever seen on the
   clipboard-fallback / unsupported paths of shareETA(); a real OS share sheet
   is its own confirmation UI. */
.share-toast {
  position:       absolute;
  z-index:        3;
  top:            1rem;
  left:           50%;
  transform:      translateX(-50%);
  font-family:    'Press Start 2P', monospace;
  font-size:      9px;
  padding:        10px 16px;
  background:     var(--ff-panel);
  color:          var(--cc);
  border:         2px solid var(--cc);
  box-shadow:     0 0 16px color-mix(in srgb, var(--cc) 35%, transparent);
  white-space:    nowrap;
}

/* Route/geolocation failure feedback — shares the share-toast's top-center
   slot (an in-flight share and a route failure are never both relevant at
   once) but its own red-tinted styling so a driver's glance distinguishes
   "something failed" from the gold-toned confirmation/growth toasts. */
.route-error-toast {
  position:       absolute;
  z-index:        3;
  top:            1rem;
  left:           50%;
  transform:      translateX(-50%);
  font-family:    'Press Start 2P', monospace;
  font-size:      9px;
  padding:        10px 16px;
  background:     var(--ff-panel);
  color:          #E85C5C;
  border:         2px solid #E85C5C;
  box-shadow:     0 0 16px rgba(232, 92, 92, 0.35);
  white-space:    nowrap;
}

/* Growth feedback (ability XP, trip-completion XP) — offset below the
   share-toast's position so the two can never visually stack. */
.xp-toast {
  position:       absolute;
  z-index:        3;
  top:            3.4rem;
  left:           50%;
  transform:      translateX(-50%);
  font-family:    'Press Start 2P', monospace;
  font-size:      9px;
  padding:        8px 14px;
  background:     var(--ff-panel);
  color:          var(--ff-gold);
  border:         2px solid var(--ff-gold-dark);
  box-shadow:     0 0 16px color-mix(in srgb, var(--ff-gold) 30%, transparent);
  white-space:    nowrap;
}

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: opacity 0.25s ease;
}

.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
}
</style>

<style>
/* Marker element is injected by MapLibre outside this component's scoped tree. */
.crystal-marker {
  width:  14px;
  height: 14px;
  background: var(--cc);
  border: 2px solid var(--ff-night);
  box-shadow: 0 0 8px var(--cc), 0 0 2px var(--ff-night);
}

/* A revealed POI (Adventurer archetype's ability) — the category icon itself
   (see poiIcons.js) rendered pixelated, with a soft glow in the marker's
   class color standing in for the border/shadow the old plain-diamond shape
   used to carry. */
.poi-marker-canvas {
  image-rendering: pixelated;
  filter: drop-shadow(0 0 3px var(--cc)) drop-shadow(0 0 1px var(--ff-night));
}
</style>
