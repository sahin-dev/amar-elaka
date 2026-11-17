import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#effaf8",
          100: "#d6f2ed",
          200: "#aee4da",
          300: "#7bcfc2",
          400: "#45b2a4",
          500: "#23968a",
          600: "#167a71",
          700: "#14625c",
          800: "#134f4b",
          900: "#12423f",
        },
        ink: {
          DEFAULT: "#111827",
          soft: "#374151",
          muted: "#5b6472",
          faint: "#8a93a1",
        },
        line: "#e5e7eb",
        canvas: "#f7f8f7",
        status: {
          reported: "#b45309",
          verified: "#c2410c",
          review: "#6d28d9",
          resolved: "#15803d",
          archived: "#4b5563",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "var(--font-bangla)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(17,24,39,0.04), 0 1px 1px rgba(17,24,39,0.03)",
        sheet: "0 -6px 24px rgba(17,24,39,0.10)",
        fab: "0 6px 16px rgba(20,98,92,0.35)",
      },
      keyframes: {
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: { shimmer: "shimmer 1.4s infinite" },
    },
  },
  plugins: [],
};

export default config;
