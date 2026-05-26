import type { ParlerWorkerIn, ParlerWorkerOut } from '~/workers/parler.worker'

type CompletionCb = (buffer: ArrayBuffer | null, err: string | null) => void
const completionCallbacks: CompletionCb[] = []

function fireCallbacks(buffer: ArrayBuffer | null, err: string | null) {
  const cbs = completionCallbacks.splice(0)
  for (const cb of cbs) cb(buffer, err)
}

// ── Module-level singleton state ──────────────────────────────────────────────

const initializing      = ref(false)
const initProgress      = ref(0)
const initStatus        = ref('')
const error             = ref('')
const generating        = ref(false)
const ready             = ref(false)
const audioBuffer       = ref<ArrayBuffer | null>(null)
const elapsedMs         = ref(0)
const sampleRate        = ref(24000)

const lastGenText         = ref('')
const lastGenExaggeration = ref(0.5)

const encodingVoice = ref(false)
const voiceName     = ref('Default')
const gpuFallback   = ref(false)

let _worker: Worker | null = null
let _blobUrl = ''
let _pendingVoice:      { pcmBuffer: ArrayBuffer; name: string } | null = null
let _pendingGeneration: { text: string; exaggeration: number }  | null = null

function spawnWorker(): Worker {
  const w = new Worker(
    new URL('../workers/parler.worker.ts', import.meta.url),
    { type: 'module' },
  )
  w.addEventListener('message', (e: MessageEvent<ParlerWorkerOut>) => {
    const msg = e.data
    switch (msg.type) {
      case 'status':
        initStatus.value = msg.msg
        break
      case 'progress':
        initProgress.value = msg.value
        break
      case 'ready':
        ready.value        = true
        initializing.value = false
        initStatus.value   = ''
        initProgress.value = 0
        if (_pendingVoice) {
          const pv = _pendingVoice
          _pendingVoice = null
          setVoice(pv.pcmBuffer, pv.name)
        }
        if (_pendingGeneration) {
          const pg = _pendingGeneration
          _pendingGeneration = null
          generate(pg.text, pg.exaggeration)
        }
        break
      case 'voice-ready':
        encodingVoice.value = false
        break
      case 'gpu-fallback':
        gpuFallback.value   = true
        ready.value         = false
        initializing.value  = true
        break
      case 'audio': {
        if (_blobUrl) URL.revokeObjectURL(_blobUrl)
        const blob = new Blob([msg.buffer], { type: 'audio/wav' })
        _blobUrl           = URL.createObjectURL(blob)
        audioBuffer.value  = msg.buffer
        elapsedMs.value    = msg.elapsedMs
        sampleRate.value   = msg.sampleRate
        generating.value   = false
        fireCallbacks(msg.buffer, null)
        break
      }
      case 'error':
        error.value         = msg.msg
        initializing.value  = false
        generating.value    = false
        encodingVoice.value = false
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

async function init() {
  if (initializing.value || ready.value) return
  initializing.value = true
  initProgress.value = 0
  error.value        = ''
  getWorker().postMessage({ type: 'init' } satisfies ParlerWorkerIn)
}

function generate(text: string, exaggeration: number) {
  if (generating.value) return
  lastGenText.value         = text
  lastGenExaggeration.value = exaggeration
  if (!ready.value) {
    _pendingGeneration = { text, exaggeration }
    if (!initializing.value) init()
    return
  }
  generating.value = true
  error.value      = ''
  getWorker().postMessage({ type: 'generate', text, exaggeration } satisfies ParlerWorkerIn)
}

function generateForMcp(text: string, exaggeration: number): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    if (!ready.value) {
      reject(new Error('Chatterbox model not loaded.'))
      return
    }
    if (generating.value) {
      reject(new Error('Chatterbox is currently busy.'))
      return
    }
    completionCallbacks.push((buffer, err) => {
      if (err !== null) reject(new Error(err))
      else resolve(buffer!)
    })
    generate(text, exaggeration)
  })
}

function setVoice(pcmBuffer: ArrayBuffer, name: string) {
  voiceName.value = name
  error.value     = ''
  if (!ready.value) {
    _pendingVoice = { pcmBuffer, name }
    if (!initializing.value) init()
    return
  }
  encodingVoice.value = true
  _pendingVoice = null
  getWorker().postMessage({ type: 'set-voice', pcmBuffer } satisfies ParlerWorkerIn, [pcmBuffer])
}

function resetVoice() {
  voiceName.value = 'Default'
  _pendingVoice   = null
  if (!ready.value) return
  getWorker().postMessage({ type: 'reset-voice' } satisfies ParlerWorkerIn)
}

function reset() {
  _worker?.postMessage({ type: 'dispose' } satisfies ParlerWorkerIn)
  _worker?.terminate()
  _worker = null
  if (_blobUrl) { URL.revokeObjectURL(_blobUrl); _blobUrl = '' }
  ready.value         = false
  audioBuffer.value   = null
  initializing.value  = false
  generating.value    = false
  encodingVoice.value = false
  gpuFallback.value   = false
  voiceName.value     = 'Default'
  _pendingVoice       = null
  _pendingGeneration  = null
  error.value         = ''
  initStatus.value    = ''
  initProgress.value  = 0
}

// ── Composable ────────────────────────────────────────────────────────────────

export function useParler() {
  return {
    initializing, initProgress, initStatus,
    error, generating, ready,
    audioBuffer, elapsedMs, sampleRate,
    lastGenText, lastGenExaggeration,
    encodingVoice, voiceName, gpuFallback,
    init, generate, generateForMcp, setVoice, resetVoice, reset,
  }
}
