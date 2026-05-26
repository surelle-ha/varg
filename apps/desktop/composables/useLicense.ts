const STORAGE_KEY = 'varg-license'

const VALID_KEYS = new Set([
  'VARG-BETA-2026-UNLOCK',
  'VARG-DEV-PREVIEW-2026',
])

// ── Module-level singleton ─────────────────────────────────────────────────────

const isLicensed   = ref(false)
const licenseKey   = ref('')
const licenseError = ref('')

if (import.meta.client) {
  const stored = localStorage.getItem(STORAGE_KEY) ?? ''
  if (stored && VALID_KEYS.has(stored)) {
    isLicensed.value = true
    licenseKey.value = stored
  }
}

export function useLicense() {
  function activate(key: string): boolean {
    const k = key.trim().toUpperCase().replace(/\s+/g, '')
    if (VALID_KEYS.has(k)) {
      isLicensed.value   = true
      licenseKey.value   = k
      licenseError.value = ''
      if (import.meta.client) localStorage.setItem(STORAGE_KEY, k)
      return true
    }
    licenseError.value = 'Invalid license key. Please check your key and try again.'
    return false
  }

  function deactivate() {
    isLicensed.value   = false
    licenseKey.value   = ''
    licenseError.value = ''
    if (import.meta.client) localStorage.removeItem(STORAGE_KEY)
  }

  function maskKey(k: string) {
    const parts = k.split('-')
    return parts.map((p, i) => (i === 0 || i === parts.length - 1) ? p : '****').join('-')
  }

  return { isLicensed, licenseKey, licenseError, maskKey, activate, deactivate }
}
