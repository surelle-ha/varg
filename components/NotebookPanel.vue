<script setup lang="ts">
import { useNotebook, relTime, type NotebookPage, type NotebookFolder } from '~/composables/useNotebook'
import { useKokoro, KOKORO_VOICES } from '~/composables/useKokoro'
import { useHistory } from '~/composables/useHistory'

const {
  pages, folders, activeId, activePage,
  create, update, remove,
  createFolder, renameFolder, toggleFolder, removeFolder,
} = useNotebook()
const {
  hasGpu,
  initializing, initStatus, initProgress,
  generating, genChunk, genTotal,
  audioBuffer, elapsedMs, sampleRate,
  activeDevice, genDevice, gpuFallback, error: ttsError,
  lastGenText, lastGenVoice, lastGenSpeed,
  init, generate, setDevice,
} = useKokoro()
const { add: addHistory } = useHistory()

const sendToTts = inject<(text: string) => void>('sendToTts')

const titleDraft   = ref(activePage.value?.title   ?? '')
const contentDraft = ref(activePage.value?.content ?? '')

watch(activePage, page => {
  if (!page) return
  titleDraft.value   = page.title
  contentDraft.value = page.content
}, { immediate: true })

// ── Save ──────────────────────────────────────────────────────────────────────
type SaveStatus = 'idle' | 'pending' | 'saved'
const saveStatus = ref<SaveStatus>('idle')
let saveTimer:   ReturnType<typeof setTimeout> | null = null
let statusTimer: ReturnType<typeof setTimeout> | null = null

function doSave() {
  if (!activePage.value) return
  update(activePage.value.id, { title: titleDraft.value, content: contentDraft.value })
  saveStatus.value = 'saved'
  if (statusTimer) clearTimeout(statusTimer)
  statusTimer = setTimeout(() => { saveStatus.value = 'idle' }, 2000)
}
function scheduleSave() {
  saveStatus.value = 'pending'
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => { doSave(); saveTimer = null }, 500)
}
watch(titleDraft,   scheduleSave)
watch(contentDraft, scheduleSave)

function manualSave() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  doSave()
}
function selectPage(page: NotebookPage) {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  if (activePage.value) update(activePage.value.id, { title: titleDraft.value, content: contentDraft.value })
  activeId.value = page.id
}
// ── Folder management ─────────────────────────────────────────────────────────
const editingFolderId  = ref<string | null>(null)
const folderDraft      = ref('')
const folderInputRef   = ref<HTMLInputElement | null>(null)
const deleteFolderConfirmId = ref<string | null>(null)
let deleteFolderTimer: ReturnType<typeof setTimeout> | null = null

function startEditFolder(folder: NotebookFolder, e: Event) {
  e.stopPropagation()
  editingFolderId.value = folder.id
  folderDraft.value = folder.name
  nextTick(() => folderInputRef.value?.select())
}

function commitFolderRename(id: string) {
  const name = folderDraft.value.trim()
  if (name) renameFolder(id, name)
  editingFolderId.value = null
}

function requestDeleteFolder(id: string, e: Event) {
  e.stopPropagation()
  if (deleteFolderConfirmId.value === id) {
    if (deleteFolderTimer) { clearTimeout(deleteFolderTimer); deleteFolderTimer = null }
    deleteFolderConfirmId.value = null
    removeFolder(id)
  } else {
    deleteFolderConfirmId.value = id
    if (deleteFolderTimer) clearTimeout(deleteFolderTimer)
    deleteFolderTimer = setTimeout(() => { deleteFolderConfirmId.value = null }, 2500)
  }
}

// Pages grouped: loose (no folder) + per-folder
const loosePages = computed(() => pages.value.filter(p => !p.folderId))

function folderPages(folderId: string) {
  return pages.value.filter(p => p.folderId === folderId)
}

// ── Delete modal ──────────────────────────────────────────────────────────────
const deleteModalId    = ref<string | null>(null)
const deleteModalTitle = ref('')

function requestDelete(id: string, e: Event) {
  e.stopPropagation()
  const p = pages.value.find(pg => pg.id === id)
  deleteModalTitle.value = p?.title || 'Untitled'
  deleteModalId.value = id
}
function confirmDelete() {
  if (deleteModalId.value) remove(deleteModalId.value)
  deleteModalId.value = null
}

// ── Per-folder script dropdown ────────────────────────────────────────────────
const folderDropdownId = ref<string | null>(null)

