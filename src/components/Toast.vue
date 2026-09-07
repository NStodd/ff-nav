<template>
  <Transition name="toast-fade">
    <div v-if="text" class="app-toast" :class="`tone-${tone}`" :style="{ top, '--cc': color }">
      {{ text }}
    </div>
  </Transition>
</template>

<script setup>
// Milestone 6: was three near-identical <Transition> blocks in MapScreen.vue
// (share/route-error/XP), each with its own copy of the same positioning and
// fade CSS, hand-offset from each other (top: 1rem vs 3.4rem) to avoid
// colliding. One reusable component now — MapScreen.vue renders it twice
// (a status lane and a growth lane), not three times.
defineProps({
  text:  { type: String, default: null },
  tone:  { type: String, default: 'default' }, // 'default' | 'error' | 'gold'
  color: { type: String, default: null },      // only used by tone 'default' — the active class's color
  top:   { type: String, default: '1rem' },
})
</script>

<style scoped>
.app-toast {
  position:       absolute;
  z-index:        3;
  left:           50%;
  transform:      translateX(-50%);
  font-family:    'Press Start 2P', monospace;
  font-size:      9px;
  padding:        10px 16px;
  background:     var(--ff-panel);
  /* Milestone 6: `white-space: nowrap` with no width limit let a long
     message (routeError's "Could not calculate a route..." at a narrow
     phone viewport) run clean off both edges of the screen — found via a
     real 390px-wide screenshot, not visible at desktop widths. Wraps and
     centers instead now. */
  max-width:      88vw;
  width:          max-content;
  text-align:     center;
  line-height:    1.6;
}

.tone-default {
  color:      var(--cc);
  border:     2px solid var(--cc);
  box-shadow: 0 0 16px color-mix(in srgb, var(--cc) 35%, transparent);
}

.tone-error {
  color:      #E85C5C;
  border:     2px solid #E85C5C;
  box-shadow: 0 0 16px rgba(232, 92, 92, 0.35);
}

.tone-gold {
  padding:    8px 14px;
  color:      var(--ff-gold);
  border:     2px solid var(--ff-gold-dark);
  box-shadow: 0 0 16px color-mix(in srgb, var(--ff-gold) 30%, transparent);
}

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: opacity 0.25s ease;
}

.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
}
</style>
