import { defineStore } from 'pinia'
import { ref } from 'vue'
import { GENRES } from '@/data/genres'

const GENRE_KEY = 'crystalpath-genre'
const CLASS_KEY = 'crystalpath-class'
const STEP_KEY  = 'crystalpath-step'
const PREFS_KEY = 'crystalpath-prefs'

export const usePlayerStore = defineStore('player', () => {
  const savedGenreId = localStorage.getItem(GENRE_KEY)
  const savedClassId = localStorage.getItem(CLASS_KEY)
  const savedStep    = localStorage.getItem(STEP_KEY)
  const savedPrefs   = localStorage.getItem(PREFS_KEY)

  const chosenGenre = ref(savedGenreId ? (GENRES.find(g => g.id === savedGenreId) ?? null) : null)
  const chosenClass = ref(
    chosenGenre.value && savedClassId
      ? (chosenGenre.value.classes.find(c => c.id === savedClassId) ?? null)
      : null
  )
  // Only trust a saved step if we also resolved a class — and clamp it to that
  // class's actual step count, so a saved index from a different class (or a
  // roster that's since changed) can't point past the end of the array.
  const onboardingStep = ref(
    chosenClass.value && savedStep !== null
      ? Math.min(Math.max(parseInt(savedStep, 10) || 0, 0), chosenClass.value.onboardingSteps.length - 1)
      : 0
  )
  const preferences    = ref(savedPrefs ? JSON.parse(savedPrefs) : {})

  function selectGenre(genre) {
    chosenGenre.value = genre
    localStorage.setItem(GENRE_KEY, genre.id)
  }

  function selectClass(cls) {
    chosenClass.value = cls
    onboardingStep.value = 0
    localStorage.setItem(CLASS_KEY, cls.id)
    localStorage.setItem(STEP_KEY, '0')
  }

  function advanceOnboarding() {
    onboardingStep.value++
    localStorage.setItem(STEP_KEY, String(onboardingStep.value))
  }

  function goBackOnboarding() {
    if (onboardingStep.value > 0) {
      onboardingStep.value--
      localStorage.setItem(STEP_KEY, String(onboardingStep.value))
    }
  }

  function setPreferences(prefs) {
    preferences.value = { ...preferences.value, ...prefs }
    localStorage.setItem(PREFS_KEY, JSON.stringify(preferences.value))
  }

  function reset() {
    chosenGenre.value    = null
    chosenClass.value    = null
    onboardingStep.value = 0
    preferences.value    = {}
    localStorage.removeItem(GENRE_KEY)
    localStorage.removeItem(CLASS_KEY)
    localStorage.removeItem(STEP_KEY)
    localStorage.removeItem(PREFS_KEY)
  }

  return {
    chosenGenre, chosenClass, onboardingStep, preferences,
    selectGenre, selectClass, advanceOnboarding, goBackOnboarding, setPreferences, reset,
  }
})
