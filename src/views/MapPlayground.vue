<template>
  <div class="playground">
    <aside class="controls">
      <h1>MAP PLAYGROUND</h1>
      <p class="hint">Milestone 6's design-review tool for the map layer — compare route-line/marker/toast treatments against a real fetched route before committing, instead of judging changes one Playwright screenshot at a time.</p>

      <section>
        <h2>World skin (§9)</h2>
        <div class="treatment-picker">
          <button
            v-for="opt in SKIN_OPTIONS"
            :key="opt.id"
            class="treatment-btn skin-btn"
            :class="{ active: worldSkinId === opt.id }"
            :disabled="opt.id !== 'default' && !worldSkinFor(opt.id)"
            :style="{ '--cc': opt.color }"
            @click="worldSkinId = opt.id"
          >{{ opt.name }}<span v-if="opt.id !== 'default' && !worldSkinFor(opt.id)" class="skin-tbd"> (not yet designed)</span></button>
        </div>
        <p class="hint sub">Repaints the same real Dark Matter tiles in place — same street data, same POI positions, same routing, only the color each layer draws in changes. FF is the pilot; the other three stay disabled here until FF's palette is judged against real screenshots.</p>
      </section>

      <section>
        <h2>Route line treatment</h2>
        <div class="treatment-picker">
          <button
            v-for="(t, key) in TREATMENTS"
            :key="key"
            class="treatment-btn"
            :class="{ active: treatment === key }"
            @click="treatment = key"
          >{{ t.label }}</button>
        </div>
        <p class="hint sub">{{ TREATMENTS[treatment].note }}</p>
      </section>

      <section>
        <h2>Reroute flash (for comparison)</h2>
        <p class="hint sub">The Speedrunner archetype's existing ability animation — fires once, independent of whichever line treatment is active above. Needs to stay visually distinct from it.</p>
        <PixelButton variant="ghost" @click="pulseRoute">TRIGGER PULSE</PixelButton>
      </section>

      <section>
        <h2>User marker heading</h2>
        <label>Heading <span>{{ heading }}°</span>
          <input type="range" min="0" max="359" step="1" v-model.number="heading">
        </label>
      </section>

      <section>
        <h2>Toasts (layer over the map above)</h2>
        <div class="toast-buttons">
          <PixelButton variant="ghost" @click="fireToast('status')">STATUS</PixelButton>
          <PixelButton variant="ghost" @click="fireToast('error')">ERROR</PixelButton>
          <PixelButton variant="ghost" @click="fireToast('xp')">XP</PixelButton>
        </div>
      </section>

      <p class="hint">Route is a real fetched OSRM path (Center City Philadelphia), same live-backend approach as everywhere else in this app — not a hand-drawn stand-in.</p>
    </aside>

    <main class="preview">
      <div ref="mapEl" class="map-mount" />
      <Toast :text="statusText" tone="default" color="#F0C060" top="1rem" />
      <Toast :text="errorText" tone="error" top="1rem" />
      <Toast :text="xpText" tone="gold" top="3.4rem" />
    </main>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { Map as MapLibreMap, Marker, LngLatBounds } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { iconForManeuver } from '@/data/maneuverIcons.js'
import { GENRES } from '@/data/genres.js'
import { MAP_LAYER_GROUPS } from '@/data/mapLayerGroups.js'
import { worldSkinFor, applyWorldSkin } from '@/data/worldSkins.js'
import PixelButton from '@/components/PixelButton.vue'
import Toast from '@/components/Toast.vue'

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
const ROUTE_SOURCE_ID = 'demo-route'
const ROUTE_LAYER_ID  = 'demo-route-line'
const DEMO_COLOR = '#C0392B' // Fighter's red — arbitrary, just needs to be a real class color

// Same public OSRM demo endpoint the real app falls back to (see Navigation.md) —
// a real fetched route, not a hand-drawn stand-in, so the treatments below are
// judged against an actual path's real curves and turn density.
const ORIGIN = { lat: 39.9526, lng: -75.1652 }
const DEST   = { lat: 39.9490, lng: -75.1610 }

const TREATMENTS = {
  flat: {
    label: 'Flat (current)',
    note: 'The shipped default — a single solid color, uniform width. No directional cue at all; included here as the baseline to compare against.',
  },
  gradient: {
    label: 'Gradient — fade toward destination',
    note: 'Muted near the origin (already traveled), full class color at the destination end (ahead). Static — no animation, no added motion, fully in keeping with the driver-attention constraint.',
  },
  glow: {
    label: 'Gradient + width taper',
    note: 'Same directional fade, plus the line itself thickens toward the destination end. Still static. More noticeable than the plain gradient; worth judging whether that reads as "clearer" or just "busier."',
  },
}

const treatment = ref('flat')
const heading    = ref(0)

// §9 world-skinning: 'default' is the shipped, unskinned Dark Matter look;
// every genre appears as an option so the disabled/"(not yet designed)"
// state is visible in the picker itself, not just absent from it.
const SKIN_OPTIONS = [
  { id: 'default', name: 'Default (shipped)', color: '#9090A8' },
  ...GENRES.map(g => ({ id: g.id, name: g.name, color: g.color })),
]
const worldSkinId = ref('default')

