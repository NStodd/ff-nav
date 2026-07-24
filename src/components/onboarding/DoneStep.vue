<template>
  <div class="step">
    <p class="fanfare" :style="{ '--cc': store.chosenClass.color }">&#10022; READY &#10022;</p>
    <p class="msg">{{ store.chosenClass.name.toUpperCase() }}, your journey begins.</p>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '@/stores/player.js'

const router = useRouter()
const store  = usePlayerStore()

onMounted(() => {
  setTimeout(() => {
    router.push({ name: 'map', params: { genreId: store.chosenGenre.id } })
  }, 1400)
})
</script>

<style scoped>
.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  text-align: center;
}

.fanfare {
  font-family: 'Press Start 2P', monospace;
  font-size: 18px;
  color: var(--cc);
  text-shadow: 0 0 16px var(--cc);
  animation: fanfare 1.4s ease-out forwards;
}

.msg {
  font-family: 'Press Start 2P', monospace;
  font-size: 9px;
  color: var(--ff-muted);
}

@keyframes fanfare {
  0%   { opacity: 0; transform: scale(0.6); }
  40%  { opacity: 1; transform: scale(1.15); }
  60%  { transform: scale(0.95); }
  100% { opacity: 1; transform: scale(1); }
}
</style>
