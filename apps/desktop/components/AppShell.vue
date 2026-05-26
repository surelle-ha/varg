<script setup lang="ts">
import {
  Brain, BookOpen, Clock, BarChart2, Puzzle, Settings,
} from 'lucide-vue-next'
import { useProfile }  from '~/composables/useProfile'
import { useSettings } from '~/composables/useSettings'
import { useMcp, setupTtsListener } from '~/composables/useMcp'

type Panel = 'profile' | 'notebook' | 'history' | 'monitor' | 'mcp' | 'model' | 'settings'
const active = ref<Panel>('notebook')

const { profile }  = useProfile()
const { settings } = useSettings()
const { autoStart, start: mcpStart } = useMcp()

watch(() => settings.value.showSystemMonitor, show => {
  if (!show && active.value === 'monitor') active.value = 'notebook'
})
watch(() => settings.value.showMcpServer, show => {
  if (!show && active.value === 'mcp') active.value = 'notebook'
})

onMounted(() => {
  if (autoStart.value) mcpStart()
  setupTtsListener()
})

const initials = computed(() => {
  const f = profile.value.firstName?.[0]?.toUpperCase() ?? ''
  const l = profile.value.lastName?.[0]?.toUpperCase() ?? ''
  return (f + l) || '?'
})

const navCls = (id: Panel) =>
  `flex h-9 w-9 items-center justify-center rounded-xl transition-ui ${
    active.value === id
      ? 'bg-accent/20 text-accent'
      : 'text-faded hover:bg-subtle hover:text-secondary'
  }`
</script>

<template>
  <div class="flex h-screen flex-col overflow-hidden bg-base">
    <AppTitlebar />

    <div class="flex min-h-0 flex-1">

      <!-- Sidebar — right-click disabled -->
      <nav
        class="flex w-[52px] flex-shrink-0 flex-col items-center gap-1 border-r border-white/5 bg-surface py-3"
        @contextmenu.prevent
      >
        <!-- Profile avatar -->
        <button type="button" title="Profile"
          class="mb-1 flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 transition-ui"
          :class="active === 'profile' ? 'border-accent shadow-button' : 'border-transparent hover:border-white/20'"
          @click="active = 'profile'">
          <img v-if="profile.avatar" :src="profile.avatar" class="h-full w-full object-cover" />
          <div v-else class="flex h-full w-full select-none items-center justify-center rounded-xl bg-accent text-[12px] font-bold text-white">
            {{ initials }}
          </div>
        </button>
        <span class="mb-1 h-px w-7 rounded bg-white/10" />

        <button type="button" title="Notebook"  :class="navCls('notebook')"  @click="active = 'notebook'">
          <BookOpen class="h-[18px] w-[18px]" />
        </button>

        <span class="h-px w-7 rounded bg-white/10" />

        <button type="button" title="History"   :class="navCls('history')"   @click="active = 'history'">
          <Clock class="h-[18px] w-[18px]" />
        </button>
        <button v-if="settings.showSystemMonitor" type="button" title="System Monitor" :class="navCls('monitor')" @click="active = 'monitor'">
          <BarChart2 class="h-[18px] w-[18px]" />
        </button>
        <button v-if="settings.showMcpServer" type="button" title="MCP Server" :class="navCls('mcp')" @click="active = 'mcp'">
          <Puzzle class="h-[18px] w-[18px]" />
        </button>

        <div class="flex-1" />

        <button type="button" title="AI Model"  :class="navCls('model')"    @click="active = 'model'">
          <Brain class="h-[18px] w-[18px]" />
        </button>
        <button type="button" title="Settings"  :class="navCls('settings')" @click="active = 'settings'">
          <Settings class="h-[18px] w-[18px]" />
        </button>
      </nav>

      <ContextMenu />

      <main class="flex min-h-0 flex-1 overflow-y-auto bg-overlay">
        <ProfilePanel       v-if="active === 'profile'" />
        <NotebookPanel      v-else-if="active === 'notebook'" />
        <HistoryPanel       v-else-if="active === 'history'" />
        <SystemMonitorPanel v-else-if="active === 'monitor'" />
        <McpPanel           v-else-if="active === 'mcp' && settings.showMcpServer" />
        <ModelPanel         v-else-if="active === 'model'" />
        <SettingsPanel      v-else-if="active === 'settings'" />
      </main>
    </div>

    <AudioDrawer />
    <FloatingMonitor v-if="settings.showSystemMonitor" />
    <WelcomeModal />
  </div>
</template>
