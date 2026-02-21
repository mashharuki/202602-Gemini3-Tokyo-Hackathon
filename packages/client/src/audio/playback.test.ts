import { describe, expect, it } from "bun:test";
import {
  createAudioPlayback,
  interruptPlayback,
  playPcmChunk,
  stopPlayback,
  type AudioPlaybackDependencies,
} from "./playback";

const createDeps = () => {
  const startedAt: number[] = [];
  const stopped: number[] = [];
  const removed = new Set<object>();

  const createdBuffers: Array<{ length: number; sampleRate: number; data: Float32Array }> = [];
  const activeSources: Array<{ start: (when: number) => void; stop: () => void; onended?: () => void; connect: () => void; buffer: any }> = [];

  const context = {
    currentTime: 10,
    destination: {},
    closed: false,
    createBuffer: (_channels: number, length: number, sampleRate: number) => {
      const data = new Float32Array(length);
      const buffer = {
        duration: length / sampleRate,
        getChannelData: () => data,
      };
      createdBuffers.push({ length, sampleRate, data });
      return buffer as unknown as AudioBuffer;
    },
    createBufferSource: () => {
      const source = {
        buffer: null as AudioBuffer | null,
        onended: undefined as (() => void) | undefined,
        connect: () => undefined,
        start: (when: number) => {
          startedAt.push(when);
        },
        stop: () => {
          stopped.push(1);
        },
      };
      activeSources.push(source);
      return source as unknown as AudioBufferSourceNode;
    },
    async close() {
      this.closed = true;
    },
  };

  const deps: AudioPlaybackDependencies = {
    createAudioContext: (options) => {
      expect(options.sampleRate).toBe(24000);
      return context as unknown as AudioContext;
    },
    decodeBase64: (value) => {
      expect(value).toBe("AQACAA==");
      return Uint8Array.from([1, 0, 2, 0]).buffer;
    },
    parseRate: (mimeType, fallback) => {
      expect(mimeType).toBe("audio/pcm;rate=24000");
      expect(fallback).toBe(24000);
      return 24000;
    },
    removeNode: (handle, node) => {
      handle.activeNodes.delete(node);
      removed.add(node as object);
    },
  };

  return { deps, context, startedAt, stopped, createdBuffers, activeSources, removed };
};

describe("createAudioPlayback", () => {
  it("creates playback handle with initial state", () => {
    const { deps, context } = createDeps();
    const handle = createAudioPlayback(deps);
    expect(handle.context).toBe(context);
    expect(handle.nextPlayAt).toBe(0);
    expect(handle.activeNodes.size).toBe(0);
  });
});

describe("playPcmChunk", () => {
  it("decodes pcm, schedules seamless playback, and tracks active nodes", () => {
    const { deps, startedAt, createdBuffers, activeSources } = createDeps();
    const handle = createAudioPlayback(deps);

    playPcmChunk(handle, "AQACAA==", "audio/pcm;rate=24000", deps);

    expect(createdBuffers[0].length).toBe(2);
    expect(createdBuffers[0].sampleRate).toBe(24000);
    expect(Math.abs(createdBuffers[0].data[0] - 1 / 32768)).toBeLessThan(0.0001);
    expect(Math.abs(createdBuffers[0].data[1] - 2 / 32768)).toBeLessThan(0.0001);
    expect(startedAt[0]).toBe(10);
    expect(handle.nextPlayAt).toBeGreaterThan(10);
    expect(handle.activeNodes.size).toBe(1);

    activeSources[0].onended?.();
    expect(handle.activeNodes.size).toBe(0);
  });
});

describe("interruptPlayback / stopPlayback", () => {
  it("stops active nodes, resets nextPlayAt, and closes context", async () => {
    const { deps, context, stopped } = createDeps();
    const handle = createAudioPlayback(deps);
    playPcmChunk(handle, "AQACAA==", "audio/pcm;rate=24000", deps);
    expect(handle.activeNodes.size).toBe(1);

    interruptPlayback(handle);
    expect(stopped.length).toBe(1);
    expect(handle.activeNodes.size).toBe(0);
    expect(handle.nextPlayAt).toBe(context.currentTime);

    await stopPlayback(handle);
    expect(context.closed).toBeTrue();
  });
});
