<script setup lang="ts">
const emit = defineEmits<{
  recorded: [buffer: ArrayBuffer]
  cancel:   []
}>()

// ── State ─────────────────────────────────────────────────────────────────────
const isRecording  = ref(false)
const hasStopped   = ref(false)
const recordingMs  = ref(0)
const micError     = ref('')
const micDevice    = ref('')
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

// ── Recording ─────────────────────────────────────────────────────────────────
async function startRecording() {
  micError.value = ''
  try {
    _stream   = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    micDevice.value = _stream.getAudioTracks()[0]?.label || 'Default microphone'

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
    recordingMs.value = 0
    _timer = setInterval(() => { recordingMs.value += 100 }, 100)
    await nextTick() // ensure canvas is painted before drawing
    _drawLoop()
  } catch (e) {
    micError.value = e instanceof Error ? e.message : 'Microphone unavailable.'
  }
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

  // Sync drawing buffer to actual CSS rendered size (avoids blurry/wrong scale)
  canvas.width  = canvas.clientWidth  || 368
  canvas.height = canvas.clientHeight || 80

  const bins = _analyser.frequencyBinCount  // 32
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

    // Faint centre line
    ctx2d.fillStyle = 'rgba(88,101,242,0.12)'
    ctx2d.fillRect(0, midY - 1, W, 2)

    for (let i = 0; i < bins; i++) {
      const raw  = data[i]! / 255                        // 0–1
      // Give a guaranteed minimum height so something is always visible
      const half = Math.max(4, raw * midY * 0.92)
      const x    = i * (barW + gap)

      // Mirrored bar (top + bottom)
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

onMounted(() => { startRecording() })
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
                {{ micDevice || 'Waiting for microphone…' }}
              </p>
            </div>
          </div>
          <!-- Timer -->
          <span class="font-mono text-[22px] font-bold tabular-nums leading-none"
            :class="isRecording ? 'text-err' : 'text-faded/30'">
            {{ recordingTime }}
          </span>
        </div>

        <!-- Visualiser canvas -->
        <div class="bg-overlay py-4 px-4">
          <canvas ref="canvasRef"
            class="w-full rounded-lg"
            style="display:block; height:80px" />
        </div>

        <!-- Device pill -->
        <div v-if="micDevice" class="mx-5 mt-2 flex items-center gap-1.5">
          <svg class="h-3 w-3 flex-shrink-0 text-faded/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V5.25a3 3 0 116 0v7.5a3 3 0 01-3 3z" />
          </svg>
          <span class="truncate text-[10px] text-faded/50">{{ micDevice }}</span>
        </div>

        <!-- Error -->
        <div v-if="micError" class="mx-5 mt-3 rounded-lg border border-err/20 bg-err/10 px-3 py-2 text-[11px] text-err">
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
