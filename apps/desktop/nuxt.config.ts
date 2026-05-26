export default defineNuxtConfig({
  ssr: false,
  modules: ['@nuxtjs/tailwindcss'],
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      title: 'Varg',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' }
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Ubuntu:ital,wght@0,300;0,400;0,500;0,700;1,300;1,400;1,500;1,700&display=swap' },
      ]
    }
  },
  typescript: {
    strict: true,
    typeCheck: false
  },
  vite: {
    worker: {
      format: 'es'
    },
    optimizeDeps: {
      exclude: ['kokoro-js'],
      include: [
        '@tauri-apps/api/core',
        '@tauri-apps/api/event',
        '@tauri-apps/api/window',
        '@tauri-apps/plugin-notification',
        'lucide-vue-next',
        'ogl',
      ],
    }
  },
  compatibilityDate: '2026-05-21',
  devtools: { enabled: true }
})

