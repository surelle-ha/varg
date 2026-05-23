<script setup lang="ts">
import { useProfile } from '~/composables/useProfile'

const { completeOnboarding } = useProfile()

const firstName = ref('')
const lastName  = ref('')
const position  = ref('')
const step      = ref<'intro' | 'form'>('intro')
const error     = ref('')

const canSubmit = computed(() =>
  firstName.value.trim().length > 0 && lastName.value.trim().length > 0,
)

function next() {
  step.value = 'form'
}

function submit() {
  if (!canSubmit.value) { error.value = 'Please enter your first and last name.'; return }
  completeOnboarding({
    firstName: firstName.value.trim(),
    lastName:  lastName.value.trim(),
    position:  position.value.trim(),
  })
}
</script>

<template>
  <div class="relative flex h-screen flex-col overflow-hidden bg-base select-none">
    <!-- Dither background -->
    <Dither
      class="absolute inset-0"
      :wave-speed="0.04"
      :wave-frequency="2.5"
      :wave-amplitude="0.25"
      :wave-color="[0.5, 0.5, 0.5]"
      :color-num="4"
      :pixel-size="2"
      :enable-mouse-interaction="true"
      :mouse-radius="1.2"
    />

    <!-- Content -->
    <div class="absolute inset-0 z-10 flex flex-col items-center justify-center px-6">

      <!-- Intro step -->
      <Transition name="onboard">
        <div v-if="step === 'intro'" key="intro" class="flex flex-col items-center gap-6 text-center">
          <div class="flex flex-col items-center gap-2">
            <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent shadow-button text-2xl font-black text-white select-none">
              V
            </div>
            <h1 class="text-[56px] font-black uppercase leading-none tracking-[0.15em] text-white"
              style="text-shadow: 0 0 60px rgba(255,255,255,0.12)">
              VARG
            </h1>
            <p class="text-[11px] font-medium uppercase tracking-[0.35em] text-white/40">
              On-device · Text to Speech
            </p>
          </div>

          <p class="max-w-xs text-[13px] leading-relaxed text-white/60">
            Before we begin, we'd like to know a little about you.
          </p>

          <button
            type="button"
            class="rounded-full border border-white/30 px-10 py-2.5 text-[12px] font-medium uppercase tracking-[0.2em] text-white/80 transition-ui hover:border-white/60 hover:bg-white/10 hover:text-white active:scale-95"
            @click="next"
          >
            Get Started
          </button>
        </div>
      </Transition>

      <!-- Form step -->
      <Transition name="onboard">
        <div v-if="step === 'form'" key="form" class="w-full max-w-sm">
          <div class="glass-panel rounded-2xl p-6 space-y-5">
            <div class="text-center">
              <h2 class="text-[16px] font-semibold text-primary">Tell us about yourself</h2>
              <p class="mt-1 text-[12px] text-faded">This will appear on your profile.</p>
            </div>

            <div class="space-y-3">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-faded">First Name</label>
                  <input
                    v-model="firstName"
                    type="text"
                    class="glass-input w-full rounded-lg px-3 py-2 text-[13px]"
                    placeholder="Harold"
                    maxlength="40"
                    @keydown.enter="lastName ? submit() : undefined"
                  />
                </div>
                <div>
                  <label class="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-faded">Last Name</label>
                  <input
                    v-model="lastName"
                    type="text"
                    class="glass-input w-full rounded-lg px-3 py-2 text-[13px]"
                    placeholder="Eustaquio"
                    maxlength="40"
                    @keydown.enter="canSubmit ? submit() : undefined"
                  />
                </div>
              </div>

              <div>
                <label class="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-faded">
                  Position / Designation
                  <span class="ml-1 normal-case tracking-normal text-faded/50">(optional)</span>
                </label>
                <input
                  v-model="position"
                  type="text"
                  class="glass-input w-full rounded-lg px-3 py-2 text-[13px]"
                  placeholder="e.g. Product Designer"
                  maxlength="60"
                  @keydown.enter="canSubmit ? submit() : undefined"
                />
              </div>
            </div>

            <div v-if="error" class="rounded-lg border border-err/20 bg-err/10 px-3 py-2 text-[11px] text-err">
              {{ error }}
            </div>

            <button
              type="button"
              class="w-full rounded-xl py-2.5 text-[13px] font-semibold shadow-button transition-ui"
              :class="canSubmit
                ? 'bg-accent text-white hover:bg-accent-dark active:scale-[0.98]'
                : 'cursor-not-allowed bg-subtle text-faded'"
              :disabled="!canSubmit"
              @click="submit"
            >
              Enter Varg
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.onboard-enter-active { transition: opacity 0.3s ease, transform 0.3s ease; }
.onboard-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.onboard-enter-from   { opacity: 0; transform: translateY(12px); }
.onboard-leave-to     { opacity: 0; transform: translateY(-8px); }
</style>
