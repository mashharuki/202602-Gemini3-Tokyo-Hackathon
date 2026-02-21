export const floatTo16BitPCM = (input: Float32Array): Int16Array => {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, input[i]));
    output[i] = sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff);
  }
  return output;
};

export const parsePcmRate = (mimeType: string | undefined, fallbackRate: number): number => {
  if (!mimeType) return fallbackRate;
  const match = /(?:^|;)rate=(\d+)/i.exec(mimeType);
  if (!match) return fallbackRate;

  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : fallbackRate;
};

export const decodeBase64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};
