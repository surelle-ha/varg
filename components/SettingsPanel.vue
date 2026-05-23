<script setup lang="ts">
import { useHistory } from '~/composables/useHistory'
import { useSettings } from '~/composables/useSettings'
import { useKokoro, KOKORO_VOICES } from '~/composables/useKokoro'

const { settings, setMaxChars, setDefaultVoice, setShowSystemMonitor } = useSettings()
const { reset: resetKokoro } = useKokoro()
const { clear: clearHistory } = useHistory()

// ── General drafts ─────────────────────────────────────────────────────────────
const maxCharsDraft = ref(settings.value.maxChars)
watch(() => settings.value.maxChars, v => { maxCharsDraft.value = v })

function commitMaxChars() {
  const n = Number(maxCharsDraft.value)
  if (!isNaN(n)) setMaxChars(n)
}

const voiceGroups = [
  { label: 'American — Female', voices: KOKORO_VOICES.filter(v => v.accent === 'american' && v.gender === 'female') },
  { label: 'American — Male',   voices: KOKORO_VOICES.filter(v => v.accent === 'american' && v.gender === 'male') },
  { label: 'British — Female',  voices: KOKORO_VOICES.filter(v => v.accent === 'british'  && v.gender === 'female') },
  { label: 'British — Male',    voices: KOKORO_VOICES.filter(v => v.accent === 'british'  && v.gender === 'male') },
]

// ── Danger zone modal ─────────────────────────────────────────────────────────
interface DangerAction {
  title: string
  body: string
  action: () => void | Promise<void>
}

const dangerModal = ref<DangerAction | null>(null)

async function executeDanger() {
  if (!dangerModal.value) return
  await dangerModal.value.action()
  dangerModal.value = null
}

function dangerClearHistory() {
  dangerModal.value = {
    title: 'Clear generation history',
    body: 'All saved audio will be permanently removed from IndexedDB. This cannot be undone.',
    action: () => clearHistory(),
  }
}

function dangerClearNotebook() {
  dangerModal.value = {
    title: 'Clear notebook pages',
    body: 'All scripts and folders will be permanently deleted from local storage. The app will reload.',
    action: () => {
      localStorage.removeItem('varg-notebook')
      localStorage.removeItem('varg-notebook-folders')
      window.location.reload()
    },
  }
}

function dangerClearModels() {
  dangerModal.value = {
    title: 'Delete model cache',
    body: 'All downloaded model and voice files will be removed. You will need to re-download them from the AI Model page before generating audio again.',
    action: async () => {
      await caches.delete('transformers-cache')
      await caches.delete('kokoro-voices')
      resetKokoro()
    },
  }
}

function dangerResetAll() {
  dangerModal.value = {
    title: 'Reset all app data',
    body: 'This will permanently erase your history, notebook, model cache, settings, and profile. The app will reload. This cannot be undone.',
    action: async () => {
      await clearHistory()
      await caches.delete('transformers-cache')
      await caches.delete('kokoro-voices')
      resetKokoro()
      localStorage.clear()
      window.location.reload()
    },
  }
}
</script>

