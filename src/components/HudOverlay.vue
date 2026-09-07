<template>
  <div class="hud-overlay" :style="{ '--cc': store.chosenClass.color }">
    <div class="hud-panel">
      <div class="hud-sprite">
        <PixelSprite :rows="store.chosenClass.sprite" :color="store.chosenClass.color" :pixelSize="spriteSize" />
      </div>

      <div class="hud-stats">
        <div v-for="stat in ['str', 'exp', 'agi']" :key="stat" class="stat-row">
          <span class="stat-label">{{ stat.toUpperCase() }}</span>
          <span
            v-for="n in 5"
            :key="n"
            class="stat-pip"
            :class="{ filled: n <= store.chosenClass.stats[stat] }"
          />
        </div>
      </div>

      <div class="hud-eta">
        <span class="eta-label">ETA</span>
        <span class="eta-value">{{ navigation.etaFormatted ?? '—' }}</span>
      </div>

      <!-- Direction F, phase 1: saved destinations. Only shown once there's
           something to save — an icon-only toggle rather than a labeled
           button, so it reads as a small glanceable state (filled vs hollow
           star) rather than one more thing competing for attention next to
           the ability button. -->
      <button
        v-if="navigation.destination"
        class="save-star"
        :class="{ saved: !!savedEntry }"
        @click="toggleSaved"
        :aria-label="savedEntry ? 'Remove saved destination' : 'Save this destination'"
      >{{ savedEntry ? '★' : '☆' }}</button>

      <AbilityButton
        :label="store.chosenClass.ability"
        :classColor="store.chosenClass.color"
        :cooldownMs="cooldownMs"
        @activate="$emit('ability')"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { usePlayerStore } from '@/stores/player.js'
import { useNavigationStore } from '@/stores/navigation.js'
import { useProfileStore } from '@/stores/profile.js'
import PixelSprite from '@/components/PixelSprite.vue'
import AbilityButton from '@/components/AbilityButton.vue'

defineProps({
  spriteSize: { type: Number, default: 6 },
  cooldownMs: { type: Number, default: 4000 },
})

defineEmits(['ability'])

const store      = usePlayerStore()
const navigation = useNavigationStore()
const profile    = useProfileStore()

const savedEntry = computed(() => {
  const dest = navigation.destination
  return dest ? profile.findSavedDestinationNear(dest.lat, dest.lng) : null
})

function toggleSaved() {
  const dest = navigation.destination
  if (!dest) return
  if (savedEntry.value) profile.removeSavedDestination(savedEntry.value.id)
  else profile.addSavedDestination(dest.lat, dest.lng)
}
</script>

<style scoped>
/*
 * Every visual knob below reads from a --hud-* custom property with a
 * fallback default. Override defaults globally in main.css, or override
 * per-instance by binding :style="{ '--hud-panel-alpha': 0.7, ... }" on
 * <HudOverlay> — see src/views/HudPlayground.vue (route: /dev/hud) for a
 * live-tweaking tool that does exactly that.
 */

.hud-overlay {
  position:        fixed;
  inset:            auto 0 0 0;
  z-index:          2;
  display:          flex;
  justify-content:  center;
  padding-bottom:   16px;
  pointer-events:   none;
}

.hud-panel {
  pointer-events: auto;
  display:        flex;
  align-items:    center;
  gap:            var(--hud-gap, 18px);
  padding:        var(--hud-padding, 14px);
  background:     color-mix(in srgb, var(--ff-panel) calc(var(--hud-panel-alpha, 0.92) * 100%), transparent);
  backdrop-filter: blur(var(--hud-panel-blur, 6px));
  border:         2px solid var(--cc);
  box-shadow:     0 0 24px color-mix(in srgb, var(--cc) calc(var(--hud-glow, 0.35) * 100%), transparent);
}

.hud-sprite {
  display:         flex;
  align-items:     center;
  justify-content: center;
}

.hud-stats {
  display:        flex;
  flex-direction: column;
  gap:            4px;
}

.stat-row {
  display:     flex;
  align-items: center;
  gap:         4px;
}

.stat-label {
  font-family:    'Press Start 2P', monospace;
  font-size:      6px;
  color:          var(--ff-muted);
  width:          20px;
  flex-shrink:    0;
}

.stat-pip {
  display:      inline-block;
  width:        var(--hud-pip-size, 8px);
  height:       var(--hud-pip-size, 8px);
  border:       1px solid var(--ff-border);
  background:   transparent;
}

.stat-pip.filled {
  background:   var(--cc);
  border-color: var(--cc);
}

.hud-eta {
  display:        flex;
  flex-direction: column;
  gap:            4px;
  font-family:    'Press Start 2P', monospace;
}

.eta-label {
  font-size: 6px;
  color:     var(--ff-muted);
}

.eta-value {
  font-size: 9px;
  color:     var(--cc);
}

.save-star {
  background:  none;
  border:      none;
  padding:     0 2px;
  cursor:      pointer;
  font-size:   18px;
  line-height: 1;
  color:       var(--ff-muted);
}

.save-star.saved {
  color: var(--ff-gold);
}

.save-star:hover {
  color: var(--cc);
}
</style>
