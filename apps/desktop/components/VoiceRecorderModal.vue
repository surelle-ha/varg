<script setup lang="ts">
const emit = defineEmits<{
  recorded: [buffer: ArrayBuffer]
  cancel:   []
}>()

// ── Devices ────────────────────────────────────────────────────────────────────
const devices      = ref<MediaDeviceInfo[]>([])
const selectedId   = ref<string>('')

async function loadDevices() {
  try {
    // Need at least one permission grant to get labels
    const tmp = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    tmp.getTracks().forEach(t => t.stop())
  } catch { /* will surface as micError below */ }
  try {
    const all = await navigator.mediaDevices.enumerateDevices()
    devices.value = all.filter(d => d.kind === 'audioinput')
    if (!selectedId.value && devices.value.length > 0) {
      selectedId.value = devices.value[0]!.deviceId
    }
  } catch { /* ignore */ }
}

// ── State ─────────────────────────────────────────────────────────────────────
const isRecording  = ref(false)
const hasStopped   = ref(false)
const recordingMs  = ref(0)
const micError     = ref('')
const canvasRef    = ref<HTMLCanvasElement | null>(null)

let _stream:    MediaStream | null    = null
let _recorder:  MediaRecorder | null = null
let _analyser:  AnalyserNode | null  = null
let _audioCtx:  AudioContext | null  = null
let _animFrame: number | null        = null
let _timer:     ReturnType<typeof setInterval> | null = null
let _chunks:    Blob[]               = []

const recordingTime = computed(() => {
  const s = Math.floor(recordingMs.value / 1000)
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
})

const activeDevice = computed(() => {
  return devices.value.find(d => d.deviceId === selectedId.value)
})

// ── Recording ─────────────────────────────────────────────────────────────────
async function startRecording() {
  micError.value = ''
  // Stop any existing stream first (device switch)
  _stopVisuals()
  _stream?.getTracks().forEach(t => t.stop())
  _stream = null

  const constraints: MediaStreamConstraints = {
    audio: selectedId.value ? { deviceId: { exact: selectedId.value } } : true,
    video: false,
  }
  try {
    _stream = await navigator.mediaDevices.getUserMedia(constraints)

    // Refresh device list now that we have permission with labels
    if (devices.value.some(d => !d.label)) await loadDevices()

    _audioCtx = new AudioContext()
    _analyser = _audioCtx.createAnalyser()
    _analyser.fftSize               = 64
    _analyser.smoothingTimeConstant = 0.55
    const src = _audioCtx.createMediaStreamSource(_stream)
    src.connect(_analyser)

    _chunks   = []
    _recorder = new MediaRecorder(_stream)
    _recorder.ondataavailable = e => { if (e.data.size > 0) _chunks.push(e.data) }
    _recorder.onstop = async () => {
      _stopVisuals()
      _stream?.getTracks().forEach(t => t.stop())
      hasStopped.value  = true
      isRecording.value = false
      if (_chunks.length === 0) { emit('cancel'); return }
      const blob   = new Blob(_chunks, { type: _chunks[0]!.type })
      const arrBuf = await blob.arrayBuffer()
      const ctx    = new AudioContext()
      try {
        const decoded = await ctx.decodeAudioData(arrBuf)
        const raw     = decoded.getChannelData(0)
        emit('recorded', new Float32Array(raw).buffer)
      } finally {
        ctx.close()
      }
    }
    _recorder.start()
    isRecording.value = true
    hasStopped.value  = false
    recordingMs.value = 0
    _timer = setInterval(() => { recordingMs.value += 100 }, 100)
    await nextTick()
    _drawLoop()
  } catch (e) {
    micError.value = e instanceof Error ? e.message : 'Microphone unavailable.'
  }
}

async function switchDevice(deviceId: string) {
  if (deviceId === selectedId.value && isRecording.value) return
  selectedId.value = deviceId
  if (isRecording.value) await startRecording()
}

function stopRecording() {
  if (_recorder?.state === 'recording') _recorder.stop()
}

function cancel() {
  if (_recorder?.state === 'recording') _recorder.stop()
  _stopVisuals()
  _stream?.getTracks().forEach(t => t.stop())
  emit('cancel')
}

function _stopVisuals() {
  if (_animFrame) { cancelAnimationFrame(_animFrame); _animFrame = null }
  if (_timer)     { clearInterval(_timer);             _timer     = null }
  _audioCtx?.close(); _audioCtx = null; _analyser = null
}

