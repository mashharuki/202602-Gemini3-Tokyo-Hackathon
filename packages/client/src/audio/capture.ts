import type { AudioCaptureHandle } from "../voice/types";
import { floatTo16BitPCM } from "./pcm-utils";

export interface AudioCaptureDependencies {
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  createAudioContext: (options: AudioContextOptions) => AudioContext;
  pcmConverter: (input: Float32Array) => Int16Array;
}

const defaultDependencies: AudioCaptureDependencies = {
  getUserMedia: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
  createAudioContext: (options) => new AudioContext(options),
  pcmConverter: floatTo16BitPCM,
};

export const startAudioCapture = async (
  onPcmChunk: (chunk: Int16Array) => void,
  dependencies: AudioCaptureDependencies = defaultDependencies,
): Promise<AudioCaptureHandle> => {
  const stream = await dependencies.getUserMedia({ audio: true });
  const context = dependencies.createAudioContext({ sampleRate: 16000 });
  const source = context.createMediaStreamSource(stream);
  const processor = context.createScriptProcessor(4096, 1, 1);

  processor.onaudioprocess = (event) => {
    const floatSamples = event.inputBuffer.getChannelData(0);
    const pcmChunk = dependencies.pcmConverter(floatSamples);
    onPcmChunk(pcmChunk);
  };

  source.connect(processor);
  processor.connect(context.destination);

  return {
    stream,
    context,
    processor,
    source,
  };
};

export const stopAudioCapture = async (handle: AudioCaptureHandle): Promise<void> => {
  if ("onaudioprocess" in handle.processor) {
    handle.processor.onaudioprocess = null;
  }
  handle.processor.disconnect();
  handle.source.disconnect();
  handle.stream.getTracks().forEach((track) => track.stop());
  await handle.context.close();
};
