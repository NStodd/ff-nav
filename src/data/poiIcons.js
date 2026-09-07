// POI category icons, wired into MapScreen.vue's poiMarkerEl(). Every icon is
// a small pixel grid using the same PixelSprite.vue character vocabulary as
// class sprites ('1' = the marker's class-tint color, 'w'/'g'/'G'/'d' = fixed
// white/gray/gold/dark, '0' = transparent).
//
// Deliberately geometric/iconic rather than detailed — legible at map-marker
// scale matters far more than realism at 9x9.
//
// shop/lodging/fuel each went through a second design pass — see
// ICON_CANDIDATES below for the rejected options and why the current ones won.

export const POI_ICONS = {
  food: {
    label: 'Food',
    rows: [
      '010101000',
      '010101000',
      '010101000',
      '011111000',
      '000100000',
      '000100000',
      '000100000',
      '000100000',
      '000000000',
    ],
  },
  cafe: {
    label: 'Cafe',
    rows: [
      '00w0w0000',
      '000w00000',
      '000000000',
      '011111000',
      '010001100',
      '010001100',
      '010001000',
      '011111000',
      '001110000',
    ],
  },
  bar: {
    label: 'Bar',
    rows: [
      '00www0000',
      '01www1000',
      '010001100',
      '010001100',
      '010001000',
      '010001000',
      '011111000',
      '000000000',
      '000000000',
    ],
  },
  // v2 — a price tag (loop + punched hole). The v1 "bag" read as a small
  // appliance more than a shopping bag; a tag's diamond-ish silhouette also
  // doesn't compete with `culture`'s column for the "small building" reading.
  shop: {
    label: 'Shop',
    rows: [
      '000011000',
      '000011000',
      '001111110',
      '01100w110',
      '011111110',
      '011111110',
      '011111100',
      '001111000',
      '000110000',
    ],
  },
  // v2 — a crescent moon. The v1 attempt (a bed frame) didn't read as a bed
  // at 9x9; a moon is the icon real map apps already use for lodging/rest,
  // and its round silhouette doesn't overlap with anything else on this board.
  lodging: {
    label: 'Lodging',
    rows: [
      '0w0111000',
      '001111100',
      '011110000',
      '011100000',
      '011100000',
      '011110000',
      '001111100',
      '000111000',
      '000000000',
    ],
  },
  culture: {
    label: 'Culture',
    rows: [
      '011111110',
      '001111100',
      '000111000',
      '000111000',
      '000111000',
      '000111000',
      '001111100',
      '011111110',
      '000000000',
    ],
  },
  nature: {
    label: 'Nature',
    rows: [
      '001110000',
      '011111000',
      '111111100',
      '011111000',
      '000010000',
      '000010000',
      '001110000',
      '000000000',
      '000000000',
    ],
  },
  // v2 — a fuel droplet. The v1 pump silhouette read as a domino/dice at
  // this scale; a droplet is the icon real fuel gauges/pump signage already
  // uses, and its filled-diamond shape reads clean even at 9x9.
  fuel: {
    label: 'Fuel',
    rows: [
      '000010000',
      '000111000',
      '001111100',
      '011111110',
      '011111110',
      '011111110',
      '001111100',
      '000111000',
      '000000000',
    ],
  },
  fallback: {
    label: 'Other',
    rows: [
      '000010000',
      '000010000',
      '000111000',
      '011111110',
      '111111111',
      '011111110',
      '001111100',
      '010000010',
      '100000001',
    ],
  },
}

// Rejected/alternate designs, kept only for the `/dev/sprites` review page's
// side-by-side comparison — not used anywhere in the live app.
export const ICON_CANDIDATES = {
  shop: [
    {
      label: 'v1: Bag (rejected — read as an appliance)',
      rows: [
        '001001000', '001001000', '011111100', '010000100',
        '010000100', '010000100', '011111100', '000000000', '000000000',
      ],
    },
    { label: 'v2: Price tag (adopted)', rows: POI_ICONS.shop.rows },
    {
      label: 'v2b: Storefront',
      rows: [
        '000111000', '001111100', '011111110', '000000000',
        '011111110', '010000010', '010011010', '010011010', '011111110',
      ],
    },
  ],
  lodging: [
    {
      label: 'v1: Bed frame (rejected — unreadable at this scale)',
      rows: [
        '000000000', '000000000', '000000000', '011ww1110',
        '010000010', '011111110', '010000010', '010000010', '000000000',
      ],
    },
    { label: 'v2: Crescent moon (adopted)', rows: POI_ICONS.lodging.rows },
    {
      label: 'v2b: Bed, redrawn',
      rows: [
        '000000000', '011000000', '011000000', '011111110',
        '010000010', '010000010', '000000000', '010000010', '010000010',
      ],
    },
  ],
  fuel: [
    {
      label: 'v1: Pump (rejected — read as a domino)',
      rows: [
        '011100000', '010100000', '011100000', '010100000',
        '010100000', '011100000', '000000110', '000000000', '000000000',
      ],
    },
    { label: 'v2: Droplet (adopted)', rows: POI_ICONS.fuel.rows },
    {
      label: 'v2b: Lightning bolt (electric/charging)',
      rows: [
        '000011000', '000110000', '001100000', '011111100',
        '000011000', '000110000', '001100000', '011000000', '000000000',
      ],
    },
  ],
}

// Maps an Overpass tag value (amenity=, shop=, tourism=) to one of the icons
// above. `revealPOIs()` in navigation.js already derives a single `category`
// string per POI the same way (amenity ?? shop ?? tourism ?? 'poi') — this
// picks up from there rather than re-deriving from raw tags.
const CATEGORY_MAP = {
  restaurant: 'food', fast_food: 'food', food_court: 'food', ice_cream: 'food',
  cafe: 'cafe',
  bar: 'bar', pub: 'bar', biergarten: 'bar',
  fuel: 'fuel', parking: 'fuel', charging_station: 'fuel',
  hotel: 'lodging', motel: 'lodging', guest_house: 'lodging', hostel: 'lodging', apartment: 'lodging',
  museum: 'culture', gallery: 'culture', artwork: 'culture', attraction: 'culture', viewpoint: 'culture', theatre: 'culture', cinema: 'culture',
  park: 'nature', garden: 'nature', nature_reserve: 'nature', picnic_site: 'nature',
  // Common shop= values — navigation.js's revealPOIs() collapses
  // amenity/shop/tourism into one `category` string with no record of which
  // tag it came from, so these are just the frequent literal values rather
  // than "any shop tag" (that distinction would need passing the tag
  // namespace through from revealPOIs(), not just its value).
  supermarket: 'shop', convenience: 'shop', clothes: 'shop', books: 'shop',
  bakery: 'shop', hairdresser: 'shop', department_store: 'shop', gift: 'shop',
  // historic= and natural= values — only ever show up when navigation.js's
  // revealPOIs() adds its interest-keyword filters (an Adventurer archetype
  // class whose player mentioned ruins/history/nature during onboarding);
  // the baseline query never requests these tags on its own.
  monument: 'culture', castle: 'culture', ruins: 'culture', archaeological_site: 'culture', memorial: 'culture',
  peak: 'nature', wood: 'nature', water: 'nature', beach: 'nature', wetland: 'nature',
}

export function iconForCategory(category) {
  return POI_ICONS[CATEGORY_MAP[category]] ?? POI_ICONS.fallback
}
