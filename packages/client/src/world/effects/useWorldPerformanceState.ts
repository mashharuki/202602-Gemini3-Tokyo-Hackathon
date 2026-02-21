import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { derivePerformanceTier, shouldEnterSafeMode, type PerformanceTierState } from "./performanceTier";
import { recordWorldLifecycleEvent } from "./worldLifecycleLog";

export type WorldPerformanceState = {
  avgFps: number;
  safeMode: boolean;
  tierState: PerformanceTierState;
  reportFatalError: (reason: string) => void;
};

export const useWorldPerformanceState = (activeEffectsCount: number): WorldPerformanceState => {
  const avgFpsRef = useRef(60);
  const slowFramesRef = useRef(0);
  const frameCounterRef = useRef(0);
  const fatalErrorRef = useRef(false);

  const [avgFps, setAvgFps] = useState(60);
  const [safeMode, setSafeMode] = useState(false);

  useEffect(() => {
    recordWorldLifecycleEvent("initialization", { module: "world-performance" });
  }, []);

  const evaluateSafeMode = (nextAvgFps: number): boolean =>
    shouldEnterSafeMode({
      avgFps: nextAvgFps,
      consecutiveSlowFrames: slowFramesRef.current,
      fatalShaderError: fatalErrorRef.current,
    });

  useFrame((_, delta) => {
    const currentFps = 1 / Math.max(delta, 1 / 240);
    const nextAvgFps = avgFpsRef.current * 0.9 + currentFps * 0.1;
    avgFpsRef.current = nextAvgFps;

    if (nextAvgFps < 18) {
      slowFramesRef.current += 1;
    } else {
      slowFramesRef.current = Math.max(0, slowFramesRef.current - 1);
    }

    frameCounterRef.current += 1;
    if (frameCounterRef.current % 15 === 0) {
      setAvgFps(nextAvgFps);
      const nextSafeMode = evaluateSafeMode(nextAvgFps);
      setSafeMode((prev) => {
        if (!prev && nextSafeMode) {
          recordWorldLifecycleEvent("abnormal_detected", { reason: "low_fps" });
        }
        return nextSafeMode;
      });
    }
  });

  const tierState = useMemo(() => derivePerformanceTier(avgFps, activeEffectsCount), [avgFps, activeEffectsCount]);

  const reportFatalError = (reason: string): void => {
    fatalErrorRef.current = true;
    const nextSafeMode = evaluateSafeMode(avgFpsRef.current);
    if (nextSafeMode) {
      recordWorldLifecycleEvent("abnormal_detected", { reason });
      setSafeMode(true);
    }
  };

  return {
    avgFps,
    safeMode,
    tierState,
    reportFatalError,
  };
};
