<template>
  <div class="divider" aria-hidden="true">
    <span
      v-for="n in count"
      :key="n"
      class="dot"
      :style="{ background: color }"
    />
  </div>
</template>

<script setup>
defineProps({
  count: { type: Number, default: 12 },
  color: { type: String, default: 'var(--ff-gold-dark)' },
})
</script>

<style scoped>
.divider {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin: 0.5rem 0;
}

.dot {
  display: inline-block;
  width:  4px;
  height: 4px;
}
</style>