const mapEl = ref(null)
let map = null
let userMarker = null
let destMarker = null
let routeCoords = []
let pulseRafId = null

const POI_ICON_COLOR_MAP = { '2': '#F5CBA7', w: '#FFFFFF', g: '#888888', G: '#F0C060', d: '#333333' }

function destMarkerEl(color) {
  const icon = iconForManeuver('arrive')
  const canvas = document.createElement('canvas')
  const px = 3
  const cols = Math.max(...icon.rows.map(r => r.length))
  canvas.width  = cols * px
  canvas.height = icon.rows.length * px
  const ctx = canvas.getContext('2d')
  icon.rows.forEach((row, ri) => {
    for (let ci = 0; ci < row.length; ci++) {
      const ch = row[ci]
      if (ch === '0') continue
      ctx.fillStyle = ch === '1' ? color : (POI_ICON_COLOR_MAP[ch] ?? '#fff')
      ctx.fillRect(ci * px, ri * px, px, px)
    }
  })
  canvas.style.filter = `drop-shadow(0 0 4px ${color})`
  return canvas
}

function userMarkerEl(color) {
  const outer = document.createElement('div')
  const inner = document.createElement('div')
  inner.className = 'demo-user-marker'
  inner.style.setProperty('--cc', color)
  outer.appendChild(inner)
  return outer
}

function paintFor(key) {
  if (key === 'flat') {
    return { 'line-color': DEMO_COLOR, 'line-width': 4, 'line-opacity': 0.85 }
  }
  if (key === 'gradient') {
    return {
      'line-width': 4,
      'line-opacity': 0.9,
      'line-gradient': [
        'interpolate', ['linear'], ['line-progress'],
        0, 'rgba(255,255,255,0.15)',
        1, DEMO_COLOR,
      ],
    }
  }
  return {
    'line-width': ['interpolate', ['linear'], ['line-progress'], 0, 2, 1, 7],
    'line-opacity': 0.9,
    'line-gradient': [
      'interpolate', ['linear'], ['line-progress'],
      0, 'rgba(255,255,255,0.12)',
      0.6, DEMO_COLOR,
      1, '#FFE8B0',
    ],
  }
}

// Recreates the source/layer rather than mutating paint properties in place —
// `line-gradient` needs `lineMetrics: true` set at source-creation time and
// doesn't reliably toggle on/off via setPaintProperty alone. Only runs when
// switching treatments in this review tool, not on a hot path, so the cost
// of rebuilding doesn't matter here the way it would in the real MapScreen.vue.
function rebuildRouteLayer() {
  if (!map || !routeCoords.length) return
  if (map.getLayer(ROUTE_LAYER_ID)) map.removeLayer(ROUTE_LAYER_ID)
  if (map.getSource(ROUTE_SOURCE_ID)) map.removeSource(ROUTE_SOURCE_ID)
  map.addSource(ROUTE_SOURCE_ID, {
    type: 'geojson',
    lineMetrics: true,
    data: { type: 'Feature', geometry: { type: 'LineString', coordinates: routeCoords } },
  })
  map.addLayer({
    id: ROUTE_LAYER_ID,
    type: 'line',
    source: ROUTE_SOURCE_ID,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: paintFor(treatment.value),
  })
}

function pulseRoute() {
  if (!map?.getLayer(ROUTE_LAYER_ID)) return
  if (pulseRafId) cancelAnimationFrame(pulseRafId)
  const baseWidth = treatment.value === 'flat' ? 4 : 5
  const peakWidth = 12
  const duration  = 650
  const start     = performance.now()
  const tick = (now) => {
    const t = Math.min(1, (now - start) / duration)
    // Only meaningful to override with a flat width during the pulse itself —
    // the data-driven width expressions (treatment 'glow') get temporarily
    // superseded for this one flash, then rebuildRouteLayer() restores
    // whichever treatment was active once the pulse finishes.
    map.setPaintProperty(ROUTE_LAYER_ID, 'line-width', peakWidth - (peakWidth - baseWidth) * t)
    if (t < 1) pulseRafId = requestAnimationFrame(tick)
    else { pulseRafId = null; rebuildRouteLayer() }
  }
  pulseRafId = requestAnimationFrame(tick)
}

watch(treatment, rebuildRouteLayer)
watch(heading, (h) => {
  const inner = userMarker?.getElement().firstElementChild
  if (inner) inner.style.transform = `rotate(${h}deg)`
})

// Runs on initial style load and again after every skin switch. A full
// `setStyle()` (below) wipes any source/layer this tool added, so the
// route line needs rebuilding every time — but not the markers: they're
// positioned by the Map instance directly, not the style, so they survive
// a style swap untouched and don't need re-adding here.
function reapplyMapContent() {
  applyWorldSkin(map, MAP_LAYER_GROUPS, worldSkinId.value === 'default' ? null : worldSkinFor(worldSkinId.value))
  rebuildRouteLayer()
}

