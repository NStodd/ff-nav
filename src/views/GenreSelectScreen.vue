<template>
  <div class="screen">
    <StarField />

    <!-- Corner decorations -->
    <div class="corner corner-tl" />
    <div class="corner corner-tr" />
    <div class="corner corner-bl" />
    <div class="corner corner-br" />

    <div class="content">
      <header class="header">
        <h1>CRYSTAL PATH</h1>
        <PixelDivider />
        <p class="subtitle">CHOOSE YOUR PATH</p>
      </header>

      <p class="prompt">— select a genre —</p>

      <div class="grid" role="group" aria-label="Genre selection">
        <GenreCard
          v-for="genre in GENRES"
          :key="genre.id"
          :genreData="genre"
          @select="onSelect(genre)"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { GENRES } from '@/data/genres.js'
import StarField from '@/components/StarField.vue'
import PixelDivider from '@/components/PixelDivider.vue'
import GenreCard from '@/components/GenreCard.vue'

const router = useRouter()

function onSelect(genre) {
  if (genre.entryRoute) router.push({ name: genre.entryRoute, params: { genreId: genre.id } })
}
</script>

<style scoped>
.screen {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem 3rem;
}

.corner {
  position: absolute;
  width: 16px;
  height: 16px;
  pointer-events: none;
}
.corner-tl { top: 1rem;    left: 1rem;  border-top: 2px solid var(--ff-gold-dark); border-left:  2px solid var(--ff-gold-dark); }
.corner-tr { top: 1rem;    right: 1rem; border-top: 2px solid var(--ff-gold-dark); border-right: 2px solid var(--ff-gold-dark); }
.corner-bl { bottom: 1rem; left: 1rem;  border-bottom: 2px solid var(--ff-gold-dark); border-left:  2px solid var(--ff-gold-dark); }
.corner-br { bottom: 1rem; right: 1rem; border-bottom: 2px solid var(--ff-gold-dark); border-right: 2px solid var(--ff-gold-dark); }

.content {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 780px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.header {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

h1 {
  font-size: clamp(14px, 3vw, 24px);
  color: var(--ff-gold);
  letter-spacing: 0.1em;
  text-shadow: 0 0 20px rgba(240, 192, 96, 0.4);
}

.subtitle {
  font-size: 8px;
  color: var(--ff-muted);
  letter-spacing: 0.15em;
}

.prompt {
  font-size: 8px;
  color: var(--ff-muted);
  letter-spacing: 0.1em;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  width: 100%;
}
</style>
