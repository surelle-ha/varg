<script setup lang="ts">
import { useKokoro, KOKORO_VOICES } from '~/composables/useKokoro'
import { useParler } from '~/composables/useParler'

const {
  audioUrl, audioBuffer, elapsedMs, sampleRate,
  genDevice, generating, genChunk, genTotal,
  lastGenText, lastGenVoice, lastGenSpeed,
  save,
} = useKokoro()

const { generating: parlerGenerating } = useParler()

const anyGenerating = computed(() => generating.value || parlerGenerating.value)

const visible   = ref(false)
const minimized = ref(false)
const audioRef  = ref<HTMLAudioElement | null>(null)
const isPlaying = ref(false)
const current   = ref(0)
const duration  = ref(0)
const seekRef   = ref<HTMLElement | null>(null)

const progress = computed(() => duration.value ? (current.value / duration.value) * 100 : 0)

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
  const rect = bar.getBoundingClientRect()
  audioRef.value.currentTime = ((e.clientX - rect.left) / bar.clientWidth) * duration.value
}

watch(audioUrl, async (url) => {
  if (!url) return
  visible.value   = true
  minimized.value = false
  isPlaying.value = false
  current.value   = 0
  duration.value  = 0
  await nextTick()
  audioRef.value?.play().catch(() => {})
})

const voiceName = computed(() => {
  const v = KOKORO_VOICES.find(x => x.id === lastGenVoice.value)
  return v ? v.name : lastGenVoice.value
})

const textPreview = computed(() => {
  const t = lastGenText.value.trim()
  return t.length > 70 ? t.slice(0, 70) + '…' : t
})

const rtf = computed(() => {
  if (!elapsedMs.value || !duration.value) return null
  return (elapsedMs.value / 1000 / duration.value).toFixed(2)
})

const fileSizeMb = computed(() => {
  if (!audioBuffer.value) return null
  return (audioBuffer.value.byteLength / 1024 / 1024).toFixed(2)
})

function dismiss() {
  visible.value = false
  audioRef.value?.pause()
  isPlaying.value = false
}
</script>

