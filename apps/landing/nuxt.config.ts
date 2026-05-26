export default defineNuxtConfig({
  compatibilityDate: '2025-05-24',
  modules: ['@nuxtjs/tailwindcss'],
  vite: {
    optimizeDeps: {
      include: ['ogl'],
    },
  },
  app: {
    head: {
      title: 'Varg Studio — Offline AI Studio',
      link: [
        { rel: 'icon', type: 'image/png', href: '/icon.png' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@300;400;500;600;700&display=swap' },
      ],
      meta: [
        { name: 'description', content: 'Varg Studio is a fully offline desktop AI studio for speech synthesis, voice cloning, and script production. No cloud, no subscription.' },
        { property: 'og:title', content: 'Varg Studio — Offline AI Studio' },
        { property: 'og:description', content: 'Speech synthesis, voice cloning, and AI tools — all offline, on your machine.' },
        { property: 'og:image', content: '/icon.png' },
        { name: 'theme-color', content: '#1e1f22' },
      ],
    },
  },
})
