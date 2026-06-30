<template>
  <div class="ability-step" :style="{ '--cc': classData.color }">
    <div class="reveal-container" :class="{ revealed }">
      <div class="ability-icon">
        <PixelSprite
          :rows="classData.sprite"
          :color="classData.color"
          :pixelSize="5"
        />
      </div>

      <div class="ability-badge">
        <span class="ability-label">ABILITY UNLOCKED</span>
      </div>

      <h2 class="ability-name">{{ classData.ability }}</h2>

      <p class="ability-desc">{{ classData.abilityDesc }}</p>

      <div class="ability-effect">
        <span v-for="n in 5" :key="n" class="spark" :style="{ '--i': n }" />
      </div>
    </div>

    <div class="actions">
      <PixelButton
        :classColor="classData.color"
        :disabled="!revealed"
        @click="$emit('next')"
      >
        Continue
      </PixelButton>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import PixelSprite from '@/components/PixelSprite.vue'
import PixelButton from '@/components/PixelButton.vue'

defineProps({
  classData: { type: Object, required: true },
})

defineEmits(['next'])

const revealed = ref(false)

onMounted(() => {
  setTimeout(() => {
    revealed.value = true
  }, 300)
})
</script>

<style scoped>
.ability-step {
  display:        flex;
  flex-direction: column;
  align-items:    center;
  gap:            24px;
}

.reveal-container {
  display:        flex;
  flex-direction: column;
  align-items:    center;
  gap:            16px;
  opacity:        0;
  transform:      scale(0.8);
  transition:     opacity 0.5s ease-out, transform 0.5s ease-out;
}

.reveal-container.revealed {
  opacity:   1;
  transform: scale(1);
}

.ability-icon {
  position:   relative;
  padding:    16px;
  background: var(--ff-panel);
  border:     2px solid var(--cc);
  animation:  glow 2s ease-in-out infinite;
}

@keyframes glow {
  0%, 100% { box-shadow: 0 0 10px color-mix(in srgb, var(--cc) 40%, transparent); }
  50%      { box-shadow: 0 0 30px color-mix(in srgb, var(--cc) 70%, transparent); }
}

.ability-badge {
  padding:       6px 12px;
  background:    var(--cc);
  animation:     pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.7; }
}

.ability-label {
  font-family:    'Press Start 2P', monospace;
  font-size:      7px;
  color:          var(--ff-night);
  letter-spacing: 1px;
}

.ability-name {
  font-family:    'Press Start 2P', monospace;
  font-size:      18px;
  color:          var(--cc);
  letter-spacing: 4px;
  text-shadow:    0 0 20px var(--cc);
  animation:      shimmer 2s linear infinite;
}

@keyframes shimmer {
  0%   { filter: brightness(1); }
  50%  { filter: brightness(1.3); }
  100% { filter: brightness(1); }
}

.ability-desc {
  font-family:  'Press Start 2P', monospace;
  font-size:    8px;
  color:        var(--ff-muted);
  text-align:   center;
  line-height:  1.8;
  max-width:    400px;
}

.ability-effect {
  position: relative;
  width:    100px;
  height:   20px;
}

.spark {
  position:      absolute;
  width:         4px;
  height:        4px;
  background:    var(--cc);
  border-radius: 50%;
  left:          calc(var(--i) * 20px);
  animation:     sparkle 1.5s ease-in-out infinite;
  animation-delay: calc(var(--i) * 0.15s);
}

@keyframes sparkle {
  0%, 100% { opacity: 0.2; transform: scale(0.5); }
  50%      { opacity: 1;   transform: scale(1.2); }
}

.actions {
  margin-top: 12px;
}
</style>