<template>
  <div class="mx-auto flex h-full w-full max-w-2xl flex-col gap-4 overflow-y-auto p-4">

    <!-- Header -->
    <div>
      <h1 class="text-[13px] font-semibold uppercase tracking-widest text-secondary">Settings</h1>
      <p class="mt-0.5 text-[11px] text-faded">General preferences &amp; data management</p>
    </div>

    <!-- Experimental notice -->
    <div class="flex items-start gap-2.5 rounded-xl border border-warn/20 bg-warn/5 px-3.5 py-3">
      <svg class="mt-0.5 h-4 w-4 flex-shrink-0 text-warn/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
      <div class="min-w-0">
        <p class="text-[12px] font-semibold text-warn/90">Experimental Phase</p>
        <p class="mt-0.5 text-[11px] leading-relaxed text-warn/60">
          This application is still in active development. Some features may be incomplete or behave unexpectedly. Use with care and report issues as you encounter them.
        </p>
      </div>
    </div>

    <!-- ── General ─────────────────────────────────────────────────────────── -->
    <div class="glass-panel rounded-xl p-4 space-y-4">
      <h2 class="text-[12px] font-semibold text-secondary">General</h2>

      <!-- Max characters -->
      <div class="flex items-center justify-between gap-4">
        <div class="min-w-0">
          <p class="text-[12px] text-secondary">Max input characters</p>
          <p class="mt-0.5 text-[11px] text-faded">Character limit for TTS text input (100–50,000)</p>
        </div>
        <div class="flex flex-shrink-0 items-center gap-2">
          <input
            v-model.number="maxCharsDraft"
            type="number" min="100" max="50000" step="500"
            class="w-24 rounded-lg border border-white/10 bg-surface px-2.5 py-1.5 text-right text-[12px] tabular-nums text-secondary focus:border-accent/50 focus:outline-none"
            @blur="commitMaxChars"
            @keydown.enter="commitMaxChars"
          />
          <button type="button"
            class="rounded-lg bg-accent/15 px-2.5 py-1.5 text-[11px] font-medium text-accent transition-ui hover:bg-accent hover:text-white"
            @click="commitMaxChars">
            Save
          </button>
        </div>
      </div>

      <div class="h-px bg-white/5" />

      <!-- Default voice -->
      <div class="flex items-center justify-between gap-4">
        <div class="min-w-0">
          <p class="text-[12px] text-secondary">Default voice</p>
          <p class="mt-0.5 text-[11px] text-faded">Voice selected when the TTS page is opened</p>
        </div>
        <select
          :value="settings.defaultVoice"
          class="glass-input w-44 cursor-pointer rounded-lg px-2.5 py-1.5 text-[12px] transition-ui"
          @change="setDefaultVoice(($event.target as HTMLSelectElement).value)">
          <optgroup v-for="g in voiceGroups" :key="g.label" :label="g.label">
            <option v-for="v in g.voices" :key="v.id" :value="v.id">{{ v.name }}</option>
          </optgroup>
        </select>
      </div>
    </div>

    <!-- ── Features ───────────────────────────────────────────────────────── -->
    <div class="glass-panel rounded-xl p-4 space-y-4">
      <h2 class="text-[12px] font-semibold text-secondary">Features</h2>

      <!-- System Monitor -->
      <div class="flex items-center justify-between gap-4">
        <div class="min-w-0">
          <p class="text-[12px] text-secondary">System Monitor</p>
          <p class="mt-0.5 text-[11px] text-faded">Show hardware &amp; memory monitor in the sidebar</p>
        </div>
        <button type="button"
          class="relative flex-shrink-0 h-5 w-9 rounded-full transition-colors duration-200"
          :class="settings.showSystemMonitor ? 'bg-accent' : 'bg-subtle'"
          @click="setShowSystemMonitor(!settings.showSystemMonitor)">
          <span class="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200"
            :class="settings.showSystemMonitor ? 'translate-x-4' : 'translate-x-0'" />
        </button>
      </div>
    </div>

    <!-- ── Danger zone ─────────────────────────────────────────────────────── -->
    <div class="rounded-xl border border-err/20 p-4 space-y-3">
      <div>
        <h2 class="text-[12px] font-semibold text-err">Danger Zone</h2>
        <p class="mt-0.5 text-[11px] text-faded">These actions are irreversible.</p>
      </div>

      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-[12px] text-secondary">Clear generation history</p>
            <p class="text-[11px] text-faded">Removes all saved audio from IndexedDB</p>
          </div>
          <button type="button"
            class="ml-4 flex-shrink-0 rounded-lg border border-err/30 px-3 py-1.5 text-[11px] font-medium text-err transition-ui hover:bg-err/10"
            @click="dangerClearHistory">Clear History</button>
        </div>

        <div class="flex items-center justify-between">
          <div>
            <p class="text-[12px] text-secondary">Clear notebook pages</p>
            <p class="text-[11px] text-faded">Deletes all scripts and folders from localStorage</p>
          </div>
          <button type="button"
            class="ml-4 flex-shrink-0 rounded-lg border border-err/30 px-3 py-1.5 text-[11px] font-medium text-err transition-ui hover:bg-err/10"
            @click="dangerClearNotebook">Clear Notebook</button>
        </div>

        <div class="flex items-center justify-between">
          <div>
            <p class="text-[12px] text-secondary">Delete model cache</p>
            <p class="text-[11px] text-faded">Removes all downloaded model &amp; voice files</p>
          </div>
          <button type="button"
            class="ml-4 flex-shrink-0 rounded-lg border border-err/30 px-3 py-1.5 text-[11px] font-medium text-err transition-ui hover:bg-err/10"
            @click="dangerClearModels">Delete Models</button>
        </div>

        <div class="flex items-center justify-between border-t border-err/10 pt-2">
          <div>
            <p class="text-[12px] font-semibold text-err">Reset all app data</p>
            <p class="text-[11px] text-faded">Clears history, notebook, models, and profile</p>
          </div>
          <button type="button"
            class="ml-4 flex-shrink-0 rounded-lg border border-err/50 px-3 py-1.5 text-[11px] font-semibold text-err transition-ui hover:bg-err/10"
            @click="dangerResetAll">Reset All</button>
        </div>
      </div>
    </div>

    <div class="h-1 flex-shrink-0" />
  </div>

  <!-- ── Danger confirmation modal ─────────────────────────────────────────── -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="dangerModal"
        class="fixed inset-0 z-[9998] flex items-center justify-center"
        @click.self="dangerModal = null">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <div class="relative z-10 w-80 rounded-2xl border border-err/20 bg-surface p-5 shadow-2xl">
          <div class="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-err/15">
            <svg class="h-5 w-5 text-err" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h2 class="text-[14px] font-semibold text-primary">{{ dangerModal.title }}</h2>
          <p class="mt-1.5 text-[12px] leading-relaxed text-faded">{{ dangerModal.body }}</p>
          <div class="mt-4 flex gap-2">
            <button type="button"
              class="flex-1 rounded-xl border border-white/10 py-2 text-[12px] font-medium text-secondary transition-ui hover:bg-subtle"
              @click="dangerModal = null">
              Cancel
            </button>
            <button type="button"
              class="flex-1 rounded-xl bg-err py-2 text-[12px] font-semibold text-white shadow-button transition-ui hover:brightness-110 active:scale-[0.98]"
              @click="executeDanger">
              Confirm
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
