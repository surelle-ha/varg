import { getVersion } from '@tauri-apps/api/app'

const RELEASES_URL = 'https://api.github.com/repos/surelle-ha/Varg/releases/latest'

const updateAvailable = ref(false)
const latestVersion   = ref('')
const currentVersion  = ref('')
const releaseUrl      = ref('')
const checking        = ref(false)

function semverGt(a: string, b: string): boolean {
  const pa = a.replace(/^v/, '').split('.').map(Number)
  const pb = b.replace(/^v/, '').split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return true
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return false
  }
  return false
}

export function useUpdater() {
  async function checkForUpdates() {
    if (checking.value) return
    checking.value = true
    try {
      const ver = await getVersion()
      currentVersion.value = ver
      const res = await fetch(RELEASES_URL, {
        headers: { Accept: 'application/vnd.github+json' },
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) return
      const data = await res.json() as { tag_name: string; html_url: string }
      latestVersion.value = data.tag_name.replace(/^v/, '')
      releaseUrl.value    = data.html_url
      if (semverGt(latestVersion.value, ver)) {
        updateAvailable.value = true
      }
    } catch {
      // network unavailable or rate limited — silent
    } finally {
      checking.value = false
    }
  }

  return { updateAvailable, latestVersion, currentVersion, releaseUrl, checking, checkForUpdates }
}
