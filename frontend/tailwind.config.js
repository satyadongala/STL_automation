/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EDF6F9',
          100: '#D9EEF4',
          200: '#B8DEE9',
          300: '#8FC9DA',
          400: '#72C2D5',
          500: '#5BAFC4',
          600: '#4096AC',
          700: '#2E7D96',
          800: '#1C6880',
          900: '#124F63',
        },
        aqua: {
          50: '#EDF6F9',
          100: '#D9EEF4',
          200: '#B8DEE9',
          300: '#8FC9DA',
          400: '#72C2D5',
          500: '#5BAFC4',
          600: '#4096AC',
          700: '#2E7D96',
          800: '#1C6880',
          900: '#124F63',
        },
        navy: {
          900: '#0F172A',
          800: '#1E293B',
          700: '#334155',
          600: '#475569',
          500: '#64748B',
        },
        "primary-bg": "#EDF6F9",
        "secondary-bg": "#D9EEF4",
        "sidebar-bg": "rgba(255, 255, 255, 0.55)",
        "card-bg": "rgba(255, 255, 255, 0.78)",
        accent: "#72C2D5",
        success: "#22C55E",
        warning: "#FBBF24",
        error: "#F87171",
        "text-primary": "#0F172A",
        "text-secondary": "#334155",
        "text-muted": "#475569",
      },
      transitionDuration: {
        250: '250ms',
      },
    },
  },
  plugins: [],
}
