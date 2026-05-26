<script setup lang="ts">
import { Play, Download, Trash2, ChevronDown, ChevronUp, FileJson, Mic, Layers } from 'lucide-vue-next'
import { useHistory, type HistoryMeta } from '~/composables/useHistory'
import { useKokoro } from '~/composables/useKokoro'

const { entries, getWav, remove, clear } = useHistory()
const { loadExternal } = useKokoro()

// ── Display grouping ──────────────────────────────────────────────────────────

interface DisplayGroup {
  key:       string
  isBatch:   boolean
  entries:   HistoryMeta[]
  timestamp: number
}

const displayGroups = computed((): DisplayGroup[] => {
  const groups: DisplayGroup[] = []
  const seen   = new Set<string>()

  for (const entry of entries.value) {
    if (entry.batchId) {
      if (seen.has(entry.batchId)) continue
      seen.add(entry.batchId)
      const batchEntries = entries.value
        .filter(e => e.batchId === entry.batchId)
        .sort((a, b) => (a.partIndex ?? 0) - (b.partIndex ?? 0))
      groups.push({
        key:       entry.batchId,
        isBatch:   true,
        entries:   batchEntries,
        timestamp: batchEntries[0]!.timestamp,
      })
    } else {
      groups.push({ key: entry.id, isBatch: false, entries: [entry], timestamp: entry.timestamp })
    }
  }

  return groups.sort((a, b) => b.timestamp - a.timestamp)
})

const PAGE_SIZE  = 10
const page       = ref(1)
const expandedId = ref<string | null>(null)

const totalPages = computed(() => Math.max(1, Math.ceil(displayGroups.value.length / PAGE_SIZE)))
const pageGroups = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE
  return displayGroups.value.slice(start, start + PAGE_SIZE)
})

watch(() => displayGroups.value.length, () => {
  if (page.value > totalPages.value) page.value = totalPages.value
})

const loadingId = ref<string | null>(null)

async function playInDrawer(id: string) {
  if (loadingId.value === id) return
  loadingId.value = id
  const wav = await getWav(id)
  loadingId.value = null
  if (!wav) return
  const entry = entries.value.find(e => e.id === id)
  if (!entry) return
  loadExternal(wav, {
    text:      entry.text,
    voice:     entry.voice,
    speed:     entry.speed,
    device:    entry.device,
    elapsedMs: entry.elapsedMs,
  })
}

function makeFilename(entry: HistoryMeta) {
  const d   = new Date(entry.timestamp)
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
  const time = `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  return `varg-${date}-${time}-${entry.voice}`
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

async function saveWav(id: string) {
  const wav = await getWav(id)
  if (!wav) return
  const entry = entries.value.find(e => e.id === id)
  if (!entry) return
  downloadBlob(new Blob([wav], { type: 'audio/wav' }), `${makeFilename(entry)}.wav`)
}

async function exportPair(id: string) {
  const wav = await getWav(id)
  if (!wav) return
  const entry = entries.value.find(e => e.id === id)
  if (!entry) return
  const name = makeFilename(entry)

  downloadBlob(new Blob([wav], { type: 'audio/wav' }), `${name}.wav`)

  const meta = {
    id:          entry.id,
    generatedAt: new Date(entry.timestamp).toISOString(),
    source:      entry.source ?? 'tts',
    text:        entry.text,
    voice:       entry.voice,
    speed:       entry.speed,
    device:      entry.device,
    duration:    Number(entry.duration.toFixed(3)),
    elapsedMs:   entry.elapsedMs,
  }
  downloadBlob(
    new Blob([JSON.stringify(meta, null, 2)], { type: 'application/json' }),
    `${name}.json`,
  )
}

async function deleteBatch(batchEntries: HistoryMeta[]) {
  for (const entry of batchEntries) await remove(entry.id)
}

function toggleExpand(key: string) {
  expandedId.value = expandedId.value === key ? null : key
}

function fmtDate(ts: number) {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function fmtDur(s: number) {
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`
}

function trunc(t: string, n = 80) {
  return t.length > n ? t.slice(0, n) + '…' : t
}
</script>

