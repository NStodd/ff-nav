<template>
  <div class="location-step" :style="{ '--cc': classData.color }">
    <div class="icon-container">
      <div class="location-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
          <circle cx="12" cy="9" r="2.5"/>
        </svg>
      </div>
      <div class="pulse-ring" />
      <div class="pulse-ring pulse-ring--delayed" />
    </div>

    <h2 class="title">LOCATION ACCESS</h2>

    <DialogBox
      :text="classData.locationPrompt"
      :classColor="classData.color"
      :speed="30"
      @done="promptDone = true"
    />

    <p v-if="permissionStatus" class="status" :class="permissionStatus">
      {{ statusMessage }}
    </p>

    <div class="actions">
      <PixelButton
        v-if="permissionStatus !== 'granted'"
        :classColor="classData.color"
        :disabled="!promptDone || requesting"
        @click="requestPermission"
      >
        {{ requesting ? 'Requesting...' : 'Enable Location' }}
      </PixelButton>

      <PixelButton
        v-if="permissionStatus === 'granted' || permissionStatus === 'denied'"
        :classColor="classData.color"
        @click="$emit('next')"
      >
        Continue
      </PixelButton>

      <PixelButton
        v-if="!permissionStatus"
        variant="ghost"
        :disabled="!promptDone"
        @click="$emit('next')"
      >
        Skip for now
      </PixelButton>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import DialogBox   from '@/components/DialogBox.vue'
import PixelButton from '@/components/PixelButton.vue'

defineProps({
  classData: { type: Object, required: true },
})

defineEmits(['next'])

const promptDone       = ref(false)
const requesting       = ref(false)
const permissionStatus = ref(null)  // null | 'granted' | 'denied'

const statusMessage = ref('')

async function requestPermission() {
  requesting.value = true

  try {
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
      })
    })

    permissionStatus.value = 'granted'
    statusMessage.value    = 'Location acquired. Ready to navigate.'
  } catch (err) {
    permissionStatus.value = 'denied'
    if (err.code === 1) {
      statusMessage.value = 'Permission denied. You can enable it later in settings.'
    } else {
      statusMessage.value = 'Could not get location. You can try again later.'
    }
  } finally {
    requesting.value = false
  }
}
</script>

<style scoped>
.location-step {
  display:        flex;
  flex-direction: column;
  align-items:    center;
  gap:            20px;
}

.icon-container {
  position: relative;
  width:    80px;
  height:   80px;
  display:  flex;
  align-items:     center;
  justify-content: center;
}

.location-icon {
  position:   relative;
  z-index:    1;
  width:      40px;
  height:     40px;
  color:      var(--cc);
  animation:  bob 2s ease-in-out infinite;
}

@keyframes bob {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-4px); }
}

.pulse-ring {
  position:      absolute;
  inset:         0;
  border:        2px solid var(--cc);
  border-radius: 50%;
  opacity:       0;
  animation:     pulse-out 2s ease-out infinite;
}

.pulse-ring--delayed {
  animation-delay: 1s;
}

@keyframes pulse-out {
  0%   { transform: scale(0.5); opacity: 0.8; }
  100% { transform: scale(1.5); opacity: 0; }
}

.title {
  font-family:    'Press Start 2P', monospace;
  font-size:      12px;
  color:          var(--cc);
  letter-spacing: 2px;
}

.status {
  font-family:  'Press Start 2P', monospace;
  font-size:    8px;
  padding:      10px 16px;
  border:       1px solid var(--ff-border);
  text-align:   center;
  line-height:  1.6;
}

.status.granted {
  color:        var(--ff-gold);
  border-color: var(--ff-gold);
}

.status.denied {
  color:        var(--ff-muted);
  border-color: var(--ff-muted);
}

.actions {
  display:   flex;
  flex-wrap: wrap;
  gap:       12px;
  justify-content: center;
  margin-top: 8px;
}
</style>
