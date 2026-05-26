// Chatterbox TTS — expressive open-source TTS by Resemble AI
// onnx-community/chatterbox-ONNX · emotion exaggeration · ships with default voice
const REPO              = 'onnx-community/chatterbox-ONNX'
const DEFAULT_VOICE_URL = `https://huggingface.co/${REPO}/resolve/main/default_voice.wav`
const SAMPLE_RATE       = 24_000

export type ParlerWorkerIn =
  | { type: 'init' }
  | { type: 'generate'; text: string; exaggeration: number }
  | { type: 'set-voice'; pcmBuffer: ArrayBuffer }
  | { type: 'reset-voice' }
  | { type: 'dispose' }

export type ParlerWorkerOut =
  | { type: 'status';      msg: string }
  | { type: 'progress';    value: number }
  | { type: 'ready' }
  | { type: 'voice-ready' }
  | { type: 'gpu-fallback' }
  | { type: 'audio';       buffer: ArrayBuffer; elapsedMs: number; sampleRate: number }
  | { type: 'error';       msg: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let model: any          = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let processor: any      = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let defaultSpeaker: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let activeSpeaker: any  = null // null = use defaultSpeaker

let currentDevice: 'webgpu' | 'wasm' = 'wasm'
// Cached PCM samples for active speaker — re-encoded after GPU fallback
let _cachedVoiceSamples: Float32Array | null = null

function post(msg: ParlerWorkerOut, transfer: Transferable[] = []) {
  self.postMessage(msg, transfer)
}

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

// Minimal PCM WAV decoder — searches for fmt+data chunks
function decodeWavPcm(buffer: ArrayBuffer): Float32Array {
  const v = new DataView(buffer)
  let offset = 12 // skip RIFF/WAVE header
  let bitsPerSample = 16
  let dataStart = -1
  let dataLen   = -1

  while (offset < buffer.byteLength - 8) {
    const id   = String.fromCharCode(v.getUint8(offset), v.getUint8(offset+1), v.getUint8(offset+2), v.getUint8(offset+3))
    const size = v.getUint32(offset + 4, true)
    if (id === 'fmt ') bitsPerSample = v.getUint16(offset + 22, true)
    if (id === 'data') { dataStart = offset + 8; dataLen = size; break }
    offset += 8 + size + (size & 1)
  }
  if (dataStart < 0) throw new Error('Invalid WAV: no data chunk found')

  const n   = dataLen / (bitsPerSample / 8)
  const out = new Float32Array(n)
  if (bitsPerSample === 16) {
    for (let i = 0; i < n; i++) out[i] = v.getInt16(dataStart + i * 2, true) / 32768
  } else if (bitsPerSample === 32) {
    for (let i = 0; i < n; i++) out[i] = v.getFloat32(dataStart + i * 4, true)
  } else {
    throw new Error(`Unsupported WAV format: ${bitsPerSample}-bit`)
  }
  return out
}

async function doInit(forceWasm = false) {
  post({ type: 'status', msg: 'Detecting device…' })

  const useWebGpu = !forceWasm && !!navigator.gpu
  const device    = useWebGpu ? 'webgpu' : 'wasm'
  currentDevice   = device
  const dtype     = useWebGpu
    ? { embed_tokens: 'fp32', speech_encoder: 'fp32', language_model: 'q4f16', conditional_decoder: 'fp32' }
    : { embed_tokens: 'fp32', speech_encoder: 'fp32', language_model: 'q4',    conditional_decoder: 'fp32' }

  try {
    const { ChatterboxModel, AutoProcessor, Tensor } = await import('@huggingface/transformers')

    const onProgress = (p: { status?: string; file?: string; progress?: number }) => {
      if (p.status === 'progress' && typeof p.progress === 'number') {
        post({ type: 'progress', value: Math.round(p.progress) })
      }
      if (p.file) post({ type: 'status', msg: `Loading ${p.file.split('/').pop() ?? p.file}…` })
    }

    post({ type: 'status', msg: 'Loading processor…' })
    processor = await AutoProcessor.from_pretrained(REPO)

    post({ type: 'status', msg: `Loading Chatterbox (${device.toUpperCase()})…` })
    model = await ChatterboxModel.from_pretrained(REPO, { device, dtype, progress_callback: onProgress })

    post({ type: 'status', msg: 'Encoding default voice…' })
    const voiceRes = await fetch(DEFAULT_VOICE_URL)
    if (!voiceRes.ok) throw new Error(`Default voice fetch failed: HTTP ${voiceRes.status}`)
    const voiceSamples = decodeWavPcm(await voiceRes.arrayBuffer())
    const voiceTensor  = new Tensor('float32', voiceSamples, [1, voiceSamples.length])
    defaultSpeaker     = await model.encode_speech(voiceTensor)

    // Re-encode cached custom voice after a GPU→CPU fallback re-init
    if (_cachedVoiceSamples) {
      const t = new Tensor('float32', _cachedVoiceSamples, [1, _cachedVoiceSamples.length])
      activeSpeaker = await model.encode_speech(t)
    }

    post({ type: 'ready' })
  } catch (e) {
    post({ type: 'error', msg: e instanceof Error ? e.message : String(e) })
  }
}

async function doSetVoice(pcmBuffer: ArrayBuffer) {
  try {
    const { Tensor } = await import('@huggingface/transformers')
    const samples = new Float32Array(pcmBuffer)
    _cachedVoiceSamples = samples // kept for GPU→CPU fallback re-encoding
    const tensor  = new Tensor('float32', samples, [1, samples.length])
    activeSpeaker = await model.encode_speech(tensor)
    post({ type: 'voice-ready' })
  } catch (e) {
    post({ type: 'error', msg: `Voice encoding failed: ${e instanceof Error ? e.message : String(e)}` })
  }
}

async function doGenerate(text: string, exaggeration: number) {
  if (!model || !processor || !defaultSpeaker) {
    post({ type: 'error', msg: 'Chatterbox not loaded' }); return
  }

  const speaker = activeSpeaker ?? defaultSpeaker
  const t0 = Date.now()
  try {
    const inputs   = await processor._call(text)
    const waveform = await model.generate({
      ...inputs,
      ...speaker,
      exaggeration: Math.max(0, Math.min(2, exaggeration)),
      max_new_tokens: 1000,
    })

    const raw: Float32Array = waveform.data
    const buffer = encodeWav(raw, SAMPLE_RATE)
    post({ type: 'status', msg: '' })
    post({ type: 'audio', buffer, elapsedMs: Date.now() - t0, sampleRate: SAMPLE_RATE }, [buffer])
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // WebGPU device lost — re-init on CPU and retry automatically
    if (currentDevice === 'webgpu' && (msg.includes('OrtRun') || msg.includes('MapAsyncStatus') || msg.includes('mapAsync'))) {
      post({ type: 'gpu-fallback' })
      post({ type: 'status', msg: 'GPU error — switching to CPU…' })
      model = null; processor = null; defaultSpeaker = null; activeSpeaker = null
      await doInit(true)
      if (model && defaultSpeaker) void doGenerate(text, exaggeration)
    } else {
      post({ type: 'error', msg })
    }
  }
}

self.addEventListener('message', (e: MessageEvent<ParlerWorkerIn>) => {
  const msg = e.data
  if (msg.type === 'init')        void doInit()
  if (msg.type === 'generate')    void doGenerate(msg.text, msg.exaggeration)
  if (msg.type === 'set-voice')   void doSetVoice(msg.pcmBuffer)
  if (msg.type === 'reset-voice') { activeSpeaker = null; post({ type: 'voice-ready' }) }
  if (msg.type === 'dispose')     { model = null; processor = null; defaultSpeaker = null; activeSpeaker = null; _cachedVoiceSamples = null; self.close() }
})
