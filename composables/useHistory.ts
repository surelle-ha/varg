export interface HistoryEntry {
  id:        string
  timestamp: number
  text:      string
  voice:     string
  speed:     number
  device:    'gpu' | 'cpu'
  elapsedMs: number
  duration:  number
  wav:       ArrayBuffer
}

export type HistoryMeta = Omit<HistoryEntry, 'wav'>

const DB_NAME    = 'varg'
const STORE      = 'history'
const MAX        = 50

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const s = db.createObjectStore(STORE, { keyPath: 'id' })
        s.createIndex('timestamp', 'timestamp')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
  return dbPromise
}

function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((res, rej) => {
    req.onsuccess = () => res(req.result)
    req.onerror   = () => rej(req.error)
  })
}

function idbTx(tx: IDBTransaction): Promise<void> {
  return new Promise((res, rej) => {
    tx.oncomplete = () => res()
    tx.onerror    = () => rej(tx.error)
  })
}

// ── Composable ────────────────────────────────────────────────────────────────

export function useHistory() {
  const entries = ref<HistoryMeta[]>([])

  async function load() {
    const db  = await openDB()
    const tx  = db.transaction(STORE, 'readonly')
    const all = await idbReq<HistoryEntry[]>(
      tx.objectStore(STORE).index('timestamp').getAll(),
    )
    entries.value = all
      .sort((a, b) => b.timestamp - a.timestamp)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .map(({ wav: _wav, ...meta }) => meta)
  }

  async function add(entry: Omit<HistoryEntry, 'id'>) {
    const db  = await openDB()
    const id  = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const full: HistoryEntry = { id, ...entry }

    const tx = db.transaction(STORE, 'readwrite')
    const st = tx.objectStore(STORE)
    st.put(full)
    await idbTx(tx)

    // Trim to MAX oldest entries
    const tx2  = db.transaction(STORE, 'readwrite')
    const st2  = tx2.objectStore(STORE)
    const keys = await idbReq<IDBValidKey[]>(
      st2.index('timestamp').getAllKeys(),
    )
    const excess = keys.length - MAX
    if (excess > 0) {
      for (let i = 0; i < excess; i++) st2.delete(keys[i]!)
    }
    await idbTx(tx2)
    await load()
  }

  async function getWav(id: string): Promise<ArrayBuffer | null> {
    const db  = await openDB()
    const tx  = db.transaction(STORE, 'readonly')
    const row = await idbReq<HistoryEntry | undefined>(tx.objectStore(STORE).get(id))
    return row?.wav ?? null
  }

  async function remove(id: string) {
    const db = await openDB()
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    await idbTx(tx)
    await load()
  }

  async function clear() {
    const db = await openDB()
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).clear()
    await idbTx(tx)
    await load()
  }

  if (import.meta.client) onMounted(load)

  return { entries, add, getWav, remove, clear, reload: load }
}
