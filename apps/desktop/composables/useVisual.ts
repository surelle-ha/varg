const STORAGE_KEY = 'varg-visual-comfy'

// Stable per-session client ID for ComfyUI WebSocket routing
const CLIENT_ID = Math.random().toString(36).slice(2) + Date.now().toString(36)

export type VisualMode   = 't2i' | 'custom'
export type VisualStatus = 'idle' | 'queued' | 'generating' | 'done' | 'error'

// ── Module-level singleton ────────────────────────────────────────────────────

const serverUrl      = ref('http://127.0.0.1:8188')
const checkpoints    = ref<string[]>([])
const checkpoint     = ref('')
const mode           = ref<VisualMode>('t2i')
const customWorkflow = ref('')   // JSON with {{PROMPT}} etc. placeholders

const prompt        = ref('')
const negPrompt     = ref('')
const steps         = ref(20)
const cfgScale      = ref(7.0)
const width         = ref(512)
const height        = ref(512)
const seed          = ref(-1)

const status        = ref<VisualStatus>('idle')
const progress      = ref(0)
const statusText    = ref('')
const error         = ref<string | null>(null)
const resultUrl     = ref<string | null>(null)
const resultIsVideo = ref(false)
const connected     = ref<boolean | null>(null)

let _ws:    WebSocket | null = null
let _abort  = false

// ── Persistence ───────────────────────────────────────────────────────────────

if (import.meta.client) {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    if (s.serverUrl)      serverUrl.value      = s.serverUrl
    if (s.checkpoint)     checkpoint.value     = s.checkpoint
    if (s.mode)           mode.value           = s.mode
    if (s.customWorkflow) customWorkflow.value = s.customWorkflow
    if (s.steps)          steps.value          = s.steps
    if (s.cfgScale)       cfgScale.value       = s.cfgScale
    if (s.width)          width.value          = s.width
    if (s.height)         height.value         = s.height
  } catch {}
}

function save() {
  if (!import.meta.client) return
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    serverUrl: serverUrl.value, checkpoint: checkpoint.value,
    mode: mode.value, customWorkflow: customWorkflow.value,
    steps: steps.value, cfgScale: cfgScale.value,
    width: width.value, height: height.value,
  }))
}

// ── ComfyUI API helpers ───────────────────────────────────────────────────────

async function loadCheckpoints(base: string) {
  try {
    const res  = await fetch(`${base}/object_info/CheckpointLoaderSimple`)
    const info = await res.json() as Record<string, {input?: {required?: Record<string, unknown[][]>}}>
    const models = (info['CheckpointLoaderSimple']?.input?.required?.['ckpt_name']?.[0] ?? []) as string[]
    checkpoints.value = models
    if (!checkpoint.value && models.length > 0) checkpoint.value = models[0]!
  } catch {}
}

export async function checkConnection(): Promise<boolean> {
  const base = serverUrl.value.replace(/\/$/, '')
  try {
    const res = await fetch(`${base}/system_stats`, { signal: AbortSignal.timeout(4000) })
    connected.value = res.ok
    if (res.ok) await loadCheckpoints(base)
    return res.ok
  } catch {
    connected.value = false
    return false
  }
}

// ── Workflow builder ──────────────────────────────────────────────────────────

function escapeJson(s: string) { return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') }

function buildWorkflow(): Record<string, unknown> {
  const s = seed.value < 0 ? Math.floor(Math.random() * 2 ** 32) : seed.value

  if (mode.value === 'custom' && customWorkflow.value.trim()) {
    const filled = customWorkflow.value
      .replace(/\{\{PROMPT\}\}/g,     escapeJson(prompt.value))
      .replace(/\{\{NEG_PROMPT\}\}/g, escapeJson(negPrompt.value))
      .replace(/\{\{MODEL\}\}/g,      escapeJson(checkpoint.value))
      .replace(/\{\{SEED\}\}/g,       String(s))
      .replace(/\{\{STEPS\}\}/g,      String(steps.value))
      .replace(/\{\{CFG\}\}/g,        String(cfgScale.value))
      .replace(/\{\{WIDTH\}\}/g,      String(width.value))
      .replace(/\{\{HEIGHT\}\}/g,     String(height.value))
    return JSON.parse(filled)
  }

  // Default Text-to-Image workflow (standard KSampler, works with any SD ckpt)
  return {
    "4": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: checkpoint.value } },
    "6": { class_type: "CLIPTextEncode", inputs: { text: prompt.value, clip: ["4", 1] } },
    "7": { class_type: "CLIPTextEncode", inputs: { text: negPrompt.value || "low quality, blurry, bad anatomy", clip: ["4", 1] } },
    "5": { class_type: "EmptyLatentImage", inputs: { width: width.value, height: height.value, batch_size: 1 } },
    "3": {
      class_type: "KSampler",
      inputs: {
        seed: s, steps: steps.value, cfg: cfgScale.value,
        sampler_name: "euler", scheduler: "normal", denoise: 1.0,
        model: ["4", 0], positive: ["6", 0], negative: ["7", 0], latent_image: ["5", 0],
      },
    },
    "8": { class_type: "VAEDecode", inputs: { samples: ["3", 0], vae: ["4", 2] } },
    "9": { class_type: "SaveImage", inputs: { filename_prefix: "varg", images: ["8", 0] } },
  }
}

