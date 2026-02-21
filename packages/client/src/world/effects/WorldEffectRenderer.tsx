import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { WorldEffectData } from "../../hooks/useWorldEffects";
import { recordWorldLifecycleEvent } from "./worldLifecycleLog";

export type EffectRenderItem = {
  key: string;
  effect: WorldEffectData["effect"];
  color: string;
  intensity: number;
  position: [number, number, number];
};

export const toEffectRenderItems = (effects: WorldEffectData[]): EffectRenderItem[] => {
  const latestByZone = new Map<string, WorldEffectData>();
  for (const effect of effects) {
    latestByZone.set(effect.zoneId, effect);
  }

  return Array.from(latestByZone.values()).map((effect) => ({
    key: effect.zoneId,
    effect: effect.effect,
    color: effect.color,
    intensity: effect.intensity,
    position: [effect.x, 0.6, effect.y],
  }));
};

const EffectItem = ({ data }: { data: EffectRenderItem }) => {
    const meshRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        if (!meshRef.current) return;
        const time = state.clock.getElapsedTime();
        const scale = 1 + Math.sin(time * 5) * 0.1 * (data.intensity / 100);
        meshRef.current.scale.set(scale, scale, scale);
    });

    return (
        <group position={data.position}>
            <pointLight
                intensity={data.intensity / 10}
                color={data.color}
                distance={20}
                decay={2}
            />
            <mesh ref={meshRef}>
                <sphereGeometry args={[0.5, 16, 16]} />
                <meshStandardMaterial
                    color={data.color}
                    emissive={data.color}
                    emissiveIntensity={data.intensity / 20}
                    transparent
                    opacity={0.6}
                />
            </mesh>
        </group>
    );
};

type WorldEffectRendererProps = {
  activeEffects: WorldEffectData[];
};

export const WorldEffectRenderer = ({ activeEffects }: WorldEffectRendererProps) => {
    const renderItems = toEffectRenderItems(activeEffects);

    useEffect(() => {
        if (renderItems.length > 0) {
            recordWorldLifecycleEvent("reflection_applied", { rendered: renderItems.length });
        }
    }, [renderItems]);

    return (
        <group>
            {renderItems.map((item) => (
                <EffectItem key={item.key} data={item} />
            ))}
        </group>
    );
};
