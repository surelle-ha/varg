<script setup lang="ts">
import { useSystemMonitor } from '~/composables/useSystemMonitor'

const { gpuInfo, cpuInfo, live, probed, floatOpen } = useSystemMonitor()

function barColor(pct: number) {
  if (pct > 80) return 'bg-err'
  if (pct > 55) return 'bg-warn'
  return 'bg-ok'
}

function fmtBytes(mb: number) {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
  return `${mb} MB`
}

function fmtLimit(v: number | string): string {
  if (typeof v === 'string') return v
  if (v >= 1_073_741_824) return `${(v / 1_073_741_824).toFixed(0)} GB`
  if (v >= 1_048_576)     return `${(v / 1_048_576).toFixed(0)} MB`
  if (v >= 1024)          return `${(v / 1024).toFixed(0)} K`
  return v.toLocaleString()
}

const heapPct = computed(() =>
  live.value.heapTotal > 0 ? Math.round((live.value.heapUsed / live.value.heapTotal) * 100) : 0,
)

// Screen / platform info (read once — not reactive)
const screenInfo = computed(() => ({
  resolution: `${screen.width} × ${screen.height}`,
  dpr:        window.devicePixelRatio,
  colorDepth: `${screen.colorDepth}-bit`,
  platform:   navigator.platform || '—',
}))
</script>

