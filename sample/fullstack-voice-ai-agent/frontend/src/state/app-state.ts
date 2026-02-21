export type ConnectionState = "connecting" | "connected" | "disconnected" | "reconnecting" | "error";

export interface ConversationItem {
  id: string;
  role: "user" | "agent" | "system";
  content: string;
  status: "partial" | "complete";
}

export interface SystemNotice {
  id: string;
  level: "info" | "warning" | "error";
  message: string;
}

export interface EventLogEntry {
  id: string;
  direction: "upstream" | "downstream";
  summary: string;
  timestamp: string;
}

export interface AppState {
  connection: ConnectionState;
  conversation: ConversationItem[];
  notices: SystemNotice[];
  eventLog: EventLogEntry[];
}

export function createInitialAppState(): AppState {
  return {
    connection: "disconnected",
    conversation: [],
    notices: [],
    eventLog: []
  };
}
