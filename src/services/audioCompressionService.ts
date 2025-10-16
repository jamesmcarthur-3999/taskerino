/**
 * Audio Compression Service
 *
 * Handles audio downsampling and compression for API transmission.
 * - Downsamples audio to optimal rates for speech recognition
 * - Encodes to MP3 for efficient transmission
 * - Preserves high quality for local storage
 */

import * as lamejs from '@breezystack/lamejs';

export type AudioQualityPreset = 'optimized' | 'balanced' | 'high';

interface CompressionSettings {
  transcriptionSampleRate: number;
  descriptionSampleRate: number;
  transcriptionBitrate: number;
  descriptionBitrate: number;
}

const QUALITY_PRESETS: Record<AudioQualityPreset, CompressionSettings> = {
  optimized: {
    transcriptionSampleRate: 16000, // Whisper's native training rate
    descriptionSampleRate: 24000,   // Better for environmental sounds
    transcriptionBitrate: 64,        // Good speech quality
    descriptionBitrate: 128,         // Better for complex audio
  },
  balanced: {
    transcriptionSampleRate: 22050,
    descriptionSampleRate: 22050,
    transcriptionBitrate: 96,
    descriptionBitrate: 128,
  },
  high: {
    transcriptionSampleRate: 44100, // No downsampling
    descriptionSampleRate: 44100,
    transcriptionBitrate: 128,
    descriptionBitrate: 192,
  },
};

class AudioCompressionService {
  private currentPreset: AudioQualityPreset = 'optimized';

  /**
   * Set audio quality preset
   */
  setQualityPreset(preset: AudioQualityPreset): void {
    this.currentPreset = preset;
    localStorage.setItem('audio-quality-preset', preset);
    console.log(`🎛️ [AUDIO COMPRESSION] Quality preset set to: ${preset}`);
  }

  /**
   * Get current quality preset
   */
  getQualityPreset(): AudioQualityPreset {
    const saved = localStorage.getItem('audio-quality-preset') as AudioQualityPreset;
    return saved || this.currentPreset;
  }

  /**
   * Get compression settings for current preset
   */
  private getSettings(): CompressionSettings {
    return QUALITY_PRESETS[this.getQualityPreset()];
  }

  /**
   * Compress audio for API transmission
   * @param base64Wav - Base64-encoded WAV data
   * @param mode - Audio mode (transcription or description)
   * @returns Base64-encoded MP3 data
   */
  async compressForAPI(
    base64Wav: string,
    mode: 'transcription' | 'description'
  ): Promise<string> {
    const settings = this.getSettings();
    const targetSampleRate = mode === 'transcription'
      ? settings.transcriptionSampleRate
      : settings.descriptionSampleRate;
    const targetBitrate = mode === 'transcription'
      ? settings.transcriptionBitrate
      : settings.descriptionBitrate;

    console.log(`🗜️  [AUDIO COMPRESSION] Compressing ${mode} audio: ${targetSampleRate}Hz @ ${targetBitrate}kbps`);

    return this.compressAudio(base64Wav, targetSampleRate, targetBitrate);
  }

  /**
   * Compress audio for long-term storage (higher quality than API compression)
   * Uses 64kbps MP3 encoding, mono, 16kHz sample rate
   */
  async compressForStorage(base64Wav: string): Promise<string> {
    const settings = this.getSettings();
    // Use transcription settings (16kHz, 64kbps) for storage
    return this.compressAudio(
      base64Wav,
      settings.transcriptionSampleRate,  // 16000 Hz
      settings.transcriptionBitrate      // 64 kbps
    );
  }

