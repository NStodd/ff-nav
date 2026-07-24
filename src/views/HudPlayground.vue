<template>
  <div class="playground">
    <StarField />

    <aside class="controls">
      <h1>HUD PLAYGROUND</h1>
      <p class="hint">Tweak live, then click "Copy CSS" and paste the block into <code>main.css</code>'s <code>:root</code>.</p>

      <section>
        <h2>Class preview</h2>
        <div class="class-picker">
          <button
            v-for="cls in CLASSES"
            :key="cls.id"
            class="class-btn"
            :class="{ active: store.chosenClass?.id === cls.id }"
            :style="{ '--cc': cls.color }"
            @click="previewClass(cls)"
          >
            {{ cls.name }}
          </button>
        </div>
      </section>

      <section>
        <h2>Panel</h2>
        <label>Background alpha <span>{{ panelAlpha }}</span>
          <input type="range" min="0" max="1" step="0.01" v-model.number="panelAlpha">
        </label>
        <label>Backdrop blur <span>{{ panelBlur }}px</span>
          <input type="range" min="0" max="20" step="1" v-model.number="panelBlur">
        </label>
        <label>Padding <span>{{ padding }}px</span>
          <input type="range" min="0" max="32" step="1" v-model.number="padding">
        </label>
        <label>Gap <span>{{ gap }}px</span>
          <input type="range" min="0" max="32" step="1" v-model.number="gap">
        </label>
        <label>Border glow <span>{{ glow }}</span>
          <input type="range" min="0" max="1" step="0.01" v-model.number="glow">
        </label>
      </section>

      <section>
        <h2>Elements</h2>
        <label>Sprite pixel size <span>{{ spriteSize }}</span>
          <input type="range" min="2" max="12" step="1" v-model.number="spriteSize">
        </label>
        <label>Stat pip size <span>{{ pipSize }}px</span>
          <input type="range" min="4" max="16" step="1" v-model.number="pipSize">
        </label>
        <label>Ability button width <span>{{ abilitySize }}px</span>
          <input type="range" min="60" max="160" step="2" v-model.number="abilitySize">
        </label>
        <label>Ability cooldown <span>{{ cooldownMs }}ms</span>
          <input type="range" min="0" max="8000" step="250" v-model.number="cooldownMs">
        </label>
      </section>

      <section>
        <h2>Fake data</h2>
        <label>ETA <span>{{ navigation.etaFormatted ?? '—' }}</span>
          <input type="range" min="0" max="3600" step="15" v-model.number="etaSeconds">
        </label>
      </section>

      <button class="copy-btn" @click="copyCss">{{ copied ? 'COPIED ✓' : 'COPY CSS ▶' }}</button>
      <p class="hint">Click the ability button in the preview below to test the cooldown animation.</p>
    </aside>

    <main class="preview">
      <HudOverlay
        :style="hudStyle"
        :spriteSize="spriteSize"
        :cooldownMs="cooldownMs"
        @ability="() => {}"
      />
    </main>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { usePlayerStore } from '@/stores/player.js'
import { useNavigationStore } from '@/stores/navigation.js'
import { CLASSES } from '@/data/classes.js'
import { GENRES } from '@/data/genres.js'
import StarField from '@/components/StarField.vue'
import HudOverlay from '@/components/HudOverlay.vue'

// This page previews against the real player/navigation stores (so HudOverlay
// needs no special-casing), but assigns state directly to the refs rather than
// calling selectGenre()/selectClass() — those actions also persist to
// localStorage, and this tool shouldn't clobber a real in-progress selection.
// The override only lives for the current session; refresh restores the real one.
const store      = usePlayerStore()
const navigation = useNavigationStore()

const ffGenre = GENRES.find(g => g.id === 'ff')
if (!store.chosenClass) {
  store.chosenGenre = ffGenre
  store.chosenClass = CLASSES[0]
}

function previewClass(cls) {
  store.chosenGenre = ffGenre
  store.chosenClass = cls
}

const panelAlpha  = ref(0.92)
const panelBlur   = ref(6)
const padding     = ref(14)
const gap         = ref(18)
const glow        = ref(0.35)
const spriteSize  = ref(6)
const pipSize     = ref(8)
const abilitySize = ref(100)
const cooldownMs  = ref(4000)
const etaSeconds  = ref(90)

watch(etaSeconds, (v) => { navigation.eta = v }, { immediate: true })

const hudStyle = computed(() => ({
  '--hud-panel-alpha':  panelAlpha.value,
  '--hud-panel-blur':   `${panelBlur.value}px`,
  '--hud-padding':      `${padding.value}px`,
  '--hud-gap':          `${gap.value}px`,
  '--hud-glow':         glow.value,
  '--hud-pip-size':     `${pipSize.value}px`,
  '--hud-ability-size': `${abilitySize.value}px`,
}))

const copied = ref(false)

function copyCss() {
  const css = `:root {
  --hud-panel-alpha:  ${panelAlpha.value};
  --hud-panel-blur:   ${panelBlur.value}px;
  --hud-padding:      ${padding.value}px;
  --hud-gap:          ${gap.value}px;
  --hud-pip-size:     ${pipSize.value}px;
  --hud-glow:         ${glow.value};
  --hud-ability-size: ${abilitySize.value}px;
}`
  navigator.clipboard.writeText(css)
  copied.value = true
  setTimeout(() => { copied.value = false }, 1500)
}
</script>

<style scoped>
.playground {
  position: relative;
  display: flex;
  min-height: 100vh;
  overflow: hidden;
  font-family: 'Press Start 2P', monospace;
}

.controls {
  position: relative;
  z-index: 1;
  width: 320px;
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
  line-height: 1.6;
}

.hint code {
  color: var(--ff-text);
}

section {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
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

.class-picker {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.4rem;
}

.class-btn {
  font-family: 'Press Start 2P', monospace;
  font-size: 6px;
  padding: 8px 6px;
  background: var(--ff-panel);
  color: var(--cc);
  border: 2px solid var(--ff-border);
  cursor: pointer;
}

.class-btn.active {
  border-color: var(--cc);
  background: color-mix(in srgb, var(--cc) 15%, var(--ff-panel));
}

.copy-btn {
  font-family: 'Press Start 2P', monospace;
  font-size: 9px;
  padding: 10px;
  background: var(--ff-gold);
  color: var(--ff-night);
  border: none;
  cursor: pointer;
}

.preview {
  position: relative;
  flex: 1;
  background:
    linear-gradient(color-mix(in srgb, var(--ff-border) 40%, transparent) 1px, transparent 1px) 0 0 / 40px 40px,
    linear-gradient(90deg, color-mix(in srgb, var(--ff-border) 40%, transparent) 1px, transparent 1px) 0 0 / 40px 40px,
    var(--ff-night);
}
</style>
