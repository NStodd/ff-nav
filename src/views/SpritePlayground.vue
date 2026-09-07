<template>
  <div class="playground">
    <StarField />

    <div class="content">
      <header>
        <h1>SPRITE PLAYGROUND</h1>
        <p class="hint">A living design-review page, not a one-off mockup. "Live now" sections reflect what's actually in the class data files today; "considered" sections are candidates that didn't get adopted (anywhere, or for that specific genre) — kept for reference, not wired into anything.</p>
      </header>

      <section>
        <h2>POI category icons — live now</h2>
        <p class="hint">Wired into <code>MapScreen.vue</code>'s <code>poiMarkerEl()</code>. Tinted to the active class's color like every other marker; shown here at a fixed gold tint for a neutral comparison, and again in each genre's brand color to check they hold up across the palette.</p>

        <div class="icon-grid">
          <div v-for="(icon, key) in POI_ICONS" :key="key" class="icon-cell">
            <canvas :ref="(el) => drawIcon(el, icon.rows, '#F0C060')" class="icon-canvas" />
            <span class="icon-label">{{ icon.label }}</span>
          </div>
        </div>

        <p class="hint sub">Across genre brand colors:</p>
        <div class="icon-genre-row" v-for="genre in GENRES" :key="genre.id">
          <span class="genre-tag" :style="{ color: genre.color }">{{ genre.name }}</span>
          <canvas
            v-for="(icon, key) in POI_ICONS"
            :key="key"
            :ref="(el) => drawIcon(el, icon.rows, genre.color, 6)"
            class="icon-canvas small"
          />
        </div>
      </section>

      <section>
        <h2>POI icons — the redesign pass</h2>
        <p class="hint">Shop, lodging, and fuel didn't read clearly at v1 (a bag that looked like an appliance, a bed that looked like a gate, a pump that looked like a domino). Each got two new candidates; the winner is now live above.</p>
        <div v-for="(candidates, key) in ICON_CANDIDATES" :key="key" class="candidate-group">
          <h3>{{ key }}</h3>
          <div class="icon-grid">
            <div v-for="c in candidates" :key="c.label" class="icon-cell">
              <canvas :ref="(el) => drawIcon(el, c.rows, '#F0C060')" class="icon-canvas" />
              <span class="icon-label">{{ c.label }}</span>
            </div>
          </div>
        </div>
      </section>

      <section v-for="archetype in ARCHETYPES" :key="archetype.id">
        <h2>{{ archetype.label }} archetype — live now</h2>
        <div class="alt-sprites">
          <div v-for="genre in GENRES" :key="genre.id" class="alt-sprite-cell">
            <PixelSprite :rows="liveRowsFor(genre, archetype.id)" :color="colorFor(genre, archetype.id)" :pixelSize="7" />
            <span class="genre-tag small" :style="{ color: genre.color }">{{ genre.name }}</span>
            <span class="variant-label">{{ LIVE_VARIANT_LABELS[archetype.id][genre.id] }}</span>
          </div>
        </div>

        <p class="hint sub">Other poses considered for this archetype (not necessarily adopted anywhere):</p>
        <div class="alt-row" v-for="alt in archetype.alts.filter(a => a.label !== 'Current')" :key="alt.label">
          <span class="alt-label">{{ alt.label }}</span>
          <div class="alt-sprites">
            <div v-for="genre in GENRES" :key="genre.id" class="alt-sprite-cell">
              <PixelSprite :rows="alt.rows" :color="colorFor(genre, archetype.id)" :pixelSize="7" />
              <span class="genre-tag small" :style="{ color: genre.color }">{{ genre.name }}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import StarField from '@/components/StarField.vue'
import PixelSprite from '@/components/PixelSprite.vue'
import { GENRES } from '@/data/genres.js'
import { POI_ICONS, ICON_CANDIDATES } from '@/data/poiIcons.js'
import { ARCHETYPES } from '@/data/spriteAlternates.js'

const ARCHETYPE_INDEX = { adventurer: 0, speedrunner: 1, connector: 2, sovereign: 3 }

