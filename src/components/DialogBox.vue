<template>
  <div
    class="dialog-box"
    :style="classColor ? { '--cc': classColor } : {}"
    role="status"
    aria-live="polite"
    @click="skip"
  >
    <p class="dialog-text">{{ displayed }}</p>
    <span v-if="done" class="cursor-done">▼</span>
    <span v-else class="cursor-typing">▌</span>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  text:       { type: String,  required: true },
  speed:      { type: Number,  default: 40 },     // ms per character
  autoStart:  { type: Boolean, default: true },
  classColor: { type: String,  default: null },
})

const emit = defineEmits(['done'])

const displayed = ref('')
const done      = ref(false)
let   interval  = null

function start() {
  done.value      = false
  displayed.value = ''
  clearInterval(interval)
  let i = 0
  interval = setInterval(() => {
    displayed.value += props.text[i]
    i++
    if (i >= props.text.length) {
      clearInterval(interval)
      interval = null
      done.value = true
      emit('done')
    }
  }, props.speed)
}

function skip() {
  if (done.value) return
  clearInterval(interval)
  interval        = null
  displayed.value = props.text
  done.value      = true
  emit('done')
}

onMounted(() => { if (props.autoStart) start() })
onUnmounted(() => clearInterval(interval))

watch(() => props.text, () => { if (props.autoStart) start() })

defineExpose({ start, skip })
</script>

<style scoped>
.dialog-box {
  position:      relative;
  background:    var(--ff-panel);
  border:        2px solid var(--cc, var(--ff-gold));
  outline:       2px solid var(--ff-night);
  outline-offset: 2px;
  padding:       16px 20px;
  min-height:    72px;
  cursor:        pointer;
}

.dialog-text {
  font-family:  'Press Start 2P', monospace;
  font-size:    10px;
  line-height:  1.9;
  color:        var(--ff-text);
  white-space:  pre-wrap;
  word-break:   break-word;
}

.cursor-done {
  position:   absolute;
  bottom:     8px;
  right:      12px;
  font-size:  8px;
  color:      var(--cc, var(--ff-gold));
  animation:  blink 0.8s step-end infinite;
}

.cursor-typing {
  display:    inline-block;
  font-size:  10px;
  color:      var(--ff-text);
  animation:  blink 0.5s step-end infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}
</style>
