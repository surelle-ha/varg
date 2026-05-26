<script setup lang="ts">
import {
  Wifi, WifiOff, RefreshCw, ChevronDown, Sparkles, X,
  Download, ImageIcon, Film, Code2, Settings2,
} from 'lucide-vue-next'
import { useVisual } from '~/composables/useVisual'

const {
  serverUrl, checkpoints, checkpoint, mode, customWorkflow,
  prompt, negPrompt, steps, cfgScale, width, height, seed,
  status, progress, statusText, error, resultUrl, resultIsVideo, connected,
  isWorking, generate, cancel, checkConnection,
  setServerUrl, setCheckpoint, setMode, setCustomWorkflow,
} = useVisual()

// ── Server URL editing ────────────────────────────────────────────────────────

const urlDraft = ref(serverUrl.value)
watch(serverUrl, v => { urlDraft.value = v })

function commitUrl() {
  const raw = urlDraft.value.trim().replace(/\/$/, '')
  if (raw) setServerUrl(raw)
}

const testing = ref(false)
async function testConnection() {
  testing.value = true
  await checkConnection()
  testing.value = false
}

// ── Settings toggle ───────────────────────────────────────────────────────────

const showSettings = ref(false)

// ── Computed ──────────────────────────────────────────────────────────────────

const canGenerate = computed(() =>
  !isWorking.value &&
  connected.value === true &&
  (mode.value === 'custom' ? customWorkflow.value.trim().length > 0 : prompt.value.trim().length > 0)
)

const DEFAULT_WORKFLOW = `{
  "4": { "class_type": "CheckpointLoaderSimple", "inputs": { "ckpt_name": "{{MODEL}}" } },
  "6": { "class_type": "CLIPTextEncode", "inputs": { "text": "{{PROMPT}}", "clip": ["4", 1] } },
  "7": { "class_type": "CLIPTextEncode", "inputs": { "text": "{{NEG_PROMPT}}", "clip": ["4", 1] } },
  "5": { "class_type": "EmptyLatentImage", "inputs": { "width": {{WIDTH}}, "height": {{HEIGHT}}, "batch_size": 1 } },
  "3": { "class_type": "KSampler", "inputs": { "seed": {{SEED}}, "steps": {{STEPS}}, "cfg": {{CFG}}, "sampler_name": "euler", "scheduler": "normal", "denoise": 1.0, "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["5", 0] } },
  "8": { "class_type": "VAEDecode", "inputs": { "samples": ["3", 0], "vae": ["4", 2] } },
  "9": { "class_type": "SaveImage", "inputs": { "filename_prefix": "varg", "images": ["8", 0] } }
}`

function loadTemplate() {
  setCustomWorkflow(DEFAULT_WORKFLOW)
}
</script>

