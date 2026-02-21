import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import config from "./vite.config";

describe("vite ws proxy", () => {
  it("forwards /ws to app server with websocket enabled", () => {
    const proxy = config.server?.proxy as Record<string, { target: string; ws: boolean }>;
    expect(proxy).toBeDefined();
    expect(proxy["/ws"]).toBeDefined();
    expect(proxy["/ws"].target).toBe("http://localhost:8000");
    expect(proxy["/ws"].ws).toBeTrue();
  });

  it("forwards /api to image generation server", () => {
    const proxy = config.server?.proxy as Record<string, { target: string; ws?: boolean }>;
    expect(proxy).toBeDefined();
    expect(proxy["/api"]).toBeDefined();
    expect(proxy["/api"].target).toBe("http://localhost:8080");
  });
});

describe("threejs world task 1 setup", () => {
  it("has required rendering dependencies", () => {
    const packageJson = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8")) as {
      dependencies?: Record<string, string>;
    };
    const deps = packageJson.dependencies ?? {};

    expect(deps["@react-three/drei"]).toBeDefined();
    expect(deps["@react-three/postprocessing"]).toBeDefined();
    expect(deps.postprocessing).toBeDefined();
  });

  it("enables glsl shader import support in vite plugins", () => {
    const source = readFileSync(new URL("./vite.config.ts", import.meta.url), "utf-8");
    expect(source.includes('from "vite-plugin-glsl"')).toBeTrue();
    expect(source.includes("glsl(")).toBeTrue();
  });
});
