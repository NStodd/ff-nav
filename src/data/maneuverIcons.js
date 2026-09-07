// Turn-by-turn maneuver icons (Direction F, phase 2). Same 9x9,
// character-per-pixel format as poiIcons.js — '1' becomes whatever color
// the caller passes (the active class color, same as every other marker),
// '0' is transparent. See Sprites.md for the full format writeup.
//
// OSRM's 8 maneuver modifiers (sharp/slight left, left, sharp/slight right,
// right, straight, uturn) are bucketed down to the 4 directions worth a
// distinct icon at HUD size — navigation.js's maneuverIconKey() does that
// bucketing; the nuance ("slight" vs "sharp") stays in the instruction text
// instead, which is where it's actually legible.
//
// These are a first pass, not a finished design review — the same
// "ship something real, then compare/refine visually" path poiIcons.js's
// v1→v2 redesign took (see PLANNING.md §17). Worth a look in
// SpritePlayground.vue before shipping to real users.

const STRAIGHT = [
  '000010000',
  '000111000',
  '001111100',
  '011111110',
  '000111000',
  '000111000',
  '000111000',
  '000111000',
  '000111000',
]

const LEFT = [
  '000001000',
  '000011000',
  '000111000',
  '111111000',
  '000111000',
  '000011000',
  '000001000',
  '000000000',
  '000000000',
]

// Mirrored, not hand-drawn — guarantees RIGHT is a true reflection of LEFT
// rather than two icons that were meant to match but quietly don't.
const RIGHT = LEFT.map(row => row.split('').reverse().join(''))

const UTURN = [
  '000000000',
  '001111100',
  '010000010',
  '010000010',
  '010000010',
  '011000010',
  '001100010',
  '000000010',
  '000001000',
]

const ROUNDABOUT = [
  '000111000',
  '001000100',
  '010000010',
  '010000010',
  '010000010',
  '010000010',
  '010000010',
  '001000100',
  '000111000',
]

const MERGE = [
  '010000010',
  '010000010',
  '001000100',
  '001000100',
  '000101000',
  '000010000',
  '000010000',
  '000010000',
  '000010000',
]

const ARRIVE = [
  '010000000',
  '011111000',
  '011111100',
  '011111000',
  '010000000',
  '010000000',
  '010000000',
  '010000000',
  '011100000',
]

export const MANEUVER_ICONS = {
  straight:   { label: 'Continue straight', rows: STRAIGHT },
  left:       { label: 'Turn left',         rows: LEFT },
  right:      { label: 'Turn right',        rows: RIGHT },
  uturn:      { label: 'U-turn',            rows: UTURN },
  roundabout: { label: 'Roundabout',        rows: ROUNDABOUT },
  merge:      { label: 'Merge',             rows: MERGE },
  arrive:     { label: 'Arrive',            rows: ARRIVE },
}

export function iconForManeuver(key) {
  return MANEUVER_ICONS[key] ?? MANEUVER_ICONS.straight
}
