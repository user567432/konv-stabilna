import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      colors: {
        ink: {
          900: "#0A0A0A",
          700: "#1F1F1F",
          500: "#525252",
          400: "#737373",
          300: "#A3A3A3",
          200: "#D4D4D4",
          100: "#EEEEEE",
          50:  "#F7F7F7",
        },
        accent: {
          DEFAULT: "#111111",
          mint:    "#10B981",
          rose:    "#F43F5E",
          amber:   "#F59E0B",
          sky:     "#0EA5E9",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,0.04), 0 2px 6px rgba(16,24,40,0.04)",
        soft: "0 10px 30px rgba(16,24,40,0.06)",
      },
      borderRadius: {
        xl: "14px",
        "2xl": "20px",
      },
    },
  },
  plugins: [],
};

export default config;
