<script setup lang="ts">
import { sendNotification, isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification'
import { useKokoro, KOKORO_VOICES, type KokoroDevice } from '~/composables/useKokoro'
import { useSettings } from '~/composables/useSettings'
import { useHistory } from '~/composables/useHistory'
import { saveGenerationToDisk } from '~/composables/useHistorySave'

const {
  hasGpu,
  initializing, initProgress, initStatus,
  error, generating, genChunk, genTotal,
  audioBuffer, elapsedMs, sampleRate, activeDevice, genDevice, gpuFallback,
  lastGenText, lastGenVoice, lastGenSpeed,
  init, generate, setDevice,
} = useKokoro()

const { settings } = useSettings()
const { add: addHistory } = useHistory()

const TTS_TEXT_KEY = 'varg-tts-text'
const text = ref(
  import.meta.client
    ? (localStorage.getItem(TTS_TEXT_KEY) ?? 'Life is like a box of chocolates. You never know what you\'re gonna get.')
    : 'Life is like a box of chocolates. You never know what you\'re gonna get.',
)
watch(text, v => { if (import.meta.client) localStorage.setItem(TTS_TEXT_KEY, v) })

const voiceId = ref(settings.value.defaultVoice)
const speed      = ref(1.0)
const devicePref = ref<KokoroDevice>('auto')

watch(activeDevice, (dev) => {
  if (dev && dev !== devicePref.value && devicePref.value !== 'auto') {
    devicePref.value = dev
  }
})

// Only allow GPU option if hardware supports it
watch(hasGpu, (gpu) => {
  if (gpu === false && devicePref.value === 'gpu') devicePref.value = 'auto'
})

const pendingText = inject<Ref<string | null>>('pendingText', ref(null))
watch(pendingText, (val) => {
  if (val !== null) { text.value = val; pendingText.value = null }
}, { immediate: true })

const maxChars    = computed(() => settings.value.maxChars)
const charCount   = computed(() => text.value.length)
const wordCount   = computed(() => text.value.trim().split(/\s+/).filter(Boolean).length)
const canGenerate = computed(
  () => text.value.trim().length > 0 && !generating.value && !initializing.value,
)

const americanFemale = KOKORO_VOICES.filter(v => v.accent === 'american' && v.gender === 'female')
const americanMale   = KOKORO_VOICES.filter(v => v.accent === 'american' && v.gender === 'male')
const britishFemale  = KOKORO_VOICES.filter(v => v.accent === 'british'  && v.gender === 'female')
const britishMale    = KOKORO_VOICES.filter(v => v.accent === 'british'  && v.gender === 'male')

const deviceBadge = computed(() => {
  if (initializing.value || !activeDevice.value) return null
  return activeDevice.value === 'gpu'
    ? { label: 'WebGPU', cls: 'bg-accent/15 text-accent' }
    : { label: 'CPU', cls: 'bg-subtle text-secondary' }
})

const audioDuration = computed(() => {
  if (!audioBuffer.value) return 0
  return ((audioBuffer.value.byteLength - 44) / 2) / sampleRate.value
})

watch(audioBuffer, async (buf) => {
  if (!buf || !elapsedMs.value) return
  const params = {
    timestamp: Date.now(),
    text:      lastGenText.value,
    voice:     lastGenVoice.value,
    speed:     lastGenSpeed.value,
    device:    (genDevice.value || 'cpu') as 'gpu' | 'cpu',
    elapsedMs: elapsedMs.value,
    duration:  audioDuration.value,
    wav:       buf,
    source:    'tts' as const,
  }
  await addHistory(params)
  saveGenerationToDisk(params).catch(e => console.error('[Varg] disk save failed:', e))

  if (settings.value.notifyOnComplete) {
    let granted = await isPermissionGranted()
    if (!granted) {
      const perm = await requestPermission()
      granted = perm === 'granted'
    }
    if (granted) {
      const secs = audioDuration.value.toFixed(1)
      sendNotification({ title: 'Varg', body: `Audio ready — ${secs}s generated in ${elapsedMs.value}ms` })
    }
  }
})

onMounted(() => init(devicePref.value))

function submit() {
  if (!canGenerate.value) return
  generate(text.value, voiceId.value, speed.value)
}

async function onDeviceChange(val: KokoroDevice) {
  devicePref.value = val
  await setDevice(val)
}

// Device options — hide GPU when hardware probe says no GPU
const deviceOptions = computed((): KokoroDevice[] => {
  if (hasGpu.value === false) return ['auto', 'cpu']
  return ['auto', 'gpu', 'cpu']
})
</script>

<template>
  <div class="mx-auto flex h-full w-full max-w-2xl flex-col gap-3 p-4">

    <!-- Header -->
    <div class="flex items-center justify-between gap-3">
      <div>
        <h1 class="text-[13px] font-semibold uppercase tracking-widest text-secondary">
          Text&nbsp;to&nbsp;Speech
        </h1>
        <p class="mt-0.5 text-[11px] text-faded">Offline · on-device</p>
      </div>

      <div class="flex items-center gap-2">
        <span v-if="deviceBadge" class="rounded-md px-2 py-0.5 text-[11px] font-medium" :class="deviceBadge.cls">
          {{ deviceBadge.label }}
        </span>
        <div class="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium"
          :class="initializing ? 'bg-warn/10 text-warn' : activeDevice ? 'bg-ok/10 text-ok' : 'bg-subtle text-faded'">
          <span class="h-[6px] w-[6px] rounded-full"
            :class="initializing ? 'bg-warn animate-pulse' : activeDevice ? 'bg-ok' : 'bg-faded'" />
          <span v-if="initializing">
            {{ initStatus || 'Loading…' }}
            <span v-if="initProgress > 0" class="ml-1 opacity-70">{{ initProgress }}%</span>
          </span>
          <span v-else-if="activeDevice">Ready</span>
          <span v-else>Not loaded</span>
        </div>
      </div>
    </div>

    <!-- Progress bar -->
    <Transition name="fade">
      <div v-if="initializing && initProgress > 0" class="h-0.5 overflow-hidden rounded-full bg-subtle">
        <div class="h-full rounded-full bg-accent transition-all duration-300" :style="{ width: `${initProgress}%` }" />
      </div>
    </Transition>

    <!-- Text input -->
    <div class="glass-panel flex min-h-0 flex-1 flex-col rounded-xl">
      <textarea
        v-model="text"
        class="playfair-display flex-1 resize-none bg-transparent p-3.5 text-[13px] leading-relaxed text-primary placeholder:text-faded focus:outline-none"
        placeholder="Enter text to synthesize… (Ctrl+Enter to generate)"
        :maxlength="maxChars"
        @keydown.ctrl.enter="submit"
      />
      <div class="flex items-center justify-between border-t border-white/5 px-3.5 py-1.5">
        <span class="text-[11px] text-faded">Ctrl+Enter</span>
        <span class="text-[11px] tabular-nums"
          :class="charCount > maxChars * 0.9 ? 'text-warn' : 'text-faded'">
          {{ charCount.toLocaleString() }} / {{ maxChars.toLocaleString() }}
        </span>
      </div>
    </div>

    <!-- Controls -->
    <div class="grid gap-3" :class="deviceOptions.length === 2 ? 'grid-cols-[1fr_150px_110px]' : 'grid-cols-[1fr_150px_130px]'">

      <!-- Voice -->
      <div>
        <label class="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-faded">Voice</label>
        <select v-model="voiceId" class="glass-input w-full cursor-pointer rounded-lg px-3 py-2 text-[13px] transition-ui">
          <optgroup label="American — Female">
            <option v-for="v in americanFemale" :key="v.id" :value="v.id">{{ v.name }}</option>
          </optgroup>
          <optgroup label="American — Male">
            <option v-for="v in americanMale" :key="v.id" :value="v.id">{{ v.name }}</option>
          </optgroup>
          <optgroup label="British — Female">
            <option v-for="v in britishFemale" :key="v.id" :value="v.id">{{ v.name }}</option>
          </optgroup>
          <optgroup label="British — Male">
            <option v-for="v in britishMale" :key="v.id" :value="v.id">{{ v.name }}</option>
          </optgroup>
        </select>
      </div>

      <!-- Speed -->
      <div>
        <label class="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-faded">
          <span>Speed</span>
          <span class="font-mono text-secondary">{{ speed.toFixed(1) }}×</span>
        </label>
        <div class="flex h-[38px] items-center rounded-lg bg-surface px-2">
          <input v-model.number="speed" type="range" min="0.5" max="2.0" step="0.1" class="w-full cursor-pointer" />
        </div>
      </div>

      <!-- Device -->
      <div>
        <label class="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-faded">
          <span>Device</span>
          <span v-if="hasGpu === null" class="text-faded/40 text-[9px]">detecting…</span>
          <span v-else-if="hasGpu === false" class="text-faded/40 text-[9px]">no GPU</span>
        </label>
        <div class="grid gap-0.5 rounded-lg bg-surface p-0.5" :class="`grid-cols-${deviceOptions.length}`">
          <button v-for="opt in deviceOptions" :key="opt" type="button"
            class="rounded-md py-1.5 text-[11px] font-medium capitalize transition-ui"
            :class="devicePref === opt ? 'bg-accent text-white shadow-button' : 'text-faded hover:text-secondary'"
            :disabled="initializing"
            @click="onDeviceChange(opt)">
            {{ opt === 'auto' ? 'Auto' : opt.toUpperCase() }}
          </button>
        </div>
      </div>
    </div>

    <!-- Generate button -->
    <button type="button"
      class="flex items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-semibold shadow-button transition-ui"
      :class="canGenerate ? 'bg-accent text-white hover:bg-accent-dark active:scale-[0.98]' : 'cursor-not-allowed bg-subtle text-faded'"
      :disabled="!canGenerate" @click="submit">
      <svg v-if="generating" class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <svg v-else class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
        <path stroke-linecap="round" stroke-linejoin="round"
          d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
      </svg>
      <span v-if="generating && genTotal > 1">Part {{ genChunk || 1 }} / {{ genTotal }}</span>
      <span v-else>{{ generating ? 'Generating…' : 'Generate Speech' }}</span>
    </button>

    <!-- Error -->
    <Transition name="fade">
      <div v-if="error" class="rounded-xl border border-err/20 bg-err/10 px-4 py-3 text-[12px] text-err space-y-1">
        <p class="font-semibold leading-snug">{{ error }}</p>
        <p v-if="error.includes('AI Model page')" class="text-err/70 text-[11px]">
          Click the brain icon in the sidebar to open the AI Model page.
        </p>
      </div>
    </Transition>

    <!-- GPU fallback warning -->
    <Transition name="fade">
      <div v-if="gpuFallback" class="rounded-xl border border-warn/20 bg-warn/10 px-3 py-2 text-[11px] text-warn">
        GPU produced silent audio — automatically fell back to CPU. Your GPU may not support this model's inference.
      </div>
    </Transition>

    <!-- Audio ready notice (player is in global drawer) -->
    <Transition name="fade">
      <div v-if="audioBuffer && !generating"
        class="flex items-center gap-2 rounded-xl border border-ok/15 bg-ok/5 px-3 py-2 text-[11px] text-ok">
        <svg class="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
        Audio ready — playing in the bar below
      </div>
    </Transition>

    <div class="h-1 flex-shrink-0" />
  </div>
</template>
