// tailwind.config.js
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      colors: {
        // Burooj Marketing brand teal — replaces orange throughout the app
        orange: {
          50:  '#e6f7fa',
          100: '#b3e8f4',
          200: '#80d8ee',
          300: '#4dc9e8',
          400: '#26b8d6',
          500: '#0098B4',
          600: '#007a91',
          700: '#005c6e',
          800: '#003d4a',
          900: '#001f27',
        },
        brand: {
          50:  '#e6f7fa',
          100: '#b3e8f4',
          200: '#80d8ee',
          300: '#4dc9e8',
          400: '#26b8d6',
          500: '#0098B4',
          600: '#007a91',
          700: '#005c6e',
          800: '#003d4a',
          900: '#001f27',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
