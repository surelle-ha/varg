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

// ── Composable ────────────────────────────────────────────────────────────────

export function useKokoro() {
  const initializing  = ref(false)
  const initProgress  = ref(0)
  const initStatus    = ref('')
  const error         = ref('')
  const generating    = ref(false)
  const audioUrl      = ref('')
  const audioBuffer   = ref<ArrayBuffer | null>(null)
  const elapsedMs     = ref(0)
  const sampleRate    = ref(24000)
  const activeDevice  = ref<'gpu' | 'cpu' | ''>('')

  let worker: Worker | null = null
  let blobUrl = ''

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
        case 'audio': {
          if (blobUrl) URL.revokeObjectURL(blobUrl)
          const blob  = new Blob([msg.buffer], { type: 'audio/wav' })
          blobUrl     = URL.createObjectURL(blob)
          audioBuffer.value  = msg.buffer
          audioUrl.value     = blobUrl
          elapsedMs.value    = msg.elapsedMs
          sampleRate.value   = msg.sampleRate
          generating.value   = false
          break
        }
        case 'error':
          error.value        = msg.msg
          initializing.value = false
          generating.value   = false
          break
      }
    })
    return w
  }

  function getWorker(): Worker {
    if (!worker) worker = spawnWorker()
    return worker
  }

  async function init(preferDevice: KokoroDevice = 'auto') {
    if (initializing.value) return
    initializing.value = true
    initProgress.value = 0
    error.value        = ''
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    getWorker().postMessage({ type: 'init', preferDevice, origin } satisfies WorkerIn)
  }

  function generate(text: string, voice: string, speed = 1.0) {
    if (!activeDevice.value || generating.value) return
    generating.value = true
    error.value      = ''
    getWorker().postMessage({ type: 'generate', text, voice, speed } satisfies WorkerIn)
  }

  function save(filename = 'speech.wav') {
    if (!blobUrl) return
    const a = document.createElement('a')
    a.href = blobUrl; a.download = filename; a.click()
  }

  async function setDevice(pref: KokoroDevice) {
    worker?.postMessage({ type: 'dispose' } satisfies WorkerIn)
    worker?.terminate()
    worker = null
    activeDevice.value = ''
    error.value        = ''
    await init(pref)
  }

  onUnmounted(() => {
    worker?.terminate()
    if (blobUrl) URL.revokeObjectURL(blobUrl)
  })

  return {
    initializing, initProgress, initStatus,
    error, generating, audioUrl, audioBuffer, elapsedMs, sampleRate, activeDevice,
    voices: KOKORO_VOICES,
    init, generate, save, setDevice,
  }
}
