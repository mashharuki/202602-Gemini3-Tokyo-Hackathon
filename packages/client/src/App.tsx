/* eslint-disable react/no-unknown-property */
import { useComponentValue, useEntityQuery } from "@latticexyz/react";
import { getComponentValueStrict, Has } from "@latticexyz/recs";
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import styled from "styled-components";
import { GlobalStyles } from "./GlobalStyles";
import { useMUD } from "./context/MUDContext";
import { useKeyboardMovement } from "./hooks/useKeyboardMovement";
import { useWorldEffects } from "./hooks/useWorldEffects";
import { VoiceAgentPanel } from "./voice/VoiceAgentPanel";
import { CharacterModel } from "./world/CharacterModel";
import { SpawnedEntityRenderer } from "./world/SpawnedEntityRenderer";
import { WorldScene } from "./world/WorldScene";
import { MatrixEffects } from "./world/effects/MatrixEffects";
import { WorldEffectRenderer } from "./world/effects/WorldEffectRenderer";
import { WorldEffectShaderPasses } from "./world/effects/WorldEffectShaderPasses";
import { WorldRenderSafetyBoundary } from "./world/effects/WorldRenderSafetyBoundary";
import { useWorldPerformanceState } from "./world/effects/useWorldPerformanceState";



const HUD_Position = styled.div`
  position: fixed;
  top: 24px;
  left: 24px;
  z-index: 1000;
  padding: 12px 20px;
  border-left: 2px solid #00ff41;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  pointer-events: none;
`;

const HUD_Stat = styled.div`
  display: flex;
  gap: 12px;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 4px;

  span {
    opacity: 0.5;
  }
`;

const Scene = () => {
    const {
        components: { Position },
        network: { playerEntity },
    } = useMUD();
    const activeEffects = useWorldEffects();
    const performanceState = useWorldPerformanceState(activeEffects.length);

    const { isMoving, direction } = useKeyboardMovement();

    const players = useEntityQuery([Has(Position)]).map((entity) => {
        const position = getComponentValueStrict(Position, entity);
        return {
            entity,
            position,
            isLocal: entity === playerEntity,
        };
    });

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

            {players.map((p) => (
                <CharacterModel
                    key={p.entity}
                    color={Math.floor(parseInt(p.entity) * 123456) % 16777215}
                    position={[p.position.x, 0, p.position.z]}
                    moving={p.isLocal ? isMoving : false}
                    direction={p.isLocal ? direction : { x: 0, z: 0 }}
                />
            ))}
        </group>
    );
};

const PlayerHUD = () => {
  const {
    components: { Position },
    network: { playerEntity },
  } = useMUD();

  const playerPosition = useComponentValue(Position, playerEntity);

  return (
    <HUD_Position>
      <div style={{ fontSize: 10, opacity: 0.4, marginBottom: 8, letterSpacing: 2 }}>LOCAL_POSITION_TELEMETRY</div>
      <HUD_Stat><span>X</span> {playerPosition?.x ?? '???'}</HUD_Stat>
      <HUD_Stat><span>Y</span> {playerPosition?.y ?? '???'}</HUD_Stat>
      <HUD_Stat><span>Z</span> {playerPosition?.z ?? '???'}</HUD_Stat>

      <div style={{ marginTop: 24, fontSize: 10, opacity: 0.4, width: 240, lineHeight: 1.5 }}>
        WASD to move, TG for elevation.<br/>
        Neural link established with Echo World Admin.
      </div>
    </HUD_Position>
  );
};

const AppContainer = styled.div`
  width: 100vw;
  height: 100vh;
  position: relative;
  background-color: #0d0208;
`;

export const App = () => {
  const { systemCalls } = useMUD();

  return (
    <AppContainer>
      <GlobalStyles />
      <VoiceAgentPanel systemCalls={systemCalls} />
      <PlayerHUD />
      <Canvas camera={{ position: [10, 10, 10], fov: 45 }}>
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
    </AppContainer>
  );
};
