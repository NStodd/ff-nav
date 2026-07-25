<template>
  <div class="personalize-step" :style="{ '--cc': classData.color }">
    <h2 class="prompt">{{ config.prompt }}</h2>

    <!-- Open-ended questions (text inputs) -->
    <div v-if="config.type === 'open-ended'" class="questions open-ended">
      <div v-for="q in config.questions" :key="q.id" class="question">
        <label :for="q.id" class="question-label">{{ q.label }}</label>
        <textarea
          :id="q.id"
          v-model="responses[q.id]"
          :placeholder="q.placeholder"
          class="text-input"
          rows="2"
        />
      </div>
    </div>

    <!-- Choice-based questions (radio/checkbox) -->
    <div v-else-if="config.type === 'choices'" class="questions choices">
      <div v-for="q in config.questions" :key="q.id" class="question">
        <span class="question-label">{{ q.label }}</span>
        <div class="options" :class="{ multi: q.type === 'multi' }">
          <label
            v-for="opt in q.options"
            :key="opt.value"
            class="option"
            :class="{ selected: isSelected(q, opt.value) }"
          >
            <input
              v-if="q.type === 'single'"
              type="radio"
              :name="q.id"
              :value="opt.value"
              v-model="responses[q.id]"
              class="visually-hidden"
            />
            <input
              v-else
              type="checkbox"
              :value="opt.value"
              v-model="responses[q.id]"
              class="visually-hidden"
            />
            <span class="option-label">{{ opt.label }}</span>
          </label>
        </div>
      </div>
    </div>

    <!-- Social media links -->
    <div v-if="config.socialLinks?.length" class="social-section">
      <span class="section-label">{{ config.socialLabel || 'Connect your accounts' }}</span>
      <div class="social-links">
        <div v-for="link in config.socialLinks" :key="link.id" class="social-link">
          <label :for="'social-' + link.id" class="social-label">
            <span class="social-icon" :style="{ color: link.color || 'var(--ff-muted)' }">
              {{ link.icon || '@' }}
            </span>
            <span class="social-name">{{ link.name }}</span>
          </label>
          <input
            :id="'social-' + link.id"
            type="text"
            v-model="responses['social_' + link.id]"
            :placeholder="link.placeholder || '@username'"
            class="social-input"
          />
        </div>
      </div>
    </div>

    <div class="actions">
      <PixelButton
        :classColor="classData.color"
        :disabled="!canContinue"
        @click="submit"
      >
        Continue
      </PixelButton>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import PixelButton from '@/components/PixelButton.vue'

const props = defineProps({
  classData: { type: Object, required: true },
})

const emit = defineEmits(['next', 'save'])

const config = computed(() => props.classData.personalization)

// Initialize responses based on question types
const responses = ref({})

onMounted(() => {
  const initial = {}
  // Initialize question responses (with defaults if specified)
  for (const q of config.value.questions) {
    if (config.value.type === 'choices' && q.type === 'multi') {
      initial[q.id] = q.default ?? []
    } else if (config.value.type === 'choices' && q.type === 'single') {
      initial[q.id] = q.default ?? ''
    } else {
      initial[q.id] = ''
    }
  }
  // Initialize social link responses
  if (config.value.socialLinks) {
    for (const link of config.value.socialLinks) {
      initial['social_' + link.id] = ''
    }
  }
  responses.value = initial
})

function isSelected(question, value) {
  if (question.type === 'multi') {
    return responses.value[question.id]?.includes(value)
  }
  return responses.value[question.id] === value
}

const canContinue = computed(() => {
  if (config.value.type === 'open-ended') {
    // Allow continue even with empty responses for open-ended
    return true
  }
  // For choices, require at least the first question answered
  const firstQ = config.value.questions[0]
  const firstResp = responses.value[firstQ.id]
  if (firstQ.type === 'multi') {
    return true // Multi-select can be empty
  }
  return !!firstResp
})

function submit() {
  emit('save', { ...responses.value })
  emit('next')
}
</script>

<style scoped>
.personalize-step {
  display:        flex;
  flex-direction: column;
  gap:            24px;
}

.prompt {
  font-family:    'Press Start 2P', monospace;
  font-size:      11px;
  color:          var(--cc);
  text-align:     center;
  letter-spacing: 1px;
}

.questions {
  display:        flex;
  flex-direction: column;
  gap:            20px;
}

.question {
  display:        flex;
  flex-direction: column;
  gap:            8px;
}

.question-label {
  font-family:    'Press Start 2P', monospace;
  font-size:      8px;
  color:          var(--ff-text);
  line-height:    1.6;
}

/* Open-ended text inputs */
.text-input {
  font-family:    'Press Start 2P', monospace;
  font-size:      8px;
  padding:        12px;
  background:     var(--ff-panel);
  border:         2px solid var(--ff-border);
  color:          var(--ff-text);
  resize:         vertical;
  min-height:     60px;
  line-height:    1.8;
}

.text-input:focus {
  outline:      none;
  border-color: var(--cc);
}

.text-input::placeholder {
  color: var(--ff-muted);
}

/* Choice-based options */
.options {
  display:   flex;
  flex-wrap: wrap;
  gap:       8px;
}

.option {
  cursor: pointer;
}

.option-label {
  display:        inline-block;
  font-family:    'Press Start 2P', monospace;
  font-size:      8px;
  padding:        8px 12px;
  background:     var(--ff-panel);
  border:         2px solid var(--ff-border);
  color:          var(--ff-muted);
  transition:     border-color 0.15s, color 0.15s, background 0.15s;
}

.option:hover .option-label {
  border-color: var(--cc);
  color:        var(--ff-text);
}

.option.selected .option-label {
  border-color: var(--cc);
  background:   color-mix(in srgb, var(--cc) 20%, var(--ff-panel));
  color:        var(--cc);
}

.visually-hidden {
  position:   absolute;
  width:      1px;
  height:     1px;
  padding:    0;
  margin:     -1px;
  overflow:   hidden;
  clip:       rect(0, 0, 0, 0);
  border:     0;
}

/* Social media links */
.social-section {
  display:        flex;
  flex-direction: column;
  gap:            12px;
  padding-top:    8px;
  border-top:     1px solid var(--ff-border);
}

.section-label {
  font-family:    'Press Start 2P', monospace;
  font-size:      8px;
  color:          var(--ff-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.social-links {
  display:        flex;
  flex-direction: column;
  gap:            12px;
}

.social-link {
  display:        flex;
  flex-direction: column;
  gap:            6px;
}

.social-label {
  display:     flex;
  align-items: center;
  gap:         8px;
}

.social-icon {
  font-family: 'Press Start 2P', monospace;
  font-size:   10px;
}

.social-name {
  font-family:    'Press Start 2P', monospace;
  font-size:      8px;
  color:          var(--ff-text);
}

.social-input {
  font-family:    'Press Start 2P', monospace;
  font-size:      8px;
  padding:        10px 12px;
  background:     var(--ff-panel);
  border:         2px solid var(--ff-border);
  color:          var(--ff-text);
}

.social-input:focus {
  outline:      none;
  border-color: var(--cc);
}

.social-input::placeholder {
  color: var(--ff-muted);
}

.actions {
  display:         flex;
  justify-content: center;
  margin-top:      8px;
}
</style>
