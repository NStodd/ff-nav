import { defineStore } from 'pinia'
import { ref } from 'vue'
import { GENRES } from '@/data/genres'

const GENRE_KEY = 'crystalpath-genre'
const CLASS_KEY = 'crystalpath-class'

export const usePlayerStore = defineStore('player', () => {
  const savedGenreId = localStorage.getItem(GENRE_KEY)
  const savedClassId = localStorage.getItem(CLASS_KEY)

  const chosenGenre = ref(savedGenreId ? (GENRES.find(g => g.id === savedGenreId) ?? null) : null)
  const chosenClass = ref(
    chosenGenre.value && savedClassId
      ? (chosenGenre.value.classes.find(c => c.id === savedClassId) ?? null)
      : null
  )
  const onboardingStep = ref(0)

  function selectGenre(genre) {
    chosenGenre.value = genre
    localStorage.setItem(GENRE_KEY, genre.id)
  }

  function selectClass(cls) {
    chosenClass.value = cls
    localStorage.setItem(CLASS_KEY, cls.id)
  }

  function advanceOnboarding() {
    onboardingStep.value++
  }

  function reset() {
    chosenGenre.value    = null
    chosenClass.value    = null
    onboardingStep.value = 0
    localStorage.removeItem(GENRE_KEY)
    localStorage.removeItem(CLASS_KEY)
  }

  return { chosenGenre, chosenClass, onboardingStep, selectGenre, selectClass, advanceOnboarding, reset }
})
