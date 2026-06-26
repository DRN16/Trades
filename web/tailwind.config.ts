import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0b0f14",
        panel: "#121823",
        border: "#1f2937",
        accent: "#22d3ee",
        good: "#22c55e",
        bad: "#ef4444",
      },
    },
  },
  plugins: [],
};
export default config;
