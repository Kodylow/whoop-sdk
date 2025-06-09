/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        whoop: {
          red: '#FF3040',
          yellow: '#FFD23F',
          green: '#5DC864',
          dark: '#1A1A1A',
          gray: '#2D2D2D'
        }
      }
    },
  },
  plugins: [],
} 