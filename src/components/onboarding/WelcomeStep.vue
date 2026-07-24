<template>
  <div class="step">
    <DialogBox
      :text="store.chosenClass.intro"
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
import { ref } from 'vue'
import { usePlayerStore } from '@/stores/player.js'
import DialogBox from '@/components/DialogBox.vue'
import PixelButton from '@/components/PixelButton.vue'

defineEmits(['advance'])

const store = usePlayerStore()
const showContinue = ref(false)
</script>

<style scoped>
.step {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.continue {
  display: flex;
  justify-content: center;
}
</style>
