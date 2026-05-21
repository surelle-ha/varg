const REPO    = 'onnx-community/Kokoro-82M-v1.0-ONNX'
const HF_BASE = `https://huggingface.co/${REPO}/resolve/main`

type KokoroDevice = 'auto' | 'gpu' | 'cpu'

export type WorkerIn =
  | { type: 'init';     preferDevice: KokoroDevice; origin: string }
  | { type: 'generate'; text: string; voice: string; speed: number }
  | { type: 'dispose' }

export type WorkerOut =
  | { type: 'status';   msg: string }
  | { type: 'progress'; value: number }
  | { type: 'ready';    device: 'gpu' | 'cpu' }
  | { type: 'audio';    buffer: ArrayBuffer; elapsedMs: number; sampleRate: number }
  | { type: 'error';    msg: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let tts: any = null

function post(msg: WorkerOut, transfer: Transferable[] = []) {
  self.postMessage(msg, transfer)
}

// ── Voice list ────────────────────────────────────────────────────────────────

const VOICE_IDS = [
  'af_heart', 'af_bella', 'af_nicole', 'af_sarah', 'af_kore',
  'af_aoede', 'af_nova',  'af_sky',    'af_alloy', 'af_river', 'af_jessica',
  'am_fenrir', 'am_michael', 'am_puck', 'am_echo', 'am_eric',
  'am_liam',   'am_onyx',    'am_adam', 'am_santa',
  'bf_emma', 'bf_isabella', 'bf_alice', 'bf_lily',
  'bm_fable', 'bm_george', 'bm_daniel', 'bm_lewis',
]

// ── Cache warming ─────────────────────────────────────────────────────────────

type CacheEntry = { hfPath: string; localPath: string }

async function populateCache(
  name: string,
  entries: CacheEntry[],
  origin: string,
  onStatus: (msg: string) => void,
): Promise<void> {
  let cache: Cache
  try { cache = await caches.open(name) } catch { return }

  for (const { hfPath, localPath } of entries) {
    const cacheKey = `${HF_BASE}/${hfPath}`
    try {
      if (await cache.match(cacheKey)) continue
      onStatus(`Caching ${hfPath.split('/').pop() ?? hfPath}…`)
      const res = await fetch(`${origin}/models/${REPO}/${localPath}`)
      if (!res.ok) continue
      await cache.put(cacheKey, res)
    } catch (e) {
      console.warn(`[Varg] Failed to cache ${hfPath}:`, e)
    }
  }
}

async function warmCaches(origin: string, onStatus: (msg: string) => void): Promise<void> {
  const modelEntries: CacheEntry[] = [
    { hfPath: 'config.json',               localPath: 'config.json' },
    { hfPath: 'tokenizer.json',            localPath: 'tokenizer.json' },
    { hfPath: 'tokenizer_config.json',     localPath: 'tokenizer_config.json' },
    { hfPath: 'onnx/model_q4f16.onnx',    localPath: 'onnx/model_q4f16.onnx' },
    { hfPath: 'onnx/model_quantized.onnx', localPath: 'onnx/model_quantized.onnx' },
  ]
  onStatus('Caching model files…')
  await populateCache('transformers-cache', modelEntries, origin, onStatus)

  const voiceEntries: CacheEntry[] = VOICE_IDS.map(id => ({
    hfPath:    `voices/${id}.bin`,
    localPath: `voices/${id}.bin`,
  }))
  onStatus('Caching voice files…')
  await populateCache('kokoro-voices', voiceEntries, origin, onStatus)
}

// ── WAV encoder ───────────────────────────────────────────────────────────────

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const dataLen = samples.length * 2
  const buf = new ArrayBuffer(44 + dataLen)
  const v = new DataView(buf)
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i))
  }
  str(0, 'RIFF'); v.setUint32(4, 36 + dataLen, true); str(8, 'WAVE')
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true)
  v.setUint16(22, 1, true); v.setUint32(24, sampleRate, true)
  v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  str(36, 'data'); v.setUint32(40, dataLen, true)
  let o = 44
  for (const s of samples) {
    const c = Math.max(-1, Math.min(1, s))
    v.setInt16(o, c < 0 ? c * 0x8000 : c * 0x7fff, true); o += 2
  }
  return buf
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function doInit(preferDevice: KokoroDevice, origin: string) {
  post({ type: 'status', msg: 'Preparing…' })
  try {
    await warmCaches(origin, msg => post({ type: 'status', msg }))

    const { KokoroTTS } = await import('kokoro-js')
    const tryGpu  = preferDevice === 'auto' || preferDevice === 'gpu'
    const tryWasm = preferDevice === 'auto' || preferDevice === 'cpu'

    const onProgress = (p: { status?: string; file?: string; progress?: number }) => {
      if (p.status === 'progress' && typeof p.progress === 'number') {
        post({ type: 'progress', value: Math.round(p.progress) })
      }
      if (p.file) post({ type: 'status', msg: `Loading ${p.file.split('/').pop() ?? p.file}…` })
    }

    if (tryGpu) {
      try {
        post({ type: 'status', msg: 'Loading on GPU…' })
        tts = await KokoroTTS.from_pretrained(REPO, {
          dtype: 'q4f16', device: 'webgpu', progress_callback: onProgress,
        })
        post({ type: 'ready', device: 'gpu' })
        return
      } catch {
        if (!tryWasm) {
          post({ type: 'error', msg: 'GPU unavailable and CPU fallback is disabled' })
          return
        }
        post({ type: 'status', msg: 'GPU unavailable — falling back to CPU…' })
      }
    }

    if (tryWasm) {
      post({ type: 'status', msg: 'Loading on CPU…' })
      tts = await KokoroTTS.from_pretrained(REPO, {
        dtype: 'q8', device: 'wasm', progress_callback: onProgress,
      })
      post({ type: 'ready', device: 'cpu' })
    }
  } catch (e) {
    post({ type: 'error', msg: e instanceof Error ? e.message : String(e) })
  }
}

