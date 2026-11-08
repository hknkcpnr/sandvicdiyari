/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        poppins: ['var(--font-poppins)', 'Poppins', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#fffbeb',
          100: '#fef3c7',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        }
      },
      opacity: {
        96: '0.96',
        97: '0.97',
        98: '0.98',
        99: '0.99',
      },
      boxShadow: {
        '2xs': '0 1px 2px 0 rgb(0 0 0 / 0.04)',
        xs: '0 1px 3px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.05)',
      },
      backdropBlur: {
        xs: '2px',
      },
      scale: {
        98: '0.98',
      },
      transitionDuration: {
        250: '250ms',
      },
      zIndex: {
        60: '60',
        70: '70',
      },
    },
  },
  plugins: [],
}
