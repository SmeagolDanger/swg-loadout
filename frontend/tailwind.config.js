/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        hull: {
          900: '#0a0c10',
          800: '#111318',
          700: '#181b22',
          600: '#1f232c',
          500: '#272c38',
          400: '#343a4a',
          300: '#4a5168',
          200: '#6b7494',
          100: '#9ca3bd',
        },
        plasma: {
          500: '#00d4ff',
          400: '#33ddff',
          300: '#66e6ff',
          glow: 'rgba(0, 212, 255, 0.15)',
        },
        laser: {
          red: '#ff3344',
          green: '#00cc66',
          yellow: '#ffaa00',
          orange: '#ff6b2b',
        },
        shield: {
          blue: '#4488ff',
          glow: 'rgba(68, 136, 255, 0.2)',
        }
      },
      fontFamily: {
        display: ['"Rajdhani"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        body: ['"Exo 2"', 'sans-serif'],
      },
      boxShadow: {
        'plasma': '0 0 20px rgba(0, 212, 255, 0.15), 0 0 40px rgba(0, 212, 255, 0.05)',
        'glow': '0 0 10px rgba(0, 212, 255, 0.3)',
        'card': '0 4px 24px rgba(0, 0, 0, 0.4)',
      },
      animation: {
        'pulse-glow': 'pulseGlow 3s ease-in-out infinite',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(0, 212, 255, 0.1)' },
          '50%': { boxShadow: '0 0 20px rgba(0, 212, 255, 0.25)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        }
      }
    },
  },
  plugins: [],
}
