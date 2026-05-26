<template>
  <div class="min-h-screen bg-base text-white font-sans antialiased">
    <NuxtPage />
  </div>
</template>

<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html { scroll-behavior: smooth; }

body {
  background-color: #1e1f22;
  color: white;
  font-family: 'Inter', system-ui, sans-serif;
}

::selection {
  background: rgba(88,101,242,0.35);
  color: #fff;
}

::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: #1e1f22; }
::-webkit-scrollbar-thumb { background: #383a40; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #5865f2; }
</style>
