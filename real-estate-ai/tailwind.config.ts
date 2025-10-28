import type { Config } from 'tailwindcss';
export default {
  content: ['./app/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0b1020',
        card: '#11162a',
        ink: '#e6edf3',
        mute: '#9aa4b2',
        prim: '#7c9cf5',
        ok: '#2ecc71',
        warn: '#f1c40f',
        err: '#e74c3c'
      }
    }
  },
  plugins: []
} satisfies Config;
