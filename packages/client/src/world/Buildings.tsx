import { useMemo } from "react";

type BuildingProps = {
  position: [number, number, number];
  scale: [number, number, number];
  color: string;
};

const Building = ({ position, scale, color }: BuildingProps) => {
  return (
    <group position={position}>
      {/* Main Structure */}
      <mesh position={[0, scale[1] / 2, 0]}>
        <boxGeometry args={scale} />
        <meshStandardMaterial
          color="#050505"
          metalness={0.9}
          roughness={0.1}
          emissive={color}
          emissiveIntensity={0.2}
        />
      </mesh>

      {/* Neon Accents / Windows */}
      <mesh position={[0, scale[1] / 2, 0]}>
        <boxGeometry args={[scale[0] + 0.05, scale[1] + 0.05, scale[2] + 0.05]} />
        <meshBasicMaterial
          color={color}
          wireframe
          transparent
          opacity={0.3}
        />
      </mesh>
    </group>
  );
};

export const Buildings = () => {
  const buildingData = useMemo(() => {
    const data = [];
    const count = 40;
    const spread = 80;
    const avoidZone = 12; // Clear area around origin

    for (let i = 0; i < count; i++) {
        const x = (Math.random() - 0.5) * spread;
        const z = (Math.random() - 0.5) * spread;

        // Avoid center where player spawns
        if (Math.abs(x) < avoidZone && Math.abs(z) < avoidZone) continue;

        const h = 5 + Math.random() * 20;
        const w = 2 + Math.random() * 4;
        const d = 2 + Math.random() * 4;
        const color = Math.random() > 0.5 ? "#00ff41" : "#003b00";

        data.push({
            id: i,
            position: [x, 0, z] as [number, number, number],
            scale: [w, h, d] as [number, number, number],
            color
        });
    }
    return data;
  }, []);

  return (
    <group>
      {buildingData.map((b) => (
        <Building key={b.id} {...b} />
      ))}
    </group>
  );
};
