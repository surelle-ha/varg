<script setup lang="ts">
const REPO    = 'onnx-community/Kokoro-82M-v1.0-ONNX'
const HF_BASE = `https://huggingface.co/${REPO}/resolve/main`

const CORE_FILES = [
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

async function checkCache() {
  checking.value = true
  let cache: Cache | null = null
  try { cache = await caches.open('transformers-cache') } catch { /* no Cache API */ }
  let voicesCache: Cache | null = null
  try { voicesCache = await caches.open('kokoro-voices') } catch { /* no Cache API */ }

  const results: FileStatus[] = []
  for (const f of CORE_FILES) {
    const key = `${HF_BASE}/${f.path}`
    const hit = cache ? await cache.match(key) : null
    results.push({ path: f.path, label: f.label, ok: !!hit, approxSize: f.size })
  }
  coreStatuses.value = results

  let ok = 0
  await Promise.all(VOICE_IDS.map(async id => {
    const key = `${HF_BASE}/voices/${id}.bin`
    const hit = voicesCache ? await voicesCache.match(key) : null
    if (hit) ok++
  }))
  voicesOk.value = ok
  checking.value = false
}

onMounted(checkCache)

// ── Download ───────────────────────────────────────────────────────────────────
interface DownloadItem {
  id: string; label: string; hfPath: string; cacheName: string
  total: number; loaded: number; done: boolean; error: string
}

const downloading   = ref(false)
const downloadItems = ref<DownloadItem[]>([])

async function downloadFile(item: DownloadItem) {
  const url = `${HF_BASE}/${item.hfPath}`
  let res: Response
  try { res = await fetch(url) } catch (e) { item.error = `Network: ${(e as Error).message}`; return }
  if (!res.ok) { item.error = `HTTP ${res.status}`; return }
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
    ...CORE_FILES.map(f => ({
      id: f.path, label: f.label, hfPath: f.path,
      cacheName: 'transformers-cache',
      total: 0, loaded: 0, done: false, error: '',
    })),
    ...VOICE_IDS.map(id => ({
      id: `voices/${id}.bin`, label: id, hfPath: `voices/${id}.bin`,
      cacheName: 'kokoro-voices',
      total: 0, loaded: 0, done: false, error: '',
    })),
  ]

  // Iterate the reactive array so mutations inside downloadFile trigger Vue updates
  const coreItems  = downloadItems.value.filter(i => i.cacheName === 'transformers-cache')
  const voiceItems = downloadItems.value.filter(i => i.cacheName === 'kokoro-voices')

  for (const item of coreItems) {
    await downloadFile(item)
  }
  for (let i = 0; i < voiceItems.length; i += 4) {
    await Promise.all(voiceItems.slice(i, i + 4).map(downloadFile))
  }
  downloading.value = false
  await checkCache()
}

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
  <div class="mx-auto flex h-full w-full max-w-2xl flex-col gap-4 overflow-y-auto p-4">

    <!-- Header -->
    <div>
      <h1 class="text-[13px] font-semibold uppercase tracking-widest text-secondary">AI Model</h1>
      <p class="mt-0.5 text-[11px] text-faded">Kokoro TTS · model downloads &amp; cache</p>
    </div>

    <!-- Model download card -->
    <div class="glass-panel rounded-xl p-4 space-y-4">

      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-[12px] font-semibold text-secondary">Kokoro TTS Model</h2>
          <p class="mt-0.5 text-[11px] text-faded">onnx-community/Kokoro-82M-v1.0-ONNX · public repo</p>
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

      <!-- Download button -->
      <button v-if="!downloading" type="button"
        class="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-semibold shadow-button transition-ui"
        :class="allReady
          ? 'bg-surface text-faded hover:bg-subtle hover:text-secondary'
          : 'bg-accent text-white hover:bg-accent-dark active:scale-[0.98]'"
        @click="startDownload">
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        {{ allReady ? 'Re-download All Files' : 'Download Model Files' }}
      </button>

      <!-- Download progress -->
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

    <!-- About card -->
    <div class="glass-panel rounded-xl p-4 space-y-2">
      <h2 class="text-[12px] font-semibold text-secondary">About</h2>
      <div class="space-y-1 text-[12px] text-faded">
        <div class="flex justify-between">
          <span>Engine</span>
          <span class="text-secondary">Kokoro-82M ONNX</span>
        </div>
        <div class="flex justify-between">
          <span>Runtime</span>
          <span class="text-secondary">WebGPU / WASM (offline)</span>
        </div>
        <div class="flex justify-between">
          <span>Voices</span>
          <span class="text-secondary">28 English (US + GB)</span>
        </div>
        <div class="flex justify-between">
          <span>Source</span>
          <span class="font-mono text-secondary text-[10px]">{{ REPO }}</span>
        </div>
      </div>
    </div>

    <div class="h-1 flex-shrink-0" />
  </div>
</template>