<template>
  <div class="mx-auto flex h-full w-full max-w-3xl flex-col gap-4 overflow-y-auto p-4">

    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-[13px] font-semibold uppercase tracking-widest text-secondary">System Monitor</h1>
        <p class="mt-0.5 text-[11px] text-faded">Runtime hardware &amp; resource overview</p>
      </div>
      <button type="button"
        class="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-ui"
        :class="floatOpen ? 'bg-accent text-white' : 'bg-surface text-faded hover:text-secondary'"
        @click="floatOpen = !floatOpen">
        <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
        </svg>
        {{ floatOpen ? 'Hide Float' : 'Float Widget' }}
      </button>
    </div>

    <!-- ── CPU / Hardware ────────────────────────────────────────────────────── -->
    <div class="rounded-xl border border-white/5 bg-surface p-4 space-y-3">
      <span class="text-[11px] font-semibold uppercase tracking-widest text-faded">CPU &amp; Hardware</span>
      <div class="grid grid-cols-2 gap-2">
        <div class="rounded-lg bg-overlay px-3 py-2">
          <p class="text-[10px] text-faded">Logical Cores</p>
          <p class="mt-0.5 text-[18px] font-bold tabular-nums text-secondary">{{ cpuInfo?.cores ?? '—' }}</p>
        </div>
        <div class="rounded-lg bg-overlay px-3 py-2">
          <p class="text-[10px] text-faded">Device RAM</p>
          <p class="mt-0.5 text-[18px] font-bold tabular-nums text-secondary">
            {{ cpuInfo?.deviceMemoryGb != null ? `${cpuInfo.deviceMemoryGb} GB` : '—' }}
          </p>
        </div>
        <div class="rounded-lg bg-overlay px-3 py-2">
          <p class="text-[10px] text-faded">Display</p>
          <p class="mt-0.5 text-[13px] font-semibold text-secondary">{{ screenInfo.resolution }}</p>
          <p class="text-[10px] text-faded">{{ screenInfo.dpr }}× DPR · {{ screenInfo.colorDepth }}</p>
        </div>
        <div class="rounded-lg bg-overlay px-3 py-2">
          <p class="text-[10px] text-faded">Platform</p>
          <p class="mt-0.5 text-[12px] font-medium text-secondary truncate">{{ screenInfo.platform }}</p>
        </div>
      </div>
    </div>

    <!-- ── Live Memory ───────────────────────────────────────────────────────── -->
    <div class="rounded-xl border border-white/5 bg-surface p-4 space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-[11px] font-semibold uppercase tracking-widest text-faded">JS Heap Memory</span>
        <span class="text-[11px] tabular-nums text-faded">{{ fmtBytes(live.heapUsed) }} / {{ fmtBytes(live.heapTotal) }}</span>
      </div>
      <div class="h-2 w-full overflow-hidden rounded-full bg-overlay">
        <div class="h-full rounded-full transition-all duration-500" :class="barColor(heapPct)" :style="{ width: `${heapPct}%` }" />
      </div>
      <div class="grid grid-cols-3 gap-2 text-[11px]">
        <div><span class="text-faded">Used </span><span class="tabular-nums text-secondary">{{ fmtBytes(live.heapUsed) }}</span></div>
        <div><span class="text-faded">Allocated </span><span class="tabular-nums text-secondary">{{ fmtBytes(live.heapTotal) }}</span></div>
        <div><span class="text-faded">Limit </span><span class="tabular-nums text-secondary">{{ live.heapLimit ? fmtBytes(live.heapLimit) : '—' }}</span></div>
      </div>
    </div>

    <!-- ── JS Activity ───────────────────────────────────────────────────────── -->
    <div class="rounded-xl border border-white/5 bg-surface p-4 space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-[11px] font-semibold uppercase tracking-widest text-faded">JS Thread Activity</span>
        <span class="text-[14px] font-bold tabular-nums" :class="live.jsActivity > 60 ? 'text-warn' : 'text-ok'">
          {{ live.jsActivity }}%
        </span>
      </div>
      <div class="h-3 w-full overflow-hidden rounded-full bg-overlay">
        <div class="h-full rounded-full transition-all duration-150" :class="barColor(live.jsActivity)" :style="{ width: `${live.jsActivity}%` }" />
      </div>
      <p class="text-[10px] text-faded/50">Estimated from rAF frame timing. Spikes during inference are expected.</p>
    </div>

    <!-- ── GPU Identity ──────────────────────────────────────────────────────── -->
    <div class="rounded-xl border border-white/5 bg-surface p-4 space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-[11px] font-semibold uppercase tracking-widest text-faded">GPU Identity</span>
        <div class="flex gap-1.5">
          <span v-if="gpuInfo" class="rounded px-2 py-0.5 text-[10px] font-medium"
            :class="Object.keys(gpuInfo.limits).length > 0 ? 'bg-accent/15 text-accent' : 'bg-subtle text-faded'">
            {{ Object.keys(gpuInfo.limits).length > 0 ? 'WebGPU' : 'WebGL only' }}
          </span>
          <span v-if="gpuInfo?.hasFp16" class="rounded px-2 py-0.5 text-[10px] font-medium bg-ok/10 text-ok">FP16</span>
          <span v-else-if="gpuInfo && !gpuInfo.hasFp16" class="rounded px-2 py-0.5 text-[10px] font-medium bg-warn/10 text-warn">No FP16</span>
        </div>
      </div>

      <div v-if="gpuInfo" class="space-y-1.5">
        <div v-if="gpuInfo.vendor" class="flex gap-2 text-[11px]">
          <span class="w-24 flex-shrink-0 text-faded">Vendor</span>
          <span class="text-secondary">{{ gpuInfo.vendor }}</span>
        </div>
        <div v-if="gpuInfo.renderer" class="flex gap-2 text-[11px]">
          <span class="w-24 flex-shrink-0 text-faded">Renderer</span>
          <span class="text-secondary">{{ gpuInfo.renderer }}</span>
        </div>
        <div v-if="gpuInfo.adapterName" class="flex gap-2 text-[11px]">
          <span class="w-24 flex-shrink-0 text-faded">Adapter</span>
          <span class="text-secondary">{{ gpuInfo.adapterName }}</span>
        </div>
        <div v-if="gpuInfo.architecture" class="flex gap-2 text-[11px]">
          <span class="w-24 flex-shrink-0 text-faded">Architecture</span>
          <span class="text-secondary">{{ gpuInfo.architecture }}</span>
        </div>
        <div v-if="gpuInfo.driverInfo" class="flex gap-2 text-[11px]">
          <span class="w-24 flex-shrink-0 text-faded">Driver</span>
          <span class="text-secondary">{{ gpuInfo.driverInfo }}</span>
        </div>
        <div v-if="gpuInfo.backendType" class="flex gap-2 text-[11px]">
          <span class="w-24 flex-shrink-0 text-faded">Backend</span>
          <span class="text-secondary">{{ gpuInfo.backendType }}</span>
        </div>
      </div>
      <p v-else-if="!probed" class="text-[11px] text-faded/50 animate-pulse">Probing GPU…</p>
    </div>

    <!-- ── WebGPU Limits ─────────────────────────────────────────────────────── -->
    <div v-if="gpuInfo && Object.keys(gpuInfo.limits).length > 0"
      class="rounded-xl border border-white/5 bg-surface p-4 space-y-3">
      <span class="text-[11px] font-semibold uppercase tracking-widest text-faded">WebGPU Limits</span>
      <div class="grid grid-cols-2 gap-x-6 gap-y-1">
        <div v-for="(val, key) in gpuInfo.limits" :key="key" class="flex items-center justify-between text-[11px]">
          <span class="text-faded/70 truncate mr-2">{{ key }}</span>
          <span class="tabular-nums text-secondary flex-shrink-0">{{ fmtLimit(val) }}</span>
        </div>
      </div>
    </div>

    <!-- ── WebGPU Features ───────────────────────────────────────────────────── -->
    <div v-if="gpuInfo && gpuInfo.features.length > 0"
      class="rounded-xl border border-white/5 bg-surface p-4 space-y-3">
      <span class="text-[11px] font-semibold uppercase tracking-widest text-faded">
        WebGPU Features ({{ gpuInfo.features.length }})
      </span>
      <div class="flex flex-wrap gap-1.5">
        <span v-for="f in gpuInfo.features" :key="f"
          class="rounded-md px-2 py-0.5 text-[10px] font-mono"
          :class="f === 'shader-f16' ? 'bg-ok/10 text-ok' : 'bg-overlay text-faded'">
          {{ f }}
        </span>
      </div>
    </div>

    <!-- ── WebGL Parameters ──────────────────────────────────────────────────── -->
    <div v-if="gpuInfo && Object.keys(gpuInfo.glParams).length > 0"
      class="rounded-xl border border-white/5 bg-surface p-4 space-y-3">
      <span class="text-[11px] font-semibold uppercase tracking-widest text-faded">WebGL Parameters</span>
      <div class="grid grid-cols-2 gap-x-6 gap-y-1">
        <div v-for="(val, key) in gpuInfo.glParams" :key="key" class="flex items-center justify-between text-[11px]">
          <span class="text-faded/70 truncate mr-2 font-mono text-[10px]">{{ key }}</span>
          <span class="tabular-nums text-secondary flex-shrink-0">{{ val }}</span>
        </div>
      </div>
    </div>

    <!-- ── WebGL Extensions ──────────────────────────────────────────────────── -->
    <div v-if="gpuInfo && gpuInfo.glExtensions.length > 0"
      class="rounded-xl border border-white/5 bg-surface p-4 space-y-3">
      <span class="text-[11px] font-semibold uppercase tracking-widest text-faded">
        WebGL Extensions ({{ gpuInfo.glExtensions.length }})
      </span>
      <div class="flex flex-wrap gap-1">
        <span v-for="e in gpuInfo.glExtensions" :key="e"
          class="rounded px-1.5 py-0.5 font-mono text-[9px] bg-overlay text-faded/60">
          {{ e }}
        </span>
      </div>
    </div>

    <div class="h-1 flex-shrink-0" />
  </div>
</template>
