import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import glsl from "vite-plugin-glsl";

export default defineConfig({
  plugins: [
    react(),
    glsl({
      include: ["**/*.glsl", "**/*.vert", "**/*.frag", "**/*.wgsl"],
    }),
  ],
  server: {
    port: 3000,
    proxy: {
      "/ws": {
        target: "http://localhost:8000",
        ws: true,
      },
      "/api": {
        target: "http://localhost:8080",
      },
    },
    fs: {
      strict: false,
    },
  },
  build: {
    target: "es2022",
    minify: true,
    sourcemap: true,
  },
});
