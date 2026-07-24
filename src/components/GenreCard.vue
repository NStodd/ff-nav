<template>
  <div
    class="card"
    :class="{ locked: !available }"
    role="button"
    :aria-disabled="!available"
    :tabindex="available ? 0 : -1"
    :style="{ '--cc': genreData.color }"
    @click="onActivate"
    @keydown.enter.space.prevent="onActivate"
  >
    <div class="card-inner">
      <div v-if="!available" class="badge">COMING SOON</div>
      <p class="genre-name">{{ genreData.name.toUpperCase() }}</p>
      <p class="genre-tagline">&#9733; {{ genreData.tagline.toUpperCase() }}</p>
      <p class="genre-desc">{{ genreData.description }}</p>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  genreData: { type: Object, required: true },
})

const emit = defineEmits(['select'])

const available = props.genreData.status === 'available'

function onActivate() {
  if (!available) return
  emit('select')
}
</script>

<style scoped>
.card {
  position: relative;
  border: 2px solid var(--ff-border);
  background: var(--ff-panel);
  padding: 1.25rem 1rem;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  outline: none;
}

.card:hover {
  border-color: var(--cc);
  background: var(--ff-dark);
}

.card:focus-visible {
  outline: 2px solid var(--cc);
  outline-offset: 2px;
}

.card.locked {
  cursor: not-allowed;
  opacity: 0.5;
}

.card.locked:hover {
  border-color: var(--ff-border);
  background: var(--ff-panel);
}

.card-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  text-align: center;
}

.badge {
  font-size: 6px;
  color: var(--ff-muted);
  letter-spacing: 0.1em;
  border: 1px solid var(--ff-border);
  padding: 3px 6px;
  margin-bottom: 0.25rem;
}

.genre-name {
  font-size: 11px;
  color: var(--cc);
  letter-spacing: 0.05em;
}

.genre-tagline {
  font-size: 7px;
  color: var(--ff-gold);
}

.genre-desc {
  font-size: 7px;
  color: var(--ff-muted);
  line-height: 1.6;
}
</style>
