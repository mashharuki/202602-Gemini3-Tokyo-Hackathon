import type { AudioCaptureHandle } from "../voice/types";
import { floatTo16BitPCM } from "./pcm-utils";

export interface AudioCaptureDependencies {
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  createAudioContext: (options: AudioContextOptions) => AudioContext;
  createAudioWorkletNode?: (context: AudioContext, name: string) => AudioWorkletNode;
  pcmConverter: (input: Float32Array) => Int16Array;
}

const defaultDependencies: AudioCaptureDependencies = {
  getUserMedia: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
  createAudioContext: (options) => new AudioContext(options),
  createAudioWorkletNode: (context, name) => new AudioWorkletNode(context, name),
  pcmConverter: floatTo16BitPCM,
};

const WORKLET_NAME = "pcm-capture-processor";

const WORKLET_SOURCE = `
class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.chunkSize = 4096;
    this.buffer = new Float32Array(this.chunkSize);
    this.offset = 0;
  }

  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (!input) return true;

    let inputOffset = 0;
    while (inputOffset < input.length) {
      const writable = Math.min(this.chunkSize - this.offset, input.length - inputOffset);
      this.buffer.set(input.subarray(inputOffset, inputOffset + writable), this.offset);
      this.offset += writable;
      inputOffset += writable;

      if (this.offset === this.chunkSize) {
        const out = new Float32Array(this.chunkSize);
        out.set(this.buffer);
        this.port.postMessage(out, [out.buffer]);
        this.offset = 0;
      }
    }

    return true;
  }
}

registerProcessor("pcm-capture-processor", PcmCaptureProcessor);
`;

let cachedWorkletModuleUrl: string | null = null;

const getWorkletModuleUrl = (): string => {
  if (cachedWorkletModuleUrl) {
    return cachedWorkletModuleUrl;
  }

  const blob = new Blob([WORKLET_SOURCE], { type: "application/javascript" });
  cachedWorkletModuleUrl = URL.createObjectURL(blob);
  return cachedWorkletModuleUrl;
};

export const startAudioCapture = async (
  onPcmChunk: (chunk: Int16Array) => void,
  dependencies: AudioCaptureDependencies = defaultDependencies,
): Promise<AudioCaptureHandle> => {
  const stream = await dependencies.getUserMedia({ audio: true });
  const context = dependencies.createAudioContext({ sampleRate: 16000 });
  const source = context.createMediaStreamSource(stream);
  let processor: ScriptProcessorNode | AudioWorkletNode;

  const canUseWorklet =
    typeof context.audioWorklet?.addModule === "function" && typeof dependencies.createAudioWorkletNode === "function";

  if (canUseWorklet) {
    try {
      await context.audioWorklet.addModule(getWorkletModuleUrl());
      const workletNode = dependencies.createAudioWorkletNode!(context, WORKLET_NAME);
      workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
        if (!(event.data instanceof Float32Array)) return;
        const pcmChunk = dependencies.pcmConverter(event.data);
        onPcmChunk(pcmChunk);
      };

      source.connect(workletNode);
      workletNode.connect(context.destination);
      processor = workletNode;

      return {
        stream,
        context,
        processor,
        source,
      };
    } catch {
      // Fall through to ScriptProcessor fallback.
    }
  }

  const scriptProcessor = context.createScriptProcessor(4096, 1, 1);
  scriptProcessor.onaudioprocess = (event) => {
    const floatSamples = event.inputBuffer.getChannelData(0);
    const pcmChunk = dependencies.pcmConverter(floatSamples);
    onPcmChunk(pcmChunk);
  };

  source.connect(scriptProcessor);
  scriptProcessor.connect(context.destination);
  processor = scriptProcessor;

  return {
    stream,
    context,
    processor,
    source,
  };
};

export const stopAudioCapture = async (handle: AudioCaptureHandle): Promise<void> => {
  if ("port" in handle.processor) {
    handle.processor.port.onmessage = null;
  }
  if ("onaudioprocess" in handle.processor) {
    handle.processor.onaudioprocess = null;
  }
  handle.processor.disconnect();
  handle.source.disconnect();
  handle.stream.getTracks().forEach((track) => track.stop());
  await handle.context.close();
};