<template>
  <!-- Hidden audio element -->
  <audio
    ref="audioRef"
    :src="audioUrl || undefined"
    class="hidden"
    @play="isPlaying = true"
    @pause="isPlaying = false"
    @ended="isPlaying = false"
    @timeupdate="current = audioRef?.currentTime ?? 0"
    @loadedmetadata="duration = audioRef?.duration ?? 0"
  />

  <Transition name="drawer">
    <div
      v-if="visible"
      class="flex-shrink-0 border-t border-white/5 bg-surface/95 backdrop-blur-md"
    >
      <!-- Minimized bar -->
      <div
        v-if="minimized"
        class="flex h-10 items-center gap-3 px-4 cursor-pointer hover:bg-subtle/40 transition-colors"
        @click="minimized = false"
      >
        <button type="button"
          class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-accent text-white shadow-button transition-ui hover:bg-accent-dark active:scale-95"
          @click.stop="togglePlay">
          <svg v-if="!isPlaying" class="h-3 w-3 translate-x-px" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
          <svg v-else class="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        </button>
        <!-- Mini progress -->
        <div class="flex-1 h-1 rounded-full bg-subtle overflow-hidden cursor-pointer" @click.stop="seek">
          <div class="h-full rounded-full bg-accent" :style="{ width: `${progress}%` }" />
        </div>
        <span class="text-[10px] tabular-nums text-faded">{{ fmt(current) }} / {{ fmt(duration) }}</span>
        <span class="text-[11px] text-faded truncate max-w-[200px]">{{ textPreview }}</span>
        <svg class="h-3.5 w-3.5 text-faded/40 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
        </svg>
      </div>

      <!-- Expanded drawer -->
      <div v-else class="px-4 py-3 space-y-2.5">

        <!-- Top row: info + controls -->
        <div class="flex items-center gap-4">

          <!-- Play/pause button -->
          <button type="button"
            class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-accent text-white shadow-button transition-ui hover:bg-accent-dark active:scale-95"
            @click="togglePlay">
            <svg v-if="!isPlaying" class="h-4 w-4 translate-x-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            <svg v-else class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          </button>

          <!-- Track info -->
          <div class="min-w-0 flex-1">
            <p class="truncate text-[12px] font-medium text-secondary">{{ textPreview }}</p>
            <div class="mt-0.5 flex items-center gap-2 flex-wrap">
              <span class="text-[10px] text-faded">{{ voiceName }}</span>
              <span class="text-[10px] text-faded/30">·</span>
              <span class="text-[10px] text-faded">{{ lastGenSpeed.toFixed(1) }}×</span>
              <span v-if="genDevice" class="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase"
                :class="genDevice === 'gpu' ? 'bg-accent/15 text-accent' : 'bg-subtle text-faded'">
                {{ genDevice === 'gpu' ? 'WebGPU' : 'CPU' }}
              </span>
            </div>
          </div>

          <!-- Stats pills -->
          <div class="hidden sm:flex items-center gap-3 flex-shrink-0 text-[10px] text-faded">
            <span v-if="duration" class="tabular-nums">{{ fmt(duration) }}</span>
            <span v-if="fileSizeMb" class="tabular-nums">{{ fileSizeMb }} MB</span>
            <span v-if="elapsedMs" class="tabular-nums">{{ (elapsedMs / 1000).toFixed(1) }}s gen</span>
            <span v-if="rtf" class="tabular-nums">RTF {{ rtf }}×</span>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-1 flex-shrink-0">
            <!-- Save -->
            <button type="button" title="Save WAV"
              class="flex h-7 w-7 items-center justify-center rounded-lg text-faded transition-ui hover:bg-subtle hover:text-secondary"
              @click="save()">
              <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            </button>
            <!-- Minimize -->
            <button type="button" title="Minimize"
              class="flex h-7 w-7 items-center justify-center rounded-lg text-faded transition-ui hover:bg-subtle hover:text-secondary"
              @click="minimized = true">
              <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
            <!-- Dismiss -->
            <button type="button" title="Close player"
              class="flex h-7 w-7 items-center justify-center rounded-lg text-faded transition-ui hover:bg-err/15 hover:text-err"
              @click="dismiss">
              <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Seek bar -->
        <div class="flex items-center gap-2">
          <span class="w-8 text-right text-[10px] tabular-nums text-faded">{{ fmt(current) }}</span>
          <div
            ref="seekRef"
            class="flex-1 h-1.5 cursor-pointer overflow-hidden rounded-full bg-subtle group"
            @click="seek"
          >
            <div class="h-full rounded-full bg-accent transition-none" :style="{ width: `${progress}%` }" />
          </div>
          <span class="w-8 text-[10px] tabular-nums text-faded">{{ fmt(duration) }}</span>
        </div>

      </div>
    </div>
  </Transition>

  <!-- Generating indicator -->
  <Transition name="drawer">
    <div v-if="anyGenerating && !visible" class="gen-bar flex-shrink-0">
      <Dither edge-color="rgba(22,23,26,1)" />

      <div class="relative z-10 flex h-full items-center gap-3 px-5">
        <div class="flex items-end gap-[3px]" style="height:16px;width:22px;">
          <span class="gen-eq gen-eq-1" />
          <span class="gen-eq gen-eq-2" />
          <span class="gen-eq gen-eq-3" />
          <span class="gen-eq gen-eq-4" />
          <span class="gen-eq gen-eq-5" />
        </div>
        <span class="text-[12px] font-medium tracking-wide text-secondary">
          {{ parlerGenerating ? 'Generating (Chatterbox)' : 'Generating audio' }}
        </span>
        <span class="text-[11px] tabular-nums text-faded/50">
          <template v-if="!parlerGenerating && genChunk > 0 && genTotal > 1">Part {{ genChunk }}&thinsp;/&thinsp;{{ genTotal }}</template>
          <template v-else>…</template>
        </span>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.drawer-enter-active { transition: height 0.2s ease, opacity 0.2s ease; overflow: hidden; }
.drawer-leave-active { transition: height 0.15s ease, opacity 0.15s ease; overflow: hidden; }
.drawer-enter-from, .drawer-leave-to { height: 0; opacity: 0; }

/* ── Generating bar ───────────────────────────────────────────────────────── */
.gen-bar {
  position: relative;
  height: 52px;
  overflow: hidden;
  background-color: rgba(22, 23, 26, 0.98);
  backdrop-filter: blur(8px);
}

/* Equalizer bars */
.gen-eq {
  display: block;
  width: 3px;
  border-radius: 2px;
  background: #5865f2;
  animation: eqBounce 1.15s ease-in-out infinite;
  min-height: 3px;
}
@keyframes eqBounce {
  0%, 100% { height: 4px;  opacity: 0.45; }
  50%       { height: 15px; opacity: 1; }
}
.gen-eq-1 { animation-delay: 0s;     }
.gen-eq-2 { animation-delay: 0.18s;  }
.gen-eq-3 { animation-delay: 0.36s;  }
.gen-eq-4 { animation-delay: 0.18s;  }
.gen-eq-5 { animation-delay: 0s;     }
</style>
