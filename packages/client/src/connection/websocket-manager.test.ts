import { describe, expect, it } from "bun:test";
import { createWebSocketManager } from "./websocket-manager";

class FakeSocket {
  static OPEN = 1;

  public readyState = FakeSocket.OPEN;
  public binaryType = "blob";
  public onopen: (() => void) | null = null;
  public onclose: ((event: { code?: number; reason?: string }) => void) | null = null;
  public onerror: (() => void) | null = null;
  public onmessage: ((event: { data: unknown }) => void) | null = null;
  public sent: Array<string | ArrayBufferLike | Blob | ArrayBufferView> = [];
  public closed = false;

  constructor(public readonly url: string) {}

  send(payload: string | ArrayBufferLike | Blob | ArrayBufferView) {
    this.sent.push(payload);
  }

  close() {
    this.closed = true;
  }
}

describe("createWebSocketManager", () => {
  it("builds ws url and transitions to connected on open", () => {
    const sockets: FakeSocket[] = [];
    const manager = createWebSocketManager({
      createSocket: (url) => {
        const socket = new FakeSocket(url);
        sockets.push(socket);
        return socket as unknown as WebSocket;
      },
      getLocationProtocol: () => "http:",
      scheduleReconnect: () => undefined,
    });

    expect(manager.getState()).toBe("disconnected");
    manager.connect("localhost:5173", "u1", "s1");
    expect(manager.getState()).toBe("connecting");
    expect(sockets[0].url).toBe("ws://localhost:5173/ws/u1/s1");

    sockets[0].onopen?.();
    expect(manager.getState()).toBe("connected");
  });

  it("uses wss in https contexts", () => {
    const manager = createWebSocketManager({
      createSocket: (url) => new FakeSocket(url) as unknown as WebSocket,
      getLocationProtocol: () => "https:",
      scheduleReconnect: () => undefined,
    });
    manager.connect("example.com", "u2", "s2");
    expect(manager.getUrl()).toBe("wss://example.com/ws/u2/s2");
  });

  it("sends binary and text payloads only when socket is open", () => {
    const socket = new FakeSocket("ws://localhost/ws/u/s");
    const manager = createWebSocketManager({
      createSocket: () => socket as unknown as WebSocket,
      getLocationProtocol: () => "http:",
      scheduleReconnect: () => undefined,
    });
    manager.connect("localhost", "u", "s");
    socket.onopen?.();

    const binary = new Int16Array([1, 2, 3]);
    manager.sendBinary(binary);
    manager.sendText({ type: "text", text: "hello" });
    expect(socket.sent.length).toBe(2);
    expect(socket.sent[0]).toBe(binary.buffer);
    expect(socket.sent[1]).toBe(JSON.stringify({ type: "text", text: "hello" }));
  });

  it("transitions to reconnecting and schedules reconnect on unexpected close", () => {
    const scheduled: Array<() => void> = [];
    const sockets: FakeSocket[] = [];
    const manager = createWebSocketManager({
      createSocket: (url) => {
        const socket = new FakeSocket(url);
        sockets.push(socket);
        return socket as unknown as WebSocket;
      },
      getLocationProtocol: () => "http:",
      scheduleReconnect: (fn) => {
        scheduled.push(fn);
      },
    });

    manager.connect("localhost", "u", "s");
    sockets[0].onopen?.();
    expect(manager.getState()).toBe("connected");

    sockets[0].onclose?.({ code: 1006 });
    expect(manager.getState()).toBe("reconnecting");
    expect(scheduled.length).toBe(1);

    scheduled[0]();
    expect(manager.getState()).toBe("connecting");
    expect(sockets.length).toBe(2);
  });

  it("moves to disconnected on manual disconnect and does not reconnect", () => {
    const scheduled: Array<() => void> = [];
    const socket = new FakeSocket("ws://localhost/ws/u/s");
    const manager = createWebSocketManager({
      createSocket: () => socket as unknown as WebSocket,
      getLocationProtocol: () => "http:",
      scheduleReconnect: (fn) => scheduled.push(fn),
    });
    manager.connect("localhost", "u", "s");
    socket.onopen?.();

    manager.disconnect();
    expect(manager.getState()).toBe("disconnected");
    expect(socket.closed).toBeTrue();
    socket.onclose?.({ code: 1000 });
    expect(scheduled.length).toBe(0);
  });
});
