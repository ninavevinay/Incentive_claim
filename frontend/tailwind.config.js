export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        "ink-soft": "#64748b",
        navy: {
          50: "#f0f4f8",
          100: "#dce4ed",
          200: "#b8c9db",
          300: "#8aa3c0",
          400: "#5c7da3",
          500: "#3d5f87",
          600: "#2d4a6e",
          700: "#1e3a5f",
          800: "#152a45",
          900: "#0c1929"
        },
        portal: {
          accent: "#0891b2",
          "accent-light": "#06b6d4",
          success: "#059669",
          warning: "#d97706",
          danger: "#dc2626"
        },
        mint: "#28C76F",
        amber: "#F6C343",
        coral: "#FF6B6B",
        stone: "#F4F1EB"
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Plus Jakarta Sans", "Inter", "system-ui", "sans-serif"]
      },
      boxShadow: {
        portal: "0 1px 3px rgba(15, 23, 42, 0.08), 0 4px 12px rgba(15, 23, 42, 0.06)",
        "portal-lg": "0 4px 6px rgba(15, 23, 42, 0.05), 0 12px 32px rgba(15, 23, 42, 0.1)",
        sidebar: "4px 0 24px rgba(15, 23, 42, 0.12)"
      }
    }
  },
  plugins: [require("@tailwindcss/forms")]
};
