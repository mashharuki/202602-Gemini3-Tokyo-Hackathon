// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import { MudTest } from "@latticexyz/world/test/MudTest.t.sol";
import { IWorld } from "../src/codegen/world/IWorld.sol";
import { WorldEffect } from "../src/codegen/tables/WorldEffect.sol";
import { SpawnRecord } from "../src/codegen/tables/SpawnRecord.sol";
import { WorldCaption } from "../src/codegen/tables/WorldCaption.sol";

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
}
