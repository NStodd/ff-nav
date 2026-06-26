import { createRouter, createWebHistory } from 'vue-router'
import { usePlayerStore } from '@/stores/player'
import ClassSelectScreen from '@/views/ClassSelectScreen.vue'
import OnboardingScreen  from '@/views/OnboardingScreen.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/',           name: 'class-select', component: ClassSelectScreen },
    { path: '/onboarding', name: 'onboarding',   component: OnboardingScreen  },
  ],
})

router.beforeEach((to) => {
  if (to.name === 'class-select') return true
  const store = usePlayerStore()
  if (!store.chosenClass) return { name: 'class-select' }
})

export default router
