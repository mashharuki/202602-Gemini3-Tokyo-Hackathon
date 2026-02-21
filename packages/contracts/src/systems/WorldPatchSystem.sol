// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import { System } from "@latticexyz/world/src/System.sol";
import { WorldEffect } from "../codegen/tables/WorldEffect.sol";
import { SpawnRecord } from "../codegen/tables/SpawnRecord.sol";
import { PatchCounter } from "../codegen/tables/PatchCounter.sol";
import { WorldCaption } from "../codegen/tables/WorldCaption.sol";
import { WorldPatchLog } from "../codegen/tables/WorldPatchLog.sol";

contract WorldPatchSystem is System {
  bytes32 internal constant GLOBAL_ZONE = bytes32(0);

  function setEffect(bytes32 zoneId, bytes32 effect, bytes3 color, uint8 intensity) public {
    require(intensity <= 100, "Intensity must be <= 100");
    WorldEffect.set(zoneId, effect, color, intensity);
  }

  function spawnEntity(bytes32 entityType, int32 x, int32 y) public returns (bytes32) {
    uint256 counter = PatchCounter.get() + 1;
    PatchCounter.set(counter);

    bytes32 entityId = keccak256(abi.encodePacked(_msgSender(), block.timestamp, counter));
    SpawnRecord.set(entityId, entityType, x, y, block.timestamp);

    return entityId;
  }

  function setCaption(bytes32 zoneId, string calldata caption) public {
    WorldCaption.set(zoneId, block.timestamp, caption);
  }

  function applyWorldPatch(
    bytes32 effect,
    bytes3 color,
    uint8 intensity,
    bytes32 spawnType,
    int32 spawnX,
    int32 spawnY,
    string calldata caption
  ) public {
    require(intensity <= 100, "Intensity must be <= 100");

    WorldEffect.set(GLOBAL_ZONE, effect, color, intensity);

    if (spawnType != bytes32(0)) {
      spawnEntity(spawnType, spawnX, spawnY);
    }

    if (bytes(caption).length > 0) {
      WorldCaption.set(GLOBAL_ZONE, block.timestamp, caption);
    }

    uint256 patchCounter = PatchCounter.get() + 1;
    PatchCounter.set(patchCounter);

    bytes32 patchId = bytes32(patchCounter);
    bytes32 callerAsBytes32 = bytes32(uint256(uint160(_msgSender())));
    WorldPatchLog.set(patchId, callerAsBytes32, block.timestamp);
  }
}
