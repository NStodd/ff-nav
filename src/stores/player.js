import { defineStore } from 'pinia'
import { ref } from 'vue'
import { CLASSES } from '@/data/classes'

const STORAGE_KEY = 'crystalpath-class'

export const usePlayerStore = defineStore('player', () => {
  const savedId = localStorage.getItem(STORAGE_KEY)
  const chosenClass    = ref(savedId ? (CLASSES.find(c => c.id === savedId) ?? null) : null)
  const onboardingStep = ref(0)

  function selectClass(cls) {
    chosenClass.value = cls
    localStorage.setItem(STORAGE_KEY, cls.id)
  }

  function advanceOnboarding() {
    onboardingStep.value++
  }

  function goBackOnboarding() {
    if (onboardingStep.value > 0) {
      onboardingStep.value--
    }
  }

  function reset() {
    chosenClass.value    = null
    onboardingStep.value = 0
    localStorage.removeItem(STORAGE_KEY)
  }

  return { chosenClass, onboardingStep, selectClass, advanceOnboarding, goBackOnboarding, reset }
})
