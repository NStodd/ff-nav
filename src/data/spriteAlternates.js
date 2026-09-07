// Candidate alternate character sprites — design review only, not adopted
// into any class's data file yet. Each alternate is a deliberately small,
// low-risk mutation of an existing, already-shipped sprite (same row-length
// pattern, same PixelSprite.vue character vocabulary) rather than a from-
// scratch silhouette, so the odds of an accidental garbled render are low —
// only specific rows change, and every changed row keeps its original length.
//
// Grouped by archetype, not by genre — the point of the archetype system
// (see Genres.md) is that one silhouette serves all four genres via
// recolor, so a new pose is reviewed once per archetype and, if adopted,
// replaces that one shared shape everywhere at once.

// Adventurer archetype's current shape (Fighter/Gunslinger/Buccaneer; Pilot's
// is a separate helmet variant already) — included as "current" for
// side-by-side comparison, not itself a candidate.
const ADVENTURER_CURRENT = [
  '00022200', '00222220', '00222220', '00212120', '00222220',
  '0G11111G', '011111110', '011111110', '001g1g100', '001111100',
  '011111110', '011111110',
]

export const ADVENTURER_ALTS = [
  { label: 'Current', rows: ADVENTURER_CURRENT },
  {
    label: 'Scout (hooded)',
    rows: [
      '000ddd00', '00d222d0', '00d222d0', '00212120', '00222220',
      '0G11111G', '011111110', '011111110', '001g1g100', '001111100',
      '011111110', '011111110',
    ],
  },
  {
    label: 'Vanguard (sash)',
    rows: [
      '00022200', '00222220', '00222220', '00212120', '00222220',
      '0G11111G', '0G1111110', '0G1111110', '001g1g100', '001111100',
      '011111110', '011111110',
    ],
  },
]

// Speedrunner archetype's current shape (Thief/Smuggler/Outrider/Corsair).
const SPEEDRUNNER_CURRENT = [
  '000d1d000', '00d111d00', '00122120', '00111110', '001d1d100',
  '0g1111g0', '0g111110', '011g1g10', '001111100', '011111110',
  '011d1d110', '011d0d110',
]

export const SPEEDRUNNER_ALTS = [
  { label: 'Current', rows: SPEEDRUNNER_CURRENT },
  {
    label: 'Ninja (full mask)',
    rows: [
      '000d1d000', '00d111d00', '00111110', '00111110', '001d1d100',
      '0g1111g0', '0g111110', '011g1g10', '001111100', '011111110',
      '011d1d110', '011d0d110',
    ],
  },
  {
    label: 'Sprinter (mid-stride)',
    rows: [
      '000d1d000', '00d111d00', '00122120', '00111110', '001d1d100',
      '0g1111g0', '0g111110', '011g1g10', '001111100', '011111110',
      '011d1d110', '0011d1d10',
    ],
  },
]

// Connector archetype's current shape (White Mage/Diplomat/Wagon Master/Quartermaster).
const CONNECTOR_CURRENT = [
  '001www100', '01wwwww10', '01w2w2w10', '01wwwww10', '001www100',
  '011111110', '011111110', '001111100', '001111100', '011111110',
  '01100110', '01100110',
]

export const CONNECTOR_ALTS = [
  { label: 'Current', rows: CONNECTOR_CURRENT },
  {
    label: 'Herald (staff)',
    rows: [
      '001www100d', '01wwwww10d', '01w2w2w10d', '01wwwww10d', '001www100d',
      '011111110d', '011111110d', '001111100d', '001111100d', '011111110',
      '01100110', '01100110',
    ],
  },
  {
    label: 'Guide (lantern)',
    rows: [
      '001www100', '01wwwww10', '01w2w2w10', '01wwwww10', '001www100',
      '011111110', '011111110', '001111100GG', '001111100GG', '011111110',
      '01100110', '01100110',
    ],
  },
]

// Sovereign archetype's current shape (Black Mage/Overseer/Outlaw/Captain).
const SOVEREIGN_CURRENT = [
  '001111100', '011111110', '11ddddd11', '11ww1ww11', '011www110',
  '001111100', '001111100', '011111110', '001111100', '001100100',
  '001001100', '000111000',
]

export const SOVEREIGN_ALTS = [
  { label: 'Current', rows: SOVEREIGN_CURRENT },
  {
    label: 'Reaper (peaked hood)',
    rows: [
      '000111000', '001111100', '011111110', '11ddddd11', '11ww1ww11',
      '011www110', '001111100', '001111100', '011111110', '001111100',
      '001100100', '001001100', '000111000',
    ],
  },
  {
    label: 'Warden (faceless)',
    rows: [
      '001111100', '011111110', '11ddddd11', '11ddddd11', '011www110',
      '001111100', '001111100', '011111110', '001111100', '001100100',
      '001001100', '000111000',
    ],
  },
]

export const ARCHETYPES = [
  { id: 'adventurer', label: 'Adventurer', alts: ADVENTURER_ALTS },
  { id: 'speedrunner', label: 'Speedrunner', alts: SPEEDRUNNER_ALTS },
  { id: 'connector', label: 'Connector', alts: CONNECTOR_ALTS },
  { id: 'sovereign', label: 'Sovereign', alts: SOVEREIGN_ALTS },
]
