<script setup lang="ts">
import { useProfile } from '~/composables/useProfile'

const { profile } = useProfile()

type Phase = 'onboarding' | 'launch' | 'app'
const phase = ref<Phase>(profile.value.onboarded ? 'launch' : 'onboarding')

// Profile singleton updates reactively — watch for onboarding completion
watch(() => profile.value.onboarded, (done) => {
  if (done && phase.value === 'onboarding') phase.value = 'app'
})
</script>

<template>
  <Transition name="phase">
    <OnboardingScreen v-if="phase === 'onboarding'" key="onboarding" />
    <LaunchScreen     v-else-if="phase === 'launch'" key="launch" @enter="phase = 'app'" />
    <AppShell         v-else                          key="app" />
  </Transition>
</template>

<style>
.phase-enter-active { transition: opacity 0.35s ease, transform 0.35s ease; }
.phase-leave-active { transition: opacity 0.25s ease, transform 0.25s ease; }
.phase-enter-from   { opacity: 0; transform: scale(0.97); }
.phase-leave-to     { opacity: 0; transform: scale(1.03); }
</style>
