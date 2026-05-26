<script setup lang="ts">
const STORAGE_KEY = 'varg-welcome-seen'

const visible    = ref(false)
const dontShow   = ref(false)

onMounted(() => {
  if (!localStorage.getItem(STORAGE_KEY)) visible.value = true
})

function close() {
  if (dontShow.value) localStorage.setItem(STORAGE_KEY, '1')
  visible.value = false
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible"
        class="fixed inset-x-0 bottom-0 top-9 z-50 flex items-center justify-center p-4"
        @click.self="close">
        <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" />

        <div class="relative z-10 w-full max-w-xl rounded-2xl border border-white/10 bg-surface shadow-2xl">

          <!-- Header -->
          <div class="px-6 pt-6 pb-4 text-center">
            <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-xl font-black text-white select-none">
              V
            </div>
            <h2 class="text-[18px] font-black uppercase tracking-[0.15em] text-primary">Varg Studio</h2>
            <p class="mt-1 text-[12px] text-faded">Fully offline AI studio — speech, voice cloning, and more.</p>
          </div>

          <!-- Model cards -->
          <div class="grid grid-cols-2 gap-3 px-6 pb-4">

            <!-- Kokoro -->
            <div class="rounded-xl bg-overlay p-4 space-y-2.5">
              <div class="flex items-start justify-between gap-2">
                <div>
                  <p class="text-[13px] font-bold text-primary">Kokoro</p>
                  <p class="text-[10px] text-faded/70">Neural TTS · 28 voices</p>
                </div>
                <span class="rounded-full bg-ok/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-ok">Default</span>
              </div>
              <p class="text-[11px] leading-relaxed text-faded/80">Fast, lightweight offline synthesis. American &amp; British accents, male &amp; female.</p>
              <div class="space-y-1 text-[10px]">
                <div class="flex justify-between">
                  <span class="text-faded/50">Speed</span>
                  <span class="font-semibold text-ok">Very Fast</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-faded/50">Voice variety</span>
                  <span class="font-semibold text-secondary">28 presets</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-faded/50">Download</span>
                  <span class="font-semibold text-secondary">~90 MB</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-faded/50">Expressiveness</span>
                  <span class="font-semibold text-secondary">Standard</span>
                </div>
              </div>
              <p class="text-[10px] text-faded/40 italic">Best for high-volume production</p>
            </div>

            <!-- Chatterbox -->
            <div class="rounded-xl bg-overlay p-4 space-y-2.5">
              <div class="flex items-start justify-between gap-2">
                <div>
                  <p class="text-[13px] font-bold text-primary">Chatterbox</p>
                  <p class="text-[10px] text-faded/70">Resemble AI · Voice cloning</p>
                </div>
                <span class="rounded-full bg-accent/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent">Expressive</span>
              </div>
              <p class="text-[11px] leading-relaxed text-faded/80">Emotional synthesis with adjustable exaggeration. Clone any voice from a reference clip.</p>
              <div class="space-y-1 text-[10px]">
                <div class="flex justify-between">
                  <span class="text-faded/50">Speed</span>
                  <span class="font-semibold text-warn">Slow–Medium</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-faded/50">Voice variety</span>
                  <span class="font-semibold text-secondary">Any (cloning)</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-faded/50">Download</span>
                  <span class="font-semibold text-secondary">~1–2 GB</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-faded/50">Expressiveness</span>
                  <span class="font-semibold text-accent">High</span>
                </div>
              </div>
              <p class="text-[10px] text-faded/40 italic">Best for dramatic narration</p>
            </div>
          </div>

          <!-- Tip -->
          <div class="mx-6 mb-4 rounded-lg border border-white/5 bg-subtle/40 px-3 py-2.5 text-[11px] text-faded/70">
            <span class="font-semibold text-secondary">Tip:</span> Models are downloaded on first use and cached offline. Switch engines anytime from the Generate sidebar inside the Notebook.
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-between border-t border-white/5 px-6 py-4">
            <label class="flex cursor-pointer items-center gap-2 text-[11px] text-faded/60 hover:text-secondary transition-colors select-none">
              <input v-model="dontShow" type="checkbox"
                class="rounded border-white/20 bg-overlay accent-accent" />
              Don't show this again
            </label>
            <button type="button"
              class="rounded-xl bg-accent px-5 py-2 text-[12px] font-semibold text-white shadow-button transition-ui hover:bg-accent/90 active:scale-[0.98]"
              @click="close">
              Get Started
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active, .modal-leave-active { transition: opacity 0.2s ease; }
.modal-enter-active .relative.z-10, .modal-leave-active .relative.z-10 { transition: opacity 0.2s ease, transform 0.2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .relative.z-10, .modal-leave-to .relative.z-10 { opacity: 0; transform: scale(0.96) translateY(8px); }
</style>
