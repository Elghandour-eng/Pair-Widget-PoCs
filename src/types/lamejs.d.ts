/**
 * Minimal type declarations for lamejs (no @types/lamejs on npm).
 * lamejs encodes PCM Int16 samples to MP3 in the browser.
 */
declare module 'lamejs' {
  export class Mp3Encoder {
    /**
     * @param channels  1 = mono, 2 = stereo
     * @param sampleRate  e.g. 44100, 48000
     * @param kbps  e.g. 128
     */
    constructor(channels: 1 | 2, sampleRate: number, kbps: number)

    /**
     * Encode a buffer of mono (or left-channel) Int16 samples.
     * Returns an Int8Array of encoded MP3 bytes (may be empty if buffering).
     */
    encodeBuffer(left: Int16Array, right?: Int16Array): Int8Array

    /**
     * Flush remaining buffered samples. Always call this at the end.
     */
    flush(): Int8Array
  }
}
