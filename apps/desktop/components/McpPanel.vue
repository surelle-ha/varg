<script setup lang="ts">
import { useMcp } from '~/composables/useMcp'

const { running, port, autoStart, error, starting, serverUrl, start, stop, setPort, setAutoStart, refresh } = useMcp()

const portDraft = ref(port.value)
watch(port, v => { portDraft.value = v })

const copied = ref(false)

async function toggle() {
  if (running.value) {
    await stop()
  } else {
    await start(portDraft.value)
  }
}

function commitPort() {
  const p = Math.max(1024, Math.min(65535, Math.round(portDraft.value)))
  portDraft.value = p
  setPort(p)
}

async function copyUrl() {
  await navigator.clipboard.writeText(serverUrl.value)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

const claudeConfig = computed(() => JSON.stringify({
  mcpServers: {
    varg: {
      url: serverUrl.value,
    },
  },
}, null, 2))

const copiedConfig = ref(false)
async function copyConfig() {
  await navigator.clipboard.writeText(claudeConfig.value)
  copiedConfig.value = true
  setTimeout(() => { copiedConfig.value = false }, 2000)
}

const tools = [
  {
    name: 'generate_speech',
    desc: 'Convert text to speech using Varg\'s offline Kokoro TTS engine. Returns base64-encoded WAV audio. Varg must be open with the TTS model loaded.',
    params: [
      { name: 'text',     type: 'string', required: true,  desc: 'Text to synthesize (max 5 000 chars)' },
      { name: 'voice_id', type: 'string', required: false, desc: 'Voice ID — see list_voices. Default: af_heart' },
      { name: 'speed',    type: 'number', required: false, desc: 'Speech speed multiplier (0.5 – 2.0, default 1.0)' },
    ],
  },
  {
    name: 'list_voices',
    desc: 'List all available Kokoro TTS voices (American & British, male & female).',
    params: [],
  },
  {
    name: 'get_history',
    desc: 'Return recent speech generations made via MCP. Each entry includes the text, voice, file path of the saved WAV, and timestamp.',
    params: [
      { name: 'limit', type: 'integer', required: false, desc: 'Max entries to return (1–20, default 10)' },
    ],
  },
]

onMounted(() => refresh())
</script>

<template>
  <div class="mx-auto flex h-full w-full max-w-2xl flex-col gap-4 overflow-y-auto p-4">

    <!-- Header -->
    <div class="flex items-center justify-between gap-3">
      <div>
        <h1 class="text-[13px] font-semibold uppercase tracking-widest text-secondary">MCP Server</h1>
        <p class="mt-0.5 text-[11px] text-faded">Model Context Protocol · agents can call Varg TTS</p>
      </div>
      <div class="flex items-center gap-2 rounded-lg px-2.5 py-1 text-[11px] font-medium"
        :class="running ? 'bg-ok/10 text-ok' : 'bg-subtle text-faded'">
        <span class="h-[6px] w-[6px] rounded-full" :class="running ? 'bg-ok' : 'bg-faded'" />
        {{ running ? 'Running' : 'Stopped' }}
      </div>
    </div>

    <!-- Server control card -->
    <div class="glass-panel rounded-xl p-4 space-y-4">
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-[12px] font-semibold text-secondary">Local HTTP Server</p>
          <p class="mt-0.5 text-[11px] text-faded">Listens on 127.0.0.1 only — not exposed to the network</p>
        </div>

        <!-- Toggle -->
        <button type="button"
          class="flex items-center gap-2 rounded-xl px-4 py-2 text-[12px] font-semibold shadow-button transition-ui min-w-[88px] justify-center"
          :class="running
            ? 'bg-subtle text-secondary hover:bg-err/10 hover:text-err'
            : 'bg-accent text-white hover:bg-accent-dark'"
          :disabled="starting"
          @click="toggle">
          <svg v-if="starting" class="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {{ starting ? 'Starting…' : running ? 'Stop' : 'Start' }}
        </button>
      </div>

      <!-- Port config (only when stopped) -->
      <div v-if="!running" class="flex items-center justify-between gap-4">
        <div class="min-w-0">
          <p class="text-[12px] text-secondary">Port</p>
          <p class="mt-0.5 text-[11px] text-faded">1024–65535 · default 3700</p>
        </div>
        <div class="flex items-center gap-2">
          <input
            v-model.number="portDraft"
            type="number" min="1024" max="65535"
            class="w-24 rounded-lg border border-white/10 bg-surface px-2.5 py-1.5 text-right text-[12px] tabular-nums text-secondary focus:border-accent/50 focus:outline-none"
            @blur="commitPort"
            @keydown.enter="commitPort"
          />
        </div>
      </div>

      <!-- URL display (when running) -->
      <div v-if="running" class="flex items-center justify-between gap-3 rounded-lg bg-ok/5 border border-ok/15 px-3.5 py-2.5">
        <div class="min-w-0">
          <p class="text-[10px] font-semibold uppercase tracking-widest text-ok/60">Endpoint</p>
          <p class="mt-0.5 truncate font-mono text-[12px] text-ok">{{ serverUrl }}</p>
        </div>
        <button type="button"
          class="flex-shrink-0 rounded-lg border border-ok/20 px-2.5 py-1 text-[11px] font-medium text-ok transition-ui hover:bg-ok/10"
          @click="copyUrl">
          {{ copied ? 'Copied!' : 'Copy' }}
        </button>
      </div>

      <!-- Auto-start toggle -->
      <div class="flex items-center justify-between gap-4 border-t border-white/5 pt-3">
        <div class="min-w-0">
          <p class="text-[12px] text-secondary">Auto-start on launch</p>
          <p class="mt-0.5 text-[11px] text-faded">Start MCP server automatically when Varg opens</p>
        </div>
        <button type="button"
          class="relative flex-shrink-0 h-5 w-9 rounded-full transition-colors duration-200"
          :class="autoStart ? 'bg-accent' : 'bg-subtle'"
          @click="setAutoStart(!autoStart)">
          <span class="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200"
            :class="autoStart ? 'translate-x-4' : 'translate-x-0'" />
        </button>
      </div>
    </div>

    <!-- Error -->
    <Transition name="fade">
      <div v-if="error" class="rounded-xl border border-err/20 bg-err/10 px-4 py-3 text-[12px] text-err">
        {{ error }}
      </div>
    </Transition>

    <!-- Tools -->
    <div class="glass-panel rounded-xl p-4 space-y-3">
      <h2 class="text-[12px] font-semibold text-secondary">Available Tools</h2>

      <div v-for="tool in tools" :key="tool.name" class="rounded-lg bg-white/[0.03] border border-white/5 p-3.5 space-y-2.5">
        <div>
          <p class="font-mono text-[12px] font-semibold text-accent">{{ tool.name }}</p>
          <p class="mt-0.5 text-[11px] leading-relaxed text-faded">{{ tool.desc }}</p>
        </div>
        <div v-if="tool.params.length" class="space-y-1.5">
          <div v-for="p in tool.params" :key="p.name" class="flex items-start gap-2">
            <span class="font-mono text-[11px] text-secondary">{{ p.name }}</span>
            <span class="rounded px-1 py-px text-[9px] font-semibold uppercase"
              :class="p.required ? 'bg-accent/15 text-accent' : 'bg-subtle text-faded'">
              {{ p.required ? 'required' : 'optional' }}
            </span>
            <span class="text-[11px] text-faded">{{ p.desc }}</span>
          </div>
        </div>
        <p v-else class="text-[11px] text-faded/50 italic">No parameters</p>
      </div>
    </div>

    <!-- Client setup guide -->
    <div class="glass-panel rounded-xl p-4 space-y-3">
      <h2 class="text-[12px] font-semibold text-secondary">Connect an Agent</h2>
      <p class="text-[11px] leading-relaxed text-faded">
        Any MCP-compatible client (Claude, Codex, Cursor, etc.) can connect over HTTP. Add the following to your client's MCP config.
      </p>

      <!-- HTTP config -->
      <div class="rounded-lg bg-[#0d0e10] border border-white/5">
        <div class="flex items-center justify-between border-b border-white/5 px-3.5 py-2">
          <span class="font-mono text-[10px] text-faded">mcp config · mcpServers block</span>
          <button type="button" class="text-[11px] text-accent hover:text-accent-dark transition-ui" @click="copyConfig">
            {{ copiedConfig ? 'Copied!' : 'Copy' }}
          </button>
        </div>
        <pre class="overflow-x-auto p-3.5 text-[11px] leading-relaxed text-secondary font-mono">{{ claudeConfig }}</pre>
      </div>

      <div class="rounded-lg border border-warn/15 bg-warn/5 px-3.5 py-3 space-y-1">
        <p class="text-[11px] font-semibold text-warn/80">Prerequisites</p>
        <ul class="space-y-0.5 text-[11px] text-faded list-disc list-inside">
          <li>Varg must be open with the MCP server running before connecting</li>
          <li>TTS models must be installed (AI Model page) for <code class="font-mono text-secondary">generate_speech</code></li>
          <li>The sherpa-onnx runtime must be present in the Varg installation</li>
        </ul>
      </div>
    </div>

    <!-- Protocol info -->
    <div class="glass-panel rounded-xl p-4 space-y-2">
      <h2 class="text-[12px] font-semibold text-secondary">Protocol</h2>
      <div class="grid grid-cols-2 gap-2 text-[11px]">
        <div class="rounded-lg bg-white/[0.03] px-3 py-2 space-y-0.5">
          <p class="text-faded">Transport</p>
          <p class="font-mono text-secondary">HTTP (Streamable)</p>
        </div>
        <div class="rounded-lg bg-white/[0.03] px-3 py-2 space-y-0.5">
          <p class="text-faded">Protocol</p>
          <p class="font-mono text-secondary">JSON-RPC 2.0</p>
        </div>
        <div class="rounded-lg bg-white/[0.03] px-3 py-2 space-y-0.5">
          <p class="text-faded">MCP Version</p>
          <p class="font-mono text-secondary">2024-11-05</p>
        </div>
        <div class="rounded-lg bg-white/[0.03] px-3 py-2 space-y-0.5">
          <p class="text-faded">Endpoint</p>
          <p class="font-mono text-secondary">POST /mcp</p>
        </div>
      </div>
    </div>

    <div class="h-1 flex-shrink-0" />
  </div>
</template>
