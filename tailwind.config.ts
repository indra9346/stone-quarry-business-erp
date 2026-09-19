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
          950: '#050a14',
          900: '#0a1220',
          800: '#101a2c',
          700: '#182640',
          600: '#22355a',
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
          'Inter',
          'Segoe UI Variable',
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
        lg: '0.75rem',
        md: '0.5rem',
        sm: '0.375rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.05), 0 2px 6px rgba(15, 23, 42, 0.06)',
        lift: '0 4px 12px rgba(15, 23, 42, 0.10), 0 12px 28px -8px rgba(15, 23, 42, 0.16)',
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
