import type { Config } from 'tailwindcss'

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Industrial command-center palette. See ARCHITECTURE.md #Design System.
        navy: {
          950: '#050a14',
          900: '#0a1220',
          800: '#101a2c',
          700: '#182640',
        },
        graphite: {
          900: '#15181d',
          800: '#1f232b',
          700: '#2a2f3a',
        },
        amber: {
          400: '#f2b544',
          500: '#e8a227',
          600: '#c8871b',
        },
        cyan: {
          400: '#4fd6e6',
          500: '#2bb8ca',
        },
      },
      borderRadius: {
        lg: '0.75rem',
        md: '0.5rem',
        sm: '0.375rem',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config
