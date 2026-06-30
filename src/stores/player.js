import { defineStore } from 'pinia'
import { ref } from 'vue'
import { CLASSES } from '@/data/classes'

const STORAGE_KEY = 'crystalpath-class'
const PREFS_KEY   = 'crystalpath-prefs'

export const usePlayerStore = defineStore('player', () => {
  const savedId    = localStorage.getItem(STORAGE_KEY)
  const savedPrefs = localStorage.getItem(PREFS_KEY)

  const chosenClass    = ref(savedId ? (CLASSES.find(c => c.id === savedId) ?? null) : null)
  const onboardingStep = ref(0)
  const preferences    = ref(savedPrefs ? JSON.parse(savedPrefs) : {})

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

  function setPreferences(prefs) {
    preferences.value = { ...preferences.value, ...prefs }
    localStorage.setItem(PREFS_KEY, JSON.stringify(preferences.value))
  }

  function reset() {
    chosenClass.value    = null
    onboardingStep.value = 0
    preferences.value    = {}
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(PREFS_KEY)
  }

  return { chosenClass, onboardingStep, preferences, selectClass, advanceOnboarding, goBackOnboarding, setPreferences, reset }
})
