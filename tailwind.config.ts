import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Semantic (CSS var) tokens ──
        background: "var(--background)",
        foreground: "var(--foreground)",

        // ── Deep Tay core (from @roami/design-system) ──
        roami: {
          ink:      "#111a24",
          tay:      "#1a2832",
          midnight: "#0d141c",
          river:    "#2a5a5a",
          copper:   "#c4956a",
          pine:     "#5a7247",
          cream:    "#faf6f1",
          sand:     "#a89880",
          stone:    "#e0d9cf",
          heading:  "#2d2a26",
          umber:    "#6b5d4f",
          mist:     "#f0eee8",
          sage:     "#6a8a8a",
          error:    "#a04040",
        },
        // Also expose without prefix for backward-compat
        ink:    "#111a24",
        tay:    "#1a2832",
        copper: "#c4956a",
        river:  "#2a5a5a",
        cream:  "#faf6f1",
        mist:   "#f0eee8",
        sage:   "#6a8a8a",
        umber:  "#6b5d4f",
        dark:   "#2d2a26",
        stone:  "#e0d9cf",

        // Warm neutral scale (replaces default grays)
        neutral: {
          50:  "#faf6f1",
          100: "#f0eee8",
          200: "#e0d9cf",
          300: "#c4bdb2",
          400: "#a89880",
          500: "#8a7d6b",
          600: "#6b5d4f",
          700: "#4a3f35",
          800: "#2d2a26",
          900: "#111a24",
        },

        // ── StoryBank accent ──
        amber: {
          DEFAULT: "#e2a039",
          dim:    "#b87d2a",
        },

        // ── App semantic tokens (map to CSS vars) ──
        card:         "var(--card)",
        "card-raised": "var(--card-raised)",
        accent:       "var(--accent)",
        muted:        "var(--muted)",
        sidebar:      "var(--sidebar)",
        border:       "var(--border)",
        input:        "var(--input)",
        ring:         "var(--ring)",
        primary:      "var(--primary)",
        secondary:    "var(--secondary)",
        destructive:  "var(--destructive)",
      },
      fontFamily: {
        // Canonical Roami fonts — Playfair Display for headings
        heading: ["'Playfair Display'", "Georgia", "'Times New Roman'", "serif"],
        display: ["'Playfair Display'", "Georgia", "'Times New Roman'", "serif"],
        sans:    ["system-ui", "-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "sans-serif"],
        body:    ["system-ui", "-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "sans-serif"],
        mono:    ["'Fira Code'", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        "3xl": ["clamp(1.5rem, 3vw, 1.875rem)", { lineHeight: "1.35" }],
        "4xl": ["clamp(1.875rem, 4vw, 2.25rem)", { lineHeight: "1.35" }],
        "5xl": ["clamp(2.25rem, 5vw, 3rem)", { lineHeight: "1.2" }],
        "6xl": ["clamp(2.5rem, 6vw, 3.75rem)", { lineHeight: "1.2" }],
      },
      letterSpacing: {
        widest: "0.2em",
      },
      lineHeight: {
        snug: "1.35",
        relaxed: "1.75",
      },
      borderRadius: {
        sm:      "4px",
        md:      "8px",
        DEFAULT: "8px",
        lg:      "12px",
        xl:      "16px",
        full:    "9999px",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(17, 26, 36, 0.06)",
        md: "0 4px 8px rgba(17, 26, 36, 0.08)",
        lg: "0 12px 24px rgba(17, 26, 36, 0.12)",
        xl: "0 24px 48px rgba(17, 26, 36, 0.16)",
        "glow-copper": "0 0 0 1px rgba(196, 149, 106, 0.18), 0 0 32px -8px rgba(196, 149, 106, 0.35)",
      },
      transitionTimingFunction: {
        roami: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      keyframes: {
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        shimmer: "shimmer 1.5s infinite",
      },
    },
  },
  plugins: [],
};
export default config;