<template>
  <div class="mx-auto flex h-full w-full max-w-2xl flex-col gap-3 p-4">

    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-[13px] font-semibold uppercase tracking-widest text-secondary">History</h1>
        <p class="mt-0.5 text-[11px] text-faded">{{ entries.length }} saved generation{{ entries.length !== 1 ? 's' : '' }}</p>
        <p v-if="totalPages > 1" class="mt-0.5 text-[11px] text-faded/50">Page {{ page }} of {{ totalPages }}</p>
      </div>
      <button v-if="entries.length > 0" type="button"
        class="rounded-lg bg-surface px-2.5 py-1 text-[11px] text-faded transition-ui hover:bg-err/10 hover:text-err"
        @click="clear()">
        Clear all
      </button>
    </div>

    <div v-if="entries.length === 0" class="flex flex-1 items-center justify-center">
      <div class="text-center">
        <Mic class="mx-auto mb-3 h-8 w-8 text-faded/30" />
        <p class="text-[13px] text-faded">No generations yet</p>
        <p class="mt-1 text-[11px] text-faded/50">Generate speech — it auto-saves here</p>
      </div>
    </div>

    <div v-else class="space-y-2 pb-2">
      <div v-for="group in pageGroups" :key="group.key" class="glass-panel rounded-xl overflow-hidden">

        <!-- ── Single entry ──────────────────────────────────────────────── -->
        <template v-if="!group.isBatch">
          <div class="flex items-start gap-3 px-3 py-2.5">
            <!-- Play -->
            <button type="button"
              class="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full transition-ui"
              :class="loadingId === group.entries[0]!.id
                ? 'bg-subtle text-accent'
                : 'bg-subtle text-faded hover:bg-accent/20 hover:text-accent'"
              :title="loadingId === group.entries[0]!.id ? 'Loading…' : 'Play in audio bar'"
              @click="playInDrawer(group.entries[0]!.id)">
              <svg v-if="loadingId === group.entries[0]!.id" class="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <Play v-else class="h-3 w-3 translate-x-px" fill="currentColor" />
            </button>

            <!-- Text + meta -->
            <div class="min-w-0 flex-1 cursor-pointer" @click="toggleExpand(group.key)">
              <p class="text-[13px] leading-snug text-primary">{{ trunc(group.entries[0]!.text) }}</p>
              <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-faded">
                <span class="uppercase font-medium">{{ group.entries[0]!.voice }}</span>
                <span>·</span>
                <span>{{ group.entries[0]!.device.toUpperCase() }}</span>
                <span>·</span>
                <span>{{ fmtDur(group.entries[0]!.duration) }}</span>
                <span>·</span>
                <span class="tabular-nums">{{ (group.entries[0]!.elapsedMs / 1000).toFixed(1) }}s gen</span>
                <span>·</span>
                <span>{{ fmtDate(group.entries[0]!.timestamp) }}</span>
                <span v-if="group.entries[0]!.source === 'mcp'"
                  class="rounded px-1 py-px text-[9px] font-semibold uppercase bg-accent/10 text-accent">
                  MCP
                </span>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex flex-shrink-0 items-center gap-0.5">
              <button type="button" title="Save WAV"
                class="flex h-7 w-7 items-center justify-center rounded-lg text-faded transition-ui hover:bg-subtle hover:text-secondary"
                @click="saveWav(group.entries[0]!.id)">
                <Download class="h-3.5 w-3.5" />
              </button>
              <button type="button" title="Delete"
                class="flex h-7 w-7 items-center justify-center rounded-lg text-faded transition-ui hover:bg-err/10 hover:text-err"
                @click="remove(group.entries[0]!.id)">
                <Trash2 class="h-3.5 w-3.5" />
              </button>
              <button type="button" :title="expandedId === group.key ? 'Collapse' : 'View details'"
                class="flex h-7 w-7 items-center justify-center rounded-lg text-faded transition-ui hover:bg-subtle hover:text-secondary"
                @click="toggleExpand(group.key)">
                <ChevronUp v-if="expandedId === group.key" class="h-3.5 w-3.5" />
                <ChevronDown v-else class="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <!-- Single expanded detail -->
          <Transition name="expand">
            <div v-if="expandedId === group.key"
              class="border-t border-white/5 bg-base/40 px-4 py-3 space-y-3">
              <div>
                <p class="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-faded/50">Script</p>
                <div class="max-h-36 overflow-y-auto rounded-lg bg-overlay px-3 py-2.5 text-[12px] leading-relaxed text-secondary whitespace-pre-wrap break-words">
                  {{ group.entries[0]!.text }}
                </div>
              </div>
              <div class="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-3">
                <div class="rounded-lg bg-white/[0.03] px-3 py-2 space-y-0.5">
                  <p class="text-faded/60">Voice</p>
                  <p class="font-mono text-secondary">{{ group.entries[0]!.voice }}</p>
                </div>
                <div class="rounded-lg bg-white/[0.03] px-3 py-2 space-y-0.5">
                  <p class="text-faded/60">Speed</p>
                  <p class="font-mono text-secondary">{{ group.entries[0]!.speed.toFixed(1) }}×</p>
                </div>
                <div class="rounded-lg bg-white/[0.03] px-3 py-2 space-y-0.5">
                  <p class="text-faded/60">Device</p>
                  <p class="font-mono text-secondary uppercase">{{ group.entries[0]!.device }}</p>
                </div>
                <div class="rounded-lg bg-white/[0.03] px-3 py-2 space-y-0.5">
                  <p class="text-faded/60">Duration</p>
                  <p class="font-mono text-secondary tabular-nums">{{ fmtDur(group.entries[0]!.duration) }}</p>
                </div>
                <div class="rounded-lg bg-white/[0.03] px-3 py-2 space-y-0.5">
                  <p class="text-faded/60">Gen time</p>
                  <p class="font-mono text-secondary tabular-nums">{{ (group.entries[0]!.elapsedMs / 1000).toFixed(2) }}s</p>
                </div>
                <div class="rounded-lg bg-white/[0.03] px-3 py-2 space-y-0.5">
                  <p class="text-faded/60">Source</p>
                  <p class="font-mono text-secondary uppercase">{{ group.entries[0]!.source ?? 'tts' }}</p>
                </div>
              </div>
              <button type="button"
                class="flex items-center gap-2 rounded-xl border border-white/10 px-3.5 py-2 text-[11px] font-medium text-faded transition-ui hover:border-accent/30 hover:text-accent"
                @click="exportPair(group.entries[0]!.id)">
                <FileJson class="h-3.5 w-3.5" />
                Export WAV + JSON metadata
              </button>
            </div>
          </Transition>
        </template>

        <!-- ── Batch entry ───────────────────────────────────────────────── -->
        <template v-else>
          <div class="flex items-start gap-3 px-3 py-2.5">
            <!-- Batch icon -->
            <div class="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-accent/10">
              <Layers class="h-3.5 w-3.5 text-accent/60" />
            </div>

            <!-- Info -->
            <div class="min-w-0 flex-1 cursor-pointer" @click="toggleExpand(group.key)">
              <p class="text-[13px] font-medium text-primary">
                Batch · {{ group.entries.length }} audio parts
              </p>
              <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-faded">
                <span class="uppercase font-medium">{{ group.entries[0]?.voice }}</span>
                <span>·</span>
                <span>{{ fmtDur(group.entries.reduce((s, e) => s + e.duration, 0)) }} total</span>
                <span>·</span>
                <span>{{ fmtDate(group.timestamp) }}</span>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex flex-shrink-0 items-center gap-0.5">
              <button type="button" title="Delete batch"
                class="flex h-7 w-7 items-center justify-center rounded-lg text-faded transition-ui hover:bg-err/10 hover:text-err"
                @click="deleteBatch(group.entries)">
                <Trash2 class="h-3.5 w-3.5" />
              </button>
              <button type="button" :title="expandedId === group.key ? 'Collapse' : 'View parts'"
                class="flex h-7 w-7 items-center justify-center rounded-lg text-faded transition-ui hover:bg-subtle hover:text-secondary"
                @click="toggleExpand(group.key)">
                <ChevronUp v-if="expandedId === group.key" class="h-3.5 w-3.5" />
                <ChevronDown v-else class="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <!-- Batch expanded parts -->
          <Transition name="expand">
            <div v-if="expandedId === group.key"
              class="border-t border-white/5 bg-base/40 px-4 py-3 space-y-3">

              <!-- Shared metadata grid -->
              <div class="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-3">
                <div class="rounded-lg bg-white/[0.03] px-3 py-2 space-y-0.5">
                  <p class="text-faded/60">Voice</p>
                  <p class="font-mono text-secondary">{{ group.entries[0]?.voice }}</p>
                </div>
                <div class="rounded-lg bg-white/[0.03] px-3 py-2 space-y-0.5">
                  <p class="text-faded/60">Speed</p>
                  <p class="font-mono text-secondary">{{ group.entries[0]?.speed.toFixed(1) }}×</p>
                </div>
                <div class="rounded-lg bg-white/[0.03] px-3 py-2 space-y-0.5">
                  <p class="text-faded/60">Device</p>
                  <p class="font-mono text-secondary uppercase">{{ group.entries[0]?.device }}</p>
                </div>
                <div class="rounded-lg bg-white/[0.03] px-3 py-2 space-y-0.5">
                  <p class="text-faded/60">Total dur.</p>
                  <p class="font-mono text-secondary tabular-nums">{{ fmtDur(group.entries.reduce((s, e) => s + e.duration, 0)) }}</p>
                </div>
                <div class="rounded-lg bg-white/[0.03] px-3 py-2 space-y-0.5">
                  <p class="text-faded/60">Parts</p>
                  <p class="font-mono text-secondary tabular-nums">{{ group.entries.length }}</p>
                </div>
                <div class="rounded-lg bg-white/[0.03] px-3 py-2 space-y-0.5">
                  <p class="text-faded/60">Source</p>
                  <p class="font-mono text-secondary uppercase">{{ group.entries[0]?.source ?? 'tts' }}</p>
                </div>
              </div>

              <!-- Per-part list -->
              <div class="space-y-1.5">
                <p class="text-[10px] font-semibold uppercase tracking-widest text-faded/40">Audio Parts</p>
                <div v-for="(part, pi) in group.entries" :key="part.id"
                  class="rounded-lg border border-white/5 bg-overlay">
                  <div class="flex items-start gap-2.5 px-3 py-2">
                    <!-- Play -->
                    <button type="button"
                      class="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full transition-ui"
                      :class="loadingId === part.id ? 'bg-subtle text-accent' : 'bg-subtle text-faded hover:bg-accent/20 hover:text-accent'"
                      @click="playInDrawer(part.id)">
                      <svg v-if="loadingId === part.id" class="h-2.5 w-2.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <Play v-else class="h-2.5 w-2.5 translate-x-px" fill="currentColor" />
                    </button>

                    <!-- Text + meta -->
                    <div class="min-w-0 flex-1">
                      <p class="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-faded/50">
                        Part {{ (part.partIndex ?? pi) + 1 }}
                      </p>
                      <p class="text-[12px] leading-snug text-secondary">{{ trunc(part.text, 120) }}</p>
                      <div class="mt-0.5 flex items-center gap-x-2 text-[10px] text-faded/50">
                        <span>{{ fmtDur(part.duration) }}</span>
                        <span>·</span>
                        <span class="tabular-nums">{{ (part.elapsedMs / 1000).toFixed(1) }}s gen</span>
                      </div>
                    </div>

                    <!-- Download -->
                    <button type="button" title="Save WAV"
                      class="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-faded transition-ui hover:bg-subtle hover:text-secondary"
                      @click="saveWav(part.id)">
                      <Download class="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </template>

      </div>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="flex flex-shrink-0 items-center justify-center gap-2 py-2">
      <button type="button"
        class="flex h-7 w-7 items-center justify-center rounded-lg text-faded transition-ui hover:bg-subtle hover:text-secondary disabled:opacity-30"
        :disabled="page <= 1" @click="page--">
        <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
      </button>
      <button v-for="p in totalPages" :key="p" type="button"
        class="flex h-7 w-7 items-center justify-center rounded-lg text-[12px] transition-ui"
        :class="p === page ? 'bg-accent text-white shadow-button' : 'text-faded hover:bg-subtle hover:text-secondary'"
        @click="page = p">{{ p }}</button>
      <button type="button"
        class="flex h-7 w-7 items-center justify-center rounded-lg text-faded transition-ui hover:bg-subtle hover:text-secondary disabled:opacity-30"
        :disabled="page >= totalPages" @click="page++">
        <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.expand-enter-active, .expand-leave-active {
  transition: max-height 0.2s ease, opacity 0.2s ease;
  overflow: hidden;
  max-height: 600px;
}
.expand-enter-from, .expand-leave-to {
  max-height: 0;
  opacity: 0;
}
</style>
