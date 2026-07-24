<template>
  <OnboardingLayout
    :totalSteps="store.chosenClass.onboardingSteps.length"
    :currentStep="store.onboardingStep"
    :classColor="store.chosenClass.color"
  >
    <component :is="currentStepComponent" @advance="store.advanceOnboarding()" />
  </OnboardingLayout>
</template>

<script setup>
import { computed } from 'vue'
import { usePlayerStore } from '@/stores/player.js'
import OnboardingLayout from '@/components/OnboardingLayout.vue'
import WelcomeStep from '@/components/onboarding/WelcomeStep.vue'
import AbilityRevealStep from '@/components/onboarding/AbilityRevealStep.vue'
import LocationPermissionStep from '@/components/onboarding/LocationPermissionStep.vue'
import DoneStep from '@/components/onboarding/DoneStep.vue'

const STEP_COMPONENTS = {
  intro:    WelcomeStep,
  ability:  AbilityRevealStep,
  location: LocationPermissionStep,
  done:     DoneStep,
}

const store = usePlayerStore()

const currentStepId = computed(() => store.chosenClass.onboardingSteps[store.onboardingStep])
const currentStepComponent = computed(() => STEP_COMPONENTS[currentStepId.value])
</script>
