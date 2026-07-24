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
import { usePlayerStore } from '@/stores/player.js'
import { useNavigationStore } from '@/stores/navigation.js'
import PixelSprite from '@/components/PixelSprite.vue'
import AbilityButton from '@/components/AbilityButton.vue'

defineProps({
  spriteSize: { type: Number, default: 6 },
  cooldownMs: { type: Number, default: 4000 },
})

defineEmits(['ability'])

const store      = usePlayerStore()
const navigation = useNavigationStore()
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
</style>
