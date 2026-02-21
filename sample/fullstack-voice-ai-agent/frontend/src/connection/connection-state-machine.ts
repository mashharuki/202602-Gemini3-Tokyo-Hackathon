import type { ConnectionState } from "../state/app-state";

export type ConnectionMachineEvent =
  | { type: "CONNECT_REQUESTED" }
  | { type: "CONNECTED" }
  | { type: "DISCONNECTED" }
  | { type: "RECONNECT_REQUESTED" }
  | { type: "CONNECTION_ERROR" };

export const initialConnectionState: ConnectionState = "disconnected";

export function connectionStateMachine(
  state: ConnectionState,
  event: ConnectionMachineEvent
): ConnectionState {
  switch (event.type) {
    case "CONNECT_REQUESTED":
      return "connecting";
    case "CONNECTED":
      return "connected";
    case "DISCONNECTED":
      return "disconnected";
    case "RECONNECT_REQUESTED":
      return "reconnecting";
    case "CONNECTION_ERROR":
      return "error";
    default:
      return state;
  }
}

export function getConnectionStateLabel(state: ConnectionState): string {
  switch (state) {
    case "connecting":
      return "接続中";
    case "connected":
      return "接続済み";
    case "disconnected":
      return "切断";
    case "reconnecting":
      return "再接続中";
    case "error":
      return "エラー";
    default:
      return "不明";
  }
}
