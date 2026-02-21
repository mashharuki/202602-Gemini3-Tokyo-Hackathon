import { describe, expect, it } from "bun:test";
import {
  clearWorldLifecycleEvents,
  getWorldLifecycleEvents,
  recordWorldLifecycleEvent,
} from "./worldLifecycleLog";

describe("worldLifecycleLog", () => {
  it("records lifecycle sequence for observability", () => {
    clearWorldLifecycleEvents();
    recordWorldLifecycleEvent("initialization", { stage: "canvas" });
    recordWorldLifecycleEvent("update_received", { effects: 3 });
    recordWorldLifecycleEvent("reflection_applied", { rendered: 3 });

    const events = getWorldLifecycleEvents();
    expect(events.map((event) => event.type)).toEqual(["initialization", "update_received", "reflection_applied"]);
    expect(events[1].metadata).toEqual({ effects: 3 });
  });

  it("captures abnormal detection signals", () => {
    clearWorldLifecycleEvents();
    recordWorldLifecycleEvent("abnormal_detected", { reason: "safe_mode" });

    const events = getWorldLifecycleEvents();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("abnormal_detected");
  });
});
