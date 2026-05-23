export interface UserProfile {
  firstName: string
  lastName:  string
  position:  string
  avatar:    string | null
  onboarded: boolean
}

const STORAGE_KEY = 'varg-profile'

function defaultProfile(): UserProfile {
  return { firstName: '', lastName: '', position: '', avatar: null, onboarded: false }
}

function load(): UserProfile {
  if (typeof localStorage === 'undefined') return defaultProfile()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...defaultProfile(), ...(JSON.parse(raw) as Partial<UserProfile>) } : defaultProfile()
  } catch {
    return defaultProfile()
  }
}

function persist(p: UserProfile) {
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
}

// Module-level singleton so all consumers share one reactive ref
const _profile = ref<UserProfile>(typeof window !== 'undefined' ? load() : defaultProfile())

export function useProfile() {
  function update(patch: Partial<UserProfile>) {
    _profile.value = { ..._profile.value, ...patch }
    persist(_profile.value)
  }

  async function setAvatar(file: File) {
    const dataUrl = await resizeImage(file, 240)
    update({ avatar: dataUrl })
  }

  function clearAvatar() {
    update({ avatar: null })
  }

  function completeOnboarding(data: Pick<UserProfile, 'firstName' | 'lastName' | 'position'>) {
    update({ ...data, onboarded: true })
  }

  function clearProfile() {
    _profile.value = defaultProfile()
    if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY)
  }

  return { profile: _profile, update, setAvatar, clearAvatar, completeOnboarding, clearProfile }
}

function resizeImage(file: File, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale  = Math.min(maxSize / img.width, maxSize / img.height, 1)
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(img.width  * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = reject
    img.src = url
  })
}
