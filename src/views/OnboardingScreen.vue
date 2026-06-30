<template>
  <OnboardingLayout
    :totalSteps="totalSteps"
    :currentStep="store.onboardingStep"
    :classColor="classData?.color"
  >
    <Transition name="step" mode="out-in">
      <WelcomeStep
        v-if="currentStepId === 'intro'"
        :key="'intro'"
        :classData="classData"
        @next="nextStep"
      />

      <AbilityRevealStep
        v-else-if="currentStepId === 'ability'"
        :key="'ability'"
        :classData="classData"
        @next="nextStep"
      />

      <LocationPermissionStep
        v-else-if="currentStepId === 'location'"
        :key="'location'"
        :classData="classData"
        @next="nextStep"
      />

      <DoneStep
        v-else-if="currentStepId === 'done'"
        :key="'done'"
        :classData="classData"
      />
    </Transition>
  </OnboardingLayout>
</template>

<script setup>
import { computed } from 'vue'
import { usePlayerStore } from '@/stores/player.js'

import OnboardingLayout       from '@/components/OnboardingLayout.vue'
import WelcomeStep            from '@/components/WelcomeStep.vue'
import AbilityRevealStep      from '@/components/AbilityRevealStep.vue'
import LocationPermissionStep from '@/components/LocationPermissionStep.vue'
import DoneStep               from '@/components/DoneStep.vue'

const store = usePlayerStore()

const classData = computed(() => store.chosenClass)

const totalSteps = computed(() => classData.value?.onboardingSteps?.length ?? 0)

const currentStepId = computed(() => {
  const steps = classData.value?.onboardingSteps
  if (!steps) return null
  return steps[store.onboardingStep] ?? null
})

function nextStep() {
  store.advanceOnboarding()
}
</script>

<style scoped>
.step-enter-active,
.step-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.step-enter-from {
  opacity:   0;
  transform: translateX(20px);
}

.step-leave-to {
  opacity:   0;
  transform: translateX(-20px);
}
</style>
