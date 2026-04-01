/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        outfit: ["Outfit", "system-ui", "sans-serif"],
        "dm-sans": ["DM Sans", "system-ui", "sans-serif"],
      },
      colors: {
        ludle: {
          green: "var(--color-green)",
          "green-light": "var(--color-green-light)",
          "green-dim": "var(--color-green-dim)",
        },
      },
    },
  },
  plugins: [],
};
