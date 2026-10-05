import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          // Hijau khas Brainly — jadi warna utama, dipakai tombol CTA utama
          50: '#EAFBF2',
          100: '#D1F7E3',
          200: '#A6EFC9',
          300: '#6FE0A8',
          400: '#34CB83',
          500: '#0ABE6B', // primary
          600: '#089955',
          700: '#077A45',
          800: '#086038',
          900: '#074F2F',
        },
        accent: {
          // Aksen oranye hangat — cuma dipakai buat badge/highlight kecil,
          // bukan tombol utama (tombol utama sekarang pakai brand/hijau)
          50: '#FFF7ED',
          100: '#FFEDD5',
          300: '#FDBA74',
          500: '#F97316',
          600: '#EA580C',
          700: '#C2410C',
        },
        online: {
          500: '#22C55E', // status "tersedia" — beda rona dari brand biar tetap kebeda
          600: '#16A34A',
        },
        ink: {
          50: '#F9FAFB',
          100: '#F3F4F6',
          400: '#9CA3AF',
          600: '#4B5563',
          800: '#1F2937',
          900: '#111827',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        chat: '18px',
      },
      keyframes: {
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.7' },
          '70%': { transform: 'scale(1.4)', opacity: '0' },
          '100%': { transform: 'scale(1.4)', opacity: '0' },
        },
      },
      animation: {
        'pulse-ring': 'pulse-ring 1.8s cubic-bezier(0.2,0.6,0.4,1) infinite',
      },
    },
  },
  plugins: [],
};

export default config;
