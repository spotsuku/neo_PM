import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Base
        ink: "#0a0a0a",
        "ink-2": "#1a1a1a",
        mute: "#6b7a92",
        "mute-2": "#9aa4bb",
        // Accent (Cool Glass / 既定)
        accent: {
          DEFAULT: "#5b8def",
          deep: "#2e5cbf",
          soft: "#e6efff",
          bright: "#bcd2ff",
        },
        // Status
        ok: "#0a8754",
        warn: "#b8860b",
        error: "#c0392b",
      },
      fontFamily: {
        sans: [
          "var(--font-noto-sans-jp)",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "var(--font-jetbrains-mono)",
          "ui-monospace",
          "monospace",
        ],
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "14px",
        xl: "18px",
      },
      keyframes: {
        sparkle: {
          "0%,100%": { transform: "scale(.9)", opacity: ".6" },
          "50%": { transform: "scale(1.15)", opacity: "1" },
        },
        confetti: {
          "0%": { transform: "translateY(-10px) rotate(0)", opacity: "0" },
          "10%": { opacity: "1" },
          "100%": {
            transform: "translateY(420px) rotate(540deg)",
            opacity: "0",
          },
        },
        risein: {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "none" },
        },
        badgePop: {
          "0%": { transform: "scale(.6) rotate(-8deg)", opacity: "0" },
          "60%": { transform: "scale(1.1) rotate(2deg)", opacity: "1" },
          "100%": { transform: "scale(1) rotate(0)" },
        },
      },
      animation: {
        sparkle: "sparkle 3s ease-in-out infinite",
        risein: "risein .35s ease-out",
        badgePop: "badgePop .5s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
