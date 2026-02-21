import { describe, expect, it } from "vitest";

import {
  type ConnectionMachineEvent,
  connectionStateMachine,
  initialConnectionState
} from "../src/connection/connection-state-machine";

function reduce(events: ConnectionMachineEvent[]) {
  return events.reduce(connectionStateMachine, initialConnectionState);
}

describe("connectionStateMachine", () => {
  it("transitions through connect lifecycle: disconnected -> connecting -> connected -> disconnected", () => {
    const state = reduce([
      { type: "CONNECT_REQUESTED" },
      { type: "CONNECTED" },
      { type: "DISCONNECTED" }
    ]);

    expect(state).toBe("disconnected");
  });

  it("supports reconnecting state before reconnect connect attempt", () => {
    const state = reduce([
      { type: "RECONNECT_REQUESTED" },
      { type: "CONNECT_REQUESTED" },
      { type: "CONNECTED" }
    ]);

    expect(state).toBe("connected");
  });

  it("moves to error state when connection error event occurs", () => {
    const state = reduce([{ type: "CONNECT_REQUESTED" }, { type: "CONNECTION_ERROR" }]);

    expect(state).toBe("error");
  });
});
