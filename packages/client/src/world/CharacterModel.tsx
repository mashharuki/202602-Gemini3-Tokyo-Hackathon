import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Group, Vector3 } from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";

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

  // SkeletonUtils.clone is essential for SkinnedMeshes to work in clones
  const clone = useMemo(() => SkeletonUtils.clone(scene) as Group, [scene]);

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
  const targetPos = useMemo(() => new Vector3(...position), [position]);
  const currentPos = useRef(new Vector3(...position));

  useFrame((state, delta) => {
    if (!group.current || !innerGroup.current) return;

    // 1. Smooth Position Lerping
    // We expect position prop to be [x, y, z]
    const [tx, ty, tz] = position;
    targetPos.set(tx, ty, tz);

    // Lerp current position towards target
    currentPos.current.lerp(targetPos, delta * 12);
    group.current.position.copy(currentPos.current);

    // 2. Smooth Rotation logic
    if (moving && (direction.x !== 0 || direction.z !== 0)) {
        targetRotation.current = Math.atan2(direction.z, direction.x);
    } else {
        // Face camera when idle. Camera is at [10, 10, 10].
        targetRotation.current = Math.atan2(10 - currentPos.current.z, 10 - currentPos.current.x);
    }

    let diff = targetRotation.current - currentRotation.current;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    currentRotation.current += diff * delta * 8;
    innerGroup.current.rotation.y = -currentRotation.current + Math.PI / 2;
  });

  return (
    <group ref={group} dispose={null}>
      <group ref={innerGroup} scale={1.2}>
        <primitive object={clone} />
      </group>
    </group>
  );
};

useGLTF.preload("/RobotExpressive.glb");
