import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useKokoro } from './useKokoro'
import { useHistory } from './useHistory'
import { saveGenerationToDisk } from './useHistorySave'

const MCP_PORT_KEY = 'varg-mcp-port'
const MCP_AUTO_KEY = 'varg-mcp-auto'

interface McpStatus { running: boolean; port: number }

// Module-level singleton
const running  = ref(false)
const port     = ref<number>(
  import.meta.client ? Number(localStorage.getItem(MCP_PORT_KEY) ?? 3700) : 3700
)
const autoStart = ref<boolean>(
  import.meta.client ? localStorage.getItem(MCP_AUTO_KEY) === 'true' : false
)
const error    = ref<string | null>(null)
const starting = ref(false)

// ── TTS bridge listener ────────────────────────────────────────────────────
// Called once on app mount; bridges mcp:generate-speech events from the Rust
// MCP server to the kokoro-js engine running in the WebView.

let _listenerActive = false

export async function setupTtsListener() {
  if (_listenerActive || !import.meta.client) return
  _listenerActive = true

  await listen<{ requestId: string; text: string; voiceId?: string; speed?: number }>(
    'mcp:generate-speech',
    async (event) => {
      const { requestId, text, voiceId, speed } = event.payload
      const { generateForMcp, genDevice } = useKokoro()
      const startMs = Date.now()
      try {
        const buffer    = await generateForMcp(text, voiceId, speed ?? 1.0)
        const elapsedMs = Date.now() - startMs
        // WAV: 44-byte header, 16-bit mono 24 kHz
        const duration  = Math.max(0, (buffer.byteLength - 44) / 2 / 24_000)

        const saveParams = {
          timestamp: Date.now(),
          text,
          voice:     voiceId ?? 'af_heart',
          speed:     speed ?? 1.0,
          device:    (genDevice.value ?? 'cpu') as 'gpu' | 'cpu',
          elapsedMs,
          duration,
          wav:       buffer,
          source:    'mcp' as const,
        }

        const { add } = useHistory()
        await add(saveParams)
        saveGenerationToDisk(saveParams).catch(e => console.error('[Varg] disk save failed:', e))

        const audioBytes = Array.from(new Uint8Array(buffer))
        await invoke('mcp_tts_complete', { requestId, audioBytes })
      } catch (e: unknown) {
        await invoke('mcp_tts_error', { requestId, errorMsg: String(e) })
      }
    },
  )
}

export function useMcp() {
  async function refresh() {
    try {
      const s = await invoke<McpStatus>('mcp_status')
      running.value = s.running
      port.value    = s.port
    } catch {}
  }

  async function start(p?: number) {
    const targetPort = p ?? port.value
    starting.value = true
    error.value    = null
    try {
      await invoke('mcp_start', { port: targetPort })
      running.value = true
      port.value    = targetPort
      if (import.meta.client) localStorage.setItem(MCP_PORT_KEY, String(targetPort))
    } catch (e: unknown) {
      error.value = String(e)
    } finally {
      starting.value = false
    }
  }

  async function stop() {
    error.value = null
    try {
      await invoke('mcp_stop')
      running.value = false
    } catch (e: unknown) {
      error.value = String(e)
    }
  }

  function setPort(p: number) {
    port.value = p
    if (import.meta.client) localStorage.setItem(MCP_PORT_KEY, String(p))
  }

  function setAutoStart(v: boolean) {
    autoStart.value = v
    if (import.meta.client) localStorage.setItem(MCP_AUTO_KEY, String(v))
  }

  const serverUrl = computed(() => `http://127.0.0.1:${port.value}/mcp`)

  return { running, port, autoStart, error, starting, serverUrl, start, stop, setPort, setAutoStart, refresh }
}
