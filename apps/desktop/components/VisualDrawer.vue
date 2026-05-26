<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { useVisual } from '~/composables/useVisual'

const { isWorking, status, statusText, progress, cancel } = useVisual()
</script>

<template>
  <Transition name="drawer">
    <div v-if="isWorking" class="vis-bar flex-shrink-0">
      <Dither
        :wave-speed="1.5"
        :wave-frequency="2.5"
        :wave-amplitude="0.4"
        :wave-color="[0.35, 0.4, 0.95]"
        :color-num="4"
        :pixel-size="3"
      />

      <div class="relative z-10 flex h-full items-center gap-3 px-5">
        <span class="vis-dot flex-shrink-0" />

        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="text-[12px] font-medium tracking-wide text-secondary">
              {{ status === 'queued' ? 'Queued…' : 'Generating image' }}
            </span>
            <span class="truncate text-[11px] text-faded/50">{{ statusText }}</span>
          </div>
          <div v-if="status === 'generating'" class="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
            <div
              class="h-full rounded-full bg-accent transition-all duration-300"
              :style="{ width: `${Math.max(3, progress)}%` }"
            />
          </div>
        </div>

        <span v-if="progress > 0 && status === 'generating'"
          class="flex-shrink-0 text-[11px] tabular-nums text-faded/60">
          {{ progress }}%
        </span>

        <button type="button" title="Cancel generation"
          class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-faded transition-ui hover:bg-err/15 hover:text-err"
          @click="cancel">
          <X class="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.drawer-enter-active { transition: height 0.2s ease, opacity 0.2s ease; overflow: hidden; }
.drawer-leave-active { transition: height 0.15s ease, opacity 0.15s ease; overflow: hidden; }
.drawer-enter-from, .drawer-leave-to { height: 0; opacity: 0; }

.vis-bar {
  position: relative;
  height: 52px;
  overflow: hidden;
  background-color: rgba(22, 23, 26, 0.98);
  backdrop-filter: blur(8px);
}

.vis-dot {
  display: block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #5865f2;
  animation: visPulse 1.5s ease-in-out infinite;
}

@keyframes visPulse {
  0%, 100% { opacity: 0.4; transform: scale(0.8); }
  50%       { opacity: 1;   transform: scale(1.2); }
}
</style>
