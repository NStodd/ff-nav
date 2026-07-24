<template>
  <div class="map-screen">
    <div ref="mapEl" class="map-mount" />

    <button class="start-over" @click="startOver">&#8592; START OVER</button>

    <HudOverlay @ability="onAbility" />
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Map as MapLibreMap, Marker, NavigationControl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { usePlayerStore } from '@/stores/player.js'
import { useNavigationStore } from '@/stores/navigation.js'
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

const mapEl = ref(null)
let map            = null
let userMarker     = null
let destMarker     = null
let userMarkerAdded = false
let hasCentered     = false

function markerEl(color) {
  const el = document.createElement('div')
  el.className = 'crystal-marker'
  el.style.setProperty('--cc', color)
  return el
}

function syncRoute() {
  if (!map?.getSource(ROUTE_SOURCE_ID)) return
  map.getSource(ROUTE_SOURCE_ID).setData({
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: navigation.route },
  })
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
    navigation.setDestination({ lat: e.lngLat.lat, lng: e.lngLat.lng })
  })

  userMarker = new Marker({ element: markerEl(store.chosenClass.color) })
})

onUnmounted(() => {
  navigation.stopWatching()
  map?.remove()
})

watch(() => navigation.position, (pos) => {
  if (!pos || !map) return
  userMarker.setLngLat([pos.lng, pos.lat])
  if (!userMarkerAdded) {
    userMarker.addTo(map)
    userMarkerAdded = true
  }
  if (!hasCentered) {
    hasCentered = true
    map.flyTo({ center: [pos.lng, pos.lat], zoom: 15 })
  }
}, { immediate: true })

watch(() => navigation.route, syncRoute)

watch(() => navigation.destination, (dest) => {
  if (!dest || !map) return
  if (!destMarker) destMarker = new Marker({ element: markerEl('#F0C060') })
  destMarker.setLngLat([dest.lng, dest.lat]).addTo(map)
})

function startOver() {
  navigation.reset()
  store.reset()
  router.push({ name: 'genre-select' })
}

function onAbility() {
  // Hook point for the four class abilities (milestone 4) — not implemented yet.
}
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
</style>
