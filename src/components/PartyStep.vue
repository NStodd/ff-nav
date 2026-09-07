<template>
  <div class="party-step" :style="{ '--cc': classData.color }">
    <DialogBox
      :text="classData.partyPrompt"
      :classColor="classData.color"
      :speed="30"
      @done="promptDone = true"
    />

    <div class="roster" v-if="profile.party.length">
      <div v-for="member in profile.party" :key="member.id" class="member">
        <span class="member-name">{{ member.name }}</span>
        <span v-if="member.note" class="member-note">{{ member.note }}</span>
        <button class="remove-btn" type="button" @click="profile.removePartyMember(member.id)" aria-label="Remove">&times;</button>
      </div>
    </div>

    <form class="add-form" @submit.prevent="addMember">
      <input v-model="name" class="name-input" placeholder="Name" maxlength="24" />
      <input v-model="note" class="note-input" placeholder="Note (optional)" maxlength="32" />
      <PixelButton variant="ghost" :classColor="classData.color" :disabled="!name.trim()">ADD</PixelButton>
    </form>

    <div class="actions">
      <PixelButton
        :classColor="classData.color"
        :disabled="!promptDone"
        @click="$emit('next')"
      >
        Continue
      </PixelButton>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useProfileStore } from '@/stores/profile.js'
import DialogBox from '@/components/DialogBox.vue'
import PixelButton from '@/components/PixelButton.vue'

defineProps({
  classData: { type: Object, required: true },
})

defineEmits(['next'])

const profile = useProfileStore()

const promptDone = ref(false)
const name = ref('')
const note = ref('')

function addMember() {
  if (!name.value.trim()) return
  profile.addPartyMember(name.value.trim(), note.value.trim())
  name.value = ''
  note.value = ''
}
</script>

<style scoped>
.party-step {
  display:        flex;
  flex-direction: column;
  align-items:    center;
  gap:            20px;
  width:          100%;
}

.roster {
  display:        flex;
  flex-direction: column;
  gap:            8px;
  width:          100%;
  max-width:      360px;
}

.member {
  display:      flex;
  align-items:  center;
  gap:          10px;
  padding:      8px 10px;
  background:   var(--ff-panel);
  border:       1px solid var(--ff-border);
}

.member-name {
  font-family: 'Press Start 2P', monospace;
  font-size:   8px;
  color:       var(--ff-text);
}

.member-note {
  font-family: 'Press Start 2P', monospace;
  font-size:   6px;
  color:       var(--ff-muted);
  flex:        1;
}

.remove-btn {
  margin-left:  auto;
  background:   none;
  border:       1px solid var(--ff-border);
  color:        var(--ff-muted);
  width:        18px;
  height:       18px;
  cursor:       pointer;
  font-size:    10px;
  line-height:  1;
  flex-shrink:  0;
}

.remove-btn:hover {
  border-color: var(--cc);
  color:        var(--ff-text);
}

.add-form {
  display:   flex;
  flex-wrap: wrap;
  gap:       8px;
  width:     100%;
  max-width: 360px;
  justify-content: center;
}

.name-input,
.note-input {
  font-family: 'Press Start 2P', monospace;
  font-size:   7px;
  padding:     10px;
  background:  var(--ff-panel);
  border:      2px solid var(--ff-border);
  color:       var(--ff-text);
  flex:        1;
  min-width:   100px;
}

.name-input:focus,
.note-input:focus {
  outline:      none;
  border-color: var(--cc);
}

.name-input::placeholder,
.note-input::placeholder {
  color: var(--ff-muted);
}

.actions {
  margin-top: 4px;
}
</style>
