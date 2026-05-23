<script setup lang="ts">
withDefaults(defineProps<{ edgeColor?: string }>(), {
  edgeColor: '#16171a',
})
</script>

<template>
  <div class="pointer-events-none absolute inset-0 overflow-hidden">
    <div class="dither-bg absolute inset-0" />
    <div class="dither-sweep absolute inset-0" />
    <div class="absolute inset-y-0 left-0 w-2/5"
      :style="`background: linear-gradient(to right, ${edgeColor} 0%, transparent 100%)`" />
    <div class="absolute inset-y-0 right-0 w-2/5"
      :style="`background: linear-gradient(to left, ${edgeColor} 0%, transparent 100%)`" />
  </div>
</template>

<style scoped>
.dither-bg {
  background-image: repeating-linear-gradient(
    -58deg,
    transparent 0px,
    transparent 9px,
    rgba(88, 101, 242, 0.07) 9px,
    rgba(88, 101, 242, 0.07) 10.5px
  );
}

@keyframes ditherSweep {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(220%);  }
}

.dither-sweep {
  background: linear-gradient(
    108deg,
    transparent             20%,
    rgba(88, 101, 242, 0.05) 40%,
    rgba(255, 255, 255, 0.06) 50%,
    rgba(88, 101, 242, 0.05) 60%,
    transparent             80%
  );
  animation: ditherSweep 2.6s cubic-bezier(0.45, 0, 0.55, 1) infinite;
}
</style>
