/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        zinc: {
          50: '#131615',
          100: '#1A1E1C',
          200: '#262B28',
          300: '#3A403C',
          400: '#9CA3AF',
          500: '#ACB3AE',
          600: '#C2C8C4',
          700: '#D8DDD9',
          800: '#ECEFED',
          900: '#F5F5F4',
        },
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
