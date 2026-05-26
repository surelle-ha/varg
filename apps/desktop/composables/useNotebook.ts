export interface NotebookPage {
  id:        string
  title:     string
  content:   string
  folderId:  string | null
  createdAt: number
  updatedAt: number
}

export interface NotebookFolder {
  id:        string
  name:      string
  collapsed: boolean
  createdAt: number
}

const PAGES_KEY   = 'varg-notebook'
const FOLDERS_KEY = 'varg-notebook-folders'

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function blankPage(folderId: string | null = null): NotebookPage {
  const now = Date.now()
  return { id: genId(), title: 'Untitled', content: '', folderId, createdAt: now, updatedAt: now }
}

function blankFolder(name = 'New Project'): NotebookFolder {
  return { id: genId(), name, collapsed: false, createdAt: Date.now() }
}

function loadPages(): NotebookPage[] {
  if (typeof localStorage === 'undefined') return [blankPage()]
  try {
    const raw = localStorage.getItem(PAGES_KEY)
    const parsed = raw ? (JSON.parse(raw) as NotebookPage[]) : null
    // Migrate old pages that lack folderId
    const list: NotebookPage[] = parsed && parsed.length > 0
      ? parsed.map((p): NotebookPage => ({
          id:        p.id,
          title:     p.title,
          content:   p.content,
          folderId:  (p as NotebookPage).folderId ?? null,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        }))
      : [blankPage()]
    return list
  } catch {
    return [blankPage()]
  }
}

function loadFolders(): NotebookFolder[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(FOLDERS_KEY)
    return raw ? (JSON.parse(raw) as NotebookFolder[]) : []
  } catch {
    return []
  }
}

function persistPages(pages: NotebookPage[]) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(PAGES_KEY, JSON.stringify(pages))
}

function persistFolders(folders: NotebookFolder[]) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders))
}

// ── Composable ────────────────────────────────────────────────────────────────

export function useNotebook() {
  const pages   = ref<NotebookPage[]>(import.meta.client ? loadPages()   : [blankPage()])
  const folders = ref<NotebookFolder[]>(import.meta.client ? loadFolders() : [])
  const activeId = ref(pages.value[0]?.id ?? '')

  const activePage = computed<NotebookPage | undefined>(
    () => pages.value.find(p => p.id === activeId.value),
  )

  // ── Pages ──────────────────────────────────────────────────────────────────
  function createPage(folderId: string | null = null) {
    const page = blankPage(folderId)
    pages.value = [page, ...pages.value]
    activeId.value = page.id
    persistPages(pages.value)
  }

  function update(id: string, patch: Partial<Pick<NotebookPage, 'title' | 'content' | 'folderId'>>) {
    pages.value = pages.value.map(p =>
      p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p,
    )
    persistPages(pages.value)
  }

  function remove(id: string) {
    let list = pages.value.filter(p => p.id !== id)
    if (list.length === 0) list = [blankPage()]
    pages.value = list
    if (activeId.value === id) activeId.value = list[0]?.id ?? ''
    persistPages(pages.value)
  }

  // ── Folders ────────────────────────────────────────────────────────────────
  function createFolder(name = 'New Project') {
    const folder = blankFolder(name)
    folders.value = [...folders.value, folder]
    persistFolders(folders.value)
    return folder
  }

  function renameFolder(id: string, name: string) {
    folders.value = folders.value.map(f => f.id === id ? { ...f, name } : f)
    persistFolders(folders.value)
  }

  function toggleFolder(id: string) {
    folders.value = folders.value.map(f => f.id === id ? { ...f, collapsed: !f.collapsed } : f)
    persistFolders(folders.value)
  }

  function removeFolder(id: string) {
    // Move folder's pages to root (folderId = null) before deleting
    pages.value = pages.value.map(p => p.folderId === id ? { ...p, folderId: null } : p)
    folders.value = folders.value.filter(f => f.id !== id)
    persistPages(pages.value)
    persistFolders(folders.value)
  }

  function movePage(pageId: string, targetFolderId: string | null) {
    pages.value = pages.value.map(p =>
      p.id === pageId ? { ...p, folderId: targetFolderId, updatedAt: Date.now() } : p,
    )
    persistPages(pages.value)
  }

  function reorderPage(pageId: string, targetPageId: string, before: boolean) {
    const list = [...pages.value]
    const fromIdx = list.findIndex(p => p.id === pageId)
    if (fromIdx === -1) return
    const [item] = list.splice(fromIdx, 1)
    if (!item) return
    const toIdx = list.findIndex(p => p.id === targetPageId)
    if (toIdx === -1) { list.push(item); pages.value = list; persistPages(list); return }
    item.folderId  = list[toIdx]!.folderId
    item.updatedAt = Date.now()
    list.splice(before ? toIdx : toIdx + 1, 0, item)
    pages.value = list
    persistPages(pages.value)
  }

  function reorderFolder(fromId: string, beforeId: string | null) {
    const list = [...folders.value]
    const fromIdx = list.findIndex(f => f.id === fromId)
    if (fromIdx === -1) return
    const [item] = list.splice(fromIdx, 1)
    if (!item) return
    if (beforeId === null) {
      list.push(item)
    } else {
      const toIdx = list.findIndex(f => f.id === beforeId)
      list.splice(toIdx === -1 ? list.length : toIdx, 0, item)
    }
    folders.value = list
    persistFolders(folders.value)
  }

  // Keep backward-compat alias
  const create = (folderId: string | null = null) => createPage(folderId)

  return {
    pages, folders, activeId, activePage,
    create, createPage, update, remove,
    createFolder, renameFolder, toggleFolder, removeFolder,
    movePage, reorderPage, reorderFolder,
  }
}

// ── Relative time helper ──────────────────────────────────────────────────────

export function relTime(ts: number): string {
  const d = Date.now() - ts
  if (d < 60_000)         return 'just now'
  if (d < 3_600_000)      return `${Math.floor(d / 60_000)}m ago`
  if (d < 86_400_000)     return `${Math.floor(d / 3_600_000)}h ago`
  if (d < 86_400_000 * 7) return `${Math.floor(d / 86_400_000)}d ago`
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
