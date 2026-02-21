import { describe, expect, it } from "vitest";

import { createInitialAppState } from "../src/state/app-state";

describe("createInitialAppState", () => {
  it("initializes shared state for conversation, connection, notices, and event log", () => {
    const state = createInitialAppState();

    expect(state.connection).toBe("disconnected");
    expect(state.conversation).toEqual([]);
    expect(state.notices).toEqual([]);
    expect(state.eventLog).toEqual([]);
  });
});