  /**
   * Core compression logic shared by compressForAPI and compressForStorage
   */
  private async compressAudio(
    base64Wav: string,
    targetSampleRate: number,
    targetBitrate: number
  ): Promise<string> {
    try {
      // 1. Decode WAV to AudioBuffer
      const audioContext = new AudioContext();
      const arrayBuffer = this.base64ToArrayBuffer(base64Wav);
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      const originalSize = arrayBuffer.byteLength;
      const originalRate = audioBuffer.sampleRate;

      console.log(`📊 [AUDIO COMPRESSION] Original: ${originalRate}Hz, ${(originalSize / 1024).toFixed(1)}KB`);

      // 2. Downsample if needed
      const resampled = originalRate === targetSampleRate
        ? audioBuffer
        : await this.resample(audioBuffer, targetSampleRate);

      // 3. Encode to MP3
      const mp3Data = this.encodeToMP3(resampled, targetSampleRate, targetBitrate);

      // 4. Convert to base64
      const base64Mp3 = this.arrayBufferToBase64(mp3Data);
      const compressedSize = mp3Data.byteLength;
      const reduction = ((1 - compressedSize / originalSize) * 100).toFixed(1);

      console.log(`✅ [AUDIO COMPRESSION] Compressed: ${targetSampleRate}Hz, ${(compressedSize / 1024).toFixed(1)}KB (${reduction}% reduction)`);

      return `data:audio/mp3;base64,${base64Mp3}`;
    } catch (error) {
      console.error('❌ [AUDIO COMPRESSION] Failed to compress audio:', error);
      // Fallback to original WAV if compression fails
      return base64Wav;
    }
  }

  /**
   * Resample audio buffer to target sample rate
   */
  private async resample(audioBuffer: AudioBuffer, targetSampleRate: number): Promise<AudioBuffer> {
    const channels = audioBuffer.numberOfChannels;
    const sourceSampleRate = audioBuffer.sampleRate;
    const ratio = sourceSampleRate / targetSampleRate;
    const targetLength = Math.round(audioBuffer.length / ratio);

    // Create offline context for resampling
    const offlineContext = new OfflineAudioContext(
      channels,
      targetLength,
      targetSampleRate
    );

    // Create buffer source
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start(0);

    // Start rendering and await the result
    const resampled = await offlineContext.startRendering();
    return resampled;
  }

  /**
   * Encode AudioBuffer to MP3 using lamejs
   */
  private encodeToMP3(audioBuffer: AudioBuffer, sampleRate: number, bitrate: number): ArrayBuffer {
    const channels = audioBuffer.numberOfChannels;
    const samples = audioBuffer.length;

    // Get audio data as mono for simplicity (mix channels if stereo)
    let audioData: Float32Array;
    if (channels === 1) {
      audioData = audioBuffer.getChannelData(0);
    } else {
      // Mix down to mono
      const left = audioBuffer.getChannelData(0);
      const right = audioBuffer.getChannelData(1);
      audioData = new Float32Array(samples);
      for (let i = 0; i < samples; i++) {
        audioData[i] = (left[i] + right[i]) / 2;
      }
    }

    // Convert float32 to int16
    const samples16 = new Int16Array(samples);
    for (let i = 0; i < samples; i++) {
      const s = Math.max(-1, Math.min(1, audioData[i]));
      samples16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    // Create MP3 encoder
    const mp3encoder = new lamejs.Mp3Encoder(1, sampleRate, bitrate);
    const mp3Data: Uint8Array[] = [];

    // Encode in chunks (1152 samples per chunk for MP3)
    const chunkSize = 1152;
    for (let i = 0; i < samples16.length; i += chunkSize) {
      const chunk = samples16.subarray(i, i + chunkSize);
      const mp3buf = mp3encoder.encodeBuffer(chunk);
      if (mp3buf.length > 0) {
        mp3Data.push(mp3buf);
      }
    }

    // Flush remaining data
    const mp3buf = mp3encoder.flush();
    if (mp3buf.length > 0) {
      mp3Data.push(mp3buf);
    }

    // Combine all MP3 chunks
    const totalLength = mp3Data.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of mp3Data) {
      // Convert Int8Array to Uint8Array for type compatibility
      result.set(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.length), offset);
      offset += chunk.length;
    }

    return result.buffer;
  }

  /**
   * Convert base64 string to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    // Remove data URL prefix if present
    const base64String = base64.split(',')[1] || base64;
    const binaryString = atob(base64String);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Convert ArrayBuffer to base64 string
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Get estimated file size for given settings
   */
  getEstimatedSize(durationSeconds: number, mode: 'transcription' | 'description'): number {
    const settings = this.getSettings();
    const bitrate = mode === 'transcription'
      ? settings.transcriptionBitrate
      : settings.descriptionBitrate;

    // MP3 bitrate is in kbps (kilobits per second)
    // Convert to bytes: (bitrate * 1000 / 8) * duration
    return (bitrate * 1000 / 8) * durationSeconds;
  }

  /**
   * Format bytes to human-readable string
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
}

export const audioCompressionService = new AudioCompressionService();