// ── Generate / Cancel ─────────────────────────────────────────────────────────

export async function visualGenerate() {
  if (status.value === 'queued' || status.value === 'generating') return
  if (!prompt.value.trim() && mode.value !== 'custom') return

  error.value     = null
  resultUrl.value = null
  progress.value  = 0
  status.value    = 'queued'
  statusText.value = 'Connecting to ComfyUI…'
  _abort           = false

  const base = serverUrl.value.replace(/\/$/, '')

  try {
    const submitRes = await fetch(`${base}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: buildWorkflow(), client_id: CLIENT_ID }),
    })

    if (!submitRes.ok) {
      const txt = await submitRes.text()
      throw new Error(`ComfyUI rejected the workflow: ${txt}`)
    }

    const { prompt_id } = await submitRes.json() as { prompt_id: string }
    statusText.value = 'Queued…'

    await new Promise<void>((resolve, reject) => {
      const wsUrl = base.replace(/^http/, 'ws') + `/ws?clientId=${CLIENT_ID}`
      _ws = new WebSocket(wsUrl)

      _ws.onopen = () => {
        if (_abort) { _ws?.close(); resolve(); return }
        status.value     = 'generating'
        statusText.value = 'Starting…'
      }

      _ws.onmessage = (evt) => {
        if (_abort) { _ws?.close(); resolve(); return }
        let msg: Record<string, unknown>
        try { msg = JSON.parse(evt.data as string) } catch { return }

        const type = msg.type as string
        const data = (msg.data ?? {}) as Record<string, unknown>

        if (type === 'progress' && data['prompt_id'] === prompt_id) {
          const val = (data['value'] as number) ?? 0
          const max = (data['max']   as number) ?? 1
          progress.value   = Math.min(99, Math.round((val / Math.max(max, 1)) * 100))
          statusText.value = `Step ${val} / ${max}`
        }

        if (type === 'executing' && data['prompt_id'] === prompt_id && data['node']) {
          statusText.value = `Running node ${data['node']}…`
        }

        if (type === 'executed' && data['prompt_id'] === prompt_id) {
          const output = (data['output'] ?? {}) as Record<string, unknown>
          type FileRef = { filename: string; subfolder: string; type: string }
          const images = (output['images'] ?? []) as FileRef[]
          const videos = ((output['gifs'] ?? output['videos'] ?? [])) as FileRef[]

          if (images.length) {
            const f = images[0]!
            resultUrl.value     = `${base}/view?filename=${encodeURIComponent(f.filename)}&subfolder=${encodeURIComponent(f.subfolder)}&type=${f.type}`
            resultIsVideo.value = false
          } else if (videos.length) {
            const f = videos[0]!
            resultUrl.value     = `${base}/view?filename=${encodeURIComponent(f.filename)}&subfolder=${encodeURIComponent(f.subfolder)}&type=${f.type}`
            resultIsVideo.value = true
          }
        }

        if (type === 'execution_complete' && data['prompt_id'] === prompt_id) {
          progress.value   = 100
          statusText.value = 'Done!'
          status.value     = 'done'
          _ws?.close()
          resolve()
        }

        if (type === 'execution_error' && data['prompt_id'] === prompt_id) {
          reject(new Error((data['exception_message'] as string) ?? 'Execution error'))
        }
      }

      _ws.onerror  = () => reject(new Error('WebSocket error — is ComfyUI running?'))
      _ws.onclose  = (e) => {
        if (!e.wasClean && status.value !== 'done' && !_abort) {
          reject(new Error('Connection to ComfyUI closed unexpectedly'))
        }
      }

      setTimeout(() => reject(new Error('Generation timed out after 10 minutes')), 600_000)
    })
  } catch (e: unknown) {
    if (_abort) {
      status.value     = 'idle'
      statusText.value = ''
    } else {
      status.value = 'error'
      error.value  = (e as Error).message
    }
  }
}

export function visualCancel() {
  _abort = true
  _ws?.close()
  _ws          = null
  status.value = 'idle'
  statusText.value = ''
}

// ── Setters ───────────────────────────────────────────────────────────────────

export function setVisualServerUrl(url: string) { serverUrl.value = url; connected.value = null; save() }
export function setVisualCheckpoint(c: string)  { checkpoint.value = c; save() }
export function setVisualMode(m: VisualMode)    { mode.value = m; save() }
export function setCustomWorkflow(wf: string)   { customWorkflow.value = wf; save() }

// ── Composable ────────────────────────────────────────────────────────────────

export function useVisual() {
  return {
    serverUrl, checkpoints, checkpoint, mode, customWorkflow,
    prompt, negPrompt, steps, cfgScale, width, height, seed,
    status, progress, statusText, error, resultUrl, resultIsVideo, connected,
    isWorking: computed(() => status.value === 'queued' || status.value === 'generating'),
    generate: visualGenerate,
    cancel:   visualCancel,
    checkConnection,
    setServerUrl:    setVisualServerUrl,
    setCheckpoint:   setVisualCheckpoint,
    setMode:         setVisualMode,
    setCustomWorkflow,
  }
}
