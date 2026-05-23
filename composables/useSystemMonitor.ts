// ── Types ──────────────────────────────────────────────────────────────────────

export interface GpuInfo {
  vendor:       string
  renderer:     string    // from WebGL unmasked renderer
  adapterName:  string    // from WebGPU adapter description
  architecture: string
  driverInfo:   string
  backendType:  string
  hasFp16:      boolean
  features:     string[]
  limits:       Record<string, number | string>
  glExtensions: string[]
  glParams:     Record<string, string | number>
}

export interface CpuInfo {
  cores: number        // navigator.hardwareConcurrency
  deviceMemoryGb: number | null  // navigator.deviceMemory
}

export interface LiveMetrics {
  heapUsed:   number   // MB
  heapTotal:  number   // MB
  heapLimit:  number   // MB
  jsActivity: number   // 0-100 from rAF delta
}

// ── Module-level singleton state (always running while app is alive) ───────────

const gpuInfo   = ref<GpuInfo | null>(null)
const cpuInfo   = ref<CpuInfo | null>(null)
const live      = ref<LiveMetrics>({ heapUsed: 0, heapTotal: 0, heapLimit: 0, jsActivity: 0 })
const probed    = ref(false)
const floatOpen = ref(false)

let memTimer = 0
let rafId    = 0
let lastRaf  = 0
const frameSamples: number[] = []

function updateMemory() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = (performance as any).memory
  if (m) {
    live.value = {
      ...live.value,
      heapUsed:  Math.round(m.usedJSHeapSize   / 1024 / 1024),
      heapTotal: Math.round(m.totalJSHeapSize  / 1024 / 1024),
      heapLimit: Math.round(m.jsHeapSizeLimit  / 1024 / 1024),
    }
  }
}

function rafLoop(now: number) {
  if (lastRaf > 0) {
    const delta = now - lastRaf
    const load  = Math.min(100, Math.max(0, Math.round(((delta - 16.67) / 50) * 100)))
    frameSamples.push(load)
    if (frameSamples.length > 30) frameSamples.shift()
    const avg = frameSamples.reduce((a, b) => a + b, 0) / frameSamples.length
    live.value = { ...live.value, jsActivity: Math.round(avg) }
  }
  lastRaf = now
  rafId = requestAnimationFrame(rafLoop)
}

