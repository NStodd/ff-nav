<template>
  <div style="padding: 2rem; font-family: 'Press Start 2P', monospace; color: #F0C060;">
    <p>Welcome, {{ store.chosenClass?.name }}.</p>
    <p style="margin-top: 1rem; font-size: 10px; color: #9090A8;">Onboarding flow coming soon.</p>
    <button @click="router.push('/')" style="margin-top: 2rem; font-family: 'Press Start 2P', monospace; cursor: pointer;">&#8592; Back</button>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { usePlayerStore } from '@/stores/player.js'
const router = useRouter()
const store  = usePlayerStore()
</script>
