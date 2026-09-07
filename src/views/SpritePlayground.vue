<template>
  <div class="playground">
    <StarField />

    <div class="content">
      <header>
        <h1>SPRITE PLAYGROUND</h1>
        <p class="hint">A living design-review page, not a one-off mockup. "Live now" sections reflect what's actually in the class data files today; "considered" sections are candidates that didn't get adopted (anywhere, or for that specific genre) — kept for reference, not wired into anything.</p>
      </header>

      <section class="sandbox">
        <h2>Sprite sandbox — build your own</h2>
        <p class="hint">Paste or type rows using the same character vocabulary every class's <code>sprite:</code> array already uses — <code>0</code> transparent, <code>1</code> the previewed color, <code>2</code> skin, <code>w</code> white, <code>g</code> gray, <code>G</code> gold, <code>d</code> dark. One row per line; rows don't need to match lengths (several live sprites already mix them). Nothing here touches real game data until you paste the result into a class file yourself.</p>

        <div class="sandbox-controls">
          <label>Start from
            <select v-model="sandboxStartId">
              <option value="">— blank canvas —</option>
              <option v-for="opt in CLASS_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </label>
          <PixelButton variant="ghost" @click="loadStart">LOAD</PixelButton>
          <span class="hint sub" style="margin:0;">Loading a real class's sprite as a base to mutate — same approach the adopted alternate poses used (see Genres.md) — is usually easier than drawing free-hand.</span>
        </div>

        <div class="sandbox-body">
          <textarea
            v-model="sandboxText"
            class="sandbox-textarea"
            spellcheck="false"
            rows="14"
          />

          <div class="sandbox-preview">
            <div class="sandbox-preview-swatches">
              <label>Color <input type="color" v-model="sandboxColor" /></label>
              <div class="size-buttons">
                <button
                  v-for="sz in [4, 6, 8, 10, 12]"
                  :key="sz"
                  type="button"
                  :class="{ active: sandboxPixelSize === sz }"
                  @click="sandboxPixelSize = sz"
                >{{ sz }}px</button>
              </div>
            </div>

            <div class="sandbox-canvas-wrap">
              <PixelSprite :rows="sandboxRows" :color="sandboxColor" :pixelSize="sandboxPixelSize" />
            </div>

            <p class="hint sub">At the actual sizes used in the app (profile list 3px, class-select card 4px, ability-reveal 5px, HUD/welcome 6px, done/profile 8px) — check legibility here, not just at the size above, especially the small end:</p>
            <div class="sandbox-real-sizes">
              <div v-for="sz in [3, 4, 5, 6, 8]" :key="sz" class="real-size-cell">
                <PixelSprite :rows="sandboxRows" :color="sandboxColor" :pixelSize="sz" />
                <span>{{ sz }}px</span>
              </div>
            </div>
          </div>
        </div>

        <p v-if="sandboxWarnings.length" class="sandbox-warning">
          <span v-for="w in sandboxWarnings" :key="w">{{ w }}<br /></span>
        </p>

        <div class="sandbox-actions">
          <PixelButton @click="copyAsArray">COPY AS JS ARRAY</PixelButton>
          <span v-if="copyStatus" class="copy-status">{{ copyStatus }}</span>
        </div>
        <pre class="sandbox-output">{{ formattedArray }}</pre>
      </section>

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
import { ref, computed } from 'vue'
import StarField from '@/components/StarField.vue'
import PixelSprite from '@/components/PixelSprite.vue'
import PixelButton from '@/components/PixelButton.vue'
import { GENRES } from '@/data/genres.js'
import { POI_ICONS, ICON_CANDIDATES } from '@/data/poiIcons.js'
import { ARCHETYPES } from '@/data/spriteAlternates.js'

// --- Sprite sandbox ---------------------------------------------------
// A scratch space for hand-drawn sprites that never touches real class data
// — everything here lives in local component state until someone copies the
// result out and pastes it into a class file themselves.

// 9 cols x 12 rows matches the convention every shipped sprite already uses
// (see CLAUDE.md's original spec and every class file since) — not a hard
// requirement (PixelSprite.vue sizes its canvas off whatever's given), just
// a sane default canvas to start drawing on.
const BLANK_TEMPLATE = Array(12).fill('000000000').join('\n')

const CLASS_OPTIONS = GENRES.flatMap((genre) =>
  (genre.classes ?? []).map((cls) => ({
    value: `${genre.id}:${cls.id}`,
    label: `${genre.name} — ${cls.name}`,
    rows:  cls.sprite,
    color: cls.color,
  })),
)

const sandboxStartId    = ref('')
const sandboxText       = ref(BLANK_TEMPLATE)
const sandboxColor      = ref('#F0C060')
const sandboxPixelSize  = ref(8)
const copyStatus        = ref(null)
let copyStatusTimer = null

const sandboxRows = computed(() => sandboxText.value.replace(/\r\n/g, '\n').split('\n'))

