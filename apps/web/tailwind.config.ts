import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0B0F14',
        surface: '#1A1F26',
        'surface-light': '#252B33',
        accent: '#14B8A6',
        'accent-glow': 'rgba(20, 184, 166, 0.3)',
        border: '#2A2F35',
        danger: '#EF4444',
        success: '#10B981',
        warning: '#F59E0B',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(20, 184, 166, 0.3)' },
          '100%': { boxShadow: '0 0 20px rgba(20, 184, 166, 0.6)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
