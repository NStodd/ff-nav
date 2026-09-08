// §9's genre world-skinning (PLANNING.md §9), phase 1: palette only. Each
// entry repaints the same real Dark Matter tiles (see mapLayerGroups.js for
// exactly which layers and why) — never touches geometry, labels' text
// content, or routing, only the color each layer is drawn in. FF is the
// pilot genre per the explicit ask; the other three stay unset here until
// FF's palette is judged against real phone-viewport screenshots and the
// mechanism is proven, the same "prove it generalizes, then roll out"
// order every other genre-generic system in this app has followed.
//
// Deliberately palette-only for this pass. "Genre feel" is meant to extend
// further than color eventually — road *line style* (dashed/organic edges
// reading as an old map vs. a crisp modern grid), *land type* variation
// (forest vs. desert texture, not just a single land color), genre-specific
// POI icon sets, and HUD chrome treatment are all real, wanted extensions
// of this same idea, not accidentally out of scope — they just don't need
// to be part of the first palette-comparison screenshots, and each is a
// big enough design surface to deserve its own pass once the base
// mechanism (this file) is validated. Tracked as follow-up work, not
// forgotten scope.

const FF_SKIN = {
  // A "moonlit fantasy map" direction: warm, torchlit hues in place of the
  // shipped theme's neutral cool grays, while staying just as dark — the
  // Milestone 6 lesson (high contrast and minimal visual noise are safer
  // at a glance while driving) applies just as much to a reskinned map as
  // it did to the plain one, so this isn't a bright "old parchment" look,
  // it's the same dark-mode contrast profile with a fantasy-warm palette.
  background:    '#160F09', // was a neutral near-black (#0e0e0e) — warm umber-black instead
  water:         '#1F3A3A', // was a cool blue-gray (#2C353C) — deep enchanted-lake teal
  land:          '#1B160D', // was flat neutral near-black — warm dark olive-brown
  buildingTop:   '#3C2E1E', // was neutral gray (~#393939) — warm brown, torchlit village read
  roadMajor:     '#8A6D3B', // was cool blue-gray (~#535666) — well-traveled gold-brown road
  roadMajorCase: '#241C10', // was near-black gray (~#1a1a1a) — warm dark brown casing
  roadMinor:     '#5C4A32', // was cool blue-gray (~#414758) — dimmer gold-brown
  roadMinorCase: '#1A140C', // was near-black — warm dark brown casing
  labelText:     '#E8D9B0', // was cool light gray (~#bdbdbd/#ccd0e4) — parchment-gold, matches --ff-gold family
  labelHalo:     '#150F08', // was near-black gray (#111/#222) — warm dark halo to match
}

export const WORLD_SKINS = {
  ff: FF_SKIN,
  // scifi, western, pirate: not yet designed — see the note above. A genre
  // with no entry here means MapScreen.vue and /dev/map's picker both fall
  // straight back to Dark Matter's own shipped colors, unchanged.
}

export function worldSkinFor(genreId) {
  return WORLD_SKINS[genreId] ?? null
}

// Applies one skin's colors to a loaded map's real style layers. Safe to
// call with `skin: null` (a no-op) so callers don't need their own guard
// for "this genre has no skin yet." Each `setPaintProperty` call is
// wrapped individually — a layer id that's missing or doesn't support a
// given property (a base-style version drift, say) is skipped rather than
// aborting every remaining override.
export function applyWorldSkin(map, groups, skin) {
  if (!skin) return
  setAll(map, groups.background, 'background-color', skin.background)
  setAll(map, groups.water, 'fill-color', skin.water)
  setAll(map, groups.waterway, 'line-color', skin.water)
  setAll(map, groups.labelWater, 'text-color', skin.labelText)
  setAll(map, groups.labelWater, 'text-halo-color', skin.labelHalo)
  setAll(map, groups.land, 'fill-color', skin.land)
  setAll(map, groups.buildingTop, 'fill-color', skin.buildingTop)
  setAll(map, groups.roadMajor, 'line-color', skin.roadMajor)
  setAll(map, groups.roadMajorCase, 'line-color', skin.roadMajorCase)
  setAll(map, groups.roadMinor, 'line-color', skin.roadMinor)
  setAll(map, groups.roadMinorCase, 'line-color', skin.roadMinorCase)
  setAll(map, groups.labelPlace, 'text-color', skin.labelText)
  setAll(map, groups.labelPlace, 'text-halo-color', skin.labelHalo)
  setAll(map, groups.labelRoad, 'text-color', skin.labelText)
  setAll(map, groups.labelRoad, 'text-halo-color', skin.labelHalo)
}

function setAll(map, ids, property, value) {
  if (!ids || value === undefined) return
  for (const id of ids) {
    if (!map.getLayer(id)) continue
    try { map.setPaintProperty(id, property, value) } catch { /* layer doesn't support this property — skip it, not fatal */ }
  }
}
