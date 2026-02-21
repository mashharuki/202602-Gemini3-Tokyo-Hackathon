import { useEntityQuery } from "@latticexyz/react";
import { Has, getComponentValue } from "@latticexyz/recs";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMUD } from "../context/MUDContext";
import { AssetRecord, ImageAgentService, SpawnInput } from "./imageAgentService";

export type SpawnRecordSnapshot = {
  spawnRecordId: string;
  type: string;
  x: number;
  y: number;
};

export type ResolvedSpawnedAsset = AssetRecord & {
  spawnRecordId: string;
};

type ImageAgentServiceLike = {
  resolveAsset(spawnInput: SpawnInput, sourcePatch: unknown): Promise<AssetRecord>;
  getFallbackRate(): number;
};

type CreateImageAgentCoordinatorParams = {
  imageAgentService: ImageAgentServiceLike;
  onAssetResolved: (asset: ResolvedSpawnedAsset) => void;
  onProcessingChange: (value: boolean) => void;
  onFallbackRateChange: (value: number) => void;
};

type UseImageAgentOptions = {
  imageAgentService?: ImageAgentServiceLike;
  spawnRecords?: SpawnRecordSnapshot[];
};

export type UseImageAgentReturn = {
  spawnedAssets: ReadonlyArray<ResolvedSpawnedAsset>;
  isProcessing: boolean;
  fallbackRate: number;
};

export const createImageAgentCoordinator = ({
  imageAgentService,
  onAssetResolved,
  onProcessingChange,
  onFallbackRateChange,
}: CreateImageAgentCoordinatorParams) => {
  const processedSpawnIds = new Set<string>();
  const inFlightSpawnIds = new Set<string>();

  const setProcessing = () => {
    onProcessingChange(inFlightSpawnIds.size > 0);
  };

  const sync = async (spawnRecords: ReadonlyArray<SpawnRecordSnapshot>) => {
    const tasks: Promise<void>[] = [];

    for (const spawnRecord of spawnRecords) {
      if (processedSpawnIds.has(spawnRecord.spawnRecordId) || inFlightSpawnIds.has(spawnRecord.spawnRecordId)) {
        continue;
      }

      inFlightSpawnIds.add(spawnRecord.spawnRecordId);
      setProcessing();

      const task = imageAgentService
        .resolveAsset(
          {
            type: spawnRecord.type,
            x: spawnRecord.x,
            y: spawnRecord.y,
          },
          {
            spawnRecordId: spawnRecord.spawnRecordId,
            spawn: {
              type: spawnRecord.type,
              x: spawnRecord.x,
              y: spawnRecord.y,
            },
          },
        )
        .then((asset) => {
          onAssetResolved({ ...asset, spawnRecordId: spawnRecord.spawnRecordId });
          onFallbackRateChange(imageAgentService.getFallbackRate());
        })
        .finally(() => {
          inFlightSpawnIds.delete(spawnRecord.spawnRecordId);
          processedSpawnIds.add(spawnRecord.spawnRecordId);
          setProcessing();
        });

      tasks.push(task);
    }

    await Promise.all(tasks);
  };

  return {
    sync,
    getProcessedSpawnIds: () => [...processedSpawnIds],
  };
};

const normalizeSpawnRecord = (entity: string, value: unknown): SpawnRecordSnapshot | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as {
    id?: unknown;
    entityType?: unknown;
    x?: unknown;
    y?: unknown;
  };

  const spawnRecordId =
    typeof record.id === "string" && record.id.length > 0 ? record.id : entity;
  const type = typeof record.entityType === "string" ? record.entityType.trim() : "";
  const x = Number(record.x);
  const y = Number(record.y);

  if (!spawnRecordId || !type || !Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return {
    spawnRecordId,
    type,
    x,
    y,
  };
};

const deriveSpawnRecords = (entities: ReadonlyArray<string>, spawnRecordComponent: unknown): SpawnRecordSnapshot[] => {
  const records: SpawnRecordSnapshot[] = [];

  for (const entity of entities) {
    const raw = getComponentValue(spawnRecordComponent as any, entity as any);
    const normalized = normalizeSpawnRecord(entity, raw);
    if (normalized) {
      records.push(normalized);
    }
  }

  return records;
};

export const useImageAgent = (options: UseImageAgentOptions = {}): UseImageAgentReturn => {
  const {
    components: { SpawnRecord },
  } = useMUD();

  const entities = useEntityQuery([Has(SpawnRecord)]);
  const defaultServiceRef = useRef<ImageAgentServiceLike>(new ImageAgentService());
  const imageAgentService = options.imageAgentService ?? defaultServiceRef.current;

  const observedSpawnRecords = useMemo(
    () => options.spawnRecords ?? deriveSpawnRecords(entities, SpawnRecord),
    [options.spawnRecords, entities, SpawnRecord],
  );

  const [spawnedAssets, setSpawnedAssets] = useState<ResolvedSpawnedAsset[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fallbackRate, setFallbackRate] = useState(0);

  const coordinator = useMemo(
    () =>
      createImageAgentCoordinator({
        imageAgentService,
        onAssetResolved: (asset) => {
          setSpawnedAssets((current) => {
            if (current.some((existing) => existing.spawnRecordId === asset.spawnRecordId)) {
              return current;
            }
            return [...current, asset];
          });
        },
        onProcessingChange: setIsProcessing,
        onFallbackRateChange: setFallbackRate,
      }),
    [imageAgentService],
  );

  useEffect(() => {
    void coordinator.sync(observedSpawnRecords);
  }, [coordinator, observedSpawnRecords]);

  return {
    spawnedAssets,
    isProcessing,
    fallbackRate,
  };
};
