<script setup lang="ts">
const props = defineProps<{
  src: string
  elapsedMs?: number
  charCount?: number
}>()

const emit = defineEmits<{ save: [] }>()

const audioRef  = ref<HTMLAudioElement | null>(null)
const isPlaying = ref(false)
const current   = ref(0)
const duration  = ref(0)

const progress = computed(() => duration.value ? (current.value / duration.value) * 100 : 0)

const rtf = computed(() => {
  if (!props.elapsedMs || !duration.value) return null
  return (props.elapsedMs / 1000 / duration.value).toFixed(2)
})

function fmt(s: number) {
  const m = Math.floor(s / 60)
  return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`
}

function togglePlay() {
  if (!audioRef.value) return
  isPlaying.value ? audioRef.value.pause() : audioRef.value.play()
}

function seek(e: MouseEvent) {
  if (!audioRef.value || !duration.value) return
  const bar = e.currentTarget as HTMLElement
  audioRef.value.currentTime = (e.offsetX / bar.clientWidth) * duration.value
}

// Auto-play on new audio
watch(() => props.src, async () => {
  isPlaying.value = false
  current.value   = 0
  duration.value  = 0
  await nextTick()
  audioRef.value?.play().catch(() => {})
})
</script>

<template>
  <audio
    ref="audioRef"
    :src="src"
    class="hidden"
    @play="isPlaying = true"
    @pause="isPlaying = false"
    @ended="isPlaying = false"
    @timeupdate="current = audioRef?.currentTime ?? 0"
    @loadedmetadata="duration = audioRef?.duration ?? 0"
  />

  <div class="glass-panel rounded-xl p-3 space-y-2.5">
    <!-- Header row -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-[10px] font-semibold uppercase tracking-widest text-faded">Output</span>
        <span v-if="elapsedMs" class="rounded bg-surface px-1.5 py-0.5 text-[10px] tabular-nums text-faded">
          {{ (elapsedMs / 1000).toFixed(2) }}s gen
        </span>
        <span v-if="duration" class="rounded bg-surface px-1.5 py-0.5 text-[10px] tabular-nums text-faded">
          {{ fmt(duration) }} audio
        </span>
        <span v-if="rtf" class="rounded bg-surface px-1.5 py-0.5 text-[10px] tabular-nums text-faded">
          RTF {{ rtf }}×
        </span>
        <span v-if="charCount" class="rounded bg-surface px-1.5 py-0.5 text-[10px] tabular-nums text-faded">
          {{ charCount.toLocaleString() }} chars
        </span>
      </div>
      <button
        type="button"
        class="flex items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1 text-[11px] text-secondary transition-ui hover:bg-subtle hover:text-primary"
        @click="emit('save')"
      >
        <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        Save WAV
      </button>
    </div>

    <!-- Controls -->
    <div class="flex items-center gap-3">
      <!-- Play / Pause -->
      <button
        type="button"
        class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent text-white shadow-button transition-ui hover:bg-accent-dark active:scale-95"
        @click="togglePlay"
      >
        <svg v-if="!isPlaying" class="h-3.5 w-3.5 translate-x-0.5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
        <svg v-else class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
        </svg>
      </button>

      <!-- Seek bar + time -->
      <div class="flex flex-1 flex-col gap-1">
        <div
          class="group relative h-1.5 w-full cursor-pointer rounded-full bg-subtle overflow-hidden"
          @click="seek"
        >
          <div
            class="h-full rounded-full bg-accent transition-none"
            :style="{ width: `${progress}%` }"
          />
        </div>
        <div class="flex justify-between">
          <span class="text-[10px] tabular-nums text-faded">{{ fmt(current) }}</span>
          <span class="text-[10px] tabular-nums text-faded">{{ fmt(duration) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
