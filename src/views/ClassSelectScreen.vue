<template>
  <div class="screen">
    <StarField />

    <!-- Corner decorations -->
    <div class="corner corner-tl" />
    <div class="corner corner-tr" />
    <div class="corner corner-bl" />
    <div class="corner corner-br" />

    <div class="content">
      <header class="header">
        <h1>CRYSTAL PATH</h1>
        <PixelDivider />
        <p class="subtitle">NAVIGATION CHRONICLES</p>
      </header>

      <p class="prompt">— choose your class —</p>

      <div class="grid" role="radiogroup" aria-label="Class selection">
        <ClassCard
          v-for="cls in CLASSES"
          :key="cls.id"
          :classData="cls"
          :selected="selected(cls.id)"
          @select="onSelect(cls.id)"
        />
      </div>

      <div class="confirm-area">
        <button
          id="confirm"
          :disabled="!selectedId"
          @click="confirm"
        >
          &#9658; CONFIRM CLASS
        </button>
        <p v-if="selectedId" class="confirm-text">
          {{ CLASSES.find(c => c.id === selectedId)?.name.toUpperCase() }} selected
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '@/stores/player.js'
import { CLASSES } from '@/data/classes.js'
import StarField from '@/components/StarField.vue'
import PixelDivider from '@/components/PixelDivider.vue'
import ClassCard from '@/components/ClassCard.vue'

const router = useRouter()
const store  = usePlayerStore()

const selectedId = ref(null)
const selected   = (id) => selectedId.value === id

function onSelect(id) {
  selectedId.value = id
}

function confirm() {
  const cls = CLASSES.find(c => c.id === selectedId.value)
  store.selectClass(cls)
  router.push({ name: 'onboarding' })
}
</script>

<style scoped>
.screen {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem 1rem 3rem;
}

.corner {
  position: absolute;
  width: 16px;
  height: 16px;
  pointer-events: none;
}
.corner-tl { top: 1rem;    left: 1rem;  border-top: 2px solid var(--ff-gold-dark); border-left:  2px solid var(--ff-gold-dark); }
.corner-tr { top: 1rem;    right: 1rem; border-top: 2px solid var(--ff-gold-dark); border-right: 2px solid var(--ff-gold-dark); }
.corner-bl { bottom: 1rem; left: 1rem;  border-bottom: 2px solid var(--ff-gold-dark); border-left:  2px solid var(--ff-gold-dark); }
.corner-br { bottom: 1rem; right: 1rem; border-bottom: 2px solid var(--ff-gold-dark); border-right: 2px solid var(--ff-gold-dark); }

.content {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 960px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.header {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

h1 {
  font-size: clamp(14px, 3vw, 24px);
  color: var(--ff-gold);
  letter-spacing: 0.1em;
  text-shadow: 0 0 20px rgba(240, 192, 96, 0.4);
}

.subtitle {
  font-size: 8px;
  color: var(--ff-muted);
  letter-spacing: 0.15em;
}

.prompt {
  font-size: 8px;
  color: var(--ff-muted);
  letter-spacing: 0.1em;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  width: 100%;
}

.confirm-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

#confirm {
  font-family: 'Press Start 2P', monospace;
  font-size: 10px;
  padding: 0.75rem 1.5rem;
  background: var(--ff-gold);
  color: var(--ff-night);
  border: none;
  cursor: pointer;
  letter-spacing: 0.05em;
  transition: opacity 0.15s, transform 0.1s;
}

#confirm:hover:not(:disabled) {
  opacity: 0.85;
  transform: translateY(-1px);
}

#confirm:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.confirm-text {
  font-size: 7px;
  color: var(--ff-gold);
  letter-spacing: 0.05em;
}
</style>
