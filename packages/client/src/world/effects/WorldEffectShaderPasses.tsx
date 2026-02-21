import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { WorldEffectData } from "../../hooks/useWorldEffects";
import { buildShaderTargets } from "./effectCompositor";
import type { PerformanceTierState } from "./performanceTier";

const rippleVertexShader = `
varying vec2 vUv;
uniform float uTime;
uniform float uStrength;

void main() {
  vUv = uv;
  vec3 transformed = position;
  float dist = distance(uv, vec2(0.5));
  transformed.z += sin(dist * 36.0 - uTime * 4.0) * 0.08 * uStrength;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
}
`;

const rippleFragmentShader = `
varying vec2 vUv;
uniform vec3 uColor;
uniform float uAlpha;

void main() {
  float ring = smoothstep(0.46, 0.38, abs(distance(vUv, vec2(0.5)) - 0.28));
  gl_FragColor = vec4(uColor, ring * uAlpha);
}
`;

const resonanceVertexShader = `
uniform float uTime;
uniform float uStrength;

void main() {
  vec3 transformed = position + normal * sin(uTime * 3.0 + position.y * 6.0) * 0.15 * uStrength;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
}
`;

const resonanceFragmentShader = `
uniform vec3 uColor;
uniform float uAlpha;

void main() {
  gl_FragColor = vec4(uColor, uAlpha);
}
`;

const RipplePass = ({
  color,
  position,
  strength,
}: {
  color: string;
  position: [number, number, number];
  strength: number;
}) => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  useFrame((state) => {
    if (!materialRef.current) return;
    materialRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
  });

  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.3, 1.8, 64]} />
      <shaderMaterial
        ref={materialRef}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexShader={rippleVertexShader}
        fragmentShader={rippleFragmentShader}
        uniforms={{
          uTime: { value: 0 },
          uStrength: { value: strength },
          uColor: { value: new THREE.Color(color) },
          uAlpha: { value: 0.8 },
        }}
      />
    </mesh>
  );
};

const ResonancePass = ({
  color,
  position,
  strength,
}: {
  color: string;
  position: [number, number, number];
  strength: number;
}) => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  useFrame((state) => {
    if (!materialRef.current) return;
    materialRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
  });

  return (
    <mesh position={position}>
      <icosahedronGeometry args={[0.5, 4]} />
      <shaderMaterial
        ref={materialRef}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexShader={resonanceVertexShader}
        fragmentShader={resonanceFragmentShader}
        uniforms={{
          uTime: { value: 0 },
          uStrength: { value: strength },
          uColor: { value: new THREE.Color(color) },
          uAlpha: { value: 0.52 },
        }}
      />
    </mesh>
  );
};

type WorldEffectShaderPassesProps = {
  activeEffects: WorldEffectData[];
  tierState: PerformanceTierState;
};

export const WorldEffectShaderPasses = ({ activeEffects, tierState }: WorldEffectShaderPassesProps) => {
  const targets = useMemo(() => buildShaderTargets(activeEffects), [activeEffects]);

  return (
    <group>
      {tierState.enabledPasses.ripple
        ? targets.ripple.map((target) => (
            <RipplePass
              key={`ripple-${target.key}`}
              color={target.color}
              position={target.position}
              strength={Math.max(0.35, target.intensity / 100)}
            />
          ))
        : null}
      {tierState.enabledPasses.resonance
        ? targets.resonance.map((target) => (
            <ResonancePass
              key={`res-${target.key}`}
              color={target.color}
              position={target.position}
              strength={Math.max(0.35, target.intensity / 100)}
            />
          ))
        : null}
    </group>
  );
};
