<script setup lang="ts">
import { getCurrentWindow } from '@tauri-apps/api/window'

const win = getCurrentWindow()
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
        @click="win.close()"
      />
    </div>
  </header>
</template>
