import type { Config } from 'tailwindcss'

export default {
  content: ['./app.vue', './pages/**/*.vue', './components/**/*.vue'],
  theme: {
    extend: {
      colors: {
        base:    '#1e1f22',
        surface: '#2b2d31',
        overlay: '#313338',
        subtle:  '#383a40',
        accent:  '#5865f2',
        ok:      '#23a55a',
        warn:    '#f0b232',
        err:     '#f23f42',
      },
      fontFamily: {
        display: ['"Playfair Display"', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-up':      'fadeUp 0.7s ease both',
        'fade-in':      'fadeIn 0.6s ease both',
        'slide-right':  'slideRight 0.6s ease both',
        'float':        'float 6s ease-in-out infinite',
        'pulse-slow':   'pulse 4s ease-in-out infinite',
        'spin-slow':    'spin 20s linear infinite',
        'glow':         'glow 3s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        slideRight: {
          from: { opacity: '0', transform: 'translateX(-20px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-12px)' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(88,101,242,0.3)' },
          '50%':      { boxShadow: '0 0 50px rgba(88,101,242,0.6), 0 0 80px rgba(88,101,242,0.2)' },
        },
      },
    },
  },
} satisfies Config
