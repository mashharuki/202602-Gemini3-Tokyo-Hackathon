import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { useWorldEffects, WorldEffectData } from "../../hooks/useWorldEffects";

const EffectItem = ({ data }: { data: WorldEffectData }) => {
    const meshRef = useRef<THREE.Mesh>(null);

    // Simple pulse animation for any effect
    useFrame((state) => {
        if (!meshRef.current) return;
        const time = state.clock.getElapsedTime();
        const scale = 1 + Math.sin(time * 5) * 0.1 * (data.intensity / 100);
        meshRef.current.scale.set(scale, scale, scale);
    });

    // MUD uses bytes32 for names, which usually come as hex strings
    // For now, we assume standard effects like '0x...' which we might need to decode
    // or just match against known patterns.
    // Simplified for demo:
    return (
        <group position={[0, 0, 0]}>
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

export const WorldEffectRenderer = () => {
    const effects = useWorldEffects();

    return (
        <group>
            {effects.map((effect, index) => (
                <EffectItem key={effect.zoneId || index} data={effect} />
            ))}
        </group>
    );
};
