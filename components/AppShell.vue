<script setup lang="ts">
import { useProfile } from '~/composables/useProfile'
import { useSettings } from '~/composables/useSettings'

type Panel = 'profile' | 'notebook' | 'tts' | 'history' | 'monitor' | 'model' | 'settings'
const active      = ref<Panel>('tts')
const pendingText = ref<string | null>(null)

const { profile } = useProfile()
const { settings } = useSettings()

watch(() => settings.value.showSystemMonitor, show => {
  if (!show && active.value === 'monitor') active.value = 'tts'
})
const initials = computed(() => {
  const f = profile.value.firstName?.[0]?.toUpperCase() ?? ''
  const l = profile.value.lastName?.[0]?.toUpperCase() ?? ''
  return (f + l) || '?'
})

// Provide to NotebookPanel: switch to TTS with pre-filled text
provide('pendingText', pendingText)
provide('sendToTts', (text: string) => {
  pendingText.value = text
  active.value = 'tts'
})
</script>

<template>
  <div class="flex h-screen flex-col overflow-hidden bg-base">
    <AppTitlebar />

    <div class="flex min-h-0 flex-1">

      <!-- Sidebar -->
      <nav class="flex w-[52px] flex-shrink-0 flex-col items-center gap-1 border-r border-white/5 bg-surface py-3">

        <!-- Profile avatar button -->
        <button
          type="button"
          title="Profile"
          class="mb-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl overflow-hidden border-2 transition-ui"
          :class="active === 'profile'
            ? 'border-accent shadow-button'
            : 'border-transparent hover:border-white/20'"
          @click="active = 'profile'"
        >
          <img
            v-if="profile.avatar"
            :src="profile.avatar"
            class="h-full w-full object-cover"
          />
          <div
            v-else
            class="flex h-full w-full items-center justify-center rounded-xl bg-accent text-[12px] font-bold text-white select-none"
          >{{ initials }}</div>
        </button>
        <span class="mb-1 h-px w-7 rounded bg-white/10" />

        <!-- Notebook -->
        <button
          type="button"
          title="Notebook"
          class="flex h-9 w-9 items-center justify-center rounded-xl transition-ui"
          :class="active === 'notebook' ? 'bg-accent/20 text-accent' : 'text-faded hover:bg-subtle hover:text-secondary'"
          @click="active = 'notebook'"
        >
          <svg class="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
        </button>

        <span class="h-px w-7 rounded bg-white/10" />

        <!-- TTS Generate -->
        <button
          type="button"
          title="Generate"
          class="flex h-9 w-9 items-center justify-center rounded-xl transition-ui"
          :class="active === 'tts' ? 'bg-accent/20 text-accent' : 'text-faded hover:bg-subtle hover:text-secondary'"
          @click="active = 'tts'"
        >
          <svg class="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
          </svg>
        </button>

        <!-- History -->
        <button
          type="button"
          title="History"
          class="flex h-9 w-9 items-center justify-center rounded-xl transition-ui"
          :class="active === 'history' ? 'bg-accent/20 text-accent' : 'text-faded hover:bg-subtle hover:text-secondary'"
          @click="active = 'history'"
        >
          <svg class="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>

        <!-- System Monitor (optional feature) -->
        <button
          v-if="settings.showSystemMonitor"
          type="button"
          title="System Monitor"
          class="flex h-9 w-9 items-center justify-center rounded-xl transition-ui"
          :class="active === 'monitor' ? 'bg-accent/20 text-accent' : 'text-faded hover:bg-subtle hover:text-secondary'"
          @click="active = 'monitor'"
        >
          <svg class="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
        </button>

        <div class="flex-1" />

        <!-- Model / AI -->
        <button
          type="button"
          title="AI Model"
          class="flex h-9 w-9 items-center justify-center rounded-xl transition-ui"
          :class="active === 'model' ? 'bg-accent/20 text-accent' : 'text-faded hover:bg-subtle hover:text-secondary'"
          @click="active = 'model'"
        >
          <svg class="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
          </svg>
        </button>

        <!-- Settings -->
        <button
          type="button"
          title="Settings"
          class="flex h-9 w-9 items-center justify-center rounded-xl transition-ui"
          :class="active === 'settings' ? 'bg-accent/20 text-accent' : 'text-faded hover:bg-subtle hover:text-secondary'"
          @click="active = 'settings'"
        >
          <svg class="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </nav>

      <!-- Custom context menu (global) -->
      <ContextMenu />

      <!-- Main area -->
      <main class="flex min-h-0 flex-1 overflow-y-auto bg-overlay">
        <ProfilePanel       v-if="active === 'profile'" />
        <NotebookPanel      v-else-if="active === 'notebook'" />
        <TtsGenerationPanel v-else-if="active === 'tts'" />
        <HistoryPanel       v-else-if="active === 'history'" />
        <SystemMonitorPanel v-else-if="active === 'monitor'" />
        <ModelPanel         v-else-if="active === 'model'" />
        <SettingsPanel      v-else-if="active === 'settings'" />
      </main>

    </div>

    <!-- Global audio drawer — sits below all panels -->
    <AudioDrawer />

    <!-- Floating system monitor widget (only when feature is enabled) -->
    <FloatingMonitor v-if="settings.showSystemMonitor" />
  </div>
</template>
