<template>
  <div class="onboarding-screen">
    <StarField />

    <div class="frame" :style="classColor ? { '--cc': classColor } : {}">
      <header class="frame-header">
        <span class="frame-title">CRYSTAL PATH</span>
        <PixelDivider :count="10" />
      </header>

      <div class="frame-content">
        <slot />
      </div>

      <footer class="frame-footer">
        <button
          v-if="currentStep > 0"
          class="back-btn"
          @click="$emit('back')"
        >
          &#9664; BACK
        </button>
        <div class="progress-dots">
          <span
            v-for="n in totalSteps"
            :key="n"
            class="progress-dot"
            :class="{ active: n - 1 === currentStep, past: n - 1 < currentStep }"
          />
        </div>
        <div v-if="currentStep > 0" class="back-spacer" />
      </footer>
    </div>
  </div>
</template>

<script setup>
import StarField     from '@/components/StarField.vue'
import PixelDivider  from '@/components/PixelDivider.vue'

defineProps({
  totalSteps:   { type: Number, required: true },
  currentStep:  { type: Number, required: true },
  classColor:   { type: String, default: null },
})

defineEmits(['back'])
</script>

<style scoped>
.onboarding-screen {
  position:    relative;
  min-height:  100vh;
  display:     flex;
  align-items: center;
  justify-content: center;
  overflow:    hidden;
  background:  var(--ff-night);
}

.frame {
  position:     relative;
  z-index:      1;
  width:        min(680px, 90vw);
  background:   var(--ff-dark);
  border:       2px solid var(--cc, var(--ff-gold));
  outline:      4px solid var(--ff-night);
  outline-offset: 2px;
  box-shadow:   0 0 0 6px var(--cc, var(--ff-gold-dark)),
                0 0 40px color-mix(in srgb, var(--cc, var(--ff-gold)) 30%, transparent);
  display:      flex;
  flex-direction: column;
  gap:          0;
}

.frame-header {
  padding:        16px 20px 12px;
  border-bottom:  2px solid var(--ff-border);
  display:        flex;
  flex-direction: column;
  align-items:    center;
  gap:            8px;
}

.frame-title {
  font-family: 'Press Start 2P', monospace;
  font-size:   11px;
  color:       var(--cc, var(--ff-gold));
  letter-spacing: 3px;
}

.frame-content {
  padding: 28px 24px;
  flex:    1;
}

.frame-footer {
  padding:         14px 20px;
  border-top:      2px solid var(--ff-border);
  display:         flex;
  justify-content: space-between;
  align-items:     center;
}

.progress-dots {
  display: flex;
  gap:     10px;
}

.back-btn {
  font-family:    'Press Start 2P', monospace;
  font-size:      7px;
  padding:        6px 10px;
  background:     transparent;
  border:         1px solid var(--ff-border);
  color:          var(--ff-muted);
  cursor:         pointer;
  transition:     border-color 0.15s, color 0.15s;
}

.back-btn:hover {
  border-color: var(--cc, var(--ff-gold));
  color:        var(--cc, var(--ff-gold));
}

.back-spacer {
  width: 60px;
}

.progress-dot {
  display:       inline-block;
  width:         8px;
  height:        8px;
  background:    var(--ff-border);
  border:        1px solid var(--ff-muted);
  transition:    background 0.2s, border-color 0.2s;
}

.progress-dot.past {
  background:   var(--ff-muted);
  border-color: var(--ff-muted);
}

.progress-dot.active {
  background:   var(--cc, var(--ff-gold));
  border-color: var(--cc, var(--ff-gold));
}
</style>