<template>
  <div class="mx-auto flex h-full w-full max-w-2xl flex-col gap-4 overflow-y-auto p-4">

    <!-- Header -->
    <div class="flex items-center justify-between gap-3">
      <div>
        <h1 class="text-[13px] font-semibold uppercase tracking-widest text-secondary">Visual</h1>
        <p class="mt-0.5 text-[11px] text-faded">AI image generation via ComfyUI · offline</p>
      </div>
      <div v-if="connected !== null" class="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium"
        :class="connected ? 'bg-ok/10 text-ok' : 'bg-err/10 text-err'">
        <component :is="connected ? Wifi : WifiOff" class="h-3 w-3" />
        {{ connected ? 'Connected' : 'Unreachable' }}
      </div>
    </div>

    <!-- ComfyUI server config -->
    <div class="glass-panel rounded-xl p-4 space-y-3">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-[12px] font-semibold text-secondary">ComfyUI Server</p>
          <p class="mt-0.5 text-[11px] text-faded">Default: http://127.0.0.1:8188</p>
        </div>
        <button type="button"
          class="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-medium text-faded transition-ui hover:border-accent/40 hover:text-accent disabled:opacity-40"
          :disabled="testing"
          @click="testConnection">
          <RefreshCw class="h-3 w-3" :class="testing ? 'animate-spin' : ''" />
          {{ testing ? 'Testing…' : 'Test' }}
        </button>
      </div>
      <input v-model="urlDraft" type="text" placeholder="http://127.0.0.1:8188"
        class="w-full rounded-lg border border-white/10 bg-surface px-3 py-2 font-mono text-[12px] text-secondary focus:border-accent/50 focus:outline-none"
        @blur="commitUrl" @keydown.enter="commitUrl" />

      <!-- Not connected instructions -->
      <div v-if="connected === false" class="rounded-lg border border-warn/15 bg-warn/5 px-3.5 py-3 text-[11px] leading-relaxed text-warn/80 space-y-1.5">
        <p class="font-semibold">ComfyUI not found. To get started:</p>
        <ol class="list-decimal list-inside space-y-0.5 text-warn/70">
          <li>Download <span class="font-mono">ComfyUI</span> from github.com/comfyanonymous/ComfyUI</li>
          <li>Run <span class="font-mono">python main.py</span> (or use the Windows portable build)</li>
          <li>Place a <span class="font-mono">.safetensors</span> checkpoint in <span class="font-mono">models/checkpoints/</span></li>
          <li>Click Test above — it should show "Connected"</li>
        </ol>
      </div>
    </div>

    <!-- Checkpoint selector (only when connected) -->
    <div v-if="connected" class="glass-panel rounded-xl p-4 space-y-3">
      <p class="text-[12px] font-semibold text-secondary">Model Checkpoint</p>
      <select v-if="checkpoints.length" :value="checkpoint"
        class="glass-input w-full cursor-pointer rounded-lg px-3 py-2 text-[12px]"
        @change="e => setCheckpoint((e.target as HTMLSelectElement).value)">
        <option v-for="ck in checkpoints" :key="ck" :value="ck">{{ ck }}</option>
      </select>
      <p v-else class="text-[11px] text-faded">No checkpoints found in <span class="font-mono">models/checkpoints/</span>. Add a <span class="font-mono">.safetensors</span> file and reconnect.</p>
    </div>

    <!-- Mode tabs -->
    <div v-if="connected" class="flex gap-1 rounded-xl bg-surface p-1">
      <button type="button"
        class="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[12px] font-medium transition-ui"
        :class="mode === 't2i' ? 'bg-accent/20 text-accent shadow-sm' : 'text-faded hover:text-secondary'"
        @click="setMode('t2i')">
        <ImageIcon class="h-3.5 w-3.5" /> Text to Image
      </button>
      <button type="button"
        class="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[12px] font-medium transition-ui"
        :class="mode === 'custom' ? 'bg-accent/20 text-accent shadow-sm' : 'text-faded hover:text-secondary'"
        @click="setMode('custom')">
        <Code2 class="h-3.5 w-3.5" /> Custom Workflow
      </button>
    </div>

    <!-- Standard T2I inputs -->
    <template v-if="connected && mode === 't2i'">
      <div class="glass-panel rounded-xl p-4 space-y-3">
        <label class="text-[12px] font-semibold text-secondary">Prompt</label>
        <textarea v-model="prompt" rows="4" placeholder="A cinematic shot of a misty mountain lake at dawn…"
          class="w-full resize-none rounded-lg border border-white/10 bg-surface px-3 py-2.5 text-[12px] leading-relaxed text-secondary placeholder:text-faded/50 focus:border-accent/50 focus:outline-none" />
        <details class="group">
          <summary class="flex cursor-pointer select-none list-none items-center gap-1 text-[11px] text-faded transition-ui hover:text-secondary">
            <ChevronDown class="h-3 w-3 transition-transform group-open:rotate-180" />
            Negative prompt
          </summary>
          <textarea v-model="negPrompt" rows="2" placeholder="low quality, blurry, bad anatomy…"
            class="mt-2 w-full resize-none rounded-lg border border-white/10 bg-surface px-3 py-2 text-[12px] leading-relaxed text-secondary placeholder:text-faded/50 focus:border-accent/50 focus:outline-none" />
        </details>
      </div>

      <!-- Settings -->
      <div class="glass-panel rounded-xl p-4 space-y-4">
        <button type="button" class="flex w-full items-center justify-between" @click="showSettings = !showSettings">
          <span class="flex items-center gap-1.5 text-[12px] font-semibold text-secondary">
            <Settings2 class="h-3.5 w-3.5" /> Generation Settings
          </span>
          <ChevronDown class="h-4 w-4 text-faded transition-transform" :class="showSettings ? 'rotate-180' : ''" />
        </button>
        <div v-if="showSettings" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-[12px] text-secondary">Width</p>
              <input v-model.number="width" type="number" step="64" min="64" max="2048"
                class="mt-1 w-full rounded-lg border border-white/10 bg-surface px-2.5 py-1.5 text-right text-[12px] tabular-nums text-secondary focus:border-accent/50 focus:outline-none" />
            </div>
            <div>
              <p class="text-[12px] text-secondary">Height</p>
              <input v-model.number="height" type="number" step="64" min="64" max="2048"
                class="mt-1 w-full rounded-lg border border-white/10 bg-surface px-2.5 py-1.5 text-right text-[12px] tabular-nums text-secondary focus:border-accent/50 focus:outline-none" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-[12px] text-secondary">Steps</p>
              <input v-model.number="steps" type="number" min="1" max="150"
                class="mt-1 w-full rounded-lg border border-white/10 bg-surface px-2.5 py-1.5 text-right text-[12px] tabular-nums text-secondary focus:border-accent/50 focus:outline-none" />
            </div>
            <div>
              <p class="text-[12px] text-secondary">CFG Scale</p>
              <input v-model.number="cfgScale" type="number" min="1" max="20" step="0.5"
                class="mt-1 w-full rounded-lg border border-white/10 bg-surface px-2.5 py-1.5 text-right text-[12px] tabular-nums text-secondary focus:border-accent/50 focus:outline-none" />
            </div>
          </div>
          <div>
            <p class="text-[12px] text-secondary">Seed <span class="text-faded text-[11px]">(-1 = random)</span></p>
            <input v-model.number="seed" type="number"
              class="mt-1 w-full rounded-lg border border-white/10 bg-surface px-2.5 py-1.5 text-right text-[12px] tabular-nums text-secondary focus:border-accent/50 focus:outline-none" />
          </div>
        </div>
      </div>
    </template>

    <!-- Custom workflow editor -->
    <div v-if="connected && mode === 'custom'" class="glass-panel rounded-xl p-4 space-y-3">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-[12px] font-semibold text-secondary">Workflow JSON</p>
          <p class="mt-0.5 text-[11px] text-faded">Export from ComfyUI (Save → API Format). Use <span class="font-mono">{{PROMPT}}</span>, <span class="font-mono">{{MODEL}}</span>, <span class="font-mono">{{SEED}}</span>, <span class="font-mono">{{STEPS}}</span>, <span class="font-mono">{{CFG}}</span>, <span class="font-mono">{{WIDTH}}</span>, <span class="font-mono">{{HEIGHT}}</span> as placeholders.</p>
        </div>
        <button type="button" class="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-faded hover:text-secondary transition-ui shrink-0" @click="loadTemplate">Template</button>
      </div>
      <textarea :value="customWorkflow" rows="12" placeholder='{"1": {"class_type": "...", "inputs": {...}}}'
        class="w-full resize-y rounded-lg border border-white/10 bg-surface px-3 py-2.5 font-mono text-[11px] leading-relaxed text-secondary placeholder:text-faded/40 focus:border-accent/50 focus:outline-none"
        @input="e => setCustomWorkflow((e.target as HTMLTextAreaElement).value)" />

      <!-- Prompt area for custom mode -->
      <div class="space-y-2 border-t border-white/5 pt-3">
        <p class="text-[11px] text-faded">Prompt values injected into placeholders above:</p>
        <textarea v-model="prompt" rows="2" placeholder="Prompt → {{PROMPT}}"
          class="w-full resize-none rounded-lg border border-white/10 bg-surface px-3 py-2 text-[12px] text-secondary placeholder:text-faded/50 focus:border-accent/50 focus:outline-none" />
        <textarea v-model="negPrompt" rows="1" placeholder="Negative → {{NEG_PROMPT}}"
          class="w-full resize-none rounded-lg border border-white/10 bg-surface px-3 py-2 text-[12px] text-secondary placeholder:text-faded/50 focus:border-accent/50 focus:outline-none" />
      </div>
    </div>

    <!-- Generate / Cancel -->
    <div v-if="connected" class="flex gap-2">
      <button type="button"
        class="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-semibold shadow-button transition-ui"
        :class="canGenerate ? 'bg-accent text-white hover:bg-accent-dark' : 'cursor-not-allowed bg-subtle text-faded'"
        :disabled="!canGenerate"
        @click="generate">
        <RefreshCw v-if="isWorking" class="h-4 w-4 animate-spin" />
        <Sparkles v-else class="h-4 w-4" />
        {{ isWorking ? (statusText || 'Generating…') : 'Generate' }}
      </button>
      <button v-if="isWorking" type="button"
        class="rounded-xl border border-err/30 px-4 py-3 text-[12px] font-medium text-err transition-ui hover:bg-err/10"
        @click="cancel">
        <X class="h-4 w-4" />
      </button>
    </div>

    <!-- Progress bar -->
    <Transition name="fade">
      <div v-if="isWorking" class="space-y-1.5">
        <div class="flex items-center justify-between text-[11px]">
          <span class="text-faded">{{ statusText || 'Generating…' }}</span>
          <span v-if="progress > 0" class="tabular-nums text-secondary">{{ progress }}%</span>
        </div>
        <div class="h-1.5 w-full overflow-hidden rounded-full bg-subtle">
          <div v-if="progress > 0"
            class="h-full rounded-full bg-accent transition-all duration-500"
            :style="{ width: `${progress}%` }" />
          <div v-else class="h-full w-1/3 rounded-full bg-accent/60 animate-[progress-slide_1.4s_ease-in-out_infinite]" />
        </div>
      </div>
    </Transition>

    <!-- Error -->
    <Transition name="fade">
      <div v-if="error" class="rounded-xl border border-err/20 bg-err/10 px-4 py-3 space-y-1">
        <p class="text-[12px] font-semibold text-err">Generation failed</p>
        <p class="text-[11px] leading-relaxed text-err/80">{{ error }}</p>
      </div>
    </Transition>

    <!-- Result -->
    <Transition name="fade">
      <div v-if="resultUrl && status === 'done'" class="glass-panel overflow-hidden rounded-xl">
        <video v-if="resultIsVideo" :src="resultUrl" controls autoplay loop class="w-full" style="max-height:480px" />
        <img v-else :src="resultUrl" alt="Generated" class="w-full object-contain" style="max-height:600px" />
        <div class="flex items-center justify-between border-t border-white/5 px-4 py-2.5">
          <div class="flex items-center gap-1.5 text-[11px] text-faded">
            <component :is="resultIsVideo ? Film : ImageIcon" class="h-3.5 w-3.5" />
            {{ resultIsVideo ? 'Video' : 'Image' }} generated
          </div>
          <a :href="resultUrl" target="_blank" download
            class="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-[11px] font-medium text-secondary transition-ui hover:bg-subtle hover:text-accent">
            <Download class="h-3 w-3" /> Download
          </a>
        </div>
      </div>
    </Transition>

    <div class="h-1 flex-shrink-0" />
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
@keyframes progress-slide {
  0%   { transform: translateX(-100%); }
  50%  { transform: translateX(300%); }
  100% { transform: translateX(300%); }
}
</style>