// ── Generate ──────────────────────────────────────────────────────────────────

async function doGenerate(text: string, voice: string, speed: number) {
  if (!tts) { post({ type: 'error', msg: 'Model not loaded' }); return }
  const t0 = Date.now()
  try {
    const out = await tts.generate(text.trim(), { voice, speed })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = out as any
    let samples: Float32Array
    if (raw?.audio instanceof Float32Array)            samples = raw.audio
    else if (raw?.data  instanceof Float32Array)       samples = raw.data
    else if (raw?.audio?.data instanceof Float32Array) samples = raw.audio.data
    else                                               samples = raw as Float32Array

    // Detect silent output (GPU inference failure)
    let maxAmp = 0
    for (const s of samples) if (Math.abs(s) > maxAmp) maxAmp = Math.abs(s)
    if (maxAmp < 0.0001) {
      post({ type: 'error', msg: 'Generated audio is silent — GPU inference may not be supported on this device. Switch to CPU.' })
      return
    }

    const sr: number = raw?.sampling_rate ?? 24000
    const buffer = encodeWav(samples, sr)
    post({ type: 'audio', buffer, elapsedMs: Date.now() - t0, sampleRate: sr }, [buffer])
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('createBuffer') || msg.includes('GPUDevice')) {
      post({ type: 'error', msg: 'GPU inference failed (WebGPU not fully supported here). Switch device to CPU.' })
    } else {
      post({ type: 'error', msg })
    }
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

self.addEventListener('message', (e: MessageEvent<WorkerIn>) => {
  const msg = e.data
  if (msg.type === 'init')     void doInit(msg.preferDevice, msg.origin)
  if (msg.type === 'generate') void doGenerate(msg.text, msg.voice, msg.speed)
  if (msg.type === 'dispose')  { tts = null; self.close() }
})
