import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Group } from "three";

type CharacterModelProps = {
  position: [number, number, number];
  moving: boolean;
  direction?: { x: number; z: number };
  color?: number;
};

export const CharacterModel = ({ position, moving, direction = { x: 0, z: 0 }, color }: CharacterModelProps) => {
  const group = useRef<Group>(null);
  const innerGroup = useRef<Group>(null);
  const { scene, animations } = useGLTF("/RobotExpressive.glb");
  const { actions } = useAnimations(animations, group);

  // Clone the scene for multi-player support (important as 'scene' is shared)
  const clone = useMemo(() => scene.clone(), [scene]);

  useEffect(() => {
    const idleAction = actions["Idle"];
    const walkAction = actions["Walking"];

    if (moving) {
      idleAction?.stop();
      walkAction?.reset().fadeIn(0.2).play();
    } else {
      walkAction?.fadeOut(0.2);
      idleAction?.reset().fadeIn(0.2).play();
    }

    return () => {
      walkAction?.fadeOut(0.2);
      idleAction?.fadeOut(0.2);
    };
  }, [moving, actions]);

  const targetRotation = useRef(0);
  const currentRotation = useRef(0);

  useFrame((state, delta) => {
    if (!innerGroup.current) return;

    if (moving && (direction.x !== 0 || direction.z !== 0)) {
        targetRotation.current = Math.atan2(direction.z, direction.x);
    } else {
        targetRotation.current = Math.atan2(10 - position[2], 10 - position[0]);
    }

    let diff = targetRotation.current - currentRotation.current;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    currentRotation.current += diff * delta * 8;
    innerGroup.current.rotation.y = -currentRotation.current + Math.PI / 2;
  });

  return (
    <group ref={group} position={position} dispose={null}>
      <group ref={innerGroup} scale={1.2}>
        <primitive object={clone} />
      </group>
    </group>
  );
};

useGLTF.preload("/RobotExpressive.glb");
