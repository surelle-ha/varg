<script setup lang="ts">
import { getCurrentWindow } from '@tauri-apps/api/window'

const win         = getCurrentWindow()
const showConfirm = ref(false)

function requestClose() {
  showConfirm.value = true
}

function confirmClose() {
  win.close()
}

function cancelClose() {
  showConfirm.value = false
}
</script>

<template>
  <!-- h-9 = 36 px. flex-shrink-0 ensures it never collapses inside a flex column. -->
  <!-- data-tauri-drag-region on the header makes the whole bar draggable;      -->
  <!-- buttons have their own pointer events and will fire clicks normally.      -->
  <header
    class="relative flex h-9 flex-shrink-0 items-center justify-between border-b border-white/5 bg-base/95 px-3 select-none"
    data-tauri-drag-region
  >
    <!-- Left: version badge -->
    <div class="z-10 flex items-center gap-1.5">
      <span class="text-[10px] font-mono text-faded/60">v{{ useAppConfig().version }}</span>
    </div>

    <!-- Centred app name — pointer-events:none so it doesn't block dragging -->
    <span class="pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] font-medium tracking-widest text-faded uppercase">
      Varg
    </span>

    <!-- Right: window controls — minimize · maximize · close -->
    <div class="z-10 flex items-center gap-[5px]">
      <button
        type="button"
        aria-label="Minimize window"
        class="h-[11px] w-[11px] rounded-full bg-[#febc2e] transition-ui hover:brightness-90 active:brightness-75"
        @click="win.minimize()"
      />
      <button
        type="button"
        aria-label="Maximize window"
        class="h-[11px] w-[11px] rounded-full bg-[#28c840] transition-ui hover:brightness-90 active:brightness-75"
        @click="win.toggleMaximize()"
      />
      <button
        type="button"
        aria-label="Close window"
        class="h-[11px] w-[11px] rounded-full bg-[#ff5f57] transition-ui hover:brightness-90 active:brightness-75"
        @click="requestClose"
      />
    </div>
  </header>

  <!-- Close confirmation modal -->
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="showConfirm"
        class="fixed inset-0 z-50 flex items-center justify-center"
        @click.self="cancelClose"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" />

        <!-- Dialog -->
        <div class="relative z-10 w-72 rounded-2xl border border-white/10 bg-surface p-5 shadow-2xl">
          <!-- Icon -->
          <div class="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-err/15">
            <svg class="h-5 w-5 text-err" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>

          <h2 class="text-[14px] font-semibold text-primary">Close Varg?</h2>
          <p class="mt-1 text-[12px] text-faded">Any ongoing generation will be cancelled.</p>

          <div class="mt-4 flex gap-2">
            <button
              type="button"
              class="flex-1 rounded-xl border border-white/10 py-2 text-[12px] font-medium text-secondary transition-ui hover:bg-subtle"
              @click="cancelClose"
            >
              Cancel
            </button>
            <button
              type="button"
              class="flex-1 rounded-xl bg-err py-2 text-[12px] font-semibold text-white shadow-button transition-ui hover:brightness-110 active:scale-[0.98]"
              @click="confirmClose"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.15s ease;
}
.modal-enter-active .relative.z-10,
.modal-leave-active .relative.z-10 {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .relative.z-10,
.modal-leave-to .relative.z-10 {
  opacity: 0;
  transform: scale(0.95);
}
</style>
