export type WorldLifecycleEventType =
  | "initialization"
  | "update_received"
  | "reflection_applied"
  | "abnormal_detected";

export type WorldLifecycleEvent = {
  type: WorldLifecycleEventType;
  at: number;
  metadata?: Record<string, string | number | boolean>;
};

const events: WorldLifecycleEvent[] = [];

export const recordWorldLifecycleEvent = (
  type: WorldLifecycleEventType,
  metadata?: Record<string, string | number | boolean>,
): void => {
  events.push({
    type,
    at: Date.now(),
    metadata,
  });
};

export const getWorldLifecycleEvents = (): WorldLifecycleEvent[] => [...events];

export const clearWorldLifecycleEvents = (): void => {
  events.length = 0;
};
