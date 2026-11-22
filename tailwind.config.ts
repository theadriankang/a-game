import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        page: "var(--page)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        text0: "var(--text0)",
        text1: "var(--text1)",
        text2: "var(--text2)",
        text3: "var(--text3)",
        accent: "var(--accent)",
        green: {
          DEFAULT: "var(--green)",
          bg: "var(--green-bg)",
          border: "var(--green-border)",
        },
        amber: {
          DEFAULT: "var(--amber)",
          bg: "var(--amber-bg)",
          border: "var(--amber-border)",
        },
        red: {
          DEFAULT: "var(--red)",
          bg: "var(--red-bg)",
          border: "var(--red-border)",
        },
        seg: {
          bg: "var(--seg-bg)",
        },
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
