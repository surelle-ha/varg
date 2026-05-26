<script setup lang="ts">
export interface ContextMenuItem {
  label:    string
  icon?:    string          // SVG path d= string
  danger?:  boolean
  disabled?: boolean
  action:   () => void
}

export interface ContextMenuEvent {
  x:     number
  y:     number
  items: ContextMenuItem[]
}

// Global context menu state — driven by the 'contextmenu:show' event bus
const visible = ref(false)
const pos     = ref({ x: 0, y: 0 })
const items   = ref<ContextMenuItem[]>([])
const menuRef = ref<HTMLElement | null>(null)

// ── Built-in items always appended ───────────────────────────────────────────
const DEFAULT_ITEMS: ContextMenuItem[] = [
  {
    label:  'Copy',
    icon:   'M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184',
    action: () => document.execCommand('copy'),
  },
  {
    label:  'Paste',
    icon:   'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z',
    action: () => document.execCommand('paste'),
  },
  {
    label:  'Select All',
    icon:   'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12',
    action: () => document.execCommand('selectAll'),
  },
]

function show(e: MouseEvent, extra: ContextMenuItem[] = []) {
  e.preventDefault()
  items.value = [...extra, ...(extra.length ? [{ label: '—', action: () => {} } as ContextMenuItem] : []), ...DEFAULT_ITEMS]

  // Position — keep inside viewport
  const MENU_W = 180
  const MENU_H = items.value.length * 32 + 16
  const vw = window.innerWidth
  const vh = window.innerHeight
  pos.value = {
    x: Math.min(e.clientX, vw - MENU_W - 8),
    y: Math.min(e.clientY, vh - MENU_H - 8),
  }
  visible.value = true
  nextTick(() => menuRef.value?.focus())
}

function hide() { visible.value = false }

function runItem(item: ContextMenuItem) {
  if (item.disabled || item.label === '—') return
  hide()
  item.action()
}

// ── Expose show() so parent can call it ──────────────────────────────────────
defineExpose({ show })

// ── Global contextmenu handler (injected at app level) ────────────────────────
onMounted(() => {
  window.addEventListener('contextmenu', onGlobalContextMenu)
  window.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
  window.removeEventListener('contextmenu', onGlobalContextMenu)
  window.removeEventListener('keydown', onKeydown)
})

function onGlobalContextMenu(e: MouseEvent) {
  const target = e.target as HTMLElement
  const isTextEl = target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable
  const isMainContent = !!target.closest('main')
  if (!isTextEl && !isMainContent) return
  show(e, [])
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') hide()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="ctx">
      <div
        v-if="visible"
        class="fixed inset-0 z-[9999]"
        @mousedown.self="hide"
        @contextmenu.prevent
      >
        <div
          ref="menuRef"
          tabindex="-1"
          class="absolute w-[180px] rounded-xl border border-white/10 bg-surface/95 py-1.5 shadow-2xl backdrop-blur-md focus:outline-none"
          :style="{ left: `${pos.x}px`, top: `${pos.y}px` }"
          @keydown.esc="hide"
        >
          <template v-for="(item, i) in items" :key="i">
            <!-- Separator -->
            <div v-if="item.label === '—'" class="my-1 mx-3 h-px bg-white/8" />

            <!-- Item -->
            <button
              v-else
              type="button"
              class="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[12px] transition-colors duration-100"
              :class="item.disabled
                ? 'cursor-not-allowed text-faded/30'
                : item.danger
                  ? 'text-err hover:bg-err/15'
                  : 'text-secondary hover:bg-subtle/80'"
              :disabled="item.disabled"
              @mousedown.prevent="runItem(item)"
            >
              <svg v-if="item.icon" class="h-3.5 w-3.5 flex-shrink-0 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" :d="item.icon" />
              </svg>
              <span v-else class="w-3.5 flex-shrink-0" />
              {{ item.label }}
            </button>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ctx-enter-active { transition: opacity 0.1s ease, transform 0.1s ease; }
.ctx-leave-active { transition: opacity 0.08s ease; }
.ctx-enter-from   { opacity: 0; transform: scale(0.95) translateY(-4px); }
.ctx-leave-to     { opacity: 0; }
</style>
