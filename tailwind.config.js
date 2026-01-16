/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        nextstep: {
          bg: '#c0c0c0',
          raised: '#d4d4d4',
          sunken: '#a0a0a0',
          border: { light: '#e8e8e8', dark: '#505050', mid: '#808080' },
          text: { primary: '#000000', secondary: '#404040', muted: '#606060' }
        }
      }
    }
  },
  plugins: [],
}
