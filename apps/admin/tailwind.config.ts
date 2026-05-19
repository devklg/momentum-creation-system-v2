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
    },
  },
  plugins: [animate],
};

export default config;
