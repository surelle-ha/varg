<script setup lang="ts">
import { useSettings } from '~/composables/useSettings'
import { useParler } from '~/composables/useParler'

const { settings } = useSettings()

// ── Bark — init via worker (transformers.js handles download + cache) ──────────
const {
  initializing: barkInitializing,
  initStatus:   barkInitStatus,
  initProgress: barkInitProgress,
  ready:        barkReady,
  error:        barkError,
  init:         preloadBark,
} = useParler()

// ── Kokoro ────────────────────────────────────────────────────────────────────
const KOKORO_REPO    = 'onnx-community/Kokoro-82M-v1.0-ONNX'
const KOKORO_HF_BASE = `https://huggingface.co/${KOKORO_REPO}/resolve/main`
const CHATTERBOX_HF_BASE = `https://huggingface.co/onnx-community/chatterbox-ONNX/resolve/main`

const KOKORO_CORE_FILES = [
  { path: 'config.json',               label: 'Config',           size: '' },
  { path: 'tokenizer.json',            label: 'Tokenizer',        size: '' },
  { path: 'tokenizer_config.json',     label: 'Tokenizer cfg',    size: '' },
  { path: 'onnx/model_fp16.onnx',      label: 'GPU model (fp16)', size: '~163 MB' },
  { path: 'onnx/model_quantized.onnx', label: 'CPU model (q8)',   size: '~82 MB' },
]

const VOICE_IDS = [
  'af_heart', 'af_bella', 'af_nicole', 'af_sarah', 'af_kore',
  'af_aoede', 'af_nova',  'af_sky',    'af_alloy', 'af_river', 'af_jessica',
  'am_fenrir', 'am_michael', 'am_puck', 'am_echo', 'am_eric',
  'am_liam',   'am_onyx',    'am_adam', 'am_santa',
  'bf_emma', 'bf_isabella', 'bf_alice', 'bf_lily',
  'bm_fable', 'bm_george', 'bm_daniel', 'bm_lewis',
]

// ── File status ────────────────────────────────────────────────────────────────
interface FileStatus { path: string; label: string; ok: boolean; approxSize: string }

const checking     = ref(false)
const coreStatuses = ref<FileStatus[]>([])
const voicesOk     = ref(0)
const voicesTotal  = ref(VOICE_IDS.length)
const barkCached   = ref(false)

async function checkCache() {
  checking.value = true
  let cache: Cache | null = null
  try { cache = await caches.open('transformers-cache') } catch { /* no Cache API */ }
  let voicesCache: Cache | null = null
  try { voicesCache = await caches.open('kokoro-voices') } catch { /* no Cache API */ }

  // Kokoro core files
  const results: FileStatus[] = []
  for (const f of KOKORO_CORE_FILES) {
    const key = `${KOKORO_HF_BASE}/${f.path}`
    const hit = cache ? await cache.match(key) : null
    results.push({ path: f.path, label: f.label, ok: !!hit, approxSize: f.size })
  }
  coreStatuses.value = results

  let ok = 0
  await Promise.all(VOICE_IDS.map(async id => {
    const key = `${KOKORO_HF_BASE}/voices/${id}.bin`
    const hit = voicesCache ? await voicesCache.match(key) : null
    if (hit) ok++
  }))
  voicesOk.value = ok

  // Chatterbox — check if transformers.js already cached it
  try {
    const hit = cache ? await cache.match(`${CHATTERBOX_HF_BASE}/config.json`) : null
    barkCached.value = !!hit
  } catch {
    barkCached.value = false
  }

  checking.value = false
}

onMounted(checkCache)

// ── Kokoro download ───────────────────────────────────────────────────────────
interface DownloadItem {
  id: string; label: string; hfBase: string; hfPath: string; cacheName: string
  total: number; loaded: number; done: boolean; error: string
}

const downloading   = ref(false)
const downloadItems = ref<DownloadItem[]>([])