async function probeAll() {
  if (probed.value) return
  probed.value = true

  // ── CPU / hardware ────────────────────────────────────────────────────
  cpuInfo.value = {
    cores:          navigator.hardwareConcurrency ?? 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    deviceMemoryGb: (navigator as any).deviceMemory ?? null,
  }

  // ── WebGL params ──────────────────────────────────────────────────────
  const glParams: Record<string, string | number> = {}
  let glVendor   = ''
  let glRenderer = ''
  const glExtensionList: string[] = []
  try {
    const canvas = document.createElement('canvas')
    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext | WebGL2RenderingContext | null
    if (gl) {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info')
      if (dbg) {
        glVendor   = gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)
        glRenderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)
      }
      const supported = gl.getSupportedExtensions() ?? []
      glExtensionList.push(...supported)

      const params: Array<[string, GLenum]> = [
        ['MAX_TEXTURE_SIZE',             gl.MAX_TEXTURE_SIZE],
        ['MAX_RENDERBUFFER_SIZE',        gl.MAX_RENDERBUFFER_SIZE],
        ['MAX_VERTEX_ATTRIBS',           gl.MAX_VERTEX_ATTRIBS],
        ['MAX_VERTEX_UNIFORM_VECTORS',   gl.MAX_VERTEX_UNIFORM_VECTORS],
        ['MAX_FRAGMENT_UNIFORM_VECTORS', gl.MAX_FRAGMENT_UNIFORM_VECTORS],
        ['MAX_TEXTURE_IMAGE_UNITS',      gl.MAX_TEXTURE_IMAGE_UNITS],
        ['MAX_COMBINED_TEXTURE_IMAGE_UNITS', gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS],
        ['MAX_CUBE_MAP_TEXTURE_SIZE',    gl.MAX_CUBE_MAP_TEXTURE_SIZE],
        ['MAX_VIEWPORT_DIMS',            gl.MAX_VIEWPORT_DIMS],
        ['ALIASED_LINE_WIDTH_RANGE',     gl.ALIASED_LINE_WIDTH_RANGE],
        ['ALIASED_POINT_SIZE_RANGE',     gl.ALIASED_POINT_SIZE_RANGE],
      ]
      // WebGL2-only
      if ('MAX_3D_TEXTURE_SIZE' in gl) {
        const gl2 = gl as WebGL2RenderingContext
        params.push(
          ['MAX_3D_TEXTURE_SIZE',           gl2.MAX_3D_TEXTURE_SIZE],
          ['MAX_DRAW_BUFFERS',              gl2.MAX_DRAW_BUFFERS],
          ['MAX_COLOR_ATTACHMENTS',         gl2.MAX_COLOR_ATTACHMENTS],
          ['MAX_SAMPLES',                   gl2.MAX_SAMPLES],
          ['MAX_UNIFORM_BUFFER_BINDINGS',   gl2.MAX_UNIFORM_BUFFER_BINDINGS],
          ['MAX_UNIFORM_BLOCK_SIZE',        gl2.MAX_UNIFORM_BLOCK_SIZE],
          ['MAX_TRANSFORM_FEEDBACK_SEPARATE_ATTRIBS', gl2.MAX_TRANSFORM_FEEDBACK_SEPARATE_ATTRIBS],
        )
      }
      for (const [name, token] of params) {
        const v = gl.getParameter(token)
        if (v !== null && v !== undefined) {
          glParams[name] = v instanceof Int32Array || v instanceof Float32Array
            ? Array.from(v).join(' × ')
            : v as string | number
        }
      }
    }
  } catch { /* no webgl */ }

  // ── WebGPU ────────────────────────────────────────────────────────────
  let gpuFeatures: string[] = []
  let gpuLimits: Record<string, number | string> = {}
  let adapterName   = ''
  let architecture  = ''
  let driverInfo    = ''
  let backendType   = ''
  let hasFp16       = false
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nav = navigator as any
    if (nav.gpu) {
      const adapter = await nav.gpu.requestAdapter()
      if (adapter) {
        hasFp16 = (adapter.features as Set<string>).has('shader-f16')
        gpuFeatures = [...(adapter.features as Set<string>)].sort()

        const info = await adapter.requestAdapterInfo?.().catch(() => null)
        adapterName  = info?.description || info?.device || ''
        architecture = info?.architecture || ''
        driverInfo   = info?.driver       || ''
        backendType  = info?.backendType  || ''

        // Limits
        const l = adapter.limits
        if (l) {
          const limitKeys = [
            'maxTextureDimension1D','maxTextureDimension2D','maxTextureDimension3D',
            'maxTextureArrayLayers','maxBindGroups','maxBindGroupsPlusVertexBuffers',
            'maxBindingsPerBindGroup',
            'maxDynamicUniformBuffersPerPipelineLayout',
            'maxDynamicStorageBuffersPerPipelineLayout',
            'maxSampledTexturesPerShaderStage',
            'maxSamplersPerShaderStage',
            'maxStorageBuffersPerShaderStage',
            'maxStorageTexturesPerShaderStage',
            'maxUniformBuffersPerShaderStage',
            'maxUniformBufferBindingSize',
            'maxStorageBufferBindingSize',
            'minUniformBufferOffsetAlignment',
            'minStorageBufferOffsetAlignment',
            'maxVertexBuffers','maxBufferSize','maxVertexAttributes',
            'maxVertexBufferArrayStride',
            'maxInterStageShaderComponents','maxInterStageShaderVariables',
            'maxColorAttachments','maxColorAttachmentBytesPerSample',
            'maxComputeWorkgroupStorageSize',
            'maxComputeInvocationsPerWorkgroup',
            'maxComputeWorkgroupSizeX','maxComputeWorkgroupSizeY','maxComputeWorkgroupSizeZ',
            'maxComputeWorkgroupsPerDimension',
          ]
          for (const k of limitKeys) {
            if (k in l) gpuLimits[k] = (l as Record<string, number>)[k]!
          }
        }
      }
    }
  } catch { /* no webgpu */ }

  gpuInfo.value = {
    vendor:       glVendor,
    renderer:     glRenderer,
    adapterName,
    architecture,
    driverInfo,
    backendType,
    hasFp16,
    features:     gpuFeatures,
    limits:       gpuLimits,
    glExtensions: glExtensionList,
    glParams,
  }
}

// ── Start polling when first composable call is made ──────────────────────────

let started = false

function startPolling() {
  if (started || typeof window === 'undefined') return
  started = true
  updateMemory()
  memTimer = window.setInterval(updateMemory, 1000)
  rafId = requestAnimationFrame(rafLoop)
  probeAll()
}

// ── Composable ────────────────────────────────────────────────────────────────

export function useSystemMonitor() {
  onMounted(() => startPolling())

  onUnmounted(() => {
    // Only stop polling when no more consumers (simple: just don't stop — let it run for lifetime)
  })

  return { gpuInfo, cpuInfo, live, probed, floatOpen }
}
