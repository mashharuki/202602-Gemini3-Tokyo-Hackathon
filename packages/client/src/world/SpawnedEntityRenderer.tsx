import { useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import { TextureLoader } from "three";
import { useImageAgent, type ResolvedSpawnedAsset } from "../image-agent/useImageAgent";

export const DEFAULT_SPAWN_POSITION: [number, number, number] = [0, 0.5, 0];

export type SpawnPlacement = {
  requestId: string;
  spawnRecordId: string;
  textureDataUrl: string;
  position: [number, number, number];
};

const toSafePosition = (asset: ResolvedSpawnedAsset): [number, number, number] => {
  const x = asset.spawnInput?.x;
  const y = asset.spawnInput?.y;

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return DEFAULT_SPAWN_POSITION;
  }

  return [x, 0.5, y];
};

export const createSpawnPlacements = (assets: ReadonlyArray<ResolvedSpawnedAsset>): SpawnPlacement[] => {
  const seen = new Set<string>();
  const placements: SpawnPlacement[] = [];

  for (const asset of assets) {
    if (seen.has(asset.requestId)) {
      continue;
    }
    seen.add(asset.requestId);

    if (!asset.textureDataUrl) {
      continue;
    }

    placements.push({
      requestId: asset.requestId,
      spawnRecordId: asset.spawnRecordId,
      textureDataUrl: asset.textureDataUrl,
      position: toSafePosition(asset),
    });
  }

  return placements;
};

const SpawnedSprite = ({ placement }: { placement: SpawnPlacement }) => {
  const texture = useLoader(TextureLoader, placement.textureDataUrl);

  return (
    <sprite position={placement.position}>
      <spriteMaterial map={texture} transparent />
    </sprite>
  );
};

export const SpawnedEntityRenderer = () => {
  const { spawnedAssets } = useImageAgent();
  const placements = useMemo(() => createSpawnPlacements(spawnedAssets), [spawnedAssets]);

  return (
    <group>
      {placements.map((placement) => (
        <SpawnedSprite key={placement.requestId} placement={placement} />
      ))}
    </group>
  );
};
