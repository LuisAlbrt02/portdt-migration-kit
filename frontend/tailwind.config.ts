import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        "port-blue": "var(--port-blue)",
        "card-bg": "var(--card-bg)",
        "hover-bg": "var(--hover-bg)",
        "border-color": "var(--border-color)",
        sidebar: {
          bg: "var(--sidebar-bg)",
          text: "var(--sidebar-text)",
          highlight: "var(--sidebar-highlight)",
        },
      },
      boxShadow: {
        card: "0 4px 6px var(--card-shadow)",
      },
    },
  },
  plugins: [],
} satisfies Config;