import type { Config } from 'tailwindcss'
import tailwindcssAnimate from 'tailwindcss-animate'

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Industrial command-center palette. Dark navy for navigation and
        // command surfaces; light slate/white for working content; amber is
        // the quarry accent, cyan the data accent.
        navy: {
          950: '#0e0d0b',
          900: '#191715',
          800: '#242120',
          700: '#332f2c',
          600: '#4a443f',
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
      fontFamily: {
        sans: [
          'IBM Plex Sans',
          'Segoe UI',
          'Segoe UI',
          'system-ui',
          '-apple-system',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      borderRadius: {
        lg: '0.375rem',
        md: '0.25rem',
        sm: '0.1875rem',
      },
      boxShadow: {
        card: '0 1px 0 rgba(28, 25, 23, 0.04)',
        lift: '0 8px 24px -6px rgba(28, 25, 23, 0.25)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 220ms ease-out both',
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config
