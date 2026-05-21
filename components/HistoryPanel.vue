<script setup lang="ts">
import { useHistory } from '~/composables/useHistory'

const { entries, getWav, remove, clear } = useHistory()

const playingId = ref<string | null>(null)
let audioEl: HTMLAudioElement | null = null
let blobUrl = ''

async function togglePlay(id: string) {
  if (playingId.value === id) {
    audioEl?.pause()
    playingId.value = null
    return
  }
  const wav = await getWav(id)
  if (!wav) return
  if (blobUrl) URL.revokeObjectURL(blobUrl)
  blobUrl = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }))
  if (!audioEl) {
    audioEl = new Audio()
    audioEl.addEventListener('ended', () => { playingId.value = null })
    audioEl.addEventListener('pause', () => {
      if (playingId.value === id) playingId.value = null
    })
  }
  audioEl.src = blobUrl
  await audioEl.play().catch(() => {})
  playingId.value = id
}

async function saveEntry(id: string, text: string) {
  const wav = await getWav(id)
  if (!wav) return
  const url = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `speech-${id.split('-')[0]}.wav`
  a.click()
  URL.revokeObjectURL(url)
  void text
}

function fmtDate(ts: number) {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
function fmtDur(s: number) {
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`
}
function trunc(t: string, n = 80) {
  return t.length > n ? t.slice(0, n) + '…' : t
}

onUnmounted(() => {
  audioEl?.pause()
  if (blobUrl) URL.revokeObjectURL(blobUrl)
})
</script>

<template>
  <div class="mx-auto flex h-full w-full max-w-2xl flex-col gap-3 p-4">

    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-[13px] font-semibold uppercase tracking-widest text-secondary">History</h1>
        <p class="mt-0.5 text-[11px] text-faded">{{ entries.length }} saved generations</p>
      </div>
      <button
        v-if="entries.length > 0"
        type="button"
        class="rounded-lg bg-surface px-2.5 py-1 text-[11px] text-faded transition-ui hover:bg-err/10 hover:text-err"
        @click="clear()"
      >
        Clear all
      </button>
    </div>

    <!-- Empty state -->
    <div v-if="entries.length === 0" class="flex flex-1 items-center justify-center">
      <div class="text-center">
        <svg class="mx-auto mb-3 h-8 w-8 text-faded/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p class="text-[13px] text-faded">No generations yet</p>
        <p class="mt-1 text-[11px] text-faded/50">Generate speech — it auto-saves here</p>
      </div>
    </div>

    <!-- List -->
    <div v-else class="space-y-2 pb-2">
      <div
        v-for="entry in entries"
        :key="entry.id"
        class="glass-panel rounded-xl px-3 py-2.5"
      >
        <div class="flex items-start gap-3">
          <!-- Play button -->
          <button
            type="button"
            class="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full transition-ui"
            :class="playingId === entry.id
              ? 'bg-accent text-white shadow-button'
              : 'bg-subtle text-faded hover:bg-accent/20 hover:text-accent'"
            @click="togglePlay(entry.id)"
          >
            <svg v-if="playingId !== entry.id" class="h-3 w-3 translate-x-px" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            <svg v-else class="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          </button>

          <!-- Content -->
          <div class="min-w-0 flex-1">
            <p class="text-[13px] leading-snug text-primary">{{ trunc(entry.text) }}</p>
            <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-faded">
              <span class="uppercase font-medium">{{ entry.voice }}</span>
              <span>·</span>
              <span>{{ entry.device.toUpperCase() }}</span>
              <span>·</span>
              <span>{{ fmtDur(entry.duration) }}</span>
              <span>·</span>
              <span class="tabular-nums">{{ (entry.elapsedMs / 1000).toFixed(1) }}s gen</span>
              <span>·</span>
              <span>{{ fmtDate(entry.timestamp) }}</span>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              title="Save WAV"
              class="flex h-7 w-7 items-center justify-center rounded-lg text-faded transition-ui hover:bg-subtle hover:text-secondary"
              @click="saveEntry(entry.id, entry.text)"
            >
              <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            </button>
            <button
              type="button"
              title="Delete"
              class="flex h-7 w-7 items-center justify-center rounded-lg text-faded transition-ui hover:bg-err/10 hover:text-err"
              @click="remove(entry.id)"
            >
              <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
