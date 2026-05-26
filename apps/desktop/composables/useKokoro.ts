import type { KokoroVoice } from '~/types/tts'
import type { WorkerIn, WorkerOut } from '~/workers/kokoro.worker'

// ── Constants ─────────────────────────────────────────────────────────────────

export const KOKORO_VOICES: KokoroVoice[] = [
  // American Female
  { id: 'af_heart',   name: 'Heart ★',  gender: 'female', accent: 'american' },
  { id: 'af_bella',   name: 'Bella',    gender: 'female', accent: 'american' },
  { id: 'af_nicole',  name: 'Nicole',   gender: 'female', accent: 'american' },
  { id: 'af_sarah',   name: 'Sarah',    gender: 'female', accent: 'american' },
  { id: 'af_kore',    name: 'Kore',     gender: 'female', accent: 'american' },
  { id: 'af_aoede',   name: 'Aoede',    gender: 'female', accent: 'american' },
  { id: 'af_nova',    name: 'Nova',     gender: 'female', accent: 'american' },
  { id: 'af_sky',     name: 'Sky',      gender: 'female', accent: 'american' },
  { id: 'af_alloy',   name: 'Alloy',    gender: 'female', accent: 'american' },
  { id: 'af_river',   name: 'River',    gender: 'female', accent: 'american' },
  { id: 'af_jessica', name: 'Jessica',  gender: 'female', accent: 'american' },
  // American Male
  { id: 'am_fenrir',  name: 'Fenrir',   gender: 'male',   accent: 'american' },
  { id: 'am_michael', name: 'Michael',  gender: 'male',   accent: 'american' },
  { id: 'am_puck',    name: 'Puck',     gender: 'male',   accent: 'american' },
  { id: 'am_echo',    name: 'Echo',     gender: 'male',   accent: 'american' },
  { id: 'am_eric',    name: 'Eric',     gender: 'male',   accent: 'american' },
  { id: 'am_liam',    name: 'Liam',     gender: 'male',   accent: 'american' },
  { id: 'am_onyx',    name: 'Onyx',     gender: 'male',   accent: 'american' },
  { id: 'am_adam',    name: 'Adam',     gender: 'male',   accent: 'american' },
  { id: 'am_santa',   name: 'Santa',    gender: 'male',   accent: 'american' },
  // British Female
  { id: 'bf_emma',     name: 'Emma ★',   gender: 'female', accent: 'british' },
  { id: 'bf_isabella', name: 'Isabella', gender: 'female', accent: 'british' },
  { id: 'bf_alice',    name: 'Alice',    gender: 'female', accent: 'british' },
  { id: 'bf_lily',     name: 'Lily',     gender: 'female', accent: 'british' },
  // British Male
  { id: 'bm_fable',  name: 'Fable',  gender: 'male', accent: 'british' },
  { id: 'bm_george', name: 'George', gender: 'male', accent: 'british' },
  { id: 'bm_daniel', name: 'Daniel', gender: 'male', accent: 'british' },
  { id: 'bm_lewis',  name: 'Lewis',  gender: 'male', accent: 'british' },
]

export type KokoroDevice = 'auto' | 'gpu' | 'cpu'

// ── GPU probe (client-side, fires once at module load) ────────────────────────
// null = still detecting, true/false = result
const hasGpu = ref<boolean | null>(null)

if (import.meta.client) {
  ;(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nav = navigator as any
      if (!nav.gpu) { hasGpu.value = false; return }
      const adapter = await nav.gpu.requestAdapter()
      hasGpu.value = !!adapter
    } catch {
      hasGpu.value = false
    }
  })()
}

// ── MCP completion callbacks ──────────────────────────────────────────────────
// Registered by generateForMcp(); fired once when the current generation ends.

type CompletionCb = (buffer: ArrayBuffer | null, err: string | null) => void
const completionCallbacks: CompletionCb[] = []

function fireCallbacks(buffer: ArrayBuffer | null, err: string | null) {
  const cbs = completionCallbacks.splice(0)
  for (const cb of cbs) cb(buffer, err)
}

// ── Module-level singleton state ──────────────────────────────────────────────

const initializing  = ref(false)
const initProgress  = ref(0)
const initStatus    = ref('')
const error         = ref('')
const generating    = ref(false)
const genChunk      = ref(0)
const genTotal      = ref(0)
const audioUrl      = ref('')
const audioBuffer   = ref<ArrayBuffer | null>(null)
const elapsedMs     = ref(0)
const sampleRate    = ref(24000)
const activeDevice  = ref<'gpu' | 'cpu' | ''>('')
const genDevice     = ref<'gpu' | 'cpu' | ''>('')
const gpuFallback   = ref(false)

// Track what was last sent to the worker for accurate history saves
const lastGenText   = ref('')
const lastGenVoice  = ref('')
const lastGenSpeed  = ref(1.0)

let _worker: Worker | null = null
let _blobUrl = ''

