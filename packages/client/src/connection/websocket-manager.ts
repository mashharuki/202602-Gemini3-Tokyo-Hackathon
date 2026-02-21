import { connectionStateMachine } from "./connection-state-machine";
import type { ConnectionState } from "../voice/types";

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

export const createWebSocketManager = (deps: Partial<WebSocketManagerDeps> = {}) => {
  const resolvedDeps: WebSocketManagerDeps = { ...defaultDeps, ...deps };

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

  const buildUrl = (targetHost: string, uid: string, sid: string): string => {
    const wsProtocol = resolvedDeps.getLocationProtocol() === "https:" ? "wss" : "ws";
    return `${wsProtocol}://${targetHost}/ws/${uid}/${sid}`;
  };

  const connectInternal = () => {
    currentUrl = buildUrl(host, userId, sessionId);
    if (state === "reconnecting") {
      state = "connecting";
    } else {
      setState("connect");
    }
    socket = resolvedDeps.createSocket(currentUrl);
    socket.binaryType = "arraybuffer";

    socket.onopen = () => {
      setState("connect_success");
    };

    socket.onerror = () => {
      setState("connect_error");
    };

    socket.onclose = () => {
      if (reconnectEnabled) {
        setState("error");
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
      state = "disconnected";
    },
    sendBinary: (payload: Int16Array | ArrayBuffer) => {
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      socket.send(payload instanceof Int16Array ? payload.buffer : payload);
    },
    sendText: (payload: { type: "text"; text: string }) => {
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
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