function openFolderDropdown(id: string, e: Event) {
  e.stopPropagation()
  folderDropdownId.value = folderDropdownId.value === id ? null : id
}

function createInFolder(id: string) {
  folderDropdownId.value = null
  create(id)
}

function closeFolderDropdown() { folderDropdownId.value = null }

// ── Script syntax ─────────────────────────────────────────────────────────────
// Inline comment:  @ ... !@  (excluded from TTS, shown in violet)
// Section header:  line starting with ===  (excluded from TTS, shown in amber)

const COMMENT_RE  = /@.*?!@/g
const SECTION_RE  = /^===/

const allLines = computed(() => contentDraft.value.split('\n'))

const scriptText = computed(() =>
  allLines.value
    .map(line => {
      if (SECTION_RE.test(line.trim())) return ''
      return line.replace(COMMENT_RE, '').trim()
    })
    .filter(l => l.length > 0)
    .join('\n')
    .trim()
)

// Gutter symbols: number = script line, '@' = comment-only, '§' = section, null = blank
type GutterMark = number | '@' | '§' | null
const gutterMarks = computed((): GutterMark[] => {
  let n = 0
  return allLines.value.map(line => {
    const t = line.trim()
    if (!t) return null
    if (SECTION_RE.test(t)) return '§'
    const stripped = t.replace(COMMENT_RE, '').trim()
    if (!stripped) return '@'
    return ++n
  })
})

// ── Script metrics ────────────────────────────────────────────────────────────
const scriptWords = computed(() =>
  scriptText.value.trim().split(/\s+/).filter(Boolean).length
)

const sectionCount = computed(() =>
  allLines.value.filter(l => SECTION_RE.test(l.trim())).length
)

const commentCount = computed(() =>
  (contentDraft.value.match(COMMENT_RE) || []).length
)

const estimatedChunks = computed(() => {
  if (!scriptText.value.trim()) return 0
  return Math.max(1, Math.ceil(scriptText.value.length / 210))
})

const estimatedSec = computed(() => {
  if (!scriptWords.value) return 0
  return (scriptWords.value / (140 * ttsSpeed.value)) * 60
})

