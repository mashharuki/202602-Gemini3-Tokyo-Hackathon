import { Environment, Grid, OrbitControls, Sky } from "@react-three/drei";

export const WorldScene = () => {
    return (
        <>
            <OrbitControls
                makeDefault
                enableDamping
                dampingFactor={0.05}
                minDistance={5}
                maxDistance={50}
                maxPolarAngle={Math.PI / 2.1}
            />

            <Environment preset="night" />
            <Sky sunPosition={[0, -1, 0]} />
            <ambientLight intensity={0.1} />
            <pointLight position={[10, 10, 10]} intensity={1.5} color="#00ff41" />

            {/* Matrix-themed Grid */}
            <Grid
                infiniteGrid
                sectionSize={5}
                sectionColor="#003b00"
                sectionThickness={1.5}
                cellSize={1}
                cellColor="#008f11"
                cellThickness={0.8}
                fadeDistance={100}
                fadeStrength={5}
            />

            {/* Base platform */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
                <planeGeometry args={[100, 100]} />
                <meshStandardMaterial color="#000000" metalness={0.8} roughness={0.2} />
            </mesh>
        </>
    );
};
