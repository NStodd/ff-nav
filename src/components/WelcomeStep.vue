<template>
  <div class="welcome-step">
    <div class="sprite-container">
      <PixelSprite
        :rows="classData.sprite"
        :color="classData.color"
        :pixelSize="6"
      />
    </div>

    <h2 class="class-name" :style="{ color: classData.color }">
      {{ classData.name.toUpperCase() }}
    </h2>

    <DialogBox
      :text="classData.intro"
      :classColor="classData.color"
      :speed="35"
      @done="textDone = true"
    />

    <div class="actions">
      <PixelButton
        :classColor="classData.color"
        :disabled="!textDone"
        @click="$emit('next')"
      >
        Continue
      </PixelButton>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import PixelSprite from '@/components/PixelSprite.vue'
import DialogBox   from '@/components/DialogBox.vue'
import PixelButton from '@/components/PixelButton.vue'

defineProps({
  classData: { type: Object, required: true },
})

defineEmits(['next'])

const textDone = ref(false)
</script>

<style scoped>
.welcome-step {
  display:        flex;
  flex-direction: column;
  align-items:    center;
  gap:            24px;
}

.sprite-container {
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-6px); }
}

.class-name {
  font-family:    'Press Start 2P', monospace;
  font-size:      14px;
  letter-spacing: 3px;
  text-shadow:    0 0 20px currentColor;
}

.actions {
  margin-top: 8px;
}
</style>