function fmtEstimate(sec: number): string {
  if (!sec) return '—'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function pageScriptWords(page: NotebookPage): number {
  return page.content
    .split('\n')
    .filter(l => !SECTION_RE.test(l.trim()))
    .join(' ')
    .replace(COMMENT_RE, '')
    .split(/\s+/)
    .filter(Boolean).length
}

// ── Syntax highlight overlay ──────────────────────────────────────────────────
function highlightLine(line: string): string {
  if (!line) return '<span class="hl-t">​</span>'
  const t = line.trim()
  if (SECTION_RE.test(t)) {
    const esc = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    return `<span class="hl-s">${esc}</span>`
  }
  // Split at inline comment markers, preserving them in the array
  const parts = line.split(/(@.*?!@)/g)
  return parts.map(part => {
    const esc = part.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    return (part.startsWith('@') && part.endsWith('!@'))
      ? `<span class="hl-c">${esc}</span>`
      : `<span class="hl-t">${esc}</span>`
  }).join('')
}

const highlightHtml = computed(() =>
  allLines.value.map(l => highlightLine(l)).join('<br>')
)

// ── Scroll sync ───────────────────────────────────────────────────────────────
const textareaRef  = ref<HTMLTextAreaElement | null>(null)
const highlightRef = ref<HTMLElement | null>(null)
const gutterRef    = ref<HTMLElement | null>(null)

function syncScroll() {
  if (!textareaRef.value) return
  const st = textareaRef.value.scrollTop
  const sl = textareaRef.value.scrollLeft
  if (gutterRef.value)    gutterRef.value.scrollTop = st
  if (highlightRef.value) { highlightRef.value.scrollTop = st; highlightRef.value.scrollLeft = sl }
}

// ── Keyboard actions ──────────────────────────────────────────────────────────
function toggleComment() {
  const ta = textareaRef.value
  if (!ta) return
  const s   = ta.selectionStart
  const e   = ta.selectionEnd
  const val = contentDraft.value
  const sel = val.slice(s, e)

  // If selection is already a comment block, unwrap it
  const m = sel.match(/^@\s?([\s\S]*?)\s?!@$/)
  const replacement = m ? (m[1] ?? '') : `@ ${sel} !@`

  contentDraft.value = val.slice(0, s) + replacement + val.slice(e)
  nextTick(() => { ta.selectionStart = s; ta.selectionEnd = s + replacement.length })
}

function onKeydown(e: KeyboardEvent) {
  if (e.ctrlKey && e.key === 's') { e.preventDefault(); manualSave() }
  if (e.ctrlKey && e.key === '/') { e.preventDefault(); toggleComment() }
}

// ── Copy script text ──────────────────────────────────────────────────────────
const copied = ref(false)
async function copyScript() {
  if (!scriptText.value) return
  await navigator.clipboard.writeText(scriptText.value)
  copied.value = true
  setTimeout(() => { copied.value = false }, 1500)
}

// ── TTS sidebar ───────────────────────────────────────────────────────────────
const ttsOpen   = ref(false)
const ttsVoice  = ref('af_heart')
const ttsSpeed  = ref(1.0)
const ttsDevice = ref<'auto' | 'gpu' | 'cpu'>('auto')

watch(activeDevice, dev => {
  if (dev && dev !== ttsDevice.value && ttsDevice.value !== 'auto') ttsDevice.value = dev
})
watch(hasGpu, (gpu) => {
  if (gpu === false && ttsDevice.value === 'gpu') ttsDevice.value = 'auto'
})
async function onTtsDeviceChange(val: 'auto' | 'gpu' | 'cpu') {
  ttsDevice.value = val
  await setDevice(val)
}

const ttsDeviceOptions = computed((): Array<'auto' | 'gpu' | 'cpu'> =>
  hasGpu.value === false ? ['auto', 'cpu'] : ['auto', 'gpu', 'cpu'],
)

const americanFemale = KOKORO_VOICES.filter(v => v.accent === 'american' && v.gender === 'female')
const americanMale   = KOKORO_VOICES.filter(v => v.accent === 'american' && v.gender === 'male')
const britishFemale  = KOKORO_VOICES.filter(v => v.accent === 'british'  && v.gender === 'female')
const britishMale    = KOKORO_VOICES.filter(v => v.accent === 'british'  && v.gender === 'male')

const canSpeak = computed(
  () => scriptText.value.trim().length > 0 && !generating.value && !initializing.value,
)

const ttsStatusLabel = computed(() => {
  if (initializing.value) return initStatus.value || 'Loading…'
  if (activeDevice.value === 'gpu') return 'WebGPU'
  if (activeDevice.value === 'cpu') return 'CPU'
  return null
})

const audioDurationSec = computed(() => {
  if (!audioBuffer.value) return 0
  return ((audioBuffer.value.byteLength - 44) / 2) / sampleRate.value
})

function speakPage() {
  if (!canSpeak.value) return
  if (!activeDevice.value && !initializing.value) init()
  generate(scriptText.value, ttsVoice.value, ttsSpeed.value)
}

watch(audioBuffer, async buf => {
  if (!buf || !elapsedMs.value) return
  await addHistory({
    timestamp: Date.now(),
    text:      lastGenText.value,
    voice:     lastGenVoice.value,
    speed:     lastGenSpeed.value,
    device:    (genDevice.value || 'cpu') as 'gpu' | 'cpu',
    elapsedMs: elapsedMs.value,
    duration:  audioDurationSec.value,
    wav:       buf,
  })
})

function onSendToTts() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  if (activePage.value) update(activePage.value.id, { title: titleDraft.value, content: contentDraft.value })
  sendToTts?.(scriptText.value)
}

onUnmounted(() => {
  if (saveTimer) clearTimeout(saveTimer)
  if (statusTimer) clearTimeout(statusTimer)
  if (activePage.value) update(activePage.value.id, { title: titleDraft.value, content: contentDraft.value })
})
</script>

