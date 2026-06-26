<template>
  <button
    class="pixel-btn"
    :class="[`pixel-btn--${variant}`, { 'pixel-btn--disabled': disabled }]"
    :disabled="disabled"
    :style="classColor ? { '--cc': classColor } : {}"
    @click="!disabled && $emit('click')"
  >
    <slot />
  </button>
</template>

<script setup>
defineProps({
  variant:    { type: String,  default: 'primary' },  // 'primary' | 'ghost'
  disabled:   { type: Boolean, default: false },
  classColor: { type: String,  default: null },        // optional class-colored variant
})

defineEmits(['click'])
</script>

<style scoped>
.pixel-btn {
  display:         inline-block;
  padding:         10px 18px;
  font-family:     'Press Start 2P', monospace;
  font-size:       10px;
  text-transform:  uppercase;
  letter-spacing:  1px;
  cursor:          pointer;
  border:          2px solid var(--ff-gold);
  background:      var(--ff-panel);
  color:           var(--ff-gold);
  image-rendering: pixelated;
  transition:      background 0.1s, color 0.1s;
  outline:         none;
  user-select:     none;
}

.pixel-btn:hover:not(.pixel-btn--disabled) {
  background: var(--ff-border);
}

.pixel-btn:active:not(.pixel-btn--disabled) {
  transform: translateY(1px);
}

.pixel-btn--ghost {
  border-color: var(--ff-border);
  color:        var(--ff-muted);
}

.pixel-btn--ghost:hover:not(.pixel-btn--disabled) {
  border-color: var(--ff-gold-dark);
  color:        var(--ff-text);
  background:   transparent;
}

/* class-colored variant — active when --cc is set */
.pixel-btn[style*='--cc'] {
  border-color: var(--cc);
  color:        var(--cc);
}

.pixel-btn[style*='--cc']:hover:not(.pixel-btn--disabled) {
  background: color-mix(in srgb, var(--cc) 15%, var(--ff-panel));
}

.pixel-btn--disabled {
  opacity:        0.4;
  cursor:         not-allowed;
  pointer-events: none;
}
</style>
