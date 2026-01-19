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
          DEFAULT: '#0a0e27',
          light: '#1a1f3a'
        },
        accent: {
          blue: '#3b82f6',
          purple: '#8b5cf6'
        }
      }
    }
  },
  plugins: []
}