function spawnWorker(): Worker {
  const w = new Worker(
    new URL('../workers/kokoro.worker.ts', import.meta.url),
    { type: 'module' },
  )
  w.addEventListener('message', (e: MessageEvent<WorkerOut>) => {
    const msg = e.data
    switch (msg.type) {
      case 'status':
        initStatus.value = msg.msg
        break
      case 'progress':
        initProgress.value = msg.value
        break
      case 'ready':
        activeDevice.value  = msg.device
        initializing.value  = false
        initStatus.value    = ''
        initProgress.value  = 0
        break
      case 'genProgress':
        genChunk.value = msg.chunk
        genTotal.value = msg.total
        break
      case 'audio': {
        if (_blobUrl) URL.revokeObjectURL(_blobUrl)
        const blob  = new Blob([msg.buffer], { type: 'audio/wav' })
        _blobUrl          = URL.createObjectURL(blob)
        audioBuffer.value  = msg.buffer
        audioUrl.value     = _blobUrl
        elapsedMs.value    = msg.elapsedMs
        sampleRate.value   = msg.sampleRate
        genDevice.value    = msg.device
        gpuFallback.value  = msg.gpuFallback
        generating.value   = false
        genChunk.value     = 0
        genTotal.value     = 0
        fireCallbacks(msg.buffer, null)
        break
      }
      case 'error':
        error.value        = msg.msg
        initializing.value = false
        generating.value   = false
        genChunk.value     = 0
        genTotal.value     = 0
        fireCallbacks(null, msg.msg)
        break
    }
  })
  return w
}

function getWorker(): Worker {
  if (!_worker) _worker = spawnWorker()
  return _worker
}

async function init(preferDevice: KokoroDevice = 'auto') {
  if (initializing.value || activeDevice.value) return
  initializing.value = true
  initProgress.value = 0
  error.value        = ''
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  getWorker().postMessage({ type: 'init', preferDevice, origin } satisfies WorkerIn)
}

function generate(text: string, voice: string, speed = 1.0) {
  if (!activeDevice.value || generating.value) return
  generating.value  = true
  error.value       = ''
  genChunk.value    = 0
  genTotal.value    = 0
  gpuFallback.value = false
  lastGenText.value  = text
  lastGenVoice.value = voice
  lastGenSpeed.value = speed
  getWorker().postMessage({ type: 'generate', text, voice, speed } satisfies WorkerIn)
}

function generateForMcp(text: string, voiceId?: string, speed = 1.0): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    if (!activeDevice.value) {
      reject(new Error('Kokoro TTS model not loaded. Open the TTS page in Varg first to initialize the model.'))
      return
    }
    if (generating.value) {
      reject(new Error('TTS is currently busy with another generation. Please try again shortly.'))
      return
    }
    completionCallbacks.push((buffer, err) => {
      if (err !== null) reject(new Error(err))
      else resolve(buffer!)
    })
    generate(text, voiceId ?? 'af_heart', speed)
  })
}

async function save(filename = 'speech.wav') {
  if (!audioBuffer.value) return

  if ('showSaveFilePicker' in window) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'WAV Audio', accept: { 'audio/wav': ['.wav'] } }],
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const writable = await (handle as any).createWritable()
      await writable.write(audioBuffer.value)
      await writable.close()
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
  }

  if (!_blobUrl) return
  const a = document.createElement('a')
  a.href     = _blobUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

function loadExternal(wavBuffer: ArrayBuffer, meta: {
  text: string; voice: string; speed: number
  device: 'gpu' | 'cpu'; elapsedMs: number
}) {
  if (_blobUrl) URL.revokeObjectURL(_blobUrl)
  const blob  = new Blob([wavBuffer], { type: 'audio/wav' })
  _blobUrl           = URL.createObjectURL(blob)
  audioBuffer.value  = wavBuffer
  audioUrl.value     = _blobUrl
  elapsedMs.value    = meta.elapsedMs
  sampleRate.value   = 24000
  genDevice.value    = meta.device
  gpuFallback.value  = false
  lastGenText.value  = meta.text
  lastGenVoice.value = meta.voice
  lastGenSpeed.value = meta.speed
}

function reset() {
  _worker?.postMessage({ type: 'dispose' } satisfies WorkerIn)
  _worker?.terminate()
  _worker         = null
  if (_blobUrl) { URL.revokeObjectURL(_blobUrl); _blobUrl = '' }
  activeDevice.value  = ''
  genDevice.value     = ''
  audioUrl.value      = ''
  audioBuffer.value   = null
  initializing.value  = false
  generating.value    = false
  error.value         = ''
  gpuFallback.value   = false
  initStatus.value    = ''
  initProgress.value  = 0
}

async function setDevice(pref: KokoroDevice) {
  _worker?.postMessage({ type: 'dispose' } satisfies WorkerIn)
  _worker?.terminate()
  _worker = null
  activeDevice.value = ''
  error.value        = ''
  await init(pref)
}

// ── Composable ────────────────────────────────────────────────────────────────

export function useKokoro() {
  return {
    hasGpu,
    initializing, initProgress, initStatus,
    error, generating, genChunk, genTotal,
    audioUrl, audioBuffer, elapsedMs, sampleRate, activeDevice, genDevice, gpuFallback,
    lastGenText, lastGenVoice, lastGenSpeed,
    voices: KOKORO_VOICES,
    init, generate, generateForMcp, save, setDevice, loadExternal, reset,
  }
}
