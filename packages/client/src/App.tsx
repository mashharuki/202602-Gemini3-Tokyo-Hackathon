/* eslint-disable react/no-unknown-property */
// Workaround react-three-fiber types by disabling unknown properties:
// https://github.com/pmndrs/react-three-fiber/discussions/2487

import { useComponentValue, useEntityQuery } from "@latticexyz/react";
import { getComponentValueStrict, Has } from "@latticexyz/recs";
import { Canvas } from "@react-three/fiber";
import { useMUD } from "./context/MUDContext";
import { useKeyboardMovement } from "./hooks/useKeyboardMovement";
import { useWorldEffects } from "./hooks/useWorldEffects";
import { VoiceAgentPanel } from "./voice/VoiceAgentPanel";

const headerStyle = { backgroundColor: "black", color: "white" };
const cellStyle = { padding: 20 };

import { WorldScene } from "./world/WorldScene";
import { MatrixEffects } from "./world/effects/MatrixEffects";
import { WorldRenderSafetyBoundary } from "./world/effects/WorldRenderSafetyBoundary";
import { WorldEffectRenderer } from "./world/effects/WorldEffectRenderer";
import { WorldEffectShaderPasses } from "./world/effects/WorldEffectShaderPasses";
import { useWorldPerformanceState } from "./world/effects/useWorldPerformanceState";
import { SpawnedEntityRenderer } from "./world/SpawnedEntityRenderer";

const Player = ({ color, position }: { color: number; position: [number, number, number] }) => {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[1, 2, 1]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
};

const Scene = () => {
    const {
        components: { Position },
    } = useMUD();
    const activeEffects = useWorldEffects();
    const performanceState = useWorldPerformanceState(activeEffects.length);

    useKeyboardMovement();

    const players = useEntityQuery([Has(Position)]).map((entity) => {
        const position = getComponentValueStrict(Position, entity);
        return {
            entity,
            position,
        };
    });

    // We still want to track players, but let's place them in the new WorldScene
    return (
        <group>
            <WorldScene />
            {performanceState.safeMode ? null : (
                <WorldRenderSafetyBoundary onFatalError={performanceState.reportFatalError}>
                    <WorldEffectRenderer activeEffects={activeEffects} />
                    <WorldEffectShaderPasses activeEffects={activeEffects} tierState={performanceState.tierState} />
                    <MatrixEffects activeEffects={activeEffects} tierState={performanceState.tierState} />
                </WorldRenderSafetyBoundary>
            )}
            <SpawnedEntityRenderer />

            {players.map((p, i) => (
                <Player
                    key={i}
                    color={Math.floor(parseInt(p.entity) * 123456) % 16777215}
                    position={[p.position.x, p.position.y, p.position.z]}
                />
            ))}
        </group>
    );
};

const styles = { height: "100vh" };

const Directions = () => {
  return (
    <>
      <p>
        You are the rectangular prism, moving around the scene. To move use <b>W</b>, <b>A</b>, <b>S</b>, and <b>D</b>.
        You can also move up (<b>T</b>) and down (<b>G</b>).
      </p>
    </>
  );
};

const PlayerInfo = () => {
  const {
    components: { Position },
    network: { playerEntity },
  } = useMUD();

  const playerPosition = useComponentValue(Position, playerEntity);

  if (!playerPosition) {
    return (
      <div style={headerStyle}>
        <table>
          <tbody>
            <tr>
              <td>
                <h2>Reading player position</h2>
              </td>
              <td>
                <Directions />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div style={headerStyle}>
      <table>
        <tbody>
          <tr>
            <td>
              <table>
                <tbody>
                  <tr>
                    <th>Coordinate</th>
                    <th>Value</th>
                  </tr>
                  <tr>
                    <th>x</th>
                    <td align="right">{playerPosition.x}</td>
                  </tr>
                  <tr>
                    <th>y</th>
                    <td align="right">{playerPosition.y}</td>
                  </tr>
                  <tr>
                    <th>z</th>
                    <td align="right">{playerPosition.z}</td>
                  </tr>
                </tbody>
              </table>
            </td>
            <td style={cellStyle}>
              <Directions />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export const App = () => {
  const { systemCalls } = useMUD();

  return (
    <>
      <VoiceAgentPanel systemCalls={systemCalls} />
      <PlayerInfo />
      <Canvas style={styles}>
        <Scene />
      </Canvas>
    </>
  );
};
