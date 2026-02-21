import { describe, expect, it } from "bun:test";
import { createSystemCalls, type WorldPatchJSON } from "./createSystemCalls";

const createMockSystemCalls = () => {
  let applyCallCount = 0;
  const appApplyWorldPatch = async () => {
    applyCallCount += 1;
    return "0xtxhash";
  };
  const appSetEffect = async () => "0xtxhash";
  const appSpawnEntity = async () => "0xtxhash";
  const appSetCaption = async () => "0xtxhash";
  const appMove = async () => "0xtxhash";
  const waitForTransaction = async () => undefined;

  const systemCalls = createSystemCalls(
    {
      worldContract: {
        write: {
          app__applyWorldPatch: appApplyWorldPatch,
          app__setEffect: appSetEffect,
          app__spawnEntity: appSpawnEntity,
          app__setCaption: appSetCaption,
          app__move: appMove,
        },
      },
      waitForTransaction,
      playerEntity: "0xplayer",
    } as any,
    {
      Position: {},
    } as any,
  );

  return {
    systemCalls,
    getApplyCallCount: () => applyCallCount,
  };
};

describe("createSystemCalls validateWorldPatch", () => {
  it("collects all validation errors and throws once", async () => {
    const { systemCalls, getApplyCallCount } = createMockSystemCalls();

    const invalidPatch = {
      effect: "",
      color: "#GG0000",
      intensity: 101,
      spawn: {
        type: "",
        x: 1.5,
        y: 2.1,
      },
      caption: "ok",
    } as unknown as WorldPatchJSON;

    await expect(systemCalls.applyWorldPatch(invalidPatch)).rejects.toThrow("effect must be a non-empty string");
    await expect(systemCalls.applyWorldPatch(invalidPatch)).rejects.toThrow(
      "color must be a valid 6-character hex string",
    );
    await expect(systemCalls.applyWorldPatch(invalidPatch)).rejects.toThrow(
      "intensity must be an integer between 0 and 100",
    );
    await expect(systemCalls.applyWorldPatch(invalidPatch)).rejects.toThrow("spawn.type must be a non-empty string");
    await expect(systemCalls.applyWorldPatch(invalidPatch)).rejects.toThrow("spawn.x and spawn.y must be integers");

    expect(getApplyCallCount()).toBe(0);
  });

  it("accepts a valid patch and sends transaction", async () => {
    const { systemCalls, getApplyCallCount } = createMockSystemCalls();

    const validPatch: WorldPatchJSON = {
      effect: "aurora",
      color: "#11AA33",
      intensity: 80,
      spawn: {
        type: "wolf",
        x: -1,
        y: 5,
      },
      caption: "northern sky glows",
    };

    await expect(systemCalls.applyWorldPatch(validPatch)).resolves.toBeUndefined();
    expect(getApplyCallCount()).toBe(1);
  });
});
