/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
        display: ['Poppins', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
      colors: {
        ink: '#EEEDF8',
        chalk: '#2A2748',
        signal: '#7C5CFF',
        ember: '#FF6B8A',
      },
    },
  },
  plugins: [],
}