async function downloadFile(item: DownloadItem) {
  const url = `${item.hfBase}/${item.hfPath}`
  let res: Response
  try { res = await fetch(url) } catch (e) { item.error = `Network: ${(e as Error).message}`; return }
  if (!res.ok) { item.error = `HTTP ${res.status}${res.status === 401 ? ' (check HF token)' : ''}`; return }
  item.total = Number(res.headers.get('content-length') ?? 0)

  const reader = res.body?.getReader()
  if (!reader) { item.error = 'No body'; return }

  const chunks: ArrayBuffer[] = []
  let loaded = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      chunks.push(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength))
      loaded += value.length
      item.loaded = loaded
    }
  }

  try {
    const blob  = new Blob(chunks)
    const resp  = new Response(blob, { headers: { 'content-type': res.headers.get('content-type') ?? 'application/octet-stream' } })
    const cache = await caches.open(item.cacheName)
    await cache.put(url, resp)
    item.done = true
  } catch (e) { item.error = `Cache: ${(e as Error).message}` }
}

async function startDownload() {
  downloading.value = true
  downloadItems.value = [
    ...KOKORO_CORE_FILES.map(f => ({
      id: f.path, label: f.label, hfBase: KOKORO_HF_BASE, hfPath: f.path,
      cacheName: 'transformers-cache',
      total: 0, loaded: 0, done: false, error: '',
    })),
    ...VOICE_IDS.map(id => ({
      id: `voices/${id}.bin`, label: id, hfBase: KOKORO_HF_BASE, hfPath: `voices/${id}.bin`,
      cacheName: 'kokoro-voices',
      total: 0, loaded: 0, done: false, error: '',
    })),
  ]

  const coreItems  = downloadItems.value.filter(i => i.cacheName === 'transformers-cache')
  const voiceItems = downloadItems.value.filter(i => i.cacheName === 'kokoro-voices')

  for (const item of coreItems) await downloadFile(item)
  for (let i = 0; i < voiceItems.length; i += 4) {
    await Promise.all(voiceItems.slice(i, i + 4).map(downloadFile))
  }
  downloading.value = false
  await checkCache()
}

// ── Kokoro computed ────────────────────────────────────────────────────────────
const allCoreOk   = computed(() => coreStatuses.value.length > 0 && coreStatuses.value.every(s => s.ok))
const allVoicesOk = computed(() => voicesOk.value === voicesTotal.value)
const allReady    = computed(() => allCoreOk.value && allVoicesOk.value)
const dlDone      = computed(() => downloadItems.value.filter(i => i.done).length)
const dlTotal     = computed(() => downloadItems.value.length)
const dlFailed    = computed(() => downloadItems.value.filter(i => i.error).length)

