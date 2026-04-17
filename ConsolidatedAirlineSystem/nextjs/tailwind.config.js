/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}', './context/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        airline: {
          700: '#1d4ed8',
          800: '#1e3a8a',
          900: '#0f172a',
        }
      }
    }
  },
  plugins: []
}