// ── Canvas visualisation ──────────────────────────────────────────────────────
function _drawLoop() {
  if (!canvasRef.value || !_analyser) return
  const canvas = canvasRef.value
  const ctx2d  = canvas.getContext('2d')
  if (!ctx2d) return

  canvas.width  = canvas.clientWidth  || 368
  canvas.height = canvas.clientHeight || 80

  const bins = _analyser.frequencyBinCount
  const data = new Uint8Array(bins)

  function draw() {
    if (!_analyser) return
    _animFrame = requestAnimationFrame(draw)
    _analyser.getByteFrequencyData(data)

    const W    = canvas.width
    const H    = canvas.height
    const midY = H / 2
    const gap  = 2
    const barW = (W - gap * (bins - 1)) / bins

    ctx2d.clearRect(0, 0, W, H)

    ctx2d.fillStyle = 'rgba(88,101,242,0.12)'
    ctx2d.fillRect(0, midY - 1, W, 2)

    for (let i = 0; i < bins; i++) {
      const raw  = data[i]! / 255
      const half = Math.max(4, raw * midY * 0.92)
      const x    = i * (barW + gap)
      const grad = ctx2d.createLinearGradient(0, midY - half, 0, midY + half)
      grad.addColorStop(0,   `rgba(88,101,242,${0.2 + raw * 0.8})`)
      grad.addColorStop(0.5, `rgba(88,101,242,${0.5 + raw * 0.5})`)
      grad.addColorStop(1,   `rgba(88,101,242,${0.2 + raw * 0.8})`)
      ctx2d.fillStyle = grad
      ctx2d.fillRect(x, midY - half, barW, half * 2)
    }
  }
  draw()
}

onMounted(async () => {
  await loadDevices()
  await startRecording()
})
onUnmounted(() => { _stopVisuals(); _stream?.getTracks().forEach(t => t.stop()) })
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-x-0 bottom-0 top-9 z-50 flex items-center justify-center"
      @click.self="cancel">
      <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div class="relative z-10 w-96 rounded-2xl border border-white/10 bg-surface shadow-2xl overflow-hidden">

        <!-- Header -->
        <div class="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <div class="flex items-center gap-2.5">
            <div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
              :class="isRecording ? 'bg-err/15' : 'bg-subtle'">
              <span v-if="isRecording" class="h-2.5 w-2.5 rounded-full bg-err animate-pulse" />
              <svg v-else class="h-4 w-4 text-faded/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V5.25a3 3 0 116 0v7.5a3 3 0 01-3 3z" />
              </svg>
            </div>
            <div>
              <p class="text-[13px] font-semibold text-primary">
                {{ isRecording ? 'Recording…' : hasStopped ? 'Processing…' : 'Starting…' }}
              </p>
              <p class="truncate max-w-[200px] text-[10px] text-faded/50">
                {{ activeDevice?.label || 'Waiting for microphone…' }}
              </p>
            </div>
          </div>
          <span class="font-mono text-[22px] font-bold tabular-nums leading-none"
            :class="isRecording ? 'text-err' : 'text-faded/30'">
            {{ recordingTime }}
          </span>
        </div>

        <!-- Visualiser canvas -->
        <div class="bg-overlay py-4 px-4">
          <canvas ref="canvasRef" class="w-full rounded-lg" style="display:block; height:80px" />
        </div>

        <!-- Device selector -->
        <div class="px-5 pt-3 pb-1 space-y-1.5">
          <p class="text-[10px] font-semibold uppercase tracking-widest text-faded/40">Input device</p>
          <div class="space-y-1 max-h-28 overflow-y-auto">
            <button
              v-for="d in devices"
              :key="d.deviceId"
              type="button"
              class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-ui"
              :class="d.deviceId === selectedId
                ? 'bg-accent/15 text-accent'
                : 'hover:bg-subtle text-faded hover:text-secondary'"
              @click="switchDevice(d.deviceId)"
            >
              <svg class="h-3 w-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V5.25a3 3 0 116 0v7.5a3 3 0 01-3 3z" />
              </svg>
              <span class="truncate text-[11px]">{{ d.label || `Microphone ${d.deviceId.slice(0, 6)}` }}</span>
              <span v-if="d.deviceId === selectedId" class="ml-auto h-1.5 w-1.5 rounded-full bg-accent flex-shrink-0" />
            </button>
          </div>
        </div>

        <!-- Error -->
        <div v-if="micError" class="mx-5 mt-2 rounded-lg border border-err/20 bg-err/10 px-3 py-2 text-[11px] text-err">
          {{ micError }}
        </div>

        <!-- Tip -->
        <div class="px-5 pt-2 pb-1">
          <p class="text-[10px] text-faded/35">
            Speak naturally for 10–30 s in a quiet environment for best cloning quality.
          </p>
        </div>

        <!-- Actions -->
        <div class="flex gap-2 px-5 py-4">
          <button type="button"
            class="flex-1 rounded-xl border border-white/10 py-2.5 text-[12px] font-medium text-secondary transition-ui hover:bg-subtle"
            @click="cancel">
            Cancel
          </button>
          <button type="button"
            class="flex-1 rounded-xl py-2.5 text-[12px] font-semibold text-white shadow-button transition-ui active:scale-[0.98]"
            :class="isRecording ? 'bg-err hover:brightness-110' : 'bg-subtle text-faded cursor-not-allowed'"
            :disabled="!isRecording"
            @click="stopRecording">
            <span class="flex items-center justify-center gap-1.5">
              <span v-if="isRecording" class="h-2.5 w-2.5 rounded-sm bg-white" />
              {{ isRecording ? 'Stop Recording' : hasStopped ? 'Processing…' : 'Waiting…' }}
            </span>
          </button>
        </div>

      </div>
    </div>
  </Teleport>
</template>