function fmtBytes(n: number) {
  if (!n) return ''
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 ** 2).toFixed(1)} MB`
}
</script>

<template>
  <div class="flex h-full w-full flex-col">

  <div class="flex-1 overflow-y-auto">
    <div class="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">

    <!-- ── Kokoro TTS ──────────────────────────────────────────────────────── -->
    <div class="glass-panel rounded-xl p-4 space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-[12px] font-semibold text-secondary">Kokoro TTS</h2>
            <span class="rounded-md bg-ok/10 px-1.5 py-0.5 text-[9px] font-semibold text-ok uppercase tracking-wider">Narration</span>
          </div>
          <p class="mt-0.5 text-[11px] text-faded">{{ KOKORO_REPO }} · fast, 28 voices</p>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="rounded-md px-2 py-0.5 text-[10px] font-medium"
            :class="allReady ? 'bg-ok/10 text-ok' : 'bg-warn/10 text-warn'">
            {{ allReady ? 'Ready' : 'Incomplete' }}
          </span>
          <button type="button"
            class="flex items-center gap-1 rounded-lg bg-surface px-2 py-1 text-[11px] text-faded transition-ui hover:text-secondary disabled:opacity-40"
            :disabled="checking || downloading" @click="checkCache">
            <svg class="h-3 w-3" :class="checking ? 'animate-spin' : ''" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      <!-- Core file status -->
      <div v-if="coreStatuses.length > 0" class="space-y-1">
        <div v-for="s in coreStatuses" :key="s.path"
          class="flex items-center justify-between rounded-lg px-2.5 py-1.5"
          :class="s.ok ? 'bg-ok/5' : 'bg-err/5'">
          <div class="flex items-center gap-2 min-w-0">
            <span class="h-1.5 w-1.5 flex-shrink-0 rounded-full" :class="s.ok ? 'bg-ok' : 'bg-err/60'" />
            <span class="text-[12px] text-secondary flex-shrink-0">{{ s.label }}</span>
            <span class="text-[10px] text-faded font-mono truncate">{{ s.path }}</span>
          </div>
          <div class="ml-2 flex flex-shrink-0 items-center gap-2">
            <span v-if="s.approxSize" class="text-[10px] text-faded">{{ s.approxSize }}</span>
            <span class="text-[10px]" :class="s.ok ? 'text-ok' : 'text-err/60'">{{ s.ok ? '✓' : '✗' }}</span>
          </div>
        </div>
        <div class="flex items-center justify-between rounded-lg px-2.5 py-1.5"
          :class="allVoicesOk ? 'bg-ok/5' : 'bg-warn/5'">
          <div class="flex items-center gap-2">
            <span class="h-1.5 w-1.5 flex-shrink-0 rounded-full" :class="allVoicesOk ? 'bg-ok' : 'bg-warn'" />
            <span class="text-[12px] text-secondary">Voice files (28)</span>
          </div>
          <span class="text-[11px] tabular-nums" :class="allVoicesOk ? 'text-ok' : 'text-warn'">
            {{ voicesOk }} / {{ voicesTotal }} cached
          </span>
        </div>
      </div>

      <button v-if="!downloading" type="button"
        class="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-semibold shadow-button transition-ui"
        :class="allReady
          ? 'bg-surface text-faded hover:bg-subtle hover:text-secondary'
          : 'bg-accent text-white hover:bg-accent/90 active:scale-[0.98]'"
        @click="startDownload">
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        {{ allReady ? 'Re-download All Files' : 'Download Model Files' }}
      </button>

      <div v-if="downloading || downloadItems.length > 0" class="space-y-2">
        <div v-if="downloading" class="space-y-1">
          <div class="flex items-center justify-between text-[11px] text-faded">
            <span>Downloading… {{ dlDone }} / {{ dlTotal }}</span>
            <span v-if="dlFailed > 0" class="text-err">{{ dlFailed }} failed</span>
          </div>
          <div class="h-1 overflow-hidden rounded-full bg-subtle">
            <div class="h-full rounded-full bg-accent transition-all duration-300"
              :style="{ width: `${Math.round((dlDone / dlTotal) * 100)}%` }" />
          </div>
        </div>
        <div class="max-h-48 overflow-y-auto space-y-1">
          <div v-for="item in downloadItems.filter(i => !i.done || i.error)" :key="item.id"
            class="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px]"
            :class="item.error ? 'bg-err/10' : 'bg-surface'">
            <svg v-if="!item.done && !item.error && item.loaded > 0" class="h-3 w-3 flex-shrink-0 animate-spin text-accent" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span class="flex-1 truncate text-faded">{{ item.label }}</span>
            <span v-if="item.error" class="flex-shrink-0 text-err">{{ item.error }}</span>
            <span v-else-if="!item.done && item.total" class="flex-shrink-0 tabular-nums text-faded">
              {{ fmtBytes(item.loaded) }} / {{ fmtBytes(item.total) }}
            </span>
            <span v-else-if="!item.done" class="flex-shrink-0 text-faded">Waiting…</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Chatterbox TTS ────────────────────────────────────────────────── -->
    <div class="glass-panel rounded-xl p-4 space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-[12px] font-semibold text-secondary">Chatterbox</h2>
            <span class="rounded-md bg-accent/10 px-1.5 py-0.5 text-[9px] font-semibold text-accent uppercase tracking-wider">Expressive</span>
          </div>
          <p class="mt-0.5 text-[11px] text-faded">onnx-community/chatterbox-ONNX · Resemble AI · emotion exaggeration</p>
        </div>
        <span class="rounded-md px-2 py-0.5 text-[10px] font-medium"
          :class="barkReady ? 'bg-ok/10 text-ok' : barkCached ? 'bg-ok/10 text-ok' : 'bg-warn/10 text-warn'">
          {{ barkReady ? 'Loaded' : barkCached ? 'Cached' : 'Not cached' }}
        </span>
      </div>

      <p class="text-[11px] text-faded leading-relaxed">
        State-of-the-art expressive TTS by Resemble AI. Adjust the <strong class="text-secondary">exaggeration</strong> slider (0–2) to control how emotional and animated the speech sounds — from flat narration to dramatic character voices.
      </p>

      <p class="text-[11px] text-faded/70 leading-relaxed rounded-lg bg-overlay px-3 py-2">
        Chatterbox downloads automatically from HuggingFace on first use (~1–2 GB) and caches for offline use. Click <strong class="text-secondary">Pre-load</strong> to download now, or click Generate in the script editor to start automatically.
      </p>

      <!-- Loading progress -->
      <div v-if="barkInitializing" class="space-y-2">
        <div class="flex items-center justify-between text-[11px] text-faded">
          <span class="animate-pulse">{{ barkInitStatus || 'Loading…' }}</span>
          <span v-if="barkInitProgress > 0" class="tabular-nums">{{ barkInitProgress }}%</span>
        </div>
        <div v-if="barkInitProgress > 0" class="h-1 overflow-hidden rounded-full bg-subtle">
          <div class="h-full rounded-full bg-accent transition-all duration-300"
            :style="{ width: `${barkInitProgress}%` }" />
        </div>
      </div>

      <!-- Error -->
      <div v-if="barkError" class="rounded-lg border border-err/20 bg-err/10 px-3 py-2 text-[11px] text-err">
        {{ barkError }}
      </div>

      <!-- Pre-load button -->
      <button v-if="!barkInitializing" type="button"
        class="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-semibold shadow-button transition-ui"
        :class="barkReady || barkCached
          ? 'bg-surface text-faded hover:bg-subtle hover:text-secondary'
          : 'bg-accent text-white hover:bg-accent/90 active:scale-[0.98]'"
        @click="preloadBark">
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        {{ barkReady ? 'Reload Chatterbox' : barkCached ? 'Load Chatterbox' : 'Pre-load Chatterbox (~1–2 GB)' }}
      </button>
    </div>

    <!-- ── Coqui XTTS2 (placeholder) ──────────────────────────────────────── -->
    <div class="glass-panel rounded-xl p-4 space-y-3 opacity-60">
      <div class="flex items-center justify-between">
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-[12px] font-semibold text-secondary">Coqui XTTS v2</h2>
            <span class="rounded-md bg-subtle px-1.5 py-0.5 text-[9px] font-semibold text-faded uppercase tracking-wider">Coming soon</span>
          </div>
          <p class="mt-0.5 text-[11px] text-faded">Voice cloning · multilingual · requires server runtime</p>
        </div>
      </div>
      <p class="text-[11px] text-faded leading-relaxed">
        XTTS v2 supports voice cloning from a short audio sample and 17 languages. Integration requires a local Python backend and is planned for a future release.
      </p>
      <button type="button" disabled
        class="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-semibold bg-subtle text-faded cursor-not-allowed">
        Not available yet
      </button>
    </div>

    <!-- ── Model Comparison ────────────────────────────────────────────────── -->
    <div class="glass-panel rounded-xl p-4 space-y-2">
      <h2 class="text-[12px] font-semibold text-secondary">Model Comparison</h2>
      <div class="space-y-2 text-[11px]">
        <div class="grid grid-cols-4 gap-2 text-[10px] font-semibold uppercase tracking-widest text-faded/60 pb-1 border-b border-white/5">
          <span>Model</span><span>Use case</span><span>Size</span><span>Speed</span>
        </div>
        <div class="grid grid-cols-4 gap-2">
          <span class="text-secondary font-medium">Kokoro</span>
          <span class="text-faded">Narration</span>
          <span class="text-faded">~250 MB</span>
          <span class="text-ok">Fast</span>
        </div>
        <div class="grid grid-cols-4 gap-2">
          <span class="text-secondary font-medium">Chatterbox</span>
          <span class="text-faded">Expressive</span>
          <span class="text-faded">~1–2 GB</span>
          <span class="text-warn">Medium</span>
        </div>
        <div class="grid grid-cols-4 gap-2 opacity-50">
          <span class="text-secondary font-medium">XTTS v2</span>
          <span class="text-faded">Voice clone</span>
          <span class="text-faded">~2 GB</span>
          <span class="text-faded">—</span>
        </div>
      </div>
    </div>

      <div class="h-1 flex-shrink-0" />
    </div>
  </div>
  </div>
</template>
