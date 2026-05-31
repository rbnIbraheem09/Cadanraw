/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      // Single source of truth lives in src/index.css (:root CSS variables).
      // These keys just expose semantic utilities (bg-surface, text-ink, etc.).
      colors: {
        void: "var(--void)",
        deep: "var(--deep)",
        base: "var(--base)",
        raised: "var(--raised)",
        surface: "var(--surface)",
        overlay: "var(--overlay)",
        accent: {
          DEFAULT: "var(--accent)",
          soft: "var(--accent-soft)",
          glow: "var(--accent-glow)",
        },
        ink: {
          DEFAULT: "var(--text)",
          dim: "var(--text-dim)",
          muted: "var(--text-muted)",
        },
        edge: {
          DEFAULT: "var(--border)",
          dim: "var(--border-dim)",
        },
      },
      fontFamily: {
        sans: [
          "Hanken Grotesk",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "SF Mono", "Menlo", "Monaco", "monospace"],
      },
    },
  },
  plugins: [],
};
