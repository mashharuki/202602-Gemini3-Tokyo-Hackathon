import { describe, expect, it } from "bun:test";
import config from "./vite.config";

describe("vite ws proxy", () => {
  it("forwards /ws to app server with websocket enabled", () => {
    const proxy = config.server?.proxy as Record<string, { target: string; ws: boolean }>;
    expect(proxy).toBeDefined();
    expect(proxy["/ws"]).toBeDefined();
    expect(proxy["/ws"].target).toBe("http://localhost:8000");
    expect(proxy["/ws"].ws).toBeTrue();
  });
});
