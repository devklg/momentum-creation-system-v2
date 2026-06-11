import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#0A0A0A', 2: '#0F0F0F' },
        gold: { DEFAULT: '#C9A84C', bright: '#F5C030' },
        teal: { DEFAULT: '#2DD4BF' },
        cream: {
          DEFAULT: '#F5EFE6',
          mute: 'rgba(245, 239, 230, 0.72)',
          faint: 'rgba(245, 239, 230, 0.48)',
        },
        line: 'rgba(245, 239, 230, 0.12)',
        identity: '#C9A84C',
        ceremony: '#F5C030',
        live: '#2DD4BF',
        action: '#2DD4BF',
        progress: '#2DD4BF',
      },
      fontFamily: {
        display: ["'Bebas Neue'", 'sans-serif'],
        body: ["'DM Sans'", 'sans-serif'],
        mono: ["'DM Mono'", "'JetBrains Mono'", 'monospace'],
      },
      letterSpacing: {
        eyebrow: '0.16em',
        label: '0.14em',
        button: '0.14em',
        wide2: '0.32em',
      },
      keyframes: {
        tmRise: {
          from: { opacity: '0', transform: 'translateY(0.75rem)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        tmLivePulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(45, 212, 191, 0.35)' },
          '50%': { boxShadow: '0 0 0 0.55rem rgba(45, 212, 191, 0)' },
        },
        tmTicker: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        'tm-rise': 'tmRise 620ms cubic-bezier(0.2, 0.7, 0.2, 1) both',
        'tm-live-pulse': 'tmLivePulse 2s ease-in-out infinite',
        'tm-ticker': 'tmTicker 28s linear infinite',
      },
    },
  },
  plugins: [animate],
};

export default config;
