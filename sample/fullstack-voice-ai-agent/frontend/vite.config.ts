import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  // FastAPI serves static files under /static, so production asset URLs must be prefixed.
  base: command === "build" ? "/static/" : "/",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "../app/static/",
    emptyOutDir: false
  },
  test: {
    environment: "jsdom",
    include: ["__tests__/**/*.{test,spec}.{ts,tsx}"],
    setupFiles: "./__tests__/test-setup.ts"
  }
}));