// What's actually live per genre, for the "live now" rows — see Genres.md's
// "Sprite reuse — and sprite variation" table, which this mirrors by hand
// rather than deriving automatically (there's no stored link from a class's
// `sprite` array back to which named variant it corresponds to).
const LIVE_VARIANT_LABELS = {
  adventurer:  { ff: 'Current', scifi: 'Current (own helmet variant)', western: 'Vanguard (sash)', pirate: 'Scout (hooded)' },
  speedrunner: { ff: 'Current', scifi: 'Ninja (full mask)', western: 'Sprinter (mid-stride)', pirate: 'Current' },
  connector:   { ff: 'Current', scifi: 'Herald (staff → antenna)', western: 'Guide (lantern)', pirate: 'Herald (staff → flagpole)' },
  sovereign:   { ff: 'Current', scifi: 'Warden (faceless)', western: 'Reaper (peaked hood)', pirate: 'Warden (faceless)' },
}

// Pulls the real per-genre class color/sprite for whichever archetype slot is
// being previewed (index 0-3 within that genre's CLASSES array — consistent
// across all four genres' roster files, see Genres.md).
function colorFor(genre, archetypeId) {
  return genre.classes[ARCHETYPE_INDEX[archetypeId]]?.color ?? '#F0C060'
}
function liveRowsFor(genre, archetypeId) {
  return genre.classes[ARCHETYPE_INDEX[archetypeId]]?.sprite ?? []
}

const COLOR_MAP = { '2': '#F5CBA7', w: '#FFFFFF', g: '#888888', G: '#F0C060', d: '#333333' }

function drawIcon(canvas, rows, color, pixelSize = 10) {
  if (!canvas) return
  const cols = Math.max(...rows.map(r => r.length))
  canvas.width  = cols * pixelSize
  canvas.height = rows.length * pixelSize
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  rows.forEach((row, ri) => {
    for (let ci = 0; ci < row.length; ci++) {
      const ch = row[ci]
      if (ch === '0') continue
      ctx.fillStyle = ch === '1' ? color : (COLOR_MAP[ch] ?? '#fff')
      ctx.fillRect(ci * pixelSize, ri * pixelSize, pixelSize - 1, pixelSize - 1)
    }
  })
}
</script>

<style scoped>
.playground {
  position: relative;
  min-height: 100vh;
  overflow-x: hidden;
  font-family: 'Press Start 2P', monospace;
  color: var(--ff-text);
}

.content {
  position: relative;
  z-index: 1;
  max-width: 960px;
  margin: 0 auto;
  padding: 2rem 1.5rem 4rem;
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
}

h1 {
  font-size: 16px;
  color: var(--ff-gold);
  letter-spacing: 0.05em;
  margin-bottom: 0.75rem;
}

h2 {
  font-size: 11px;
  color: var(--ff-gold);
  letter-spacing: 0.04em;
  margin-bottom: 0.6rem;
  border-bottom: 2px solid var(--ff-border);
  padding-bottom: 0.5rem;
}

h3 {
  font-size: 8px;
  color: var(--ff-text);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 1rem 0 0.5rem;
}

.hint {
  font-size: 8px;
  line-height: 1.8;
  color: var(--ff-muted);
  max-width: 70ch;
}

.hint.sub {
  margin-top: 1rem;
}

.hint code {
  color: var(--ff-text);
}

.candidate-group:first-child h3 {
  margin-top: 1rem;
}

.icon-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.icon-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--ff-panel);
  border: 2px solid var(--ff-border);
}

.icon-canvas {
  image-rendering: pixelated;
}

.icon-canvas.small {
  image-rendering: pixelated;
}

.icon-label {
  font-size: 6.5px;
  color: var(--ff-muted);
  letter-spacing: 0.02em;
  text-align: center;
  line-height: 1.5;
}

.icon-genre-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-top: 0.5rem;
  padding: 0.4rem 0;
}

.genre-tag {
  font-size: 7px;
  width: 80px;
  flex-shrink: 0;
}

.genre-tag.small {
  width: auto;
  font-size: 6px;
  margin-top: 0.3rem;
}

.variant-label {
  font-size: 5.5px;
  color: var(--ff-muted);
  text-align: center;
  max-width: 90px;
  line-height: 1.4;
}

.alt-row {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--ff-border);
}

.alt-row:last-child {
  border-bottom: none;
}

.alt-label {
  font-size: 8px;
  width: 150px;
  flex-shrink: 0;
  color: var(--ff-text);
}

.alt-sprites {
  display: flex;
  gap: 1.25rem;
  flex-wrap: wrap;
}

.alt-sprite-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  padding: 0.5rem;
  background: var(--ff-panel);
  border: 2px solid var(--ff-border);
}
</style>