watch(worldSkinId, () => {
  if (!map) return
  map.setStyle(MAP_STYLE)
  map.once('style.load', reapplyMapContent)
})

onMounted(async () => {
  map = new MapLibreMap({
    container: mapEl.value,
    style: MAP_STYLE,
    center: [ORIGIN.lng, ORIGIN.lat],
    zoom: 15,
  })

  userMarker = new Marker({ element: userMarkerEl(DEMO_COLOR) }).setLngLat([ORIGIN.lng, ORIGIN.lat])
  destMarker = new Marker({ element: destMarkerEl('#F0C060') }).setLngLat([DEST.lng, DEST.lat])

  map.on('load', async () => {
    userMarker.addTo(map)
    destMarker.addTo(map)

    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${ORIGIN.lng},${ORIGIN.lat};${DEST.lng},${DEST.lat}?overview=full&geometries=geojson`
      const res = await fetch(url)
      const data = await res.json()
      routeCoords = data.routes?.[0]?.geometry?.coordinates ?? []
    } catch {
      routeCoords = [[ORIGIN.lng, ORIGIN.lat], [DEST.lng, DEST.lat]] // fallback straight line if the demo server is unreachable
    }
    reapplyMapContent()

    if (routeCoords.length) {
      const bounds = routeCoords.reduce((b, c) => b.extend(c), new LngLatBounds(routeCoords[0], routeCoords[0]))
      map.fitBounds(bounds, { padding: 60 })
    }
  })
})

onUnmounted(() => {
  if (pulseRafId) cancelAnimationFrame(pulseRafId)
  map?.remove()
})

// --- Toast triggers ---
const statusText = ref(null)
const errorText  = ref(null)
const xpText     = ref(null)
let statusTimer, errorTimer, xpTimer

function fireToast(kind) {
  if (kind === 'status') {
    clearTimeout(statusTimer)
    statusText.value = 'Copied to clipboard.'
    statusTimer = setTimeout(() => { statusText.value = null }, 3000)
  } else if (kind === 'error') {
    clearTimeout(errorTimer)
    errorText.value = 'Could not calculate a route. Tap the map to try again.'
    errorTimer = setTimeout(() => { errorText.value = null }, 5000)
  } else {
    clearTimeout(xpTimer)
    xpText.value = '+42 XP — LEVEL UP!'
    xpTimer = setTimeout(() => { xpText.value = null }, 2500)
  }
}
</script>

<style scoped>
.playground {
  display: flex;
  min-height: 100vh;
  overflow: hidden;
  font-family: 'Press Start 2P', monospace;
}

.controls {
  width: 340px;
  flex-shrink: 0;
  background: var(--ff-dark);
  border-right: 2px solid var(--ff-border);
  padding: 1.25rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

h1 {
  font-size: 12px;
  color: var(--ff-gold);
  letter-spacing: 0.05em;
}

h2 {
  font-size: 9px;
  color: var(--ff-muted);
  letter-spacing: 0.05em;
  margin-bottom: 0.5rem;
}

.hint {
  font-size: 7px;
  color: var(--ff-muted);
  line-height: 1.7;
}

.hint.sub {
  margin-top: 0.5rem;
}

section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 7px;
  color: var(--ff-text);
}

label span {
  color: var(--ff-gold);
}

input[type='range'] {
  width: 100%;
}

.treatment-picker {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.treatment-btn {
  font-family: 'Press Start 2P', monospace;
  font-size: 7px;
  padding: 8px 10px;
  background: var(--ff-panel);
  color: var(--ff-muted);
  border: 2px solid var(--ff-border);
  cursor: pointer;
  text-align: left;
}

.treatment-btn.active {
  border-color: var(--ff-gold-dark);
  color: var(--ff-text);
  background: color-mix(in srgb, var(--ff-gold) 12%, var(--ff-panel));
}

.skin-btn.active {
  border-color: var(--cc);
  color: var(--ff-text);
  background: color-mix(in srgb, var(--cc) 12%, var(--ff-panel));
}

.skin-btn:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.skin-tbd {
  color: var(--ff-muted);
}

.toast-buttons {
  display: flex;
  gap: 0.4rem;
}

.preview {
  position: relative;
  flex: 1;
}

.map-mount {
  position: absolute;
  inset: 0;
}
</style>

<style>
/* Marker element injected by MapLibre outside this component's scoped tree —
   duplicated from MapScreen.vue's own .crystal-marker rather than shared,
   same "small duplication across dev-tool/live-code boundaries" precedent
   poiIcons.js's own COLOR_MAP copies already set (see Sprites.md). */
.demo-user-marker {
  width:  16px;
  height: 16px;
  background: var(--cc);
  clip-path: polygon(50% 0%, 100% 100%, 50% 76%, 0% 100%);
  filter: drop-shadow(0 0 5px var(--cc)) drop-shadow(0 0 2px var(--ff-night));
  transition: transform 0.3s ease;
}
</style>
