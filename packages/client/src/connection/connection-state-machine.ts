import type { ConnectionState } from "../voice/types";

export type ConnectionEvent =
  | "connect"
  | "connect_success"
  | "connect_error"
  | "disconnect"
  | "error"
  | "retry";

const transitionTable: Record<ConnectionState, Partial<Record<ConnectionEvent, ConnectionState>>> = {
  disconnected: {
    connect: "connecting",
  },
  connecting: {
    connect_success: "connected",
    connect_error: "error",
  },
  connected: {
    disconnect: "disconnected",
    error: "error",
  },
  error: {
    retry: "reconnecting",
  },
  reconnecting: {
    connect_success: "connected",
    connect_error: "error",
  },
};

export const connectionStateMachine = (
  state: ConnectionState,
  event: ConnectionEvent,
): ConnectionState => {
  return transitionTable[state][event] ?? state;
};

export const getConnectionStateLabel = (state: ConnectionState): string => {
  switch (state) {
    case "disconnected":
      return "未接続";
    case "connecting":
      return "接続中";
    case "connected":
      return "接続済み";
    case "reconnecting":
      return "再接続中";
    case "error":
      return "エラー";
    default:
      return "不明";
  }
};

