import type { AudioPlaybackHandle } from "../voice/types";
import { decodeBase64ToArrayBuffer, parsePcmRate } from "./pcm-utils";

export interface AudioPlaybackDependencies {
  createAudioContext: (options: AudioContextOptions) => AudioContext;
  decodeBase64: (base64: string) => ArrayBuffer;
  parseRate: (mimeType: string | undefined, fallbackRate: number) => number;
  removeNode: (handle: AudioPlaybackHandle, node: AudioBufferSourceNode) => void;
}

const defaultPlaybackDependencies: AudioPlaybackDependencies = {
  createAudioContext: (options) => new AudioContext(options),
  decodeBase64: decodeBase64ToArrayBuffer,
  parseRate: parsePcmRate,
  removeNode: (handle, node) => {
    handle.activeNodes.delete(node);
  },
};

export const createAudioPlayback = (
  dependencies: AudioPlaybackDependencies = defaultPlaybackDependencies,
): AudioPlaybackHandle => {
  const context = dependencies.createAudioContext({ sampleRate: 24000 });
  return {
    context,
    nextPlayAt: 0,
    activeNodes: new Set<AudioBufferSourceNode>(),
  };
};

export const playPcmChunk = (
  handle: AudioPlaybackHandle,
  base64Data: string,
  mimeType?: string,
  dependencies: AudioPlaybackDependencies = defaultPlaybackDependencies,
): void => {
  const pcmRate = dependencies.parseRate(mimeType, 24000);
  const buffer = dependencies.decodeBase64(base64Data);
  const pcm = new Int16Array(buffer);

  const audioBuffer = handle.context.createBuffer(1, pcm.length, pcmRate);
  const channelData = audioBuffer.getChannelData(0);
  for (let i = 0; i < pcm.length; i += 1) {
    channelData[i] = pcm[i] / 32768;
  }

  const source = handle.context.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(handle.context.destination);
  source.onended = () => dependencies.removeNode(handle, source);

  const startAt = Math.max(handle.context.currentTime, handle.nextPlayAt);
  source.start(startAt);
  handle.nextPlayAt = startAt + audioBuffer.duration;
  handle.activeNodes.add(source);
};

export const interruptPlayback = (handle: AudioPlaybackHandle): void => {
  for (const node of handle.activeNodes) {
    node.stop();
  }
  handle.activeNodes.clear();
  handle.nextPlayAt = handle.context.currentTime;
};

export const stopPlayback = async (handle: AudioPlaybackHandle): Promise<void> => {
  interruptPlayback(handle);
  await handle.context.close();
};

