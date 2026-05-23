const REPO    = 'onnx-community/Kokoro-82M-v1.0-ONNX'
const HF_BASE = `https://huggingface.co/${REPO}/resolve/main`

type KokoroDevice = 'auto' | 'gpu' | 'cpu'

export type WorkerIn =
  | { type: 'init';     preferDevice: KokoroDevice; origin: string }
  | { type: 'generate'; text: string; voice: string; speed: number }
  | { type: 'dispose' }

export type WorkerOut =
  | { type: 'status';      msg: string }
  | { type: 'progress';    value: number }
  | { type: 'ready';       device: 'gpu' | 'cpu' }
  | { type: 'genProgress'; chunk: number; total: number }
  | { type: 'audio';       buffer: ArrayBuffer; elapsedMs: number; sampleRate: number; device: 'gpu' | 'cpu'; gpuFallback: boolean }
  | { type: 'error';       msg: string }

// ── State ─────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let tts: any = null
let currentDevice: 'gpu' | 'cpu' | null = null
let currentDtype:  string | null = null
let lastOrigin = ''

// fp16 requires shader-f16 WebGPU feature; we probe for it before loading.
const GPU_DTYPES = ['fp16'] as const

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

// ── Text chunker ──────────────────────────────────────────────────────────────
// Kokoro has a ~510 phoneme limit per generation (~200 chars of English text).
// Split text at sentence boundaries, then clause boundaries if still too long.

function splitIntoChunks(text: string, maxChars = 220): string[] {
  if (text.trim().length <= maxChars) return [text.trim()]

  const chunks: string[] = []
  // Split at sentence endings, keeping the punctuation
  const sentences = text.split(/(?<=[.!?])\s+/)

  let current = ''
  for (const sentence of sentences) {
    if (!sentence.trim()) continue

    if (sentence.length > maxChars) {
      // Sentence is longer than maxChars — split at clauses (commas)
      if (current) { chunks.push(current.trim()); current = '' }
      const clauses = sentence.split(/,\s+/)
      let group = ''
      for (const clause of clauses) {
        const candidate = group ? `${group}, ${clause}` : clause
        if (candidate.length > maxChars && group) {
          chunks.push(group.trim())
          group = clause
        } else {
          group = candidate
        }
      }
      if (group.trim()) chunks.push(group.trim())
    } else {
      const candidate = current ? `${current} ${sentence}` : sentence
      if (candidate.length > maxChars && current) {
        chunks.push(current.trim())
        current = sentence
      } else {
        current = candidate
      }
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks.filter(c => c.trim().length > 0)
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

function concatFloat32(arrays: Float32Array[]): Float32Array {
  const total = arrays.reduce((s, a) => s + a.length, 0)
  const out = new Float32Array(total)
  let offset = 0
  for (const a of arrays) { out.set(a, offset); offset += a.length }
  return out
}

// ── Shared sample extraction ──────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractSamples(out: any): { samples: Float32Array; sr: number } {
  const raw = out
  let samples: Float32Array
  if (raw?.audio instanceof Float32Array)            samples = raw.audio
  else if (raw?.data  instanceof Float32Array)       samples = raw.data
  else if (raw?.audio?.data instanceof Float32Array) samples = raw.audio.data
  else                                               samples = raw as Float32Array
  return { samples, sr: raw?.sampling_rate ?? 24000 }
}

async function runChunks(
  text: string, voice: string, speed: number,
): Promise<{ combined: Float32Array; sr: number } | null> {
  const chunks = splitIntoChunks(text)
  const allSamples: Float32Array[] = []
  let sr = 24000
  try {
    for (let i = 0; i < chunks.length; i++) {
      if (chunks.length > 1) post({ type: 'genProgress', chunk: i + 1, total: chunks.length })
      const out = await tts.generate(chunks[i]!, { voice, speed })
      const ex  = extractSamples(out)
      allSamples.push(ex.samples)
      sr = ex.sr
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!msg.includes('createBuffer') && !msg.includes('GPUDevice')) {
      post({ type: 'error', msg })
    }
    return null
  }
  return { combined: concatFloat32(allSamples), sr }
}

function isSilent(samples: Float32Array): boolean {
  for (const s of samples) if (Math.abs(s) > 0.0001) return false
  return true
}

// ── Cache check ───────────────────────────────────────────────────────────────

async function isCoreModelCached(): Promise<boolean> {
  try {
    const cache = await caches.open('transformers-cache')
    const hit   = await cache.match(`${HF_BASE}/config.json`)
    return !!hit
  } catch {
    return false
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

// Returns true only when the WebGPU adapter exists AND supports shader-f16.
// Without shader-f16, fp16 inference runs silently on zeros.
async function probeWebGpu(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('gpu' in navigator)) return false
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = await (navigator as any).gpu.requestAdapter()
    if (!adapter) return false
    return (adapter.features as Set<string>).has('shader-f16')
  } catch {
    return false
  }
}

async function doInit(preferDevice: KokoroDevice, origin: string) {
  lastOrigin = origin
  post({ type: 'status', msg: 'Preparing…' })
  try {
    // Check before warming — if user cleared the cache, don't silently refill it
    const cached = await isCoreModelCached()
    if (!cached) {
      post({ type: 'error', msg: 'Model files not downloaded. Open the AI Model page (brain icon) to download the Kokoro TTS model first.' })
      return
    }

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
      post({ type: 'status', msg: 'Checking GPU support…' })
      const gpuReady = await probeWebGpu()

      if (!gpuReady) {
        if (!tryWasm) {
          post({ type: 'error', msg: 'GPU unavailable (no WebGPU shader-f16 support) and CPU fallback is disabled' })
          return
        }
        post({ type: 'status', msg: 'GPU not supported on this device — using CPU…' })
      } else {
        for (const dtype of GPU_DTYPES) {
          try {
            post({ type: 'status', msg: 'Loading on GPU…' })
            tts = await KokoroTTS.from_pretrained(REPO, {
              dtype, device: 'webgpu', progress_callback: onProgress,
            })
            currentDevice = 'gpu'
            currentDtype  = dtype
            post({ type: 'ready', device: 'gpu' })
            return
          } catch {
            tts = null
            post({ type: 'status', msg: `GPU (${dtype}) failed, trying next…` })
          }
        }

        if (!tryWasm) {
          post({ type: 'error', msg: 'GPU unavailable and CPU fallback is disabled' })
          return
        }
        post({ type: 'status', msg: 'GPU load failed — falling back to CPU…' })
      }
    }

    if (tryWasm) {
      post({ type: 'status', msg: 'Loading on CPU…' })
      tts = await KokoroTTS.from_pretrained(REPO, {
        dtype: 'q8', device: 'wasm', progress_callback: onProgress,
      })
      currentDevice = 'cpu'
      currentDtype  = 'q8'
      post({ type: 'ready', device: 'cpu' })
    }
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e)
    const isHtmlResponse = raw.includes('<!DOCTYPE') || raw.includes('is not valid JSON') || raw.includes('Unexpected token')
    post({
      type: 'error',
      msg: isHtmlResponse
        ? 'Model files are missing or incomplete. Open the AI Model page to re-download them.'
        : raw,
    })
  }
}

