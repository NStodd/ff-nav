<template>
  <div
    class="card"
    role="radio"
    :aria-checked="selected"
    tabindex="0"
    :style="{ '--cc': classData.color }"
    :class="{ selected }"
    @click="$emit('select')"
    @keydown.enter.space.prevent="$emit('select')"
  >
    <div class="card-inner">
      <PixelSprite :rows="classData.sprite" :color="classData.color" :pixelSize="4" />
      <div class="card-info">
        <p class="class-name">{{ classData.name.toUpperCase() }}</p>
        <p class="class-tag">&#9733; {{ classData.tag.toUpperCase() }}</p>
        <p class="class-desc">{{ classData.description }}</p>
        <div class="ability">
          <span class="ability-name">{{ classData.ability }}</span>
          <span class="ability-desc">{{ classData.abilityDesc }}</span>
        </div>
        <div class="stats">
          <div v-for="stat in ['str', 'exp', 'agi']" :key="stat" class="stat-row">
            <span class="stat-label">{{ stat.toUpperCase() }}</span>
            <span
              v-for="n in 5"
              :key="n"
              class="stat-pip"
              :class="{ filled: n <= classData.stats[stat] }"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import PixelSprite from './PixelSprite.vue'

defineProps({
  classData: { type: Object, required: true },
  selected:  { type: Boolean, default: false },
})

defineEmits(['select'])
</script>

<style scoped>
.card {
  border: 2px solid var(--ff-border);
  background: var(--ff-panel);
  padding: 1rem;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  outline: none;
}

.card:hover {
  border-color: var(--cc);
  background: var(--ff-dark);
}

.card.selected {
  border-color: var(--cc);
  background: var(--ff-dark);
}

.card:focus-visible {
  outline: 2px solid var(--cc);
  outline-offset: 2px;
}

.card-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.card-info {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.class-name {
  font-size: 10px;
  color: var(--cc);
  letter-spacing: 0.05em;
}

.class-tag {
  font-size: 7px;
  color: var(--ff-gold);
}

.class-desc {
  font-size: 7px;
  color: var(--ff-muted);
  line-height: 1.6;
}

.ability {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  border-left: 2px solid var(--cc);
  padding-left: 0.5rem;
}

.ability-name {
  font-size: 7px;
  color: var(--cc);
}

.ability-desc {
  font-size: 6px;
  color: var(--ff-muted);
  line-height: 1.5;
}

.stats {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-top: 0.25rem;
}

.stat-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.stat-label {
  font-size: 6px;
  color: var(--ff-muted);
  width: 20px;
  flex-shrink: 0;
}

.stat-pip {
  display: inline-block;
  width:  7px;
  height: 7px;
  border: 1px solid var(--ff-border);
  background: transparent;
}

.stat-pip.filled {
  background: var(--cc);
  border-color: var(--cc);
}
</style>
