// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import { MudTest } from "@latticexyz/world/test/MudTest.t.sol";
import { IWorld } from "../src/codegen/world/IWorld.sol";
import { WorldEffect } from "../src/codegen/tables/WorldEffect.sol";
import { SpawnRecord } from "../src/codegen/tables/SpawnRecord.sol";
import { WorldCaption } from "../src/codegen/tables/WorldCaption.sol";
import { WorldPatchLog } from "../src/codegen/tables/WorldPatchLog.sol";
import { PatchCounter } from "../src/codegen/tables/PatchCounter.sol";

contract WorldPatchSystemTest is MudTest {
  function testSetEffect_updatesWorldEffect() public {
    bytes32 zoneId = bytes32("zone-1");
    bytes32 effect = bytes32("aurora");
    bytes3 color = 0x11aa33;
    uint8 intensity = 42;

    IWorld(worldAddress).app__setEffect(zoneId, effect, color, intensity);

    assertEq(WorldEffect.getEffect(zoneId), effect);
    assertEq(WorldEffect.getColor(zoneId), color);
    assertEq(WorldEffect.getIntensity(zoneId), intensity);
  }

  function testSetEffect_revertsOnHighIntensity() public {
    vm.expectRevert(bytes("Intensity must be <= 100"));
    IWorld(worldAddress).app__setEffect(bytes32("zone-1"), bytes32("storm"), 0xffffff, 101);
  }

  function testSpawnEntity_uniqueIds() public {
    bytes32 firstId = IWorld(worldAddress).app__spawnEntity(bytes32("wolf"), 10, 20);
    bytes32 secondId = IWorld(worldAddress).app__spawnEntity(bytes32("wolf"), 10, 20);

    assertTrue(firstId != secondId);
  }

  function testSpawnEntity_setsTimestamp() public {
    vm.warp(123456);

    bytes32 entityId = IWorld(worldAddress).app__spawnEntity(bytes32("golem"), -5, 7);

    assertEq(SpawnRecord.getEntityType(entityId), bytes32("golem"));
    assertEq(SpawnRecord.getX(entityId), -5);
    assertEq(SpawnRecord.getY(entityId), 7);
    assertEq(SpawnRecord.getSpawnedAt(entityId), 123456);
  }

  function testSetCaption_updatesWithTimestamp() public {
    vm.warp(222222);

    bytes32 zoneId = bytes32("zone-2");
    string memory caption = "calm winds over the valley";

    IWorld(worldAddress).app__setCaption(zoneId, caption);

    assertEq(WorldCaption.getCaption(zoneId), caption);
    assertEq(WorldCaption.getUpdatedAt(zoneId), 222222);
  }

  function testApplyWorldPatch_updatesAllTables() public {
    vm.warp(333333);

    bytes32 effect = bytes32("aurora");
    bytes3 color = 0x112233;
    uint8 intensity = 88;
    bytes32 spawnType = bytes32("wolf");
    int32 spawnX = 10;
    int32 spawnY = -4;
    string memory caption = "aurora rises over the forest";

    IWorld(worldAddress).app__applyWorldPatch(effect, color, intensity, spawnType, spawnX, spawnY, caption);

    assertEq(WorldEffect.getEffect(bytes32(0)), effect);
    assertEq(uint256(uint24(WorldEffect.getColor(bytes32(0)))), uint256(uint24(color)));
    assertEq(WorldEffect.getIntensity(bytes32(0)), intensity);

    bytes32 expectedEntityId = keccak256(abi.encodePacked(address(this), uint256(333333), uint256(1)));
    assertEq(SpawnRecord.getEntityType(expectedEntityId), spawnType);
    assertEq(SpawnRecord.getX(expectedEntityId), spawnX);
    assertEq(SpawnRecord.getY(expectedEntityId), spawnY);
    assertEq(SpawnRecord.getSpawnedAt(expectedEntityId), 333333);

    assertEq(WorldCaption.getCaption(bytes32(0)), caption);
    assertEq(WorldCaption.getUpdatedAt(bytes32(0)), 333333);

    bytes32 patchId = bytes32(uint256(2));
    bytes32 callerAsBytes32 = bytes32(uint256(uint160(address(this))));
    assertEq(WorldPatchLog.getAppliedBy(patchId), callerAsBytes32);
    assertEq(WorldPatchLog.getAppliedAt(patchId), 333333);
  }

  function testApplyWorldPatch_skipsSpawnWhenZeroType() public {
    vm.warp(444444);

    IWorld(worldAddress).app__applyWorldPatch(bytes32("calm"), 0xaabbcc, 5, bytes32(0), 99, 100, "clear sky");

    bytes32 expectedEntityId = keccak256(abi.encodePacked(address(this), uint256(444444), uint256(1)));
    assertEq(SpawnRecord.getEntityType(expectedEntityId), bytes32(0));
    assertEq(SpawnRecord.getX(expectedEntityId), 0);
    assertEq(SpawnRecord.getY(expectedEntityId), 0);
    assertEq(SpawnRecord.getSpawnedAt(expectedEntityId), 0);
  }

  function testApplyWorldPatch_incrementsCounter() public {
    assertEq(PatchCounter.get(), 0);

    IWorld(worldAddress).app__applyWorldPatch(bytes32("storm"), 0x010203, 25, bytes32(0), 0, 0, "");
    assertEq(PatchCounter.get(), 1);

    IWorld(worldAddress).app__applyWorldPatch(bytes32("calm"), 0x040506, 15, bytes32(0), 0, 0, "");
    assertEq(PatchCounter.get(), 2);
  }
}
