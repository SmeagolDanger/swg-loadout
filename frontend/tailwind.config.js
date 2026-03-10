/** @type {import('tailwindcss').Config} */
const withOpacity = (cssVar) => `rgb(var(${cssVar}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        hull: {
          950: withOpacity('--color-hull-950'),
          900: withOpacity('--color-hull-900'),
          800: withOpacity('--color-hull-800'),
          700: withOpacity('--color-hull-700'),
          600: withOpacity('--color-hull-600'),
          500: withOpacity('--color-hull-500'),
          400: withOpacity('--color-hull-400'),
          300: withOpacity('--color-hull-300'),
          200: withOpacity('--color-hull-200'),
          100: withOpacity('--color-hull-100'),
          50: withOpacity('--color-hull-50'),
        },
        plasma: {
          500: withOpacity('--color-plasma-500'),
          400: withOpacity('--color-plasma-400'),
          300: withOpacity('--color-plasma-300'),
          glow: withOpacity('--color-plasma-glow'),
        },
        laser: {
          red: withOpacity('--color-laser-red'),
          green: withOpacity('--color-laser-green'),
          yellow: withOpacity('--color-laser-yellow'),
          orange: withOpacity('--color-laser-orange'),
        },
        shield: {
          blue: withOpacity('--color-shield-blue'),
          glow: withOpacity('--color-shield-glow'),
        },
      },
      fontFamily: {
        display: ['"Rajdhani"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        body: ['"Exo 2"', 'sans-serif'],
      },
      boxShadow: {
        plasma: '0 0 20px rgb(var(--color-plasma-500) / 0.15), 0 0 40px rgb(var(--color-plasma-500) / 0.05)',
        glow: '0 0 10px rgb(var(--color-plasma-500) / 0.3)',
        card: '0 4px 24px rgba(0, 0, 0, 0.4)',
      },
      animation: {
        'pulse-glow': 'pulseGlow 3s ease-in-out infinite',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 10px rgb(var(--color-plasma-500) / 0.1)' },
          '50%': { boxShadow: '0 0 20px rgb(var(--color-plasma-500) / 0.25)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
      },
    },
  },
  plugins: [],
};
