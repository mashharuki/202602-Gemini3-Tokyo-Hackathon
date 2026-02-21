import { Environment, Grid, OrbitControls, Sky } from "@react-three/drei";
import { Buildings } from "./Buildings";

export const matrixWorldSceneConfig = {
  controls: {
    dampingFactor: 0.05,
    minDistance: 5,
    maxDistance: 60,
    maxPolarAngle: Math.PI / 2.1,
  },
  environmentPreset: "city" as const,
  ambientLightIntensity: 0.1, // Slightly increased for building visibility
  keyLight: {
    position: [20, 30, 10] as [number, number, number],
    intensity: 3.5, // Brighter for city shadows
    color: "#00ff41",
    distance: 120,
  },
  grid: {
    sectionSize: 10,
    sectionColor: "#00ff41",
    sectionThickness: 1.5,
    cellSize: 2,
    cellColor: "#003b00",
    cellThickness: 1.0,
    fadeDistance: 150,
    fadeStrength: 5,
  },
  basePlane: {
    size: [400, 400] as [number, number], // Larger for the city
    color: "#050505",
    metalness: 0.9,
    roughness: 0.1,
  },
};

export const WorldScene = () => {
  return (
    <>
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={matrixWorldSceneConfig.controls.dampingFactor}
        minDistance={matrixWorldSceneConfig.controls.minDistance}
        maxDistance={matrixWorldSceneConfig.controls.maxDistance}
        maxPolarAngle={matrixWorldSceneConfig.controls.maxPolarAngle}
      />

      {/* Atmospheric Fog */}
      <color attach="background" args={["#000000"]} />
      <fog attach="fog" args={["#000000", 30, 150]} />

      <Environment preset={matrixWorldSceneConfig.environmentPreset} />
      <Sky sunPosition={[0, -1, 0]} />
      <ambientLight intensity={matrixWorldSceneConfig.ambientLightIntensity} />
      <pointLight
        position={matrixWorldSceneConfig.keyLight.position}
        intensity={matrixWorldSceneConfig.keyLight.intensity}
        color={matrixWorldSceneConfig.keyLight.color}
      />

      <Buildings />

      <Grid
        infiniteGrid
        sectionSize={matrixWorldSceneConfig.grid.sectionSize}
        sectionColor={matrixWorldSceneConfig.grid.sectionColor}
        sectionThickness={matrixWorldSceneConfig.grid.sectionThickness}
        cellSize={matrixWorldSceneConfig.grid.cellSize}
        cellColor={matrixWorldSceneConfig.grid.cellColor}
        cellThickness={matrixWorldSceneConfig.grid.cellThickness}
        fadeDistance={matrixWorldSceneConfig.grid.fadeDistance}
        fadeStrength={matrixWorldSceneConfig.grid.fadeStrength}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={matrixWorldSceneConfig.basePlane.size} />
        <meshStandardMaterial
          color={matrixWorldSceneConfig.basePlane.color}
          metalness={matrixWorldSceneConfig.basePlane.metalness}
          roughness={matrixWorldSceneConfig.basePlane.roughness}
        />
      </mesh>
    </>
  );
};
