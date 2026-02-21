import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import type { Plugin } from "vite";
import { defineConfig, loadEnv } from "vite";

const GLSL_EXTENSIONS = /\.(glsl|vert|frag|wgsl)$/i;

const glslShaderPlugin = (): Plugin => ({
  name: "glsl-shader-loader",
  enforce: "pre",
  load(id) {
    if (!GLSL_EXTENSIONS.test(id)) return null;
    const source = readFileSync(id, "utf-8");
    return `export default ${JSON.stringify(source)};`;
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendUrl = env.VITE_BACKEND_URL || "http://localhost:8080";

  return {
    plugins: [
      react(),
      glslShaderPlugin(),
    ],
    server: {
      port: 3000,
      proxy: {
        "/ws": {
          target: backendUrl,
          ws: true,
          changeOrigin: true,
        },
        "/api": {
          target: backendUrl,
          changeOrigin: true,
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
  };
});
