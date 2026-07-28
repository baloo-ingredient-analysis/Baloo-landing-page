import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      // V3 "warm boutique" palette (Order L1a) — cream paper world, brown-black ink. muted is
      // deliberately darker than the V3 mock's #8C7B68: that value is ~3.5:1 on canvas and fails
      // WCAG AA for the small text it's used on; #766753 keeps the hue at ~4.7:1 (PRODUCT.md
      // commits to AA; measured in-browser). natural/processed are untouched — the one meaningful colour.
      colors: {
        ink: "#2D2417",
        muted: "#766753",
        line: "#E8DDD0",
        paper: "#FDFAF6",
        canvas: "#F4EDE3",
        natural: { DEFAULT: "#2E7D52", soft: "#E7F1EB" },
        processed: { DEFAULT: "#B5701F", soft: "#F6ECDD" },
        // Like (Order L8) — the ONE affection colour. A warm boutique rose-red, deliberately
        // distinct from natural/processed so it never reads as a health verdict. Reserved for the
        // Like heart on lists/cards; it must never appear on ingredient or nutrition UI.
        like: { DEFAULT: "#C24C4C", soft: "#F7E8E6" },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      maxWidth: { tool: "640px" },
      boxShadow: {
        card: "0 1px 2px rgba(45,36,23,0.04), 0 1px 3px rgba(45,36,23,0.05)",
        "card-hover": "0 4px 14px rgba(45,36,23,0.07), 0 2px 5px rgba(45,36,23,0.04)",
        hero: "0 1px 2px rgba(45,36,23,0.05), 0 10px 30px -12px rgba(45,36,23,0.12)",
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        // The board's live dot (Order D). Gentle by design; the global reduced-motion rule
        // in globals.css zeroes it.
        "pulse-dot": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.45", transform: "scale(0.7)" },
        },
      },
      animation: {
        rise: "rise 0.35s ease-out both",
        "fade-in": "fade-in 0.5s ease-out both",
        "pulse-dot": "pulse-dot 2.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
