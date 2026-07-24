import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving'

export const useNavigationStore = defineStore('navigation', () => {
  const position    = ref(null)  // { lat, lng }
  const destination = ref(null)  // { lat, lng }
  const route       = ref([])    // [ [lng, lat], ... ] — GeoJSON coordinate order
  const eta         = ref(null)  // seconds
  const watcherId   = ref(null)

  const hasRoute = computed(() => route.value.length > 0)
  const etaFormatted = computed(() => {
    if (eta.value == null) return null
    const mins = Math.round(eta.value / 60)
    return mins < 1 ? '<1 min' : `${mins} min`
  })

  function setPosition(latLng) {
    position.value = latLng
  }

  function startWatching() {
    if (watcherId.value != null || !navigator.geolocation) return
    watcherId.value = navigator.geolocation.watchPosition(
      (pos) => { position.value = { lat: pos.coords.latitude, lng: pos.coords.longitude } },
      () => {},
      { enableHighAccuracy: true },
    )
  }

  function stopWatching() {
    if (watcherId.value == null) return
    navigator.geolocation.clearWatch(watcherId.value)
    watcherId.value = null
  }

  async function fetchRoute(origin, dest) {
    const url = `${OSRM_BASE}/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=full&geometries=geojson`
    const res  = await fetch(url)
    const data = await res.json()
    const best = data.routes?.[0]
    if (!best) return
    route.value = best.geometry.coordinates
    eta.value   = best.duration
  }

  async function setDestination(latLng) {
    destination.value = latLng
    if (position.value) await fetchRoute(position.value, latLng)
  }

  function reset() {
    stopWatching()
    position.value    = null
    destination.value = null
    route.value       = []
    eta.value         = null
  }

  return {
    position, destination, route, eta,
    hasRoute, etaFormatted,
    setPosition, startWatching, stopWatching, setDestination, fetchRoute, reset,
  }
})
