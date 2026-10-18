/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: { red: '#EF3E36', redhi: '#FF6B5E', navy: '#113150', deep: '#0A1A2B', cream: '#F6F1E7' },
        zinc: {
          // Dark surfaces re-tinted toward brand navy (#113150).
          50: '#0F2740',
          100: '#143456',
          200: '#1E446B',
          300: '#2E5880',
          400: '#9CA3AF',
          500: '#ACB3AE',
          600: '#C2C8C4',
          700: '#D8DDD9',
          800: '#ECEFED',
          900: '#F5F5F4',
        },
      },
      fontFamily: {
        display: ['"Barlow Condensed"', 'Impact', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: '5px',
        xl: '5px',
        '2xl': '5px',
        '3xl': '6px',
      },
    },
  },
  plugins: [],
}
