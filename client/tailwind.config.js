/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: "#202124"
      },
      fontFamily: {
        poppins: "Poppins, sans-serif"
      }
    },
  },
  plugins: [],
}