import { Environment, Grid, OrbitControls, Sky } from "@react-three/drei";

export const matrixWorldSceneConfig = {
  controls: {
    dampingFactor: 0.05,
    minDistance: 5,
    maxDistance: 50,
    maxPolarAngle: Math.PI / 2.1,
  },
  environmentPreset: "night" as const,
  ambientLightIntensity: 0.1,
  keyLight: {
    position: [10, 10, 10] as [number, number, number],
    intensity: 1.5,
    color: "#00ff41",
  },
  grid: {
    sectionSize: 5,
    sectionColor: "#003b00",
    sectionThickness: 1.5,
    cellSize: 1,
    cellColor: "#008f11",
    cellThickness: 0.8,
    fadeDistance: 100,
    fadeStrength: 5,
  },
  basePlane: {
    size: [100, 100] as [number, number],
    color: "#000000",
    metalness: 0.8,
    roughness: 0.2,
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

      <Environment preset={matrixWorldSceneConfig.environmentPreset} />
      <Sky sunPosition={[0, -1, 0]} />
      <ambientLight intensity={matrixWorldSceneConfig.ambientLightIntensity} />
      <pointLight
        position={matrixWorldSceneConfig.keyLight.position}
        intensity={matrixWorldSceneConfig.keyLight.intensity}
        color={matrixWorldSceneConfig.keyLight.color}
      />

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
