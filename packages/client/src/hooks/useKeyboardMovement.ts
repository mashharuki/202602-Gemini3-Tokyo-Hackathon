import { useEffect, useState } from "react";
import { useMUD } from "../context/MUDContext";

export const useKeyboardMovement = () => {
  const {
    systemCalls: { moveBy },
  } = useMUD();

  const [isMoving, setIsMoving] = useState(false);

  useEffect(() => {
    const pressedKeys = new Set<string>();

    const updateMoving = () => {
      setIsMoving(pressedKeys.size > 0);
    };

    const keyListener = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (["w", "a", "s", "d", "t", "g"].includes(key)) {
        pressedKeys.add(key);
        updateMoving();

        if (key === "w") moveBy(1, 0, 0);
        if (key === "s") moveBy(-1, 0, 0);
        if (key === "a") moveBy(0, 0, -1);
        if (key === "d") moveBy(0, 0, 1);
        if (key === "t") moveBy(0, 1, 0);
        if (key === "g") moveBy(0, -1, 0);
      }
    };

    const upListener = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      pressedKeys.delete(key);
      updateMoving();
    };

    window.addEventListener("keydown", keyListener);
    window.addEventListener("keyup", upListener);
    return () => {
      window.removeEventListener("keydown", keyListener);
      window.removeEventListener("keyup", upListener);
    };
  }, [moveBy]);

  return { isMoving };
};
