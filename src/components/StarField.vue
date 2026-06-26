<template>
  <div class="starfield" aria-hidden="true">
    <div
      v-for="(star, i) in stars"
      :key="i"
      class="star"
      :style="{
        left:              star.x + '%',
        top:               star.y + '%',
        width:             star.size + 'px',
        height:            star.size + 'px',
        animationDelay:    star.delay + 's',
        animationDuration: star.duration + 's',
      }"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const stars = ref([])

onMounted(() => {
  stars.value = Array.from({ length: 80 }, () => ({
    x:        Math.random() * 100,
    y:        Math.random() * 100,
    size:     Math.random() * 2 + 1,
    delay:    Math.random() * 4,
    duration: Math.random() * 3 + 2,
  }))
})
</script>

<style scoped>
.starfield {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.star {
  position: absolute;
  background: var(--ff-text);
  animation: twinkle var(--dur, 3s) var(--delay, 0s) infinite ease-in-out;
}

@keyframes twinkle {
  0%, 100% { opacity: 0.15; }
  50%       { opacity: 1; }
}
</style>
