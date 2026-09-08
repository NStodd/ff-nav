<template>
  <div class="screen">
    <StarField />

    <div class="corner corner-tl" />
    <div class="corner corner-tr" />
    <div class="corner corner-bl" />
    <div class="corner corner-br" />

    <div class="content">
      <PixelButton variant="ghost" class="back-link" @click="router.push({ name: 'map', params: { genreId: store.chosenGenre.id } })">
        &#8592; MAP
      </PixelButton>

      <header class="header">
        <h1>CRYSTAL PATH</h1>
        <PixelDivider />
        <p class="subtitle">YOUR JOURNEY SO FAR</p>
      </header>

      <section class="character-card" :style="{ '--cc': store.chosenClass.color }">
        <PixelSprite :rows="store.chosenClass.sprite" :color="store.chosenClass.color" :pixelSize="8" />
        <div class="character-info">
          <p class="class-name">{{ store.chosenClass.name.toUpperCase() }}</p>
          <p class="class-tag">&#9733; {{ store.chosenClass.tag.toUpperCase() }} &middot; {{ store.chosenGenre.name.toUpperCase() }}</p>

          <div class="pip-row">
            <span class="pip-label">LEVEL {{ progress.level }}</span>
            <span v-for="n in 5" :key="n" class="pip" :class="{ filled: n <= progress.level }" />
          </div>
          <p class="xp-text">
            {{ progress.maxed ? `${progress.xp} XP — max level` : `${progress.xp} / ${progress.ceil} XP to level ${progress.level + 1}` }}
          </p>

          <div class="pip-row" v-for="stat in ['str', 'exp', 'agi']" :key="stat">
            <span class="pip-label">{{ stat.toUpperCase() }}</span>
            <span v-for="n in 5" :key="n" class="pip" :class="{ filled: n <= store.chosenClass.stats[stat] }" />
          </div>
        </div>
      </section>

      <section class="stats-grid">
        <div class="stat-tile">
          <span class="stat-value">{{ current.tripsCompleted }}</span>
          <span class="stat-label">TRIPS COMPLETED</span>
        </div>
        <div class="stat-tile">
          <span class="stat-value">{{ distanceLabel }}</span>
          <span class="stat-label">DISTANCE TRAVELED</span>
        </div>
        <div class="stat-tile">
          <span class="stat-value">{{ current.abilitiesUsed }}</span>
          <span class="stat-label">ABILITIES USED</span>
        </div>
        <div class="stat-tile">
          <span class="stat-value">{{ current.poisDiscovered }}</span>
          <span class="stat-label">POIS DISCOVERED</span>
        </div>
        <div class="stat-tile">
          <span class="stat-value">{{ current.pickupsCollected }}</span>
          <span class="stat-label">PICKUPS COLLECTED</span>
        </div>
      </section>

      <section v-if="otherClasses.length" class="other-classes">
        <h2>OTHER PATHS WALKED</h2>
        <div class="other-list">
          <div v-for="entry in otherClasses" :key="entry.classId" class="other-entry" :style="{ '--cc': entry.class.color }">
            <PixelSprite :rows="entry.class.sprite" :color="entry.class.color" :pixelSize="3" />
            <div class="other-info">
              <span class="other-name">{{ entry.class.name.toUpperCase() }}</span>
              <span class="other-genre">{{ entry.genre.name.toUpperCase() }} &middot; LEVEL {{ entry.level }}</span>
            </div>
          </div>
        </div>
      </section>

      <section class="party">
        <h2>YOUR PARTY</h2>
        <p class="hint">Companions you're traveling with — used to personalize sharing your ETA, once that's wired up. Local to this device; no accounts, no sync.</p>

        <div v-if="profile.party.length" class="party-list">
          <div v-for="member in profile.party" :key="member.id" class="party-member">
            <span class="member-name">{{ member.name }}</span>
            <span v-if="member.note" class="member-note">{{ member.note }}</span>
            <button class="remove-btn" @click="profile.removePartyMember(member.id)" aria-label="Remove">&times;</button>
          </div>
        </div>
        <p v-else class="empty-hint">No one in your party yet.</p>

        <form class="add-form" @submit.prevent="addMember">
          <input v-model="newName" class="name-input" placeholder="Name" maxlength="24" />
          <input v-model="newNote" class="note-input" placeholder="Note (optional)" maxlength="32" />
          <PixelButton :classColor="store.chosenClass.color" :disabled="!newName.trim()">ADD</PixelButton>
        </form>
      </section>

      <section class="saved-places">
        <h2>SAVED PLACES</h2>
        <p class="hint">Destinations worth keeping — home, work, anywhere you'd rather pick from a list than tap the map again. No addresses looked up automatically, so name each one yourself.</p>

        <div v-if="profile.savedDestinations.length" class="places-list">
          <div v-for="dest in profile.savedDestinations" :key="dest.id" class="place-entry">
            <input
              class="place-label"
              :value="dest.label"
              @change="profile.renameSavedDestination(dest.id, $event.target.value)"
              maxlength="32"
            />
            <span class="place-coords">{{ dest.lat.toFixed(4) }}, {{ dest.lng.toFixed(4) }}</span>
            <PixelButton
              v-if="navigation.hasRoute"
              variant="ghost"
              :classColor="store.chosenClass.color"
              @click="addSavedAsStop(dest)"
            >+ STOP</PixelButton>
            <PixelButton variant="ghost" :classColor="store.chosenClass.color" @click="goToSaved(dest)">GO</PixelButton>
            <button class="remove-btn" @click="profile.removeSavedDestination(dest.id)" aria-label="Remove">&times;</button>
          </div>
        </div>
        <p v-else class="empty-hint">Nothing saved yet — tap the ☆ next to your ETA on the map to save your current destination.</p>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '@/stores/player.js'
