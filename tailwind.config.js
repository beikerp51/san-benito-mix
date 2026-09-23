/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', 'sans-serif'],
      },
      colors: {
        ios: {
          bg: '#F2F2F7',
          card: '#FFFFFF',
          blue: '#007AFF',
          green: '#34C759',
          red: '#FF3B30',
          orange: '#FF9500',
          yellow: '#FFCC00',
          purple: '#AF52DE',
          teal: '#5AC8FA',
          pink: '#FF2D55',
          indigo: '#5856D6',
        },
      },
      borderRadius: {
        'squircle': '1.375rem',
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
};
