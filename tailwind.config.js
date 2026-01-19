/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './404.html',
    './src/js/**/*.js',
    './assets/main.js'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'Plus Jakarta Sans', 'sans-serif']
      },
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8'
        },
        accent: {
          purple: '#8b5cf6',
          cyan: '#22d3ee'
        }
      },
      animation: {
        'gradient': 'gradient 8s ease infinite',
        'float': 'float 6s ease-in-out infinite',
        'bounce-slow': 'bounce 2s infinite'
      },
      keyframes: {
        gradient: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' }
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' }
        }
      }
    }
  },
  plugins: []
}