<template>
  <div class="flex h-full w-full min-h-0">

    <!-- ── Scripts sidebar ───────────────────────────────────────────── -->
    <aside class="flex w-48 flex-shrink-0 flex-col border-r border-white/5 bg-surface">

      <!-- Header -->
      <div class="flex items-center justify-between border-b border-white/5 px-3 py-2.5">
        <div class="flex items-center gap-1.5">
          <svg class="h-3 w-3 text-accent/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <span class="text-[10px] font-semibold uppercase tracking-widest text-faded">Scripts</span>
        </div>
        <!-- New folder only — scripts are created inside a folder -->
        <button type="button" title="New project folder"
          class="flex h-5 w-5 items-center justify-center rounded text-faded transition-ui hover:bg-subtle hover:text-secondary"
          @click="createFolder()">
          <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 10.5v6m3-3H9m4.06-7.19l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
          </svg>
        </button>
      </div>

      <!-- Tree list -->
      <div class="flex-1 overflow-y-auto py-1">

        <!-- Folders first -->
        <div v-for="folder in folders" :key="folder.id">
          <!-- Folder row -->
          <div class="group flex items-center gap-1 px-2 py-1.5 cursor-pointer hover:bg-subtle/40 transition-ui"
            @click="toggleFolder(folder.id)">
            <!-- Chevron -->
            <svg class="h-3 w-3 flex-shrink-0 text-faded/40 transition-transform duration-150"
              :class="folder.collapsed ? '' : 'rotate-90'"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
            <!-- Folder icon -->
            <svg class="h-3.5 w-3.5 flex-shrink-0 text-warn/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v8.25m19.5 0v.193a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25v-.193" />
            </svg>
            <!-- Folder name / inline edit -->
            <input v-if="editingFolderId === folder.id"
              ref="folderInputRef"
              v-model="folderDraft"
              class="flex-1 min-w-0 bg-overlay rounded px-1 text-[11px] text-secondary focus:outline-none focus:ring-1 focus:ring-accent/50"
              @click.stop
              @blur="commitFolderRename(folder.id)"
              @keydown.enter.stop="commitFolderRename(folder.id)"
              @keydown.esc.stop="editingFolderId = null" />
            <span v-else class="flex-1 min-w-0 truncate text-[11px] font-medium text-secondary">
              {{ folder.name }}
            </span>
            <!-- Folder actions (visible on hover) -->
            <div class="hidden group-hover:flex items-center gap-0.5 ml-auto flex-shrink-0">
              <!-- Add script inside folder (dropdown) -->
              <div class="relative">
                <button type="button" title="New script in project"
                  class="h-4 w-4 flex items-center justify-center rounded text-faded hover:text-secondary"
                  @click.stop="openFolderDropdown(folder.id, $event)">
                  <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </button>
                <Transition name="fade">
                  <div v-if="folderDropdownId === folder.id"
                    class="absolute left-0 top-5 z-50 w-36 rounded-xl border border-white/10 bg-surface/95 py-1.5 shadow-2xl backdrop-blur-md"
                    @mouseleave="closeFolderDropdown">
                    <button type="button"
                      class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-secondary hover:bg-subtle/80 transition-colors"
                      @click.stop="createInFolder(folder.id)">
                      <svg class="h-3 w-3 flex-shrink-0 text-faded/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                      Script / Text
                    </button>
                  </div>
                </Transition>
              </div>
              <!-- Rename -->
              <button type="button" title="Rename"
                class="h-4 w-4 flex items-center justify-center rounded text-faded hover:text-secondary"
                @click.stop="startEditFolder(folder, $event)">
                <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                </svg>
              </button>
              <!-- Delete folder -->
              <button type="button"
                class="h-4 w-4 flex items-center justify-center rounded transition-ui"
                :class="deleteFolderConfirmId === folder.id ? 'bg-err/20 text-err text-[8px] font-bold w-auto px-1' : 'text-faded hover:text-err'"
                :title="deleteFolderConfirmId === folder.id ? 'Click again to confirm' : 'Delete folder'"
                @click.stop="requestDeleteFolder(folder.id, $event)">
                <template v-if="deleteFolderConfirmId === folder.id">Sure?</template>
                <svg v-else class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Scripts inside folder -->
          <div v-if="!folder.collapsed" class="pl-4">
            <button v-for="page in folderPages(folder.id)" :key="page.id" type="button"
              class="group relative w-full pl-3 pr-2 py-1.5 text-left transition-ui"
              :class="page.id === activeId ? 'bg-accent/15' : 'hover:bg-subtle/60'"
              @click="selectPage(page)">
              <p class="truncate text-[11px] font-medium leading-tight pr-5"
                :class="page.id === activeId ? 'text-accent' : 'text-secondary'">
                {{ page.title || 'Untitled' }}
              </p>
              <span class="text-[10px] tabular-nums text-faded">{{ pageScriptWords(page).toLocaleString() }}w</span>
              <span
                class="absolute right-1.5 top-1/2 -translate-y-1/2 h-4 w-4 items-center justify-center rounded transition-ui hidden group-hover:flex text-faded hover:text-err"
                @click.stop="requestDelete(page.id, $event)">
                <svg class="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </span>
            </button>
            <p v-if="folderPages(folder.id).length === 0" class="px-3 py-1.5 text-[10px] text-faded/30 italic">Empty</p>
          </div>
        </div>

        <!-- Loose pages (no folder) -->
        <div v-if="folders.length > 0 && loosePages.length > 0"
          class="mt-1 border-t border-white/5 pt-1">
          <p class="px-3 pb-1 text-[9px] font-semibold uppercase tracking-widest text-faded/30">Loose Scripts</p>
        </div>
        <button v-for="page in loosePages" :key="page.id" type="button"
          class="group relative w-full px-3 py-2 text-left transition-ui"
          :class="page.id === activeId ? 'bg-accent/15' : 'hover:bg-subtle/60'"
          @click="selectPage(page)">
          <p class="truncate text-[12px] font-medium leading-tight pr-5"
            :class="page.id === activeId ? 'text-accent' : 'text-secondary'">
            {{ page.title || 'Untitled' }}
          </p>
          <div class="mt-0.5 flex items-center gap-1">
            <span class="text-[10px] tabular-nums text-faded">{{ pageScriptWords(page).toLocaleString() }}w</span>
            <span class="text-[10px] text-faded/30">·</span>
            <span class="text-[10px] text-faded">{{ relTime(page.updatedAt) }}</span>
          </div>
          <span
            class="absolute right-1.5 top-1/2 -translate-y-1/2 h-5 w-5 items-center justify-center rounded hidden group-hover:flex text-faded hover:bg-err/20 hover:text-err transition-ui"
            @click.stop="requestDelete(page.id, $event)">
            <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </span>
        </button>
      </div>

      <!-- Syntax legend -->
      <div class="border-t border-white/5 px-3 py-2.5 space-y-1.5">
        <p class="text-[9px] font-semibold uppercase tracking-widest text-faded/40">Syntax</p>
        <div class="flex items-center gap-1.5">
          <span class="legend-comment font-mono text-[10px]">@ note !@</span>
          <span class="text-[10px] text-faded/50">inline comment</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="legend-section font-mono text-[10px]">=== title</span>
          <span class="text-[10px] text-faded/50">section break</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="text-[10px] text-faded/40 font-mono">Ctrl+/</span>
          <span class="text-[10px] text-faded/50">toggle comment</span>
        </div>
      </div>
    </aside>

    <!-- ── Editor ─────────────────────────────────────────────────────── -->
    <div v-if="activePage" class="flex min-h-0 flex-1 flex-col bg-overlay">

      <!-- Header bar -->
      <div class="flex flex-shrink-0 items-center gap-3 border-b border-white/5 bg-surface/30 px-4 py-2">
        <input v-model="titleDraft"
          class="flex-1 bg-transparent text-[14px] font-semibold text-primary placeholder:text-faded/40 focus:outline-none"
          placeholder="Script title…" maxlength="120" />

        <div class="flex items-center gap-1.5">
          <!-- Save indicator -->
          <button type="button"
            class="flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-ui"
            :class="saveStatus === 'saved' ? 'text-ok' : 'text-faded hover:text-secondary'"
            title="Save (Ctrl+S)" @click="manualSave">
            <svg v-if="saveStatus !== 'saved'" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
            </svg>
            <svg v-else class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            {{ saveStatus === 'saved' ? 'Saved' : 'Save' }}
          </button>

          <span class="h-4 w-px bg-white/10" />

          <!-- Copy script text -->
          <button type="button"
            class="flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] transition-ui"
            :class="copied ? 'text-ok' : 'text-faded hover:text-secondary'"
            title="Copy script text (comments excluded)" @click="copyScript">
            <svg v-if="!copied" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
            </svg>
            <svg v-else class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            {{ copied ? 'Copied!' : 'Copy' }}
          </button>

          <!-- Send to TTS panel -->
          <button v-if="scriptText.trim()" type="button"
            class="flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] text-faded transition-ui hover:text-secondary"
            title="Send to TTS panel" @click="onSendToTts">
            <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
            Send to TTS
          </button>

          <span class="h-4 w-px bg-white/10" />

          <!-- Generate sidebar toggle -->
          <button type="button"
            class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-ui"
            :class="ttsOpen ? 'bg-accent text-white shadow-button' : 'bg-accent/15 text-accent hover:bg-accent hover:text-white'"
            @click="ttsOpen = !ttsOpen">
            <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
            Generate
          </button>
        </div>
      </div>

      <!-- Editor row -->
      <div class="flex min-h-0 flex-1 overflow-hidden">

        <!-- Gutter + text pane -->
        <div class="flex min-h-0 flex-1 overflow-hidden">

          <!-- Line gutter -->
          <div ref="gutterRef"
            class="w-10 flex-shrink-0 select-none overflow-hidden border-r border-white/5 bg-surface/20"
            style="padding-top: 1rem; padding-bottom: 1rem;">
            <div v-for="(mark, i) in gutterMarks" :key="i"
              class="px-2 text-right tabular-nums leading-none"
              style="font-size: 13px; line-height: 1.625;">
              <span v-if="mark === '§'" class="gutter-section">§</span>
              <span v-else-if="mark === '@'" class="gutter-comment">@</span>
              <span v-else-if="mark === null" class="text-faded/10">·</span>
              <span v-else class="text-faded/25">{{ mark }}</span>
            </div>
          </div>

          <!-- Overlay + textarea stacked -->
          <div class="relative flex-1">
            <div ref="highlightRef"
              class="hl-overlay absolute inset-0 overflow-hidden px-4"
              style="font-size: 13px; line-height: 1.625; padding-top: 1rem; padding-bottom: 1rem; font-family: inherit; word-wrap: break-word;"
              v-html="highlightHtml" />

            <textarea ref="textareaRef" v-model="contentDraft"
              class="script-ta absolute inset-0 h-full w-full resize-none bg-transparent px-4 focus:outline-none"
              style="font-size: 13px; line-height: 1.625; padding-top: 1rem; padding-bottom: 1rem; color: transparent; caret-color: rgba(255,255,255,0.85); font-family: inherit;"
              placeholder="Write your script… (@ note !@ for comments, === Title for sections)"
              @scroll="syncScroll"
              @keydown="onKeydown" />
          </div>
        </div>

        <!-- ── TTS sidebar ───────────────────────────────────────────── -->
        <Transition name="tts-sidebar">
          <aside v-if="ttsOpen"
            class="flex w-60 flex-shrink-0 flex-col border-l border-white/5 bg-surface overflow-y-auto">

            <div class="flex flex-shrink-0 items-center justify-between border-b border-white/5 px-3 py-2.5">
              <span class="text-[10px] font-semibold uppercase tracking-widest text-faded">Generate Audio</span>
              <span v-if="ttsStatusLabel" class="text-[10px] font-medium"
                :class="initializing ? 'text-warn' : activeDevice === 'gpu' ? 'text-accent' : 'text-faded'">
                {{ ttsStatusLabel }}
                <span v-if="initProgress > 0" class="opacity-60">{{ initProgress }}%</span>
              </span>
            </div>

            <div class="flex flex-col gap-3 p-3">

              <!-- Script stats card -->
              <div class="rounded-lg border border-white/5 bg-overlay px-3 py-2 space-y-1">
                <div class="flex items-center justify-between text-[11px]">
                  <span class="text-faded">Script words</span>
                  <span class="tabular-nums text-secondary">{{ scriptWords.toLocaleString() }}</span>
                </div>
                <div class="flex items-center justify-between text-[11px]">
                  <span class="text-faded">Est. duration</span>
                  <span class="tabular-nums text-secondary">~{{ fmtEstimate(estimatedSec) }}</span>
                </div>
                <div v-if="estimatedChunks > 1" class="flex items-center justify-between text-[11px]">
                  <span class="text-faded">Parts</span>
                  <span class="tabular-nums text-secondary">{{ estimatedChunks }}</span>
                </div>
                <template v-if="sectionCount > 0 || commentCount > 0">
                  <div class="my-0.5 h-px bg-white/5" />
                  <div v-if="sectionCount > 0" class="flex items-center justify-between text-[11px]">
                    <span class="text-faded">Sections</span>
                    <span class="tabular-nums section-stat">{{ sectionCount }}</span>
                  </div>
                  <div v-if="commentCount > 0" class="flex items-center justify-between text-[11px]">
                    <span class="text-faded">Comments</span>
                    <span class="tabular-nums comment-stat">{{ commentCount }} excluded</span>
                  </div>
                </template>
              </div>

              <!-- Voice -->
              <div>
                <label class="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-faded">Voice</label>
                <select v-model="ttsVoice" class="glass-input w-full cursor-pointer rounded-lg px-2.5 py-1.5 text-[12px] transition-ui">
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
                  <span class="font-mono text-secondary">{{ ttsSpeed.toFixed(1) }}×</span>
                </label>
                <div class="flex h-8 items-center rounded-lg bg-overlay px-2">
                  <input v-model.number="ttsSpeed" type="range" min="0.5" max="2.0" step="0.1" class="w-full cursor-pointer" />
                </div>
              </div>

              <!-- Device -->
              <div>
                <label class="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-faded">
                  <span>Device</span>
                  <span v-if="hasGpu === false" class="text-faded/40 text-[9px]">no GPU</span>
                </label>
                <div class="grid gap-0.5 rounded-lg bg-overlay p-0.5" :class="`grid-cols-${ttsDeviceOptions.length}`">
                  <button v-for="opt in ttsDeviceOptions" :key="opt" type="button"
                    class="rounded-md py-1.5 text-[11px] font-medium capitalize transition-ui"
                    :class="ttsDevice === opt ? 'bg-accent text-white shadow-button' : 'text-faded hover:text-secondary'"
                    :disabled="initializing"
                    @click="onTtsDeviceChange(opt)">
                    {{ opt === 'auto' ? 'Auto' : opt.toUpperCase() }}
                  </button>
                </div>
              </div>

              <!-- Generate button -->
              <button type="button"
                class="flex items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-semibold shadow-button transition-ui"
                :class="canSpeak ? 'bg-accent text-white hover:bg-accent-dark active:scale-[0.98]' : 'cursor-not-allowed bg-subtle text-faded'"
                :disabled="!canSpeak" @click="speakPage">
                <svg v-if="generating" class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <svg v-else class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                </svg>
                <span v-if="generating && genTotal > 1">Part {{ genChunk || 1 }} / {{ genTotal }}</span>
                <span v-else>{{ generating ? 'Generating…' : 'Generate Audio' }}</span>
              </button>

              <Transition name="fade">
                <div v-if="ttsError" class="rounded-lg border border-err/20 bg-err/10 px-2.5 py-2 text-[11px] text-err">{{ ttsError }}</div>
              </Transition>
              <Transition name="fade">
                <div v-if="gpuFallback" class="rounded-lg border border-warn/20 bg-warn/10 px-2.5 py-2 text-[11px] text-warn">
                  GPU fell back to CPU — silent audio detected.
                </div>
              </Transition>

              <!-- Audio ready notice (player is in global drawer) -->
              <Transition name="fade">
                <div v-if="audioBuffer && !generating"
                  class="flex items-center gap-2 rounded-lg border border-ok/15 bg-ok/5 px-2.5 py-2 text-[11px] text-ok">
                  <svg class="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                  Playing in bottom bar
                </div>
              </Transition>
            </div>
          </aside>
        </Transition>
      </div>

      <!-- Metrics footer -->
      <div class="flex flex-shrink-0 items-center justify-between border-t border-white/5 bg-surface/20 px-4 py-1.5">
        <div class="flex items-center gap-3">
          <span class="flex items-center gap-1 text-[11px] text-faded">
            <svg class="h-3 w-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
            </svg>
            {{ scriptWords.toLocaleString() }} words
          </span>
          <span class="flex items-center gap-1 text-[11px] text-faded" title="Estimated audio duration">
            <svg class="h-3 w-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            ~{{ fmtEstimate(estimatedSec) }}
          </span>
          <span v-if="estimatedChunks > 1" class="flex items-center gap-1 text-[11px] text-faded">
            <svg class="h-3 w-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3" />
            </svg>
            {{ estimatedChunks }} parts
          </span>
          <span v-if="sectionCount > 0" class="flex items-center gap-1 text-[11px] section-metric" title="Sections">
            <span class="font-semibold opacity-70">§</span>
            {{ sectionCount }} {{ sectionCount === 1 ? 'section' : 'sections' }}
          </span>
          <span v-if="commentCount > 0" class="flex items-center gap-1 text-[11px] comment-metric" title="Inline comments excluded from audio">
            <svg class="h-3 w-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
            {{ commentCount }} {{ commentCount === 1 ? 'note' : 'notes' }}
          </span>
        </div>
        <span class="text-[11px] transition-colors"
          :class="{ 'text-warn': saveStatus === 'pending', 'text-ok': saveStatus === 'saved', 'text-faded/30': saveStatus === 'idle' }">
          {{ saveStatus === 'pending' ? 'Saving…' : saveStatus === 'saved' ? 'Saved ✓' : 'Auto-saved' }}
        </span>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="flex flex-1 flex-col items-center justify-center gap-3 bg-overlay">
      <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface">
        <svg class="h-7 w-7 text-faded/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      </div>
      <div class="text-center">
        <p class="text-[13px] font-medium text-secondary">No scripts yet</p>
        <p class="mt-0.5 text-[11px] text-faded">Create a script to get started</p>
      </div>
      <button type="button"
        class="mt-1 rounded-xl bg-accent/15 px-4 py-2 text-[12px] font-medium text-accent transition-ui hover:bg-accent hover:text-white"
        @click="create()">
        New Script
      </button>
    </div>

  </div>

  <!-- ── Delete script modal ──────────────────────────────────────────── -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="deleteModalId" class="fixed inset-0 z-50 flex items-center justify-center"
        @click.self="deleteModalId = null">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <div class="relative z-10 w-72 rounded-2xl border border-white/10 bg-surface p-5 shadow-2xl">
          <div class="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-err/15">
            <svg class="h-5 w-5 text-err" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </div>
          <h2 class="text-[14px] font-semibold text-primary">Delete script?</h2>
          <p class="mt-1 text-[12px] text-faded">
            "<span class="text-secondary">{{ deleteModalTitle }}</span>" will be permanently deleted.
          </p>
          <div class="mt-4 flex gap-2">
            <button type="button"
              class="flex-1 rounded-xl border border-white/10 py-2 text-[12px] font-medium text-secondary transition-ui hover:bg-subtle"
              @click="deleteModalId = null">
              Cancel
            </button>
            <button type="button"
              class="flex-1 rounded-xl bg-err py-2 text-[12px] font-semibold text-white shadow-button transition-ui hover:brightness-110 active:scale-[0.98]"
              @click="confirmDelete">
              Delete
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active, .modal-leave-active { transition: opacity 0.15s ease; }
.modal-enter-active .relative.z-10, .modal-leave-active .relative.z-10 { transition: opacity 0.15s ease, transform 0.15s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .relative.z-10, .modal-leave-to .relative.z-10 { opacity: 0; transform: scale(0.95); }
</style>

<style scoped>
/* ── Overlay highlight ──────────────────────────────────────────────────── */
.hl-overlay {
  white-space: pre-wrap;
  word-wrap: break-word;
  pointer-events: none;
  user-select: none;
}
/* Script text — visible */
.hl-overlay :deep(.hl-t) { color: rgba(255, 255, 255, 0.82); }
/* Inline comment @...!@ — violet */
.hl-overlay :deep(.hl-c) { color: rgba(167, 139, 250, 0.65); }
/* Section header === — amber */
.hl-overlay :deep(.hl-s) { color: rgba(251, 191, 36, 0.85); }

/* Textarea text invisible; selection restores visibility */
.script-ta::selection { background-color: rgba(88, 101, 242, 0.45); color: rgba(255,255,255,0.9); }
.script-ta::placeholder { color: rgba(255, 255, 255, 0.18); }

/* Gutter symbols */
.gutter-comment { color: rgba(167, 139, 250, 0.45); font-size: 10px; font-style: italic; }
.gutter-section  { color: rgba(251, 191, 36, 0.55); font-size: 11px; font-weight: 600; }

/* Sidebar legend */
.legend-comment { color: rgba(167, 139, 250, 0.7); }
.legend-section  { color: rgba(251, 191, 36, 0.7); }

/* TTS stats */
.comment-stat  { color: rgba(167, 139, 250, 0.65); }
.section-stat  { color: rgba(251, 191, 36, 0.65); }

/* Footer metrics */
.comment-metric { color: rgba(167, 139, 250, 0.6); }
.section-metric  { color: rgba(251, 191, 36, 0.6); }

/* TTS sidebar slide-in */
.tts-sidebar-enter-active, .tts-sidebar-leave-active {
  transition: width 0.2s ease, opacity 0.2s ease;
  overflow: hidden;
}
.tts-sidebar-enter-from, .tts-sidebar-leave-to { width: 0; opacity: 0; }
.tts-sidebar-enter-to,   .tts-sidebar-leave-from { width: 15rem; opacity: 1; }

/* Generic fade */
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from,   .fade-leave-to     { opacity: 0; }
</style>
