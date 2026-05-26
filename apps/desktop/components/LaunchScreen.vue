<script setup lang="ts">
const emit = defineEmits<{ enter: [] }>()
</script>

<template>
  <div class="flex h-screen flex-col overflow-hidden bg-base select-none">
    <!-- Titlebar — gives drag region, version, and window controls -->
    <AppTitlebar />

    <!-- Dither fills all remaining space below the titlebar -->
    <div class="relative flex-1 overflow-hidden" data-tauri-drag-region>
      <Dither
        :wave-speed="0.05"
        :wave-frequency="3"
        :wave-amplitude="0.3"
        :wave-color="[0.5, 0.5, 0.5]"
        :color-num="4"
        :pixel-size="2"
        :disable-animation="false"
        :enable-mouse-interaction="true"
        :mouse-radius="1"
      />

      <!-- Centred content — pointer-events on children, not on the drag layer -->
      <div class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-8">
        <div class="flex flex-col items-center gap-3">
          <h1
            class="text-[80px] font-black uppercase leading-none tracking-[0.18em] text-white"
            style="text-shadow: 0 0 60px rgba(255,255,255,0.15)"
          >
            VARG
          </h1>
          <p class="text-[12px] font-medium uppercase tracking-[0.35em] text-white/40">
            On-device · AI Studio
          </p>
        </div>

        <button
          type="button"
          class="rounded-full border border-white/30 px-10 py-2.5 text-[12px] font-medium uppercase tracking-[0.2em] text-white/80 transition-ui hover:border-white/60 hover:bg-white/10 hover:text-white active:scale-95"
          @click="emit('enter')"
        >
          Enter
        </button>
      </div>
    </div>
  </div>
</template>
