<template>
  <canvas ref="canvasEl" :style="{ imageRendering: 'pixelated' }" />
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'

const props = defineProps({
  rows:      { type: Array,  required: true },
  color:     { type: String, required: true },
  pixelSize: { type: Number, default: 4 },
})

const canvasEl = ref(null)

const COLOR_MAP = {
  '2': '#F5CBA7', w: '#FFFFFF', g: '#888888', G: '#F0C060', d: '#333333',
}

function draw() {
  const canvas = canvasEl.value
  if (!canvas) return
  const ps   = props.pixelSize
  const cols = Math.max(...props.rows.map(r => r.length))
  canvas.width  = cols * ps
  canvas.height = props.rows.length * ps
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  props.rows.forEach((row, ri) => {
    for (let ci = 0; ci < row.length; ci++) {
      const ch = row[ci]
      if (ch === '0') continue
      ctx.fillStyle = ch === '1' ? props.color : (COLOR_MAP[ch] ?? '#fff')
      ctx.fillRect(ci * ps, ri * ps, ps - 1, ps - 1)
    }
  })
}

onMounted(draw)
watch([() => props.rows, () => props.color, () => props.pixelSize], draw)
</script>
