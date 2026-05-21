<script setup lang="ts">
type Panel = 'tts' | 'history' | 'settings'
const active = ref<Panel>('tts')
</script>

<template>
  <div class="flex h-screen flex-col overflow-hidden bg-base">
    <AppTitlebar />

    <div class="flex min-h-0 flex-1">

      <!-- Sidebar -->
      <nav class="flex w-[52px] flex-shrink-0 flex-col items-center gap-1 border-r border-white/5 bg-surface py-3">

        <!-- Logo -->
        <div class="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-sm font-bold text-white shadow-button select-none">
          V
        </div>
        <span class="mb-1 h-px w-7 rounded bg-white/10" />

        <!-- TTS -->
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

        <div class="flex-1" />

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

      <!-- Main area -->
      <main class="flex min-h-0 flex-1 overflow-y-auto bg-overlay">
        <TtsGenerationPanel v-if="active === 'tts'" />
        <HistoryPanel       v-else-if="active === 'history'" />
        <SettingsPanel      v-else-if="active === 'settings'" />
      </main>

    </div>
  </div>
</template>
