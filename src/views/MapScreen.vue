<template>
  <div class="map-screen" :style="classData ? { '--cc': classData.color } : {}">
    <StarField />

    <div class="hud-top">
      <div class="class-badge" v-if="classData">
        <PixelSprite
          :rows="classData.sprite"
          :color="classData.color"
          :pixelSize="3"
        />
        <span class="class-name">{{ classData.name }}</span>
      </div>
    </div>

    <div class="map-placeholder">
      <div class="compass">
        <span class="compass-n">N</span>
        <span class="compass-ring" />
      </div>
      <p class="placeholder-text">Map view coming soon</p>
      <p class="placeholder-sub">Milestone 3 will add the full map integration</p>
    </div>

    <div class="hud-bottom">
      <PixelButton
        variant="ghost"
        @click="resetAndReturn"
      >
        Change Class
      </PixelButton>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '@/stores/player.js'

import StarField   from '@/components/StarField.vue'
import PixelSprite from '@/components/PixelSprite.vue'
import PixelButton from '@/components/PixelButton.vue'

const router = useRouter()
const store  = usePlayerStore()

const classData = computed(() => store.chosenClass)

function resetAndReturn() {
  store.reset()
  router.push({ name: 'class-select' })
}
</script>

<style scoped>
.map-screen {
  position:   relative;
  min-height: 100vh;
  display:    flex;
  flex-direction: column;
  overflow:   hidden;
  background: var(--ff-night);
}

.hud-top {
  position: relative;
  z-index:  10;
  padding:  16px;
}

.class-badge {
  display:     inline-flex;
  align-items: center;
  gap:         10px;
  padding:     8px 12px;
  background:  var(--ff-panel);
  border:      2px solid var(--cc, var(--ff-border));
}

.class-name {
  font-family:    'Press Start 2P', monospace;
  font-size:      8px;
  color:          var(--cc, var(--ff-text));
  letter-spacing: 1px;
}

.map-placeholder {
  flex:       1;
  display:    flex;
  flex-direction: column;
  align-items:    center;
  justify-content: center;
  gap:        24px;
  position:   relative;
  z-index:    1;
}

.compass {
  position: relative;
  width:    80px;
  height:   80px;
}

.compass-n {
  position:       absolute;
  top:            8px;
  left:           50%;
  transform:      translateX(-50%);
  font-family:    'Press Start 2P', monospace;
  font-size:      12px;
  color:          var(--ff-gold);
  text-shadow:    0 0 10px var(--ff-gold);
  animation:      pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.6; }
}

.compass-ring {
  position:      absolute;
  inset:         0;
  border:        2px solid var(--ff-border);
  border-radius: 50%;
  border-top-color: var(--ff-gold);
  animation:     spin 8s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

.placeholder-text {
  font-family:    'Press Start 2P', monospace;
  font-size:      12px;
  color:          var(--ff-muted);
  letter-spacing: 1px;
}

.placeholder-sub {
  font-family:  'Press Start 2P', monospace;
  font-size:    7px;
  color:        var(--ff-border);
  text-align:   center;
  line-height:  1.6;
}

.hud-bottom {
  position: relative;
  z-index:  10;
  padding:  16px;
  display:  flex;
  justify-content: center;
}
</style>
