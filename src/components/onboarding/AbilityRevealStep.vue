<template>
  <div class="step">
    <div class="sprite-wrap">
      <PixelSprite :rows="store.chosenClass.sprite" :color="store.chosenClass.color" :pixelSize="8" />
    </div>

    <p class="ability-name" :style="{ '--cc': store.chosenClass.color }">{{ store.chosenClass.ability }}</p>

    <DialogBox
      v-if="showDesc"
      :text="store.chosenClass.abilityDesc"
      :classColor="store.chosenClass.color"
      @done="showContinue = true"
    />

    <div v-if="showContinue" class="continue">
      <PixelButton :classColor="store.chosenClass.color" @click="$emit('advance')">
        CONTINUE &#9658;
      </PixelButton>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { usePlayerStore } from '@/stores/player.js'
import PixelSprite from '@/components/PixelSprite.vue'
import DialogBox from '@/components/DialogBox.vue'
import PixelButton from '@/components/PixelButton.vue'

defineEmits(['advance'])

const store = usePlayerStore()
const showDesc = ref(false)
const showContinue = ref(false)

onMounted(() => {
  setTimeout(() => { showDesc.value = true }, 800)
})
</script>

<style scoped>
.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.sprite-wrap {
  display: flex;
  justify-content: center;
}

.ability-name {
  font-family: 'Press Start 2P', monospace;
  font-size: 16px;
  color: var(--cc);
  letter-spacing: 2px;
  opacity: 0;
  animation: fadeIn 0.6s ease-out forwards, pulse 1.6s ease-in-out 0.6s infinite;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes pulse {
  0%, 100% { text-shadow: 0 0 8px var(--cc); }
  50%      { text-shadow: 0 0 20px var(--cc); }
}

.continue {
  display: flex;
  justify-content: center;
}
</style>
