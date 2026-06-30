import { createRouter, createWebHistory } from 'vue-router'
import { usePlayerStore } from '@/stores/player'
import ClassSelectScreen from '@/views/ClassSelectScreen.vue'
import OnboardingScreen  from '@/views/OnboardingScreen.vue'
import MapScreen         from '@/views/MapScreen.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/',           name: 'class-select', component: ClassSelectScreen },
    { path: '/onboarding', name: 'onboarding',   component: OnboardingScreen  },
    { path: '/map',        name: 'map',          component: MapScreen         },
  ],
})

router.beforeEach((to) => {
  if (to.name === 'class-select') return true
  const store = usePlayerStore()
  if (!store.chosenClass) return { name: 'class-select' }
})

export default router
