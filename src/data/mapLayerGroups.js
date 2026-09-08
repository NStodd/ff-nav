// §9's world-skinning work repaints CARTO's real Dark Matter tiles rather
// than replacing them (see PLANNING.md §9) — genre palettes get applied as
// `setPaintProperty()` overrides on the base style's own layers, once it
// loads. This file is the one place that enumerates which of those layers
// exist and what they're for, so worldSkins.js and any screen applying a
// skin (currently just /dev/map's picker; MapScreen.vue once the FF pilot
// is approved) both aim at the same real ids instead of each guessing.
//
// Not guessed at — fetched and inspected the real style JSON directly
// (https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json, 93
// layers total) rather than assuming a clean `road`/`water`/`building` id
// per category the way a hand-rolled style might have one. It doesn't:
// most categories are split across many zoom-dependent/tunnel/bridge/case
// variants (transportation alone is 49 of the 93 layers), so each group
// below is a real, verified id list, not a single wildcard.
//
// Deliberately not exhaustive. Rail, administrative boundaries, and house
// numbers exist in the base style but carry little visual weight and are
// left at their default color for every genre — a v1 scope cut, not an
// oversight. Building's own base `building` layer (as opposed to
// `building-top`) is skipped for the same "don't touch it" reason but a
// different one: its fill-color is a zoom-dependent stops array that's
// `transparent` until you're zoomed in close, and overriding it with a
// flat genre color would remove that fade-in behavior, not just recolor
// it. `building-top` carries the visible color at the zoom levels this
// app actually renders at, so it's the one building layer worldSkins.js
// targets.

export const MAP_LAYER_GROUPS = {
  background: ['background'],

  water: ['water'],
  waterway: ['waterway'],
  labelWater: ['watername_ocean', 'watername_sea', 'watername_lake', 'watername_lake_line'],

  land: ['landcover', 'landuse', 'landuse_residential', 'park_national_park', 'park_nature_reserve'],

  buildingTop: ['building-top'],

  roadMajor: [
    'road_mot_fill_ramp', 'road_mot_fill_noramp',
    'road_trunk_fill_ramp', 'road_trunk_fill_noramp',
    'road_pri_fill_ramp', 'road_pri_fill_noramp',
    'bridge_mot_fill', 'bridge_trunk_fill', 'bridge_pri_fill',
    'tunnel_mot_fill', 'tunnel_trunk_fill', 'tunnel_pri_fill',
  ],
  roadMajorCase: [
    'road_mot_case_ramp', 'road_mot_case_noramp',
    'road_trunk_case_ramp', 'road_trunk_case_noramp',
    'road_pri_case_ramp', 'road_pri_case_noramp',
    'bridge_mot_case', 'bridge_trunk_case', 'bridge_pri_case',
    'tunnel_mot_case', 'tunnel_trunk_case', 'tunnel_pri_case',
  ],
  roadMinor: [
    'road_sec_fill_noramp', 'road_minor_fill', 'road_service_fill', 'road_path',
    'bridge_sec_fill', 'bridge_minor_fill', 'bridge_service_fill', 'bridge_path',
    'tunnel_sec_fill', 'tunnel_minor_fill', 'tunnel_service_fill', 'tunnel_path',
  ],
  roadMinorCase: [
    'road_sec_case_noramp', 'road_minor_case', 'road_service_case',
    'bridge_sec_case', 'bridge_minor_case', 'bridge_service_case',
    'tunnel_sec_case', 'tunnel_minor_case', 'tunnel_service_case',
  ],

  labelPlace: [
    'place_hamlet', 'place_suburbs', 'place_villages', 'place_town',
    'place_country_2', 'place_country_1', 'place_state', 'place_continent',
    'place_city_r6', 'place_city_r5',
    'place_city_dot_r7', 'place_city_dot_r4', 'place_city_dot_r2',
    'place_city_dot_z7', 'place_capital_dot_z7',
  ],
  labelRoad: ['roadname_minor', 'roadname_sec', 'roadname_pri', 'roadname_major'],
}
