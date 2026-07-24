<template>
  <div class="step">
    <DialogBox
      :text="showError ? errorText : store.chosenClass.locationPrompt"
      :classColor="store.chosenClass.color"
      @done="showButton = true"
    />

    <div v-if="showButton" class="actions">
      <PixelButton
        v-if="!showError"
        :classColor="store.chosenClass.color"
        :disabled="requesting"
        @click="requestLocation"
      >
        {{ requesting ? 'REQUESTING…' : 'GRANT ACCESS ▶' }}
      </PixelButton>
      <PixelButton v-else variant="ghost" @click="$emit('advance')">
        SKIP FOR NOW
      </PixelButton>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { usePlayerStore } from '@/stores/player.js'
import { useNavigationStore } from '@/stores/navigation.js'
import DialogBox from '@/components/DialogBox.vue'
import PixelButton from '@/components/PixelButton.vue'

const emit = defineEmits(['advance'])

const store      = usePlayerStore()
const navigation = useNavigationStore()
const showButton  = ref(false)
const requesting  = ref(false)
const showError   = ref(false)
const errorText   = ref('')

function requestLocation() {
  requesting.value = true
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      navigation.setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      requesting.value = false
      emit('advance')
    },
    () => {
      requesting.value = false
      showButton.value = false
      showError.value  = true
      errorText.value  = 'Signal lost. Position unknown. Proceed without it, or try again.'
    },
  )
}
</script>

<style scoped>
.step {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.actions {
  display: flex;
  justify-content: center;
  gap: 12px;
}
</style>
