export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0B1021",
        mint: "#28C76F",
        amber: "#F6C343",
        coral: "#FF6B6B",
        stone: "#F4F1EB"
      }
    }
  },
  plugins: [require("@tailwindcss/forms")]
};
