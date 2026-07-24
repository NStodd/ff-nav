<template>
  <button
    class="ability-btn"
    :style="classColor ? { '--cc': classColor } : {}"
    :disabled="disabled || cooling"
    @click="trigger"
  >
    <span class="ability-label">{{ label }}</span>
    <span v-if="cooling" class="cooldown-veil" :style="{ width: (100 - cooldownPct) + '%' }" />
  </button>
</template>

<script setup>
import { ref, onUnmounted } from 'vue'

const props = defineProps({
  label:      { type: String,  required: true },
  classColor: { type: String,  default: null },
  cooldownMs: { type: Number,  default: 0 },
  disabled:   { type: Boolean, default: false },
})

const emit = defineEmits(['activate'])

const cooling     = ref(false)
const cooldownPct = ref(0) // 0-100, how much of the cooldown has elapsed
let rafId = null

function trigger() {
  if (props.disabled || cooling.value) return
  emit('activate')
  if (props.cooldownMs > 0) startCooldown()
}

function startCooldown() {
  cooling.value = true
  cooldownPct.value = 0
  const start = performance.now()
  const tick = (now) => {
    const elapsed = now - start
    cooldownPct.value = Math.min(100, (elapsed / props.cooldownMs) * 100)
    if (elapsed >= props.cooldownMs) {
      cooling.value = false
      rafId = null
    } else {
      rafId = requestAnimationFrame(tick)
    }
  }
  rafId = requestAnimationFrame(tick)
}

onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId) })

defineExpose({ startCooldown })
</script>

<style scoped>
.ability-btn {
  position:        relative;
  overflow:        hidden;
  font-family:     'Press Start 2P', monospace;
  font-size:       9px;
  letter-spacing:  1px;
  text-transform:  uppercase;
  padding:         12px 16px;
  min-width:       var(--hud-ability-size, 100px);
  background:      var(--ff-panel);
  color:           var(--cc, var(--ff-gold));
  border:          2px solid var(--cc, var(--ff-gold));
  cursor:          pointer;
}

.ability-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--cc, var(--ff-gold)) 15%, var(--ff-panel));
}

.ability-btn:disabled {
  cursor:  not-allowed;
  opacity: 0.6;
}

.ability-label {
  position: relative;
  z-index:  1;
}

.cooldown-veil {
  position:   absolute;
  inset:      0 0 0 auto;
  height:     100%;
  background: color-mix(in srgb, var(--ff-night) 70%, transparent);
  transition: width 0.05s linear;
}
</style>
