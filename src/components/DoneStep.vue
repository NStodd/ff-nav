<template>
  <div class="done-step" :style="{ '--cc': classData.color }">
    <div class="fanfare" :class="{ active: fanfareActive }">
      <div class="sprite-glow">
        <PixelSprite
          :rows="classData.sprite"
          :color="classData.color"
          :pixelSize="8"
        />
      </div>

      <div class="stars">
        <span v-for="n in 8" :key="n" class="star" :style="{ '--i': n }" />
      </div>
    </div>

    <h2 class="title">READY TO EMBARK</h2>

    <p class="message">
      Your journey begins, {{ classData.name }}.
    </p>

    <div class="actions" :class="{ visible: showButton }">
      <PixelButton
        :classColor="classData.color"
        @click="enterMap"
      >
        Enter the World
      </PixelButton>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import PixelSprite from '@/components/PixelSprite.vue'
import PixelButton from '@/components/PixelButton.vue'

const props = defineProps({
  classData: { type: Object, required: true },
})

const router = useRouter()

const fanfareActive = ref(false)
const showButton    = ref(false)

onMounted(() => {
  setTimeout(() => {
    fanfareActive.value = true
  }, 100)

  setTimeout(() => {
    showButton.value = true
  }, 1500)
})

function enterMap() {
  router.push({ name: 'map' })
}
</script>

<style scoped>
.done-step {
  display:        flex;
  flex-direction: column;
  align-items:    center;
  gap:            24px;
  padding-top:    16px;
}

.fanfare {
  position:  relative;
  opacity:   0;
  transform: scale(0.5);
  transition: opacity 0.8s ease-out, transform 0.8s ease-out;
}

.fanfare.active {
  opacity:   1;
  transform: scale(1);
}

.sprite-glow {
  position:   relative;
  padding:    20px;
  background: var(--ff-panel);
  border:     3px solid var(--cc);
  animation:  victory-glow 1.5s ease-in-out infinite;
}

@keyframes victory-glow {
  0%, 100% {
    box-shadow: 0 0 20px color-mix(in srgb, var(--cc) 50%, transparent),
                0 0 40px color-mix(in srgb, var(--cc) 30%, transparent);
  }
  50% {
    box-shadow: 0 0 40px color-mix(in srgb, var(--cc) 70%, transparent),
                0 0 80px color-mix(in srgb, var(--cc) 50%, transparent);
  }
}

.stars {
  position: absolute;
  inset:    -40px;
  pointer-events: none;
}

.star {
  position:      absolute;
  width:         6px;
  height:        6px;
  background:    var(--ff-gold);
  clip-path:     polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
  opacity:       0;
  animation:     star-burst 1.5s ease-out forwards;
  animation-delay: calc(var(--i) * 0.1s);
}

.star:nth-child(1) { top: 50%; left: -20px; }
.star:nth-child(2) { top: 50%; right: -20px; }
.star:nth-child(3) { top: -20px; left: 50%; }
.star:nth-child(4) { bottom: -20px; left: 50%; }
.star:nth-child(5) { top: 10%; left: 10%; }
.star:nth-child(6) { top: 10%; right: 10%; }
.star:nth-child(7) { bottom: 10%; left: 10%; }
.star:nth-child(8) { bottom: 10%; right: 10%; }

@keyframes star-burst {
  0%   { opacity: 0; transform: scale(0) rotate(0deg); }
  50%  { opacity: 1; transform: scale(1.5) rotate(180deg); }
  100% { opacity: 0.6; transform: scale(1) rotate(360deg); }
}

.title {
  font-family:    'Press Start 2P', monospace;
  font-size:      14px;
  color:          var(--ff-gold);
  letter-spacing: 3px;
  text-shadow:    0 0 20px var(--ff-gold);
  animation:      title-pulse 2s ease-in-out infinite;
}

@keyframes title-pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.8; }
}

.message {
  font-family:  'Press Start 2P', monospace;
  font-size:    9px;
  color:        var(--ff-text);
  text-align:   center;
  line-height:  1.8;
}

.actions {
  opacity:    0;
  transform:  translateY(10px);
  transition: opacity 0.5s ease-out, transform 0.5s ease-out;
  margin-top: 8px;
}

.actions.visible {
  opacity:   1;
  transform: translateY(0);
}
</style>
