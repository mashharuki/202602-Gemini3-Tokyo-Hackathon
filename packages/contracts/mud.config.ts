import { defineWorld } from "@latticexyz/world";

export default defineWorld({
  namespace: "app",
  tables: {
    Position: {
      schema: {
        id: "bytes32",
        x: "int32",
        y: "int32",
        z: "int32",
      },
      key: ["id"],
    },
    WorldEffect: {
      schema: {
        zoneId: "bytes32",
        effect: "bytes32",
        color: "bytes3",
        intensity: "uint8",
      },
      key: ["zoneId"],
    },
    SpawnRecord: {
      schema: {
        id: "bytes32",
        entityType: "bytes32",
        x: "int32",
        y: "int32",
        spawnedAt: "uint256",
      },
      key: ["id"],
    },
    WorldCaption: {
      schema: {
        zoneId: "bytes32",
        updatedAt: "uint256",
        caption: "string",
      },
      key: ["zoneId"],
    },
    WorldPatchLog: {
      schema: {
        patchId: "bytes32",
        appliedBy: "bytes32",
        appliedAt: "uint256",
      },
      key: ["patchId"],
    },
    PatchCounter: {
      schema: {
        value: "uint256",
      },
      key: [],
    },
  },
});
