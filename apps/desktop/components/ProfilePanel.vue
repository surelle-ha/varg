<script setup lang="ts">
import { useProfile } from '~/composables/useProfile'
import { useHistory } from '~/composables/useHistory'

const { profile, setAvatar, clearAvatar, update } = useProfile()
const { entries } = useHistory()

const fileInputRef  = ref<HTMLInputElement | null>(null)
const uploading     = ref(false)
const editingName   = ref(false)

const draftFirst    = ref(profile.value.firstName)
const draftLast     = ref(profile.value.lastName)
const draftPosition = ref(profile.value.position)

watch(() => profile.value, (p) => {
  if (!editingName.value) {
    draftFirst.value    = p.firstName
    draftLast.value     = p.lastName
    draftPosition.value = p.position
  }
}, { deep: true })

const initials = computed(() => {
  const f = profile.value.firstName?.[0]?.toUpperCase() ?? ''
  const l = profile.value.lastName?.[0]?.toUpperCase() ?? ''
  return (f + l) || '?'
})
const fullName = computed(() =>
  [profile.value.firstName, profile.value.lastName].filter(Boolean).join(' ') || 'No name',
)

// Aggregated stats from history
const totalGenerations = computed(() => entries.value.length)
const totalChars       = computed(() => entries.value.reduce((s, e) => s + e.text.length, 0))
const totalAudioSec    = computed(() => entries.value.reduce((s, e) => s + e.duration, 0))
const totalGenTimeSec  = computed(() => entries.value.reduce((s, e) => s + e.elapsedMs, 0) / 1000)
const recentEntries    = computed(() => entries.value.slice(0, 5))

