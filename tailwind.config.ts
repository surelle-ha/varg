import type { Config } from 'tailwindcss'

export default {
  content: [
    './app.vue',
    './components/**/*.{vue,js,ts}',
    './composables/**/*.{js,ts}',
    './pages/**/*.vue'
  ],
  theme: {
    extend: {
      colors: {
        base:     '#1e1f22',
        surface:  '#2b2d31',
        overlay:  '#313338',
        subtle:   '#383a40',
        muted:    '#404249',
        primary:  '#f2f3f5',
        secondary:'#b5bac1',
        faded:    '#80848e',
        accent:   '#5865f2',
        'accent-dark': '#4752c4',
        ok:       '#23a55a',
        warn:     '#f0b232',
        err:      '#f23f42',
      },
      backdropBlur: {
        glass: '20px',
      },
      boxShadow: {
        glass:  '0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05)',
        panel:  '0 2px 12px rgba(0,0,0,0.35)',
        button: '0 1px 4px rgba(0,0,0,0.5)',
      },
      borderColor: {
        glass: 'rgba(255,255,255,0.07)',
      },
    }
  }
} satisfies Config
