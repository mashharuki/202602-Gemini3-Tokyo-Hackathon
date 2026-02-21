import { useAnimations, useGLTF } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import { Group } from "three";

type CharacterModelProps = {
  position: [number, number, number];
  moving: boolean;
  color?: number;
};

export const CharacterModel = ({ position, moving, color }: CharacterModelProps) => {
  const group = useRef<Group>(null);
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

  return (
    <group ref={group} position={position} dispose={null}>
      <group rotation={[0, Math.PI, 0]} scale={1.2}>
        <primitive object={clone} />
      </group>
    </group>
  );
};

useGLTF.preload("/RobotExpressive.glb");
