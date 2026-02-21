import { describe, expect, it } from "bun:test";
import { startAudioCapture, stopAudioCapture, type AudioCaptureDependencies } from "./capture";

const createDeps = () => {
  const track = {
    stopped: false,
    stop() {
      this.stopped = true;
    },
  };

  const stream = {
    getTracks: () => [track],
  } as unknown as MediaStream;

  const source = {
    connectedTo: null as unknown,
    disconnected: false,
    connect(target: unknown) {
      this.connectedTo = target;
    },
    disconnect() {
      this.disconnected = true;
    },
  };

  const processor = {
    connectedTo: null as unknown,
    disconnected: false,
    onaudioprocess: undefined as ((event: { inputBuffer: { getChannelData: (_index: number) => Float32Array } }) => void) | undefined,
    connect(target: unknown) {
      this.connectedTo = target;
    },
    disconnect() {
      this.disconnected = true;
    },
  };

  const context = {
    destination: {},
    closed: false,
    createMediaStreamSource: () => source,
    createScriptProcessor: (bufferSize: number) => {
      if (bufferSize !== 4096) throw new Error("unexpected bufferSize");
      return processor;
    },
    async close() {
      this.closed = true;
    },
  };

  const deps: AudioCaptureDependencies = {
    getUserMedia: async (constraints) => {
      expect(constraints).toEqual({ audio: true });
      return stream;
    },
    createAudioContext: (options) => {
      expect(options.sampleRate).toBe(16000);
      return context as unknown as AudioContext;
    },
    pcmConverter: (input) => Int16Array.from(input.map((value) => Math.round(value * 10))),
  };

  return { deps, track, source, processor, context };
};

describe("startAudioCapture", () => {
  it("initializes capture pipeline and emits PCM chunks", async () => {
    const { deps, processor } = createDeps();
    const chunks: Int16Array[] = [];

    const handle = await startAudioCapture((chunk) => chunks.push(chunk), deps);
    expect(handle.stream).toBeDefined();
    expect(handle.context).toBeDefined();
    expect(handle.processor).toBeDefined();
    expect(handle.source).toBeDefined();

    processor.onaudioprocess?.({
      inputBuffer: { getChannelData: () => new Float32Array([0.1, -0.2, 0.3]) },
    });
    expect(Array.from(chunks[0])).toEqual([1, -2, 3]);
  });
});

describe("stopAudioCapture", () => {
  it("stops tracks, disconnects nodes, and closes context", async () => {
    const { deps, track, source, processor, context } = createDeps();
    const handle = await startAudioCapture(() => undefined, deps);

    await stopAudioCapture(handle);
    expect(track.stopped).toBeTrue();
    expect(source.disconnected).toBeTrue();
    expect(processor.disconnected).toBeTrue();
    expect(context.closed).toBeTrue();
  });
});
