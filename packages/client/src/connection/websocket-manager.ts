import type { ConnectionState } from "../voice/types";
import { connectionStateMachine } from "./connection-state-machine";

interface WebSocketManagerDeps {
  createSocket: (url: string) => WebSocket;
  getLocationProtocol: () => string;
  scheduleReconnect: (fn: () => void) => void;
}

export interface WebSocketManager {
  connect: (targetHost: string, uid: string, sid: string) => void;
  disconnect: () => void;
  sendBinary: (payload: Int16Array | ArrayBuffer) => void;
  sendText: (payload: { type: "text"; text: string }) => void;
  getState: () => ConnectionState;
  getUrl: () => string;
  getSocket: () => WebSocket | null;
  setHandlers: (handlers: {
    onStateChange?: (next: ConnectionState) => void;
    onMessage?: (text: string) => void;
  }) => void;
}

const defaultDeps: WebSocketManagerDeps = {
  createSocket: (url) => new WebSocket(url),
  getLocationProtocol: () => window.location.protocol,
  scheduleReconnect: (fn) => {
    window.setTimeout(fn, 1000);
  },
};

const isWebSocketDebugEnabled = (): boolean => {
  if (import.meta.env.DEV) return true;
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem("VOICE_DEBUG") === "1";
};

export const createWebSocketManager = (deps: Partial<WebSocketManagerDeps> = {}) => {
  const resolvedDeps: WebSocketManagerDeps = { ...defaultDeps, ...deps };

  const debug = (...args: unknown[]) => {
    if (isWebSocketDebugEnabled()) {
      console.log("[WebSocketDebug]", ...args);
    }
  };

  const debugWarn = (...args: unknown[]) => {
    if (isWebSocketDebugEnabled()) {
      console.warn("[WebSocketDebug]", ...args);
    }
  };

  let state: ConnectionState = "disconnected";
  let socket: WebSocket | null = null;
  let reconnectEnabled = false;
  let host = "";
  let userId = "";
  let sessionId = "";
  let currentUrl = "";
  let onStateChange: ((next: ConnectionState) => void) | null = null;
  let onMessage: ((text: string) => void) | null = null;

  const setState = (event: Parameters<typeof connectionStateMachine>[1]) => {
    state = connectionStateMachine(state, event);
    onStateChange?.(state);
  };

  const setStateDirectly = (next: ConnectionState) => {
    state = next;
    onStateChange?.(state);
  };

  const normalizeTargetHost = (targetHost: string): string => {
    const trimmed = targetHost.trim().replace(/\/$/, "");
    if (!trimmed) return trimmed;

    if (
      trimmed.startsWith("ws://") ||
      trimmed.startsWith("wss://") ||
      trimmed.startsWith("http://") ||
      trimmed.startsWith("https://")
    ) {
      try {
        const parsed = new URL(trimmed);
        return parsed.host;
      } catch {
        return trimmed.replace(/^(ws|wss|http|https):\/\//, "");
      }
    }

    return trimmed;
  };

  const buildUrl = (targetHost: string, uid: string, sid: string): string => {
    const wsProtocol = resolvedDeps.getLocationProtocol() === "https:" ? "wss" : "ws";
    const normalizedHost = normalizeTargetHost(targetHost);
    return `${wsProtocol}://${normalizedHost}/ws/${uid}/${sid}`;
  };

  const connectInternal = () => {
    currentUrl = buildUrl(host, userId, sessionId);
    debug("connecting", { url: currentUrl, userId, sessionId });
    if (state === "reconnecting") {
      setStateDirectly("connecting");
    } else {
      setState("connect");
    }
    socket = resolvedDeps.createSocket(currentUrl);
    socket.binaryType = "arraybuffer";

    socket.onopen = () => {
      debug("socket open", { url: currentUrl });
      setState("connect_success");
    };

    socket.onerror = (event) => {
      debugWarn("socket error", { event, url: currentUrl });
      setState("connect_error");
    };

    socket.onclose = (event) => {
      debugWarn("socket close", { code: event.code, reason: event.reason, wasClean: event.wasClean });
      if (reconnectEnabled) {
        if (state === "connecting" || state === "reconnecting") {
          setState("connect_error");
        } else {
          setState("error");
        }
        setState("retry");
        resolvedDeps.scheduleReconnect(() => {
          if (!reconnectEnabled) return;
          connectInternal();
        });
        return;
      }

      setState("disconnect");
    };

    socket.onmessage = (event) => {
      if (typeof event.data === "string") {
        debug("socket message received", { length: event.data.length, preview: event.data.slice(0, 160) });
        onMessage?.(event.data);
      }
    };
  };

  return {
    connect: (targetHost: string, uid: string, sid: string) => {
      host = targetHost;
      userId = uid;
      sessionId = sid;
      reconnectEnabled = true;
      connectInternal();
    },
    disconnect: () => {
      reconnectEnabled = false;
      if (socket) {
        socket.close();
      }
      setStateDirectly("disconnected");
    },
    sendBinary: (payload: Int16Array | ArrayBuffer) => {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        debugWarn("binary send skipped: socket not open", { readyState: socket?.readyState ?? "no-socket" });
        return;
      }
      socket.send(payload instanceof Int16Array ? payload.buffer : payload);
    },
    sendText: (payload: { type: "text"; text: string }) => {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        debugWarn("text send skipped: socket not open", {
          readyState: socket?.readyState ?? "no-socket",
          payload,
        });
        return;
      }
      debug("text send", payload);
      socket.send(JSON.stringify(payload));
    },
    getState: () => state,
    getUrl: () => currentUrl,
    getSocket: () => socket,
    setHandlers: (handlers: {
      onStateChange?: (next: ConnectionState) => void;
      onMessage?: (text: string) => void;
    }) => {
      onStateChange = handlers.onStateChange ?? null;
      onMessage = handlers.onMessage ?? null;
    },
  } satisfies WebSocketManager;
};
