/*
 * Create the system calls that the client can use to ask
 * for changes in the World state (using the System contracts).
 */

import { getComponentValue } from "@latticexyz/recs";
import { Hex, pad, stringToHex } from "viem";
import { ClientComponents } from "./createClientComponents";
import { SetupNetworkResult } from "./setupNetwork";

export type SystemCalls = ReturnType<typeof createSystemCalls>;

export type WorldPatchJSON = {
  effect: string;
  color: string;
  intensity: number;
  spawn: {
    type: string;
    x: number;
    y: number;
  } | null;
  caption: string;
};

type ValidationResult = {
  valid: boolean;
  errors: string[];
};

const ZERO_BYTES32 = pad("0x", { size: 32 });

const toBytes32 = (value: string): Hex => {
  if (value.startsWith("0x")) {
    return pad(value as Hex, { size: 32 });
  }

  return stringToHex(value, { size: 32 });
};

const toBytes3Color = (value: string): Hex => value.replace("#", "0x") as Hex;

const validateWorldPatch = (patch: WorldPatchJSON): ValidationResult => {
  const errors: string[] = [];

  if (typeof patch !== "object" || patch === null) {
    errors.push("patch must be an object");
    return { valid: false, errors };
  }

  if (typeof patch.effect !== "string" || patch.effect.trim().length === 0) {
    errors.push("effect must be a non-empty string");
  }

  if (typeof patch.color !== "string" || !/^#[0-9A-Fa-f]{6}$/.test(patch.color)) {
    errors.push("color must be a valid 6-character hex string");
  }

  if (!Number.isInteger(patch.intensity) || patch.intensity < 0 || patch.intensity > 100) {
    errors.push("intensity must be an integer between 0 and 100");
  }

  if (patch.spawn !== null) {
    if (typeof patch.spawn.type !== "string" || patch.spawn.type.trim().length === 0) {
      errors.push("spawn.type must be a non-empty string");
    }

    if (!Number.isInteger(patch.spawn.x) || !Number.isInteger(patch.spawn.y)) {
      errors.push("spawn.x and spawn.y must be integers");
    }
  }

  if (typeof patch.caption !== "string") {
    errors.push("caption must be a string");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export function createSystemCalls(
  /*
   * The parameter list informs TypeScript that:
   *
   * - The first parameter is expected to be a
   *   SetupNetworkResult, as defined in setupNetwork.ts
   *
   *   Out of this parameter, we only care about two fields:
   *   - worldContract (which comes from getContract, see
   *     https://github.com/latticexyz/mud/blob/main/templates/threejs/packages/client/src/mud/setupNetwork.ts#L61-L67).
   *
   *   - waitForTransaction (which comes from syncToRecs, see
   *     https://github.com/latticexyz/mud/blob/main/templates/threejs/packages/client/src/mud/setupNetwork.ts#L75-L81).
   *
   * - From the second parameter, which is a ClientComponent,
   *   we only care about Counter. This parameter comes to use
   *   through createClientComponents.ts, but it originates in
   *   syncToRecs
   *   (https://github.com/latticexyz/mud/blob/main/templates/threejs/packages/client/src/mud/setupNetwork.ts#L75-L81).
   */
  { worldContract, waitForTransaction, playerEntity }: SetupNetworkResult,
  { Position }: ClientComponents,
) {
  const moveTo = async (x: number, y: number, z: number) => {
    /*
     * Because MoveSystem is in the root namespace, .move can be called directly
     * on the World contract.
     */
    const tx = await worldContract.write.app__move([x, y, z]);
    await waitForTransaction(tx);
  };

  const moveBy = async (deltaX: number, deltaY: number, deltaZ: number) => {
    console.log({ Position, playerEntity });
    const playerPosition = getComponentValue(Position, playerEntity);

    if (playerPosition) {
      await moveTo(playerPosition.x + deltaX, playerPosition.y + deltaY, playerPosition.z + deltaZ);
    } else {
      await moveTo(deltaX, deltaY, deltaZ);
    }
  };

  const applyWorldPatch = async (patch: WorldPatchJSON) => {
    const validationResult = validateWorldPatch(patch);
    if (!validationResult.valid) {
      throw new Error(`Invalid world patch: ${validationResult.errors.join("; ")}`);
    }

    const spawnType = patch.spawn ? toBytes32(patch.spawn.type) : ZERO_BYTES32;
    const spawnX = patch.spawn ? patch.spawn.x : 0;
    const spawnY = patch.spawn ? patch.spawn.y : 0;

    const tx = await worldContract.write.app__applyWorldPatch([
      toBytes32(patch.effect),
      toBytes3Color(patch.color),
      patch.intensity,
      spawnType,
      spawnX,
      spawnY,
      patch.caption,
    ]);
    await waitForTransaction(tx);
  };

  const setEffect = async (zoneId: string, effect: string, color: string, intensity: number) => {
    const tx = await worldContract.write.app__setEffect([
      toBytes32(zoneId),
      toBytes32(effect),
      toBytes3Color(color),
      intensity,
    ]);
    await waitForTransaction(tx);
  };

  const spawnEntity = async (entityType: string, x: number, y: number) => {
    const tx = await worldContract.write.app__spawnEntity([toBytes32(entityType), x, y]);
    await waitForTransaction(tx);
  };

  const setCaption = async (zoneId: string, caption: string) => {
    const tx = await worldContract.write.app__setCaption([toBytes32(zoneId), caption]);
    await waitForTransaction(tx);
  };

  return {
    moveTo,
    moveBy,
    applyWorldPatch,
    setEffect,
    spawnEntity,
    setCaption,
  };
}