// ── Generate ──────────────────────────────────────────────────────────────────

async function doGenerate(text: string, voice: string, speed: number) {
  if (!tts) { post({ type: 'error', msg: 'Model not loaded' }); return }
  const t0 = Date.now()

  const result = await runChunks(text, voice, speed)

  if (!result) {
    // Hard GPU error — try next dtype before CPU
    if (currentDevice === 'gpu') return await handleGpuFallback(text, voice, speed, t0)
    return
  }

  // Silence detection — GPU only, on first attempt
  if (currentDevice === 'gpu' && isSilent(result.combined)) {
    return await handleGpuFallback(text, voice, speed, t0)
  }

  const buffer = encodeWav(result.combined, result.sr)
  post({ type: 'audio', buffer, elapsedMs: Date.now() - t0, sampleRate: result.sr, device: currentDevice!, gpuFallback: false }, [buffer])
}

async function handleGpuFallback(text: string, voice: string, speed: number, t0: number) {
  const failedDtype = currentDtype
  tts = null; currentDevice = null; currentDtype = null

  // Find the next GPU dtype to try before giving up on GPU entirely
  const dtypeIdx  = GPU_DTYPES.indexOf(failedDtype as typeof GPU_DTYPES[number])
  const nextDtype = dtypeIdx >= 0 && dtypeIdx < GPU_DTYPES.length - 1
    ? GPU_DTYPES[dtypeIdx + 1]!
    : null

  if (nextDtype) {
    post({ type: 'status', msg: `GPU silent — trying ${nextDtype} model…` })
    try {
      const { KokoroTTS } = await import('kokoro-js')
      tts = await KokoroTTS.from_pretrained(REPO, { dtype: nextDtype, device: 'webgpu' })
      currentDevice = 'gpu'
      currentDtype  = nextDtype
      post({ type: 'ready', device: 'gpu' })

      const result = await runChunks(text, voice, speed)
      if (result && !isSilent(result.combined)) {
        const buffer = encodeWav(result.combined, result.sr)
        post({ type: 'audio', buffer, elapsedMs: Date.now() - t0, sampleRate: result.sr, device: 'gpu', gpuFallback: false }, [buffer])
        return
      }
      // This dtype also failed — fall through to CPU
      tts = null; currentDevice = null; currentDtype = null
    } catch {
      tts = null; currentDevice = null; currentDtype = null
    }
  }

  // All GPU dtypes exhausted — reinit with CPU wasm
  post({ type: 'status', msg: 'GPU output invalid — switching to CPU…' })
  await doInit('cpu', lastOrigin)
  if (!tts) { post({ type: 'error', msg: 'CPU fallback failed. Please reload.' }); return }

  const result = await runChunks(text, voice, speed)
  if (!result) return
  const buffer = encodeWav(result.combined, result.sr)
  post({ type: 'audio', buffer, elapsedMs: Date.now() - t0, sampleRate: result.sr, device: 'cpu', gpuFallback: true }, [buffer])
}

// ── Entry point ───────────────────────────────────────────────────────────────

self.addEventListener('message', (e: MessageEvent<WorkerIn>) => {
  const msg = e.data
  if (msg.type === 'init')     void doInit(msg.preferDevice, msg.origin)
  if (msg.type === 'generate') void doGenerate(msg.text, msg.voice, msg.speed)
  if (msg.type === 'dispose')  { tts = null; self.close() }
})