import { useProfileStore } from '@/stores/profile.js'
import { useNavigationStore } from '@/stores/navigation.js'
import { findClassById } from '@/data/genres.js'
import StarField from '@/components/StarField.vue'
import PixelDivider from '@/components/PixelDivider.vue'
import PixelButton from '@/components/PixelButton.vue'
import PixelSprite from '@/components/PixelSprite.vue'

const router      = useRouter()
const store       = usePlayerStore()
const profile     = useProfileStore()
const navigation  = useNavigationStore()

const progress = computed(() => profile.xpProgressOf(store.chosenClass.id))
const current  = computed(() => profile.progressFor(store.chosenClass.id))

const distanceLabel = computed(() => {
  const m = current.value.distanceMeters
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`
})

// Any other class with tracked progress — reads across every genre's roster
// via findClassById(), not just the currently active one, since profile.js
// keys progress by classId regardless of which genre it came from.
const otherClasses = computed(() =>
  Object.keys(profile.classes)
    .filter(id => id !== store.chosenClass.id)
    .map(id => {
      const found = findClassById(id)
      if (!found) return null
      return { classId: id, class: found.class, genre: found.genre, level: profile.levelOf(id) }
    })
    .filter(Boolean)
)

const newName = ref('')
const newNote = ref('')
function addMember() {
  if (!newName.value.trim()) return
  profile.addPartyMember(newName.value.trim(), newNote.value.trim())
  newName.value = ''
  newNote.value = ''
}

// Direction F, phase 1: picking a saved destination is a real navigation,
// same as every other "leave this screen" action here — not a mid-map
// dropdown, consistent with the driver-attention principle this app has
// followed since Milestone 5.
function goToSaved(dest) {
  navigation.setDestination({ lat: dest.lat, lng: dest.lng }, store.preferences)
  router.push({ name: 'map', params: { genreId: store.chosenGenre.id } })
}

// Direction F, phase 3: the other way to build a multi-stop trip besides
// arming "+ ADD STOP" on the map itself — only shown once a trip is already
// underway (`navigation.hasRoute`), since a waypoint only means anything
// relative to an existing destination.
function addSavedAsStop(dest) {
  navigation.addWaypoint({ lat: dest.lat, lng: dest.lng })
  router.push({ name: 'map', params: { genreId: store.chosenGenre.id } })
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
  padding: 2rem 1rem 3rem;
  font-family: 'Press Start 2P', monospace;
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
  max-width: 720px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.back-link {
  align-self: flex-start;
  font-size: 8px;
  padding: 6px 10px;
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

h2 {
  font-size: 9px;
  color: var(--ff-gold);
  letter-spacing: 0.05em;
  margin-bottom: 0.5rem;
}

.character-card {
  width: 100%;
  display: flex;
  gap: 1.5rem;
  padding: 1.25rem;
  background: var(--ff-panel);
  border: 2px solid var(--cc);
  box-shadow: 0 0 24px color-mix(in srgb, var(--cc) 25%, transparent);
}

.character-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
}

.class-name {
  font-size: 12px;
  color: var(--cc);
  letter-spacing: 0.05em;
}

.class-tag {
  font-size: 7px;
  color: var(--ff-muted);
  margin-bottom: 0.25rem;
}

.pip-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pip-label {
  font-size: 6.5px;
  color: var(--ff-muted);
  width: 52px;
  flex-shrink: 0;
}

.pip {
  display: inline-block;
  width: 9px;
  height: 9px;
  border: 1px solid var(--ff-border);
}

.pip.filled {
  background: var(--cc);
  border-color: var(--cc);
}

.xp-text {
  font-size: 6.5px;
  color: var(--ff-muted);
  margin: 0.1rem 0 0.4rem;
}

.stats-grid {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 1px;
  background: var(--ff-border);
  border: 1px solid var(--ff-border);
}

.stat-tile {
  background: var(--ff-panel);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.stat-value {
  font-size: 16px;
  color: var(--ff-gold);
  font-variant-numeric: tabular-nums;
}

.stat-tile .stat-label {
  font-size: 6px;
  color: var(--ff-muted);
  letter-spacing: 0.04em;
}

.other-classes,
.party {
  width: 100%;
}

.hint {
  font-size: 6.5px;
  color: var(--ff-muted);
  line-height: 1.7;
  margin-bottom: 0.75rem;
}

.other-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.other-entry {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: var(--ff-panel);
  border: 1px solid var(--ff-border);
}

.other-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.other-name {
  font-size: 7px;
  color: var(--cc);
}

.other-genre {
  font-size: 6px;
  color: var(--ff-muted);
}

.party-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.party-member {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
  background: var(--ff-panel);
  border: 1px solid var(--ff-border);
}

.member-name {
  font-size: 7px;
  color: var(--ff-text);
}

.member-note {
  font-size: 6px;
  color: var(--ff-muted);
  flex: 1;
}

.remove-btn {
  margin-left: auto;
  background: none;
  border: 1px solid var(--ff-border);
  color: var(--ff-muted);
  width: 20px;
  height: 20px;
  cursor: pointer;
  font-size: 10px;
  line-height: 1;
}

.remove-btn:hover {
  border-color: var(--ff-gold-dark);
  color: var(--ff-text);
}

.empty-hint {
  font-size: 7px;
  color: var(--ff-muted);
  margin-bottom: 1rem;
}

.add-form {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.name-input,
.note-input {
  font-family: 'Press Start 2P', monospace;
  font-size: 7px;
  padding: 8px 10px;
  background: var(--ff-panel);
  border: 2px solid var(--ff-border);
  color: var(--ff-text);
  flex: 1;
  min-width: 100px;
}

.name-input:focus,
.note-input:focus {
  outline: none;
  border-color: var(--ff-gold-dark);
}

.name-input::placeholder,
.note-input::placeholder {
  color: var(--ff-muted);
}

.saved-places {
  width: 100%;
}

.places-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.place-entry {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 0.75rem;
  background: var(--ff-panel);
  border: 1px solid var(--ff-border);
  flex-wrap: wrap;
}

.place-label {
  font-family: 'Press Start 2P', monospace;
  font-size: 7px;
  padding: 6px 8px;
  background: var(--ff-dark);
  border: 1px solid var(--ff-border);
  color: var(--ff-text);
  flex: 1;
  min-width: 100px;
}

.place-label:focus {
  outline: none;
  border-color: var(--ff-gold-dark);
}

.place-coords {
  font-size: 6px;
  color: var(--ff-muted);
  flex-shrink: 0;
}
</style>
