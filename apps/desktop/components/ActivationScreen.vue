<script setup lang="ts">
import { KeyRound, ShieldCheck, AlertCircle } from 'lucide-vue-next'
import { useLicense } from '~/composables/useLicense'

const emit = defineEmits<{ activated: [] }>()

const { activate, licenseError } = useLicense()

const keyInput  = ref('')
const loading   = ref(false)
const shake     = ref(false)

async function submit() {
  if (!keyInput.value.trim()) return
  loading.value = true
  await nextTick()
  const ok = activate(keyInput.value)
  loading.value = false
  if (ok) {
    emit('activated')
  } else {
    shake.value = true
    setTimeout(() => { shake.value = false }, 500)
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') submit()
}

const formatted = computed(() => {
  const raw = keyInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const groups = raw.match(/.{1,4}/g) ?? []
  return groups.join('-')
})

function onInput(e: Event) {
  const val = (e.target as HTMLInputElement).value
  keyInput.value = val.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24)
}
</script>

<template>
  <div class="flex h-screen flex-col overflow-hidden bg-base">
    <AppTitlebar />

    <div class="relative flex flex-1 flex-col items-center justify-center overflow-hidden">

    <!-- Subtle grid background -->
    <div class="pointer-events-none absolute inset-0 opacity-[0.03]"
      style="background-image: linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px); background-size: 32px 32px;" />

    <!-- Glow -->
    <div class="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full opacity-[0.07]"
      style="background: radial-gradient(circle, #5865f2 0%, transparent 70%);" />

    <div class="relative z-10 flex w-full max-w-sm flex-col items-center gap-6 px-6">

      <!-- Icon -->
      <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 border border-accent/20">
        <KeyRound class="h-8 w-8 text-accent" />
      </div>

      <!-- Title -->
      <div class="text-center">
        <p class="text-[10px] font-mono font-medium uppercase tracking-[0.25em] text-faded/50 mb-1">Varg</p>
        <h1 class="text-[20px] font-semibold text-primary">Activation Required</h1>
        <p class="mt-2 text-[13px] leading-relaxed text-faded">
          Enter your license key to unlock Varg.
        </p>
      </div>

      <!-- Key input card -->
      <div class="w-full rounded-2xl border border-white/10 bg-surface p-5 space-y-4">

        <div :class="['space-y-1.5', shake && 'animate-shake']">
          <label class="text-[11px] font-medium text-faded uppercase tracking-widest">License Key</label>
          <input
            :value="keyInput"
            type="text"
            placeholder="XXXX-XXXX-XXXX-XXXX"
            autocomplete="off"
            spellcheck="false"
            maxlength="24"
            class="w-full rounded-xl border border-white/10 bg-overlay px-3.5 py-3 font-mono text-[14px] tracking-[0.15em] text-primary placeholder:text-faded/30 focus:border-accent/50 focus:outline-none transition-colors"
            :class="licenseError ? 'border-err/40' : ''"
            @input="onInput"
            @keydown="onKeydown"
          />
        </div>

        <!-- Error -->
        <Transition name="fade">
          <div v-if="licenseError" class="flex items-start gap-2 rounded-lg bg-err/10 px-3 py-2.5">
            <AlertCircle class="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-err" />
            <p class="text-[11px] leading-relaxed text-err">{{ licenseError }}</p>
          </div>
        </Transition>

        <!-- Activate button -->
        <button type="button"
          class="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-semibold shadow-button transition-ui"
          :class="keyInput.trim()
            ? 'bg-accent text-white hover:bg-accent-dark active:scale-[0.98]'
            : 'bg-subtle text-faded cursor-not-allowed'"
          :disabled="loading || !keyInput.trim()"
          @click="submit">
          <svg v-if="loading" class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <ShieldCheck v-else class="h-4 w-4" />
          {{ loading ? 'Activating…' : 'Activate Varg' }}
        </button>
      </div>

      <p class="text-center text-[11px] text-faded/40">
        Need a license?
        <span class="text-accent/60">Contact your administrator for a key.</span>
      </p>
    </div>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(-4px); }

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%       { transform: translateX(-6px); }
  40%       { transform: translateX(6px); }
  60%       { transform: translateX(-4px); }
  80%       { transform: translateX(4px); }
}
.animate-shake { animation: shake 0.45s ease; }
</style>
