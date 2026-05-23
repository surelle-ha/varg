const SETTINGS_KEY = 'varg-settings'

export interface AppSettings {
  maxChars: number
  defaultVoice: string
  showSystemMonitor: boolean
}

const DEFAULTS: AppSettings = {
  maxChars: 5000,
  defaultVoice: 'af_heart',
  showSystemMonitor: true,
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

  return { settings, setMaxChars, setDefaultVoice, setShowSystemMonitor }
}
