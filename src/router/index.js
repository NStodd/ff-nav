import { createRouter, createWebHistory } from 'vue-router'
import { usePlayerStore } from '@/stores/player'
import { GENRES } from '@/data/genres'
import GenreSelectScreen from '@/views/GenreSelectScreen.vue'
import ClassSelectScreen from '@/views/ClassSelectScreen.vue'
import OnboardingScreen  from '@/views/OnboardingScreen.vue'
import MapScreen         from '@/views/MapScreen.vue'
import ProfileScreen     from '@/views/ProfileScreen.vue'
import HudPlayground     from '@/views/HudPlayground.vue'
import SpritePlayground  from '@/views/SpritePlayground.vue'
import MapPlayground     from '@/views/MapPlayground.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/',                     name: 'genre-select',      component: GenreSelectScreen },
    { path: '/:genreId',             name: 'class-select',      component: ClassSelectScreen },
    { path: '/:genreId/onboarding',  name: 'onboarding',        component: OnboardingScreen  },
    { path: '/:genreId/map',         name: 'map',               component: MapScreen         },
    { path: '/:genreId/profile',     name: 'profile',           component: ProfileScreen     },
    { path: '/dev/hud',              name: 'hud-playground',    component: HudPlayground     },
    { path: '/dev/sprites',          name: 'sprite-playground', component: SpritePlayground  },
    { path: '/dev/map',              name: 'map-playground',    component: MapPlayground     },
  ],
})

router.beforeEach((to) => {
  // Standalone dev tools — no genre/class context required.
  if (to.name === 'hud-playground' || to.name === 'sprite-playground' || to.name === 'map-playground') return true

  if (to.name === 'genre-select') return true

  const genre = GENRES.find(g => g.id === to.params.genreId)
  if (!genre || genre.status !== 'available') return { name: 'genre-select' }

  if (to.name === 'class-select') return true

  const store = usePlayerStore()
  if (!store.chosenClass || store.chosenGenre?.id !== genre.id) {
    return { name: 'class-select', params: { genreId: genre.id } }
  }
})

export default router
