<script setup lang="ts">
import { useSystemMonitor } from '~/composables/useSystemMonitor'

const { gpuInfo, cpuInfo, live, memHistory, activityHistory, probed, floatOpen } = useSystemMonitor()

function metricColor(pct: number): string {
  if (pct > 80) return 'text-err'
  if (pct > 55) return 'text-warn'
  return 'text-ok'
}

function lineStroke(pct: number): string {
  if (pct > 80) return 'rgba(242,63,66,0.8)'
  if (pct > 55) return 'rgba(240,178,50,0.8)'
  return 'rgba(35,165,90,0.8)'
}

function lineFill(pct: number): string {
  if (pct > 80) return 'rgba(242,63,66,0.15)'
  if (pct > 55) return 'rgba(240,178,50,0.15)'
  return 'rgba(35,165,90,0.12)'
}

function sparkPoints(data: number[]): string {
  const w = 60; const h = 40
  return data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / 100) * h}`).join(' ')
}

function sparkArea(data: number[]): string {
  const w = 60; const h = 40
  const line = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / 100) * h}`).join(' L ')
  return `M 0,${h} L ${line} L ${w},${h} Z`
}

function fmtMb(mb: number) {
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

const screenInfo = computed(() => ({
  resolution: `${screen.width} × ${screen.height}`,
  dpr:        window.devicePixelRatio,
  colorDepth: `${screen.colorDepth}-bit`,
}))

const gpuCapable = computed(() => gpuInfo.value && Object.keys(gpuInfo.value.limits).length > 0)
</script>

<template>
  <div class="mx-auto flex h-full w-full max-w-3xl flex-col gap-4 overflow-y-auto p-4">

    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-[13px] font-semibold uppercase tracking-widest text-secondary">Performance</h1>
        <p class="mt-0.5 text-[11px] text-faded">Live hardware &amp; resource metrics</p>
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

    <!-- ── Live charts ───────────────────────────────────────────────────────── -->
    <div class="grid grid-cols-2 gap-3">

      <!-- App Memory -->
      <div class="rounded-xl border border-white/5 bg-surface p-4">
        <div class="flex items-start justify-between">
          <div>
            <p class="text-[10px] font-semibold uppercase tracking-widest text-faded/60">App Memory</p>
            <p class="mt-1 text-[22px] font-bold tabular-nums leading-none" :class="metricColor(heapPct)">
              {{ heapPct }}<span class="text-[13px] font-normal text-faded">%</span>
            </p>
            <p class="mt-0.5 text-[10px] tabular-nums text-faded">
              {{ fmtMb(live.heapUsed) }} / {{ fmtMb(live.heapTotal) }}
            </p>
          </div>
        </div>
        <svg class="mt-3 h-12 w-full overflow-visible" viewBox="0 0 60 40" preserveAspectRatio="none">
          <path :d="sparkArea(memHistory)" :fill="lineFill(heapPct)" />
          <polyline :points="sparkPoints(memHistory)" fill="none"
            :stroke="lineStroke(heapPct)" stroke-width="1.5"
            stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <div class="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-overlay">
          <div class="h-full rounded-full transition-all duration-700"
            :class="heapPct > 80 ? 'bg-err' : heapPct > 55 ? 'bg-warn' : 'bg-ok'"
            :style="{ width: `${heapPct}%` }" />
        </div>
      </div>

      <!-- Render Load -->
      <div class="rounded-xl border border-white/5 bg-surface p-4">
        <div class="flex items-start justify-between">
          <div>
            <p class="text-[10px] font-semibold uppercase tracking-widest text-faded/60">Render Load</p>
            <p class="mt-1 text-[22px] font-bold tabular-nums leading-none" :class="metricColor(live.jsActivity)">
              {{ live.jsActivity }}<span class="text-[13px] font-normal text-faded">%</span>
            </p>
            <p class="mt-0.5 text-[10px] text-faded">frame timing · 30 sample avg</p>
          </div>
        </div>
        <svg class="mt-3 h-12 w-full overflow-visible" viewBox="0 0 60 40" preserveAspectRatio="none">
          <path :d="sparkArea(activityHistory)" :fill="lineFill(live.jsActivity)" />
          <polyline :points="sparkPoints(activityHistory)" fill="none"
            :stroke="lineStroke(live.jsActivity)" stroke-width="1.5"
            stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <div class="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-overlay">
          <div class="h-full rounded-full transition-all duration-150"
            :class="live.jsActivity > 80 ? 'bg-err' : live.jsActivity > 55 ? 'bg-warn' : 'bg-ok'"
            :style="{ width: `${live.jsActivity}%` }" />
        </div>
        <p class="mt-1.5 text-[9px] text-faded/30">Spikes during inference are normal</p>
      </div>
    </div>

    <!-- Memory detail -->
    <div v-if="live.heapLimit > 0" class="rounded-xl border border-white/5 bg-surface px-4 py-3">
      <div class="grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <p class="text-faded/60">Used</p>
          <p class="tabular-nums text-secondary font-medium">{{ fmtMb(live.heapUsed) }}</p>
        </div>
        <div>
          <p class="text-faded/60">Allocated</p>
          <p class="tabular-nums text-secondary font-medium">{{ fmtMb(live.heapTotal) }}</p>
        </div>
        <div>
          <p class="text-faded/60">Limit</p>
          <p class="tabular-nums text-secondary font-medium">{{ fmtMb(live.heapLimit) }}</p>
        </div>
      </div>
    </div>

    <!-- ── Hardware ──────────────────────────────────────────────────────────── -->
    <div class="rounded-xl border border-white/5 bg-surface p-4 space-y-3">
      <span class="text-[11px] font-semibold uppercase tracking-widest text-faded">Hardware</span>
      <div class="grid grid-cols-2 gap-2">
        <div class="rounded-lg bg-overlay px-3 py-2">
          <p class="text-[10px] text-faded">Logical Cores</p>
          <p class="mt-0.5 text-[18px] font-bold tabular-nums text-secondary">{{ cpuInfo?.cores ?? '—' }}</p>
        </div>
        <div class="rounded-lg bg-overlay px-3 py-2">
          <p class="text-[10px] text-faded">System RAM</p>
          <p class="mt-0.5 text-[18px] font-bold tabular-nums text-secondary">
            {{ cpuInfo?.deviceMemoryGb != null ? `${cpuInfo.deviceMemoryGb} GB` : '—' }}
          </p>
        </div>
        <div class="rounded-lg bg-overlay px-3 py-2">
          <p class="text-[10px] text-faded">Display</p>
          <p class="mt-0.5 text-[13px] font-semibold text-secondary">{{ screenInfo.resolution }}</p>
          <p class="text-[10px] text-faded">{{ screenInfo.dpr }}× DPR · {{ screenInfo.colorDepth }}</p>
        </div>
        <div class="rounded-lg bg-overlay px-3 py-2 flex flex-col justify-center">
          <p class="text-[10px] text-faded">Accelerator</p>
          <div class="mt-1 flex flex-wrap gap-1">
            <span v-if="gpuInfo" class="rounded px-1.5 py-0.5 text-[10px] font-medium"
              :class="gpuCapable ? 'bg-accent/15 text-accent' : 'bg-subtle text-faded'">
              {{ gpuCapable ? 'GPU Compute' : 'Rasterization only' }}
            </span>
            <span v-if="gpuInfo?.hasFp16" class="rounded px-1.5 py-0.5 text-[10px] font-medium bg-ok/10 text-ok">FP16</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ── GPU Identity ──────────────────────────────────────────────────────── -->
    <div class="rounded-xl border border-white/5 bg-surface p-4 space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-[11px] font-semibold uppercase tracking-widest text-faded">Graphics Adapter</span>
        <span v-if="!gpuInfo && !probed" class="text-[10px] text-faded/50 animate-pulse">Probing…</span>
      </div>

      <div v-if="gpuInfo" class="space-y-1.5">
        <div v-if="gpuInfo.adapterName" class="flex gap-2 text-[11px]">
          <span class="w-24 flex-shrink-0 text-faded">Model</span>
          <span class="text-secondary">{{ gpuInfo.adapterName }}</span>
        </div>
        <div v-if="gpuInfo.vendor" class="flex gap-2 text-[11px]">
          <span class="w-24 flex-shrink-0 text-faded">Vendor</span>
          <span class="text-secondary">{{ gpuInfo.vendor }}</span>
        </div>
        <div v-if="gpuInfo.renderer" class="flex gap-2 text-[11px]">
          <span class="w-24 flex-shrink-0 text-faded">Renderer</span>
          <span class="text-secondary truncate">{{ gpuInfo.renderer }}</span>
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
      <p v-else-if="probed" class="text-[11px] text-faded/50">No GPU information available.</p>
    </div>

    <!-- ── Compute Limits ───────────────────────────────────────────────────── -->
    <div v-if="gpuCapable && Object.keys(gpuInfo!.limits).length > 0"
      class="rounded-xl border border-white/5 bg-surface p-4 space-y-3">
      <span class="text-[11px] font-semibold uppercase tracking-widest text-faded">Compute Limits</span>
      <div class="grid grid-cols-2 gap-x-6 gap-y-1">
        <div v-for="(val, key) in gpuInfo!.limits" :key="key" class="flex items-center justify-between text-[11px]">
          <span class="text-faded/70 truncate mr-2">{{ key }}</span>
          <span class="tabular-nums text-secondary flex-shrink-0">{{ fmtLimit(val) }}</span>
        </div>
      </div>
    </div>

    <!-- ── Compute Features ─────────────────────────────────────────────────── -->
    <div v-if="gpuInfo && gpuInfo.features.length > 0"
      class="rounded-xl border border-white/5 bg-surface p-4 space-y-3">
      <span class="text-[11px] font-semibold uppercase tracking-widest text-faded">
        Compute Features ({{ gpuInfo.features.length }})
      </span>
      <div class="flex flex-wrap gap-1.5">
        <span v-for="f in gpuInfo.features" :key="f"
          class="rounded-md px-2 py-0.5 text-[10px] font-mono"
          :class="f === 'shader-f16' ? 'bg-ok/10 text-ok' : 'bg-overlay text-faded'">
          {{ f }}
        </span>
      </div>
    </div>

    <div class="h-1 flex-shrink-0" />
  </div>
</template>
