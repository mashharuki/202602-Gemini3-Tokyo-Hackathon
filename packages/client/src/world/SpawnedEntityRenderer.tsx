import { useFrame, useLoader } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import { MathUtils, Sprite, TextureLoader } from "three";
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
  const spriteRef = useRef<Sprite>(null);
  const [scale, setScale] = useState(0);

  useFrame((state, delta) => {
    if (spriteRef.current) {
      // Materialize Effect: Scale up from 0 to 1 with some bounce
      if (scale < 1) {
        const nextScale = MathUtils.lerp(scale, 1, delta * 4);
        setScale(nextScale);
        spriteRef.current.scale.set(nextScale, nextScale, 1);
      }
    }
  });

  return (
    <sprite ref={spriteRef} position={placement.position}>
      <spriteMaterial map={texture} transparent opacity={scale} />
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
