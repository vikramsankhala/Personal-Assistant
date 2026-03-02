import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "monospace"],
      },
      colors: {
        ink: {
          50: "#f6f6f7",
          100: "#e2e3e5",
          200: "#c4c6ca",
          300: "#9fa2a8",
          400: "#7a7e86",
          500: "#5f6369",
          600: "#4b4e53",
          700: "#3d4044",
          800: "#252729",
          900: "#18191b",
        },
        accent: {
          DEFAULT: "#0ea5e9",
          hover: "#0284c7",
          muted: "#e0f2fe",
        },
      },
    },
  },
  plugins: [],
};

export default config;