const VALID_SPRITE_CHARS = new Set(['0', '1', '2', 'w', 'g', 'G', 'd'])
const sandboxWarnings = computed(() => {
  const warnings = []
  sandboxRows.value.forEach((row, i) => {
    for (const ch of row) {
      if (!VALID_SPRITE_CHARS.has(ch)) {
        warnings.push(`Row ${i + 1}: '${ch}' isn't a recognized character — it'll render as white, which is probably not what you meant. Expected one of 0 1 2 w g G d.`)
        break // one warning per row is plenty
      }
    }
  })
  return warnings
})

const formattedArray = computed(() => {
  const body = sandboxRows.value.map((r) => `  '${r.replace(/'/g, "\\'")}',`).join('\n')
  return `[\n${body}\n]`
})

function loadStart() {
  if (!sandboxStartId.value) {
    sandboxText.value  = BLANK_TEMPLATE
    sandboxColor.value = '#F0C060'
    return
  }
  const opt = CLASS_OPTIONS.find((o) => o.value === sandboxStartId.value)
  if (!opt) return
  sandboxText.value  = opt.rows.join('\n')
  sandboxColor.value = opt.color
}

async function copyAsArray() {
  if (copyStatusTimer) clearTimeout(copyStatusTimer)
  try {
    await navigator.clipboard.writeText(formattedArray.value)
    copyStatus.value = 'Copied — paste into a class\'s sprite: field.'
  } catch {
    copyStatus.value = 'Could not copy automatically — select the text below by hand.'
  }
  copyStatusTimer = setTimeout(() => { copyStatus.value = null }, 4000)
}

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

/* --- Sprite sandbox --- */

.sandbox-controls {
  display:    flex;
  align-items: center;
  gap:        0.75rem;
  flex-wrap:  wrap;
  margin:     0.75rem 0 1.25rem;
}

.sandbox-controls label {
  display:     flex;
  align-items: center;
  gap:         8px;
  font-size:   7px;
  color:       var(--ff-muted);
}

.sandbox-controls select {
  font-family: 'Press Start 2P', monospace;
  font-size:   7px;
  padding:     8px;
  background:  var(--ff-panel);
  color:       var(--ff-text);
  border:      2px solid var(--ff-border);
}

.sandbox-body {
  display:     flex;
  gap:         1.5rem;
  flex-wrap:   wrap;
  align-items: flex-start;
}

.sandbox-textarea {
  flex:            1 1 260px;
  min-width:       220px;
  min-height:      280px;
  padding:         12px;
  background:      var(--ff-dark);
  color:           var(--ff-text);
  border:          2px solid var(--ff-border);
  font-family:     'Consolas', 'Courier New', monospace;
  font-size:       13px;
  line-height:     1.5;
  letter-spacing:  0.05em;
  resize:          vertical;
}

.sandbox-textarea:focus {
  outline:      none;
  border-color: var(--ff-gold-dark);
}

.sandbox-preview {
  flex:           1 1 260px;
  display:        flex;
  flex-direction: column;
  gap:            0.85rem;
  padding:        1rem;
  background:     var(--ff-panel);
  border:         2px solid var(--ff-border);
}

.sandbox-preview-swatches {
  display:     flex;
  align-items: center;
  gap:         1rem;
  flex-wrap:   wrap;
}

.sandbox-preview-swatches label {
  display:     flex;
  align-items: center;
  gap:         6px;
  font-size:   7px;
  color:       var(--ff-muted);
}

.size-buttons {
  display: flex;
  gap:     4px;
}

.size-buttons button {
  font-family: 'Press Start 2P', monospace;
  font-size:   6px;
  padding:     6px 8px;
  background:  var(--ff-dark);
  color:       var(--ff-muted);
  border:      1px solid var(--ff-border);
  cursor:      pointer;
}

.size-buttons button.active {
  color:        var(--ff-gold);
  border-color: var(--ff-gold-dark);
}

.sandbox-canvas-wrap {
  display:         flex;
  justify-content: center;
  padding:         1.25rem;
  background:      var(--ff-night);
  border:          1px solid var(--ff-border);
}

.sandbox-real-sizes {
  display:         flex;
  gap:             1.5rem;
  justify-content: center;
  align-items:     flex-end;
}

.real-size-cell {
  display:        flex;
  flex-direction: column;
  align-items:    center;
  gap:            0.3rem;
}

.real-size-cell span {
  font-size: 6px;
  color:     var(--ff-muted);
}

.sandbox-warning {
  font-size:   7px;
  color:       #E85C5C;
  line-height: 1.9;
  margin-top:  0.75rem;
}

.sandbox-actions {
  display:     flex;
  align-items: center;
  gap:         0.75rem;
  flex-wrap:   wrap;
  margin-top:  1rem;
}

.copy-status {
  font-size: 7px;
  color:     var(--ff-gold);
}

.sandbox-output {
  margin-top:      0.75rem;
  padding:         12px;
  background:      var(--ff-dark);
  border:          2px solid var(--ff-border);
  font-family:     'Consolas', 'Courier New', monospace;
  font-size:       11px;
  line-height:     1.5;
  color:           var(--ff-text);
  white-space:     pre;
  overflow-x:      auto;
  max-height:      240px;
}
</style>
