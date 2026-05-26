<script setup lang="ts">
useHead({
  title: 'Varg Studio — Offline AI Studio',
})

// ── Scroll-reveal ─────────────────────────────────────────────────────────────
const revealed = ref<Set<string>>(new Set())

onMounted(() => {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(e => {
        if (e.isIntersecting && e.target instanceof HTMLElement && e.target.dataset.reveal) {
          revealed.value = new Set([...revealed.value, e.target.dataset.reveal])
        }
      })
    },
    { threshold: 0.12, rootMargin: '0px 0px -60px 0px' }
  )
  document.querySelectorAll('[data-reveal]').forEach(el => observer.observe(el))
  onUnmounted(() => observer.disconnect())
})

function isRevealed(id: string) {
  return revealed.value.has(id)
}

// ── Features ──────────────────────────────────────────────────────────────────
const features = [
  {
    title: 'Kokoro TTS',
    badge: 'Default',
    badgeColor: 'ok',
    desc: '28 voices across American and British accents. Lightning-fast ONNX inference runs entirely on your device.',
    icon: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z',
  },
  {
    title: 'Chatterbox Voice Cloning',
    badge: 'Expressive',
    badgeColor: 'accent',
    desc: 'Clone any voice from a 10–30s reference clip or record live. Adjustable emotional exaggeration for dramatic narration.',
    icon: 'M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V5.25a3 3 0 116 0v7.5a3 3 0 01-3 3z',
  },
  {
    title: 'Script Maker',
    badge: 'Studio',
    badgeColor: 'warn',
    desc: 'Write scripts with inline comments, section headers, and multi-part audio generation. Folder-based project organisation.',
    icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  },
  {
    title: 'WebGPU Accelerated',
    badge: 'Fast',
    badgeColor: 'accent',
    desc: 'Automatically uses your GPU via WebGPU for faster generation. Seamlessly falls back to CPU WASM if unavailable.',
    icon: 'M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18',
  },
  {
    title: 'Generation History',
    badge: 'Local',
    badgeColor: 'ok',
    desc: 'Every generated audio is saved locally with full metadata — replay, download, or review your scripts any time.',
    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    title: 'MCP Server',
    badge: 'AI-Ready',
    badgeColor: 'accent',
    desc: 'Expose Varg as an MCP endpoint. Let any AI agent generate speech, list history, and retrieve audio programmatically.',
    icon: 'M5 12h14M12 5l7 7-7 7',
  },
  {
    title: 'System Monitor',
    badge: 'Live',
    badgeColor: 'warn',
    desc: 'Real-time CPU, GPU, and memory metrics in a floating overlay. Keep an eye on resources during heavy generation.',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  },
  {
    title: 'No Subscription',
    badge: 'Free',
    badgeColor: 'ok',
    desc: 'Free to download, free to use forever. No accounts, no telemetry, no data ever leaves your machine.',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  },
]

// ── Models ────────────────────────────────────────────────────────────────────
const models = [
  {
    name: 'Kokoro',
    subtitle: 'Neural TTS · 28 voices',
    badge: 'Default',
    badgeColor: '#23a55a',
    badgeBg: 'rgba(35,165,90,0.15)',
    desc: 'Fast, lightweight offline synthesis. American & British accents, male & female. Best for high-volume narration.',
    stats: [
      { label: 'Speed',         value: 'Very Fast',   color: '#23a55a' },
      { label: 'Voice variety', value: '28 presets',  color: 'rgba(255,255,255,0.6)' },
      { label: 'Download',      value: '~90 MB',      color: 'rgba(255,255,255,0.6)' },
      { label: 'Expressiveness',value: 'Standard',    color: 'rgba(255,255,255,0.6)' },
    ],
  },
  {
    name: 'Chatterbox',
    subtitle: 'Resemble AI · Voice Cloning',
    badge: 'Expressive',
    badgeColor: '#5865f2',
    badgeBg: 'rgba(88,101,242,0.15)',
    desc: 'Emotional synthesis with adjustable exaggeration. Clone any voice from a short reference clip. Best for dramatic dubbing.',
    stats: [
      { label: 'Speed',         value: 'Slow–Med',    color: '#f0b232' },
      { label: 'Voice variety', value: 'Any (clone)', color: 'rgba(255,255,255,0.6)' },
      { label: 'Download',      value: '~1–2 GB',     color: 'rgba(255,255,255,0.6)' },
      { label: 'Expressiveness',value: 'High',        color: '#5865f2' },
    ],
  },
]

