<script setup lang="ts">
import { useSystemMonitor } from '~/composables/useSystemMonitor'

const { live, gpuInfo, cpuInfo, floatOpen } = useSystemMonitor()

// ── Dragging ──────────────────────────────────────────────────────────────────
const pos      = ref({ x: 16, y: 80 })
const dragging = ref(false)
const dragStart = { mx: 0, my: 0, px: 0, py: 0 }
const panelRef = ref<HTMLElement | null>(null)

function onMouseDown(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('button')) return
  dragging.value = true
  dragStart.mx = e.clientX
  dragStart.my = e.clientY
  dragStart.px = pos.value.x
  dragStart.py = pos.value.y
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

function onMouseMove(e: MouseEvent) {
  if (!dragging.value) return
  const nx = dragStart.px + e.clientX - dragStart.mx
  const ny = dragStart.py + e.clientY - dragStart.my
  const pw = panelRef.value?.offsetWidth  ?? 220
  const ph = panelRef.value?.offsetHeight ?? 200
  pos.value = {
    x: Math.max(0, Math.min(window.innerWidth  - pw, nx)),
    y: Math.max(0, Math.min(window.innerHeight - ph, ny)),
  }
}

function onMouseUp() {
  dragging.value = false
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
}

onUnmounted(() => {
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
})

// ── Helpers ───────────────────────────────────────────────────────────────────
function barColor(pct: number) {
  if (pct > 80) return 'bg-err'
  if (pct > 55) return 'bg-warn'
  return 'bg-ok'
}

const heapPct = computed(() =>
  live.value.heapTotal > 0 ? Math.round((live.value.heapUsed / live.value.heapTotal) * 100) : 0,
)

const gpuShort = computed(() => {
  const r = gpuInfo.value?.renderer || gpuInfo.value?.adapterName || ''
  return r.length > 30 ? r.slice(0, 30) + '…' : r
})
</script>

<template>
  <Teleport to="body">
    <Transition name="float">
      <div
        v-if="floatOpen"
        ref="panelRef"
        class="fixed z-[9990] w-52 rounded-xl border border-white/10 bg-surface/95 shadow-2xl backdrop-blur-md select-none"
        :style="{ left: `${pos.x}px`, top: `${pos.y}px`, cursor: dragging ? 'grabbing' : 'grab' }"
        @mousedown="onMouseDown"
      >
        <!-- Title bar -->
        <div class="flex items-center justify-between border-b border-white/5 px-3 py-2">
          <span class="text-[10px] font-semibold uppercase tracking-widest text-faded">Monitor</span>
          <button type="button"
            class="flex h-5 w-5 items-center justify-center rounded text-faded transition-ui hover:bg-err/15 hover:text-err"
            @click="floatOpen = false">
            <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="p-3 space-y-3">

          <!-- JS Activity -->
          <div>
            <div class="flex items-center justify-between mb-1">
              <span class="text-[10px] text-faded">JS Activity</span>
              <span class="text-[11px] tabular-nums font-semibold"
                :class="live.jsActivity > 60 ? 'text-warn' : 'text-ok'">{{ live.jsActivity }}%</span>
            </div>
            <div class="h-1.5 w-full overflow-hidden rounded-full bg-overlay">
              <div class="h-full rounded-full transition-all duration-150" :class="barColor(live.jsActivity)" :style="{ width: `${live.jsActivity}%` }" />
            </div>
          </div>

          <!-- Heap -->
          <div>
            <div class="flex items-center justify-between mb-1">
              <span class="text-[10px] text-faded">Heap</span>
              <span class="text-[10px] tabular-nums text-secondary">{{ live.heapUsed }}/{{ live.heapTotal }} MB</span>
            </div>
            <div class="h-1.5 w-full overflow-hidden rounded-full bg-overlay">
              <div class="h-full rounded-full transition-all duration-500" :class="barColor(heapPct)" :style="{ width: `${heapPct}%` }" />
            </div>
          </div>

          <!-- CPU cores -->
          <div class="flex items-center justify-between text-[10px]">
            <span class="text-faded">CPU Cores</span>
            <span class="text-secondary tabular-nums">{{ cpuInfo?.cores ?? '—' }}</span>
          </div>

          <!-- GPU short name -->
          <div v-if="gpuShort" class="text-[10px]">
            <span class="text-faded block">GPU</span>
            <span class="text-secondary text-[9px] leading-tight block mt-0.5">{{ gpuShort }}</span>
          </div>

          <!-- FP16 badge -->
          <div class="flex items-center gap-1.5">
            <span class="rounded px-1.5 py-0.5 text-[9px] font-medium"
              :class="gpuInfo?.hasFp16 ? 'bg-ok/10 text-ok' : 'bg-warn/10 text-warn'">
              {{ gpuInfo?.hasFp16 ? 'FP16 ✓' : 'No FP16' }}
            </span>
            <span v-if="gpuInfo && Object.keys(gpuInfo.limits).length > 0"
              class="rounded px-1.5 py-0.5 text-[9px] font-medium bg-accent/10 text-accent">
              WebGPU
            </span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.float-enter-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.float-leave-active { transition: opacity 0.1s ease, transform 0.1s ease; }
.float-enter-from, .float-leave-to { opacity: 0; transform: scale(0.92); }
</style>
