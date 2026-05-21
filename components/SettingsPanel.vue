<script setup lang="ts">
const REPO = 'onnx-community/Kokoro-82M-v1.0-ONNX'

const CORE_FILES = [
  { path: 'config.json',               label: 'Config' },
  { path: 'tokenizer.json',            label: 'Tokenizer' },
  { path: 'tokenizer_config.json',     label: 'Tokenizer config' },
  { path: 'onnx/model_quantized.onnx', label: 'CPU model' },
  { path: 'onnx/model_q4f16.onnx',     label: 'GPU model' },
]

const VOICE_IDS = [
  'af_heart', 'af_bella', 'af_nicole', 'af_sarah', 'af_kore',
  'af_aoede', 'af_nova',  'af_sky',    'af_alloy', 'af_river', 'af_jessica',
  'am_fenrir', 'am_michael', 'am_puck', 'am_echo', 'am_eric',
  'am_liam',   'am_onyx',    'am_adam', 'am_santa',
  'bf_emma', 'bf_isabella', 'bf_alice', 'bf_lily',
  'bm_fable', 'bm_george', 'bm_daniel', 'bm_lewis',
]

interface FileStatus {
  path: string; label: string; ok: boolean; size: string
}

const checking     = ref(false)
const coreStatuses = ref<FileStatus[]>([])
const voicesOk     = ref(0)
const voicesTotal  = ref(VOICE_IDS.length)

function fmtBytes(n: number) {
  if (!n) return '?'
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 ** 2).toFixed(1)} MB`
}

async function check() {
  checking.value = true
  const origin = window.location.origin

  const results: FileStatus[] = []
  for (const f of CORE_FILES) {
    try {
      const res   = await fetch(`${origin}/models/${REPO}/${f.path}`, { method: 'HEAD' })
      const bytes = Number(res.headers.get('content-length') ?? 0)
      results.push({ ...f, ok: res.ok, size: fmtBytes(bytes) })
    } catch {
      results.push({ ...f, ok: false, size: '—' })
    }
  }
  coreStatuses.value = results

  let ok = 0
  await Promise.all(VOICE_IDS.map(async id => {
    try {
      const res = await fetch(`${origin}/models/${REPO}/voices/${id}.bin`, { method: 'HEAD' })
      if (res.ok) ok++
    } catch { /* missing */ }
  }))
  voicesOk.value = ok

  checking.value = false
}

const allCoreOk    = computed(() => coreStatuses.value.length > 0 && coreStatuses.value.every(s => s.ok))
const allVoicesOk  = computed(() => voicesOk.value === voicesTotal.value)
const anyMissing   = computed(() => !allCoreOk.value || !allVoicesOk.value)

onMounted(check)
</script>

<template>
  <div class="mx-auto flex h-full w-full max-w-2xl flex-col gap-4 p-4">

    <!-- Header -->
    <div>
      <h1 class="text-[13px] font-semibold uppercase tracking-widest text-secondary">Settings</h1>
      <p class="mt-0.5 text-[11px] text-faded">Model files &amp; app info</p>
    </div>

    <!-- Model files card -->
    <div class="glass-panel rounded-xl p-4 space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-[12px] font-semibold text-secondary">Model Files</h2>
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1 text-[11px] text-faded transition-ui hover:text-secondary disabled:opacity-40"
          :disabled="checking"
          @click="check"
        >
          <svg
            class="h-3 w-3"
            :class="checking ? 'animate-spin' : ''"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {{ checking ? 'Checking…' : 'Refresh' }}
        </button>
      </div>

      <!-- Core files -->
      <div class="space-y-1">
        <div
          v-for="s in coreStatuses"
          :key="s.path"
          class="flex items-center justify-between rounded-lg px-2.5 py-1.5"
          :class="s.ok ? 'bg-ok/5' : 'bg-err/5'"
        >
          <div class="flex items-center gap-2 min-w-0">
            <span class="h-1.5 w-1.5 flex-shrink-0 rounded-full" :class="s.ok ? 'bg-ok' : 'bg-err'" />
            <span class="text-[12px] text-secondary flex-shrink-0">{{ s.label }}</span>
            <span class="text-[10px] text-faded font-mono truncate">{{ s.path }}</span>
          </div>
          <span class="ml-2 flex-shrink-0 text-[10px] tabular-nums text-faded">{{ s.size }}</span>
        </div>
      </div>

      <!-- Voice summary row -->
      <div
        v-if="coreStatuses.length > 0"
        class="flex items-center justify-between rounded-lg px-2.5 py-1.5"
        :class="allVoicesOk ? 'bg-ok/5' : 'bg-warn/5'"
      >
        <div class="flex items-center gap-2">
          <span class="h-1.5 w-1.5 flex-shrink-0 rounded-full" :class="allVoicesOk ? 'bg-ok' : 'bg-warn'" />
          <span class="text-[12px] text-secondary">Voice files</span>
        </div>
        <span class="text-[11px] tabular-nums" :class="allVoicesOk ? 'text-ok' : 'text-warn'">
          {{ voicesOk }} / {{ voicesTotal }}
        </span>
      </div>

      <!-- Missing hint -->
      <div v-if="anyMissing && coreStatuses.length > 0" class="rounded-lg border border-err/20 bg-err/10 px-3 py-2 text-[11px] text-err">
        Some files are missing. Run:
        <code class="mt-1 block rounded bg-black/30 px-2 py-1 font-mono text-[10px] text-secondary">
          $env:HF_TOKEN="hf_xxx"; pnpm model:download
        </code>
      </div>
    </div>

    <!-- App info card -->
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
      </div>
    </div>

  </div>
</template>