function fmtAudio(s: number) {
  if (s < 60) return `${s.toFixed(0)}s`
  return `${Math.floor(s / 60)}m ${Math.floor(s % 60)}s`
}
function fmtDur(s: number) {
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`
}
function trunc(t: string, n = 60) {
  return t.length > n ? t.slice(0, n) + '…' : t
}

async function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploading.value = true
  try { await setAvatar(file) } finally { uploading.value = false }
  if (fileInputRef.value) fileInputRef.value.value = ''
}

function saveNameEdit() {
  update({
    firstName: draftFirst.value.trim(),
    lastName:  draftLast.value.trim(),
    position:  draftPosition.value.trim(),
  })
  editingName.value = false
}
</script>

<template>
  <div class="h-full w-full overflow-y-auto">

    <!-- Cover + avatar -->
    <div class="relative">
      <!-- Dither cover -->
      <div class="h-44 w-full overflow-hidden">
        <Dither
          :wave-speed="0.03"
          :wave-frequency="2"
          :wave-amplitude="0.2"
          :wave-color="[0.34, 0.39, 0.95]"
          :color-num="4"
          :pixel-size="2"
          :disable-animation="false"
          :enable-mouse-interaction="false"
        />
      </div>

      <!-- Avatar overlapping cover -->
      <div class="absolute bottom-0 left-1/2 z-10 -translate-x-1/2 translate-y-1/2">
        <div class="group relative h-24 w-24 overflow-hidden rounded-full border-4 border-base bg-surface shadow-button">
          <img v-if="profile.avatar" :src="profile.avatar" class="h-full w-full object-cover" />
          <div
            v-else
            class="flex h-full w-full items-center justify-center bg-accent/20 text-[28px] font-black text-accent"
          >{{ initials }}</div>

          <!-- Camera overlay on hover -->
          <button
            type="button"
            title="Change photo"
            class="absolute inset-0 flex flex-col items-center justify-center rounded-full bg-black/0 opacity-0 transition-all group-hover:bg-black/50 group-hover:opacity-100"
            :class="uploading ? 'bg-black/50 !opacity-100' : ''"
            @click="fileInputRef?.click()"
          >
            <svg v-if="!uploading" class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
            </svg>
            <svg v-else class="h-5 w-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </button>
        </div>
        <input ref="fileInputRef" type="file" accept="image/*" class="hidden" @change="onFileChange" />
      </div>
    </div>

    <!-- Content -->
    <div class="mt-14 space-y-5 px-6 pb-6">

      <!-- Name + position -->
      <div class="text-center">
        <template v-if="!editingName">
          <h2 class="text-[18px] font-bold leading-tight text-primary">{{ fullName }}</h2>
          <p v-if="profile.position" class="mt-0.5 text-[12px] text-faded">{{ profile.position }}</p>
          <button
            type="button"
            class="mt-2 text-[11px] text-accent hover:underline"
            @click="editingName = true; draftFirst = profile.firstName; draftLast = profile.lastName; draftPosition = profile.position"
          >
            Edit profile
          </button>
        </template>

        <div v-else class="mx-auto max-w-xs space-y-2 text-left">
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="mb-0.5 block text-[10px] font-semibold uppercase tracking-widest text-faded">First</label>
              <input v-model="draftFirst" class="glass-input w-full rounded-lg px-2.5 py-1.5 text-[12px]" maxlength="40" />
            </div>
            <div>
              <label class="mb-0.5 block text-[10px] font-semibold uppercase tracking-widest text-faded">Last</label>
              <input v-model="draftLast" class="glass-input w-full rounded-lg px-2.5 py-1.5 text-[12px]" maxlength="40" />
            </div>
          </div>
          <div>
            <label class="mb-0.5 block text-[10px] font-semibold uppercase tracking-widest text-faded">Position</label>
            <input v-model="draftPosition" class="glass-input w-full rounded-lg px-2.5 py-1.5 text-[12px]" placeholder="e.g. Product Designer" maxlength="60" />
          </div>
          <div class="flex justify-end gap-2">
            <button type="button" class="rounded-lg px-3 py-1 text-[11px] text-faded transition-ui hover:text-secondary" @click="editingName = false">Cancel</button>
            <button type="button" class="rounded-lg bg-accent px-3 py-1 text-[11px] font-medium text-white shadow-button transition-ui hover:bg-accent-dark" @click="saveNameEdit">Save</button>
          </div>
        </div>
      </div>

      <!-- Stats grid -->
      <div class="glass-panel rounded-xl p-4">
        <p class="mb-3 text-[10px] font-semibold uppercase tracking-widest text-faded/60">Usage Stats</p>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <p class="text-[22px] font-bold tabular-nums leading-none text-primary">{{ totalGenerations.toLocaleString() }}</p>
            <p class="mt-0.5 text-[11px] text-faded">Generations</p>
          </div>
          <div>
            <p class="text-[22px] font-bold tabular-nums leading-none text-primary">{{ totalChars.toLocaleString() }}</p>
            <p class="mt-0.5 text-[11px] text-faded">Chars synthesized</p>
          </div>
          <div>
            <p class="text-[22px] font-bold tabular-nums leading-none text-primary">{{ fmtAudio(totalAudioSec) }}</p>
            <p class="mt-0.5 text-[11px] text-faded">Audio generated</p>
          </div>
          <div>
            <p class="text-[22px] font-bold tabular-nums leading-none text-primary">{{ fmtAudio(totalGenTimeSec) }}</p>
            <p class="mt-0.5 text-[11px] text-faded">Processing time</p>
          </div>
        </div>
      </div>

      <!-- Recent activity -->
      <div v-if="recentEntries.length > 0" class="glass-panel rounded-xl p-4 space-y-1">
        <p class="mb-2 text-[10px] font-semibold uppercase tracking-widest text-faded/60">Recent Activity</p>
        <div
          v-for="entry in recentEntries"
          :key="entry.id"
          class="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-ui hover:bg-subtle/40"
        >
          <div class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-accent/15">
            <svg class="h-3.5 w-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-[12px] text-secondary">{{ trunc(entry.text) }}</p>
            <p class="text-[10px] text-faded">{{ fmtDur(entry.duration) }} · {{ entry.voice }}</p>
          </div>
        </div>
      </div>

      <div v-else class="rounded-xl border border-white/5 px-4 py-6 text-center">
        <p class="text-[12px] text-faded">No activity yet</p>
        <p class="mt-0.5 text-[11px] text-faded/50">Generate speech to see it here</p>
      </div>

    </div>
  </div>
</template>
