const SETTINGS_KEY = 'varg-settings'

export interface AppSettings {
  maxChars: number
  defaultVoice: string
  showSystemMonitor: boolean
  showMcpServer: boolean
  notifyOnComplete: boolean
  activeTtsModel: 'kokoro' | 'parler'
  chatterboxExaggeration: number
  hfToken: string
}

const DEFAULTS: AppSettings = {
  maxChars: 5000,
  defaultVoice: 'af_heart',
  showSystemMonitor: true,
  showMcpServer: true,
  notifyOnComplete: true,
  activeTtsModel: 'kokoro',
  chatterboxExaggeration: 0.5,
  hfToken: '',
}

function load(): AppSettings {
  if (typeof localStorage === 'undefined') return { ...DEFAULTS }
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS }
  } catch { return { ...DEFAULTS } }
}

function persist(s: AppSettings) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
}

// Module-level singleton
const settings = ref<AppSettings>(import.meta.client ? load() : { ...DEFAULTS })

export function useSettings() {
  function set<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    settings.value = { ...settings.value, [key]: value }
    persist(settings.value)
  }

  function setMaxChars(n: number) {
    set('maxChars', Math.max(100, Math.min(50_000, Math.round(n))))
  }

  function setDefaultVoice(id: string) {
    set('defaultVoice', id)
  }

  function setShowSystemMonitor(v: boolean) {
    set('showSystemMonitor', v)
  }

  function setShowMcpServer(v: boolean) {
    set('showMcpServer', v)
  }

  function setNotifyOnComplete(v: boolean) {
    set('notifyOnComplete', v)
  }

  function setActiveTtsModel(m: 'kokoro' | 'parler') {
    set('activeTtsModel', m)
  }

  function setChatterboxExaggeration(n: number) {
    set('chatterboxExaggeration', Math.max(0, Math.min(2, n)))
  }

  function setHfToken(t: string) {
    set('hfToken', t)
  }

  return {
    settings,
    setMaxChars, setDefaultVoice, setShowSystemMonitor, setShowMcpServer,
    setNotifyOnComplete, setActiveTtsModel, setChatterboxExaggeration, setHfToken,
  }
}
