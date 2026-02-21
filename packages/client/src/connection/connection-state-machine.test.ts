import { describe, expect, it } from "bun:test";
import { connectionStateMachine, getConnectionStateLabel } from "./connection-state-machine";

describe("connectionStateMachine", () => {
  it("handles all valid transitions", () => {
    expect(connectionStateMachine("disconnected", "connect")).toBe("connecting");
    expect(connectionStateMachine("connecting", "connect_success")).toBe("connected");
    expect(connectionStateMachine("connecting", "connect_error")).toBe("error");
    expect(connectionStateMachine("connected", "disconnect")).toBe("disconnected");
    expect(connectionStateMachine("connected", "error")).toBe("error");
    expect(connectionStateMachine("error", "retry")).toBe("reconnecting");
    expect(connectionStateMachine("reconnecting", "connect_success")).toBe("connected");
  });

  it("keeps current state for invalid transitions", () => {
    expect(connectionStateMachine("disconnected", "disconnect")).toBe("disconnected");
    expect(connectionStateMachine("connecting", "retry")).toBe("connecting");
    expect(connectionStateMachine("reconnecting", "connect")).toBe("reconnecting");
  });
});

describe("getConnectionStateLabel", () => {
  it("returns japanese labels", () => {
    expect(getConnectionStateLabel("disconnected")).toBe("未接続");
    expect(getConnectionStateLabel("connecting")).toBe("接続中");
    expect(getConnectionStateLabel("connected")).toBe("接続済み");
    expect(getConnectionStateLabel("reconnecting")).toBe("再接続中");
    expect(getConnectionStateLabel("error")).toBe("エラー");
  });
});
