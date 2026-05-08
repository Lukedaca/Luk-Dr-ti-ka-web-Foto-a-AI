/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './*.html',
    './galerie/**/*.html',
    './src/js/**/*.js',
    './assets/main.js'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'system-ui', 'sans-serif'],
        display: ['Geist', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace']
      },
      colors: {
        ink: {
          900: '#050a14',
          800: '#0a1628',
          700: '#14213d',
          600: '#1f2d4d',
          500: '#2c3d63'
        },
        silver: {
          50:  '#f4f7fb',
          100: '#e8eef6',
          200: '#cfd8e3',
          300: '#aebccd',
          400: '#8a98ad'
        },
        signal: {
          DEFAULT: '#4a90e2',
          hi: '#6fb0ff',
          deep: '#2f6fc4'
        },
        primary: {
          DEFAULT: '#0a1628',
          light: '#14213d'
        },
        accent: {
          blue: '#4a90e2',
          purple: '#4a90e2'
        }
      },
      letterSpacing: {
        eyebrow: '0.18em',
        tight2: '-0.02em'
      },
      boxShadow: {
        signal: '0 18px 36px rgba(74,144,226,0.22)',
        signalHi: '0 22px 50px rgba(74,144,226,0.32)',
        ink: '0 24px 60px -20px rgba(5,10,20,0.6)'
      }
    }
  },
  plugins: []
}