const badgeClass: Record<string, string> = {
  accent: 'bg-accent/15 text-accent',
  ok:     'bg-ok/15 text-ok',
  warn:   'bg-warn/15 text-warn',
}
</script>

<template>
  <div class="flex flex-col min-h-screen overflow-x-hidden">

    <!-- ── Nav ──────────────────────────────────────────────────────────────── -->
    <nav class="sticky top-0 z-50 flex items-center justify-between px-8 py-4 border-b border-white/5 bg-base/80 backdrop-blur-xl">
      <div class="flex items-center gap-3">
        <img src="/icon.png" alt="Varg" class="h-7 w-7" />
        <span class="text-[15px] font-bold tracking-widest uppercase select-none">Varg</span>
        <span class="hidden sm:inline rounded-full bg-accent/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent">Studio</span>
      </div>
      <div class="flex items-center gap-6 text-[13px] text-white/50">
        <a href="#features" class="hidden sm:inline hover:text-white transition-colors">Features</a>
        <a href="#models"   class="hidden sm:inline hover:text-white transition-colors">Models</a>
        <a href="#download" class="hidden sm:inline hover:text-white transition-colors">Download</a>
        <a href="https://github.com/surelle-ha/varg" target="_blank" rel="noopener"
          class="hover:text-white transition-colors">GitHub</a>
        <a href="https://github.com/surelle-ha/varg/releases/latest" target="_blank" rel="noopener"
          class="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-1.5 text-[12px] font-semibold text-white transition hover:bg-accent/90 active:scale-[0.98]">
          <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download
        </a>
      </div>
    </nav>

    <!-- ── Hero ─────────────────────────────────────────────────────────────── -->
    <section class="relative flex flex-col items-center justify-center min-h-[92vh] overflow-hidden">

      <!-- Dither background -->
      <div class="absolute inset-0">
        <ClientOnly>
          <Dither
            :wave-speed="0.04"
            :wave-frequency="2.5"
            :wave-amplitude="0.28"
            :wave-color="[0.42, 0.43, 0.55]"
            :color-num="5"
            :pixel-size="2"
            :enable-mouse-interaction="false"
            :mouse-radius="0.9"
          />
        </ClientOnly>
      </div>

      <!-- Bottom gradient fade -->
      <div class="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-base to-transparent pointer-events-none z-10" />
      <!-- Top gradient fade -->
      <div class="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-base/60 to-transparent pointer-events-none z-10" />

      <!-- Content -->
      <div class="relative z-20 flex flex-col items-center text-center px-6 select-none">

        <!-- Icon + badge -->
        <div class="animate-fade-in mb-8 flex flex-col items-center gap-5" style="animation-delay:0.1s">
          <div class="animate-float relative">
            <img
              src="/icon.png"
              alt="Varg Studio"
              class="h-20 w-20 icon-glow"
            />
          </div>
          <div class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-4 py-1.5 text-[11px] font-medium uppercase tracking-widest text-white/50 backdrop-blur-sm">
            <span class="h-1.5 w-1.5 rounded-full bg-ok animate-pulse" />
            On-device · Offline · Free · Open Source
          </div>
        </div>

        <!-- Title -->
        <h1
          class="animate-fade-up font-display text-[72px] sm:text-[96px] lg:text-[120px] font-black uppercase leading-none tracking-[0.08em]"
          style="animation-delay:0.2s; text-shadow: 0 0 120px rgba(88,101,242,0.5), 0 4px 40px rgba(0,0,0,0.8)"
        >
          VARG
        </h1>
        <p
          class="animate-fade-up text-[13px] sm:text-[16px] font-semibold uppercase tracking-[0.5em] text-white/40 mt-1"
          style="animation-delay:0.35s"
        >
          Studio
        </p>

        <!-- Tagline -->
        <p
          class="animate-fade-up mt-7 max-w-lg text-[15px] sm:text-[17px] leading-relaxed text-white/60"
          style="animation-delay:0.45s"
        >
          Fully offline AI studio. Speech synthesis, voice cloning,<br class="hidden sm:inline" />
          script production — all on your machine.
        </p>

        <!-- CTA buttons -->
        <div
          class="animate-fade-up mt-10 flex flex-col sm:flex-row items-center gap-4"
          style="animation-delay:0.55s"
        >
          <a
            id="download"
            href="https://github.com/surelle-ha/varg/releases/latest"
            target="_blank" rel="noopener"
            class="group flex items-center gap-2.5 rounded-2xl bg-accent px-8 py-3.5 text-[14px] font-bold text-white shadow-lg transition-all hover:bg-accent/90 hover:scale-[1.03] hover:shadow-accent/40 hover:shadow-2xl active:scale-[0.98]"
          >
            <svg class="h-4 w-4 transition-transform group-hover:translate-y-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download for Windows
          </a>
          <a
            href="https://github.com/surelle-ha/varg"
            target="_blank" rel="noopener"
            class="flex items-center gap-2 rounded-2xl border border-white/15 px-8 py-3.5 text-[14px] font-medium text-white/60 transition-all hover:border-white/30 hover:text-white hover:bg-white/5"
          >
            <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            View on GitHub
          </a>
        </div>

        <p class="animate-fade-up mt-5 text-[11px] text-white/25" style="animation-delay:0.65s">
          Windows 10/11 · Free · No account required ·
          <a href="https://github.com/surelle-ha/varg" target="_blank" rel="noopener" class="underline underline-offset-2 hover:text-white/50 transition-colors">build from source</a>
        </p>
      </div>

      <!-- Scroll indicator -->
      <div class="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 animate-bounce opacity-30">
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </section>

    <!-- ── Marquee strip ─────────────────────────────────────────────────────── -->
    <div class="relative overflow-hidden border-y border-white/5 bg-surface/60 py-3">
      <div class="marquee-track flex gap-12 text-[11px] font-semibold uppercase tracking-widest text-white/25">
        <template v-for="_ in 4" :key="_">
          <span>Kokoro TTS</span><span class="text-accent/40">·</span>
          <span>Chatterbox Voice Cloning</span><span class="text-accent/40">·</span>
          <span>WebGPU Accelerated</span><span class="text-accent/40">·</span>
          <span>Script Maker</span><span class="text-accent/40">·</span>
          <span>MCP Server</span><span class="text-accent/40">·</span>
          <span>100% Offline</span><span class="text-accent/40">·</span>
          <span>Free Forever</span><span class="text-accent/40">·</span>
        </template>
      </div>
    </div>

    <!-- ── Features ─────────────────────────────────────────────────────────── -->
    <section id="features" class="px-6 py-24 max-w-6xl mx-auto w-full">
      <div
        data-reveal="feat-header"
        :class="['transition-all duration-700', isRevealed('feat-header') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6']"
        class="text-center mb-16"
      >
        <p class="text-[11px] font-semibold uppercase tracking-[0.3em] text-accent/70 mb-3">Everything you need</p>
        <h2 class="text-[36px] sm:text-[44px] font-display font-black uppercase leading-tight">
          Built for creators.<br/>
          <span class="text-white/30">Runs without the cloud.</span>
        </h2>
      </div>

      <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div
          v-for="(f, i) in features"
          :key="f.title"
          :data-reveal="`feat-${i}`"
          :class="['transition-all duration-700', isRevealed(`feat-${i}`) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8']"
          :style="{ transitionDelay: `${i * 60}ms` }"
          class="group relative rounded-2xl border border-white/5 bg-surface/60 p-6 hover:border-accent/30 hover:bg-surface transition-all duration-300 hover:-translate-y-1 cursor-default"
        >
          <!-- Top row: icon + badge -->
          <div class="mb-4 flex items-start justify-between">
            <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 group-hover:bg-accent/20 transition-colors">
              <svg class="h-4.5 w-4.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                <path stroke-linecap="round" stroke-linejoin="round" :d="f.icon" />
              </svg>
            </div>
            <span class="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider" :class="badgeClass[f.badgeColor]">
              {{ f.badge }}
            </span>
          </div>
          <h3 class="text-[13px] font-semibold text-white leading-snug">{{ f.title }}</h3>
          <p class="mt-2 text-[11px] leading-relaxed text-white/40">{{ f.desc }}</p>

          <!-- Accent line on hover -->
          <div class="absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    </section>

    <!-- ── Models ────────────────────────────────────────────────────────────── -->
    <section id="models" class="px-6 py-20 border-t border-white/5">
      <div class="max-w-4xl mx-auto">
        <div
          data-reveal="models-header"
          :class="['transition-all duration-700 text-center mb-12', isRevealed('models-header') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6']"
        >
          <p class="text-[11px] font-semibold uppercase tracking-[0.3em] text-accent/70 mb-3">Two engines, one studio</p>
          <h2 class="text-[36px] font-display font-black uppercase leading-tight">Choose your voice</h2>
          <p class="mt-3 text-[14px] text-white/40">Switch between engines anytime from the Generate panel.</p>
        </div>

        <div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div
            v-for="(m, i) in models"
            :key="m.name"
            :data-reveal="`model-${i}`"
            :class="['transition-all duration-700', isRevealed(`model-${i}`) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8']"
            :style="{ transitionDelay: `${i * 120}ms` }"
            class="relative rounded-2xl border border-white/5 bg-surface p-6 overflow-hidden hover:border-white/10 transition-colors"
          >
            <!-- Glow blob -->
            <div
              class="absolute -top-16 -right-16 h-48 w-48 rounded-full opacity-10 blur-3xl pointer-events-none"
              :style="{ backgroundColor: m.badgeColor }"
            />

            <div class="relative z-10">
              <div class="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p class="text-[16px] font-bold text-white">{{ m.name }}</p>
                  <p class="text-[11px] text-white/40">{{ m.subtitle }}</p>
                </div>
                <span
                  class="rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider flex-shrink-0"
                  :style="{ color: m.badgeColor, backgroundColor: m.badgeBg }"
                >
                  {{ m.badge }}
                </span>
              </div>

              <p class="mb-5 text-[12px] leading-relaxed text-white/50">{{ m.desc }}</p>

              <div class="space-y-2">
                <div v-for="s in m.stats" :key="s.label" class="flex items-center justify-between text-[11px]">
                  <span class="text-white/35">{{ s.label }}</span>
                  <span class="font-semibold" :style="{ color: s.color }">{{ s.value }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ── How it works ──────────────────────────────────────────────────────── -->
    <section class="px-6 py-24 border-t border-white/5">
      <div class="max-w-3xl mx-auto text-center">
        <div
          data-reveal="how-header"
          :class="['transition-all duration-700 mb-14', isRevealed('how-header') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6']"
        >
          <p class="text-[11px] font-semibold uppercase tracking-[0.3em] text-accent/70 mb-3">Simple setup</p>
          <h2 class="text-[36px] font-display font-black uppercase leading-tight">Up in three steps</h2>
        </div>

        <div class="grid grid-cols-1 gap-8 sm:grid-cols-3">
          <div
            v-for="(step, i) in [
              { n: '01', title: 'Download', desc: 'Grab the Windows installer from the releases page and run it.' },
              { n: '02', title: 'Get Models', desc: 'On first use, Varg downloads the AI models (~90 MB for Kokoro) and caches them offline.' },
              { n: '03', title: 'Generate', desc: 'Write a script, pick a voice, and generate audio — entirely on your machine.' },
            ]"
            :key="step.n"
            :data-reveal="`step-${i}`"
            :class="['transition-all duration-700', isRevealed(`step-${i}`) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8']"
            :style="{ transitionDelay: `${i * 100}ms` }"
            class="flex flex-col items-center gap-3"
          >
            <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 border border-accent/20">
              <span class="font-mono text-[13px] font-bold text-accent">{{ step.n }}</span>
            </div>
            <p class="text-[14px] font-semibold text-white">{{ step.title }}</p>
            <p class="text-[12px] leading-relaxed text-white/40 max-w-[200px]">{{ step.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ── CTA ───────────────────────────────────────────────────────────────── -->
    <section class="relative overflow-hidden border-t border-white/5 px-6 py-24">

      <!-- Dither accent background -->
      <div class="absolute inset-0 opacity-40">
        <ClientOnly>
          <Dither
            :wave-speed="0.02"
            :wave-frequency="2"
            :wave-amplitude="0.2"
            :wave-color="[0.38, 0.39, 0.48]"
            :color-num="4"
            :pixel-size="3"
            :enable-mouse-interaction="false"
          />
        </ClientOnly>
      </div>
      <div class="absolute inset-0 bg-gradient-to-b from-base via-transparent to-base pointer-events-none" />

      <div
        data-reveal="cta"
        :class="['relative z-10 flex flex-col items-center gap-6 text-center transition-all duration-700', isRevealed('cta') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8']"
      >
        <img src="/icon.png" alt="Varg" class="h-14 w-14 icon-glow" />
        <h2 class="text-[40px] sm:text-[52px] font-display font-black uppercase tracking-wider leading-tight">
          Start creating.<br/>
          <span class="text-white/30">Without the cloud.</span>
        </h2>
        <p class="max-w-md text-[14px] text-white/40 leading-relaxed">
          Download Varg Studio, grab the model files once, and generate studio-quality speech — offline, forever free.
        </p>
        <div class="flex flex-col sm:flex-row items-center gap-4">
          <a
            href="https://github.com/surelle-ha/varg/releases/latest"
            target="_blank" rel="noopener"
            class="group flex items-center gap-2.5 rounded-2xl bg-accent px-10 py-4 text-[15px] font-bold text-white shadow-lg transition-all hover:bg-accent/90 hover:scale-[1.03] hover:shadow-accent/40 hover:shadow-2xl active:scale-[0.98]"
          >
            <svg class="h-5 w-5 transition-transform group-hover:translate-y-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Varg Studio
          </a>
          <a
            href="https://github.com/surelle-ha/varg"
            target="_blank" rel="noopener"
            class="flex items-center gap-2 text-[13px] text-white/40 hover:text-white transition-colors"
          >
            View source on GitHub →
          </a>
        </div>
        <p class="text-[11px] text-white/20">Windows 10/11 · No account · No telemetry · Open source — <a href="https://github.com/surelle-ha/varg" target="_blank" rel="noopener" class="underline underline-offset-2 hover:text-white/40 transition-colors">build from source</a></p>
      </div>
    </section>

    <!-- ── Footer ────────────────────────────────────────────────────────────── -->
    <footer class="border-t border-white/5 bg-base px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-white/25">
      <div class="flex items-center gap-3">
        <img src="/icon.png" alt="Varg" class="h-5 w-5 opacity-60" />
        <span>© {{ new Date().getFullYear() }} Vindicta. All rights reserved.</span>
      </div>
      <div class="flex items-center gap-5">
        <a href="https://github.com/surelle-ha/varg" target="_blank" rel="noopener" class="hover:text-white/60 transition-colors">GitHub</a>
        <a href="https://github.com/surelle-ha/varg/releases" target="_blank" rel="noopener" class="hover:text-white/60 transition-colors">Releases</a>
        <a href="https://github.com/surelle-ha/varg/issues" target="_blank" rel="noopener" class="hover:text-white/60 transition-colors">Issues</a>
      </div>
    </footer>

  </div>
</template>

<style scoped>
/* ── Marquee ─────────────────────────────────────────────────────────────── */
.marquee-track {
  animation: marquee 30s linear infinite;
  white-space: nowrap;
  width: max-content;
}
@keyframes marquee {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}

/* ── h-4.5 utility (Tailwind doesn't ship this by default) ──────────────── */
.h-4\.5 { height: 1.125rem; }
.w-4\.5 { width:  1.125rem; }

/* ── Icon glow — uses drop-shadow so it follows transparent PNG shape ─────── */
.icon-glow {
  animation: iconGlow 3s ease-in-out infinite;
}
@keyframes iconGlow {
  0%, 100% { filter: drop-shadow(0 0 8px  rgba(88,101,242,0.4)); }
  50%       { filter: drop-shadow(0 0 22px rgba(88,101,242,0.75)); }
}
</style>
