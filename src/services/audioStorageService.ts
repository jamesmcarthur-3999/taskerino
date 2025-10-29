/**
 * AudioStorageService
 *
 * Handles storage, compression, and retrieval of audio files.
 * - Stores high-quality WAV in IndexedDB via attachmentStorage
 * - Generates waveform data for visualization
 * - Stitches audio segments into full session audio
 * - Manages audio file deletion
 */

import type { Attachment, Session } from '../types';
import { getCAStorage } from './storage/ContentAddressableStorage';
import { audioCompressionService } from './audioCompressionService';

class AudioStorageService {
  /**
   * Save audio chunk to storage
   *
   * @param base64Wav - Base64-encoded WAV data from Rust (with data:audio/wav;base64, prefix)
   * @param sessionId - Session ID for naming
   * @param segmentIndex - Chunk number
   * @returns Attachment with ID and waveform
   */
  async saveAudioChunk(
    base64Wav: string,
    sessionId: string,
    segmentIndex: number,
    duration?: number
  ): Promise<Attachment> {
    console.log(`💾 [AUDIO STORAGE] Saving audio segment ${segmentIndex} for session ${sessionId}...`);

    // Compress to MP3 for storage (95% size reduction)
    const base64Mp3 = await audioCompressionService.compressForStorage(base64Wav);

    // Calculate sizes for comparison
    const wavSize = base64Wav.length;
    const mp3Size = base64Mp3.length;
    const savings = ((1 - mp3Size / wavSize) * 100).toFixed(1);

    console.log(`🗜️  [AUDIO STORAGE] Compressed ${wavSize} → ${mp3Size} bytes (${savings}% reduction)`);

    // Generate waveform data for visualization (using original WAV for accuracy)
    const waveform = await this.generateWaveform(base64Wav);

    // Calculate actual duration from audio data if not provided
    const actualDuration = duration || await this.calculateDuration(base64Wav);

    const attachment: Attachment = {
      id: `audio-${sessionId}-${segmentIndex}-${Date.now()}`,
      type: 'audio',
      name: `Audio Segment ${segmentIndex + 1}.mp3`,
      mimeType: 'audio/mp3',
      size: mp3Size,
      createdAt: new Date().toISOString(),
      base64: base64Mp3,
      waveform,
      duration: actualDuration,
    };

    // Phase 4: Save to content-addressable storage
    const caStorage = await getCAStorage();
    const hash = await caStorage.saveAttachment(attachment);
    attachment.hash = hash;
    await caStorage.addReference(hash, sessionId, attachment.id);

    console.log(`✅ [AUDIO STORAGE] Saved audio segment ${segmentIndex} as MP3 (hash: ${hash.substring(0, 8)}...)`);

    // VERIFY: Try loading it back immediately to confirm it's saved
    const verified = await caStorage.loadAttachment(hash);
    if (!verified) {
      console.error(`❌ [AUDIO STORAGE] VERIFICATION FAILED! Just saved hash ${hash.substring(0, 8)}... but can't load it back!`);
    } else {
      console.log(`✅ [AUDIO STORAGE] VERIFIED: Can load hash ${hash.substring(0, 8)}... (${verified.size} bytes)`);
    }

    return attachment;
  }

  /**
   * Stitch all audio segments into one file
   *
   * @param segmentIds - Array of attachment IDs in order
   * @param sessionId - Session ID
   * @returns Attachment for full session audio
   */
  async stitchAudioSegments(
    segmentIds: string[],
    sessionId: string
  ): Promise<Attachment> {
    console.log(`🎵 [AUDIO STORAGE] Stitching ${segmentIds.length} audio segments for session ${sessionId}`);

    if (segmentIds.length === 0) {
      throw new Error('No audio segments to stitch');
    }

    const audioContext = new AudioContext();
    const audioBuffers: AudioBuffer[] = [];

    // Load all segments (Phase 4: Use CA storage with hash lookup)
    const caStorage = await getCAStorage();
    for (const id of segmentIds) {
      // Note: segmentIds should contain hashes in Phase 4, but we support legacy IDs
      // The migration will update all references to use hashes
      const attachment = await caStorage.loadAttachment(id);
      if (!attachment?.base64) {
        console.warn(`⚠️  [AUDIO STORAGE] Segment ${id} not found, skipping`);
        continue;
      }

      const arrayBuffer = this.base64ToArrayBuffer(attachment.base64);
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      audioBuffers.push(audioBuffer);
    }

    if (audioBuffers.length === 0) {
      throw new Error('No valid audio segments found');
    }

    // Calculate total length
    const totalLength = audioBuffers.reduce((sum, buf) => sum + buf.length, 0);
    const sampleRate = audioBuffers[0].sampleRate;
    const channels = audioBuffers[0].numberOfChannels;

    console.log(`🎵 [AUDIO STORAGE] Creating combined buffer: ${totalLength} samples, ${channels} channels, ${sampleRate}Hz`);

    // Create combined buffer
    const outputBuffer = audioContext.createBuffer(channels, totalLength, sampleRate);

    let offset = 0;
    for (const buffer of audioBuffers) {
      for (let channel = 0; channel < channels; channel++) {
        outputBuffer.copyToChannel(buffer.getChannelData(channel), channel, offset);
      }
      offset += buffer.length;
    }

    // Encode as WAV
    const wavBlob = this.audioBufferToWav(outputBuffer);
    const base64Wav = await this.blobToBase64(wavBlob);

    // Generate waveform for full audio
    const waveform = await this.generateWaveform(base64Wav);

    const totalDuration = totalLength / sampleRate;

    const attachment: Attachment = {
      id: `audio-${sessionId}-full-${Date.now()}`,
      type: 'audio',
      name: `Session Audio - Full Recording.wav`,
      mimeType: 'audio/wav',
      size: Math.ceil((base64Wav.split(',')[1] || base64Wav).length * 0.75),
      createdAt: new Date().toISOString(),
      base64: base64Wav,
      waveform,
      duration: totalDuration,
    };

    // Phase 4: Save to content-addressable storage
    const hash = await caStorage.saveAttachment(attachment);
    attachment.hash = hash;
    await caStorage.addReference(hash, sessionId, attachment.id);

    console.log(`✅ [AUDIO STORAGE] Stitched audio saved: ${attachment.id} (${totalDuration.toFixed(1)}s) (hash: ${hash.substring(0, 8)}...)`);

    return attachment;
  }

  /**
   * Calculate audio duration from base64 WAV data
   */
  private async calculateDuration(base64Wav: string): Promise<number> {
    try {
      const audioContext = new AudioContext();
      const arrayBuffer = this.base64ToArrayBuffer(base64Wav);
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      return audioBuffer.duration;
    } catch (error) {
      console.error('❌ [AUDIO STORAGE] Failed to calculate duration:', error);
      return 120; // Default fallback
    }
  }

  /**
   * Generate simplified waveform data for visualization
   * Samples every Nth point to create ~200 data points
   */
  private async generateWaveform(base64Wav: string): Promise<number[]> {
    try {
      const audioContext = new AudioContext();
      const arrayBuffer = this.base64ToArrayBuffer(base64Wav);
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      const rawData = audioBuffer.getChannelData(0); // Mono or first channel
      const samples = 200; // Number of bars in waveform
      const blockSize = Math.floor(rawData.length / samples);
      const waveform: number[] = [];

      for (let i = 0; i < samples; i++) {
        const start = blockSize * i;
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
          sum += Math.abs(rawData[start + j] || 0);
        }
        waveform.push(sum / blockSize);
      }

      // Normalize to 0-1
      const max = Math.max(...waveform, 0.001); // Prevent division by zero
      return waveform.map(v => v / max);
    } catch (error) {
      console.error('❌ [AUDIO STORAGE] Failed to generate waveform:', error);
      // Return flat waveform on error
      return new Array(200).fill(0.5);
    }
  }

  /**
   * Convert base64 to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    // Strip data URL prefix if present (e.g., "data:audio/wav;base64,")
    let base64Data = base64;
    if (base64.startsWith('data:') && base64.includes(',')) {
      base64Data = base64.split(',')[1];
      console.log('[AUDIO STORAGE] Stripped data URL prefix from base64 string');
    }

    // Additional validation: Check if string contains only valid base64 characters
    const validBase64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!validBase64Regex.test(base64Data.replace(/\s/g, ''))) {
      console.warn('[AUDIO STORAGE] Base64 string contains invalid characters, attempting cleanup');
      // Remove any whitespace or newlines
      base64Data = base64Data.replace(/\s/g, '');
    }

    try {
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
    } catch (error) {
      console.error('[AUDIO STORAGE] Failed to decode base64:', error);
      throw new Error(`Invalid base64 audio data: ${error}`);
    }
  }

  /**
   * Convert AudioBuffer to WAV Blob
   */
  private audioBufferToWav(audioBuffer: AudioBuffer): Blob {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length * numberOfChannels * 2;
    const buffer = new ArrayBuffer(44 + length);
    const view = new DataView(buffer);

    // Helper to write string
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    // WAV header
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // PCM
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, audioBuffer.sampleRate, true);
    view.setUint32(28, audioBuffer.sampleRate * numberOfChannels * 2, true); // Byte rate
    view.setUint16(32, numberOfChannels * 2, true); // Block align
    view.setUint16(34, 16, true); // Bits per sample
    writeString(36, 'data');
    view.setUint32(40, length, true);

    // Write interleaved audio data
    const channels: Float32Array[] = [];
    for (let i = 0; i < numberOfChannels; i++) {
      channels.push(audioBuffer.getChannelData(i));
    }

    let offset = 44;
    for (let i = 0; i < audioBuffer.length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, channels[channel][i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  /**
   * Convert Blob to base64
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Save full session audio (used by audio review service)
   *
   * @param base64Wav - Base64-encoded WAV data (downsampled)
   * @param sessionId - Session ID
   * @param duration - Audio duration in seconds
   * @returns Attachment for full session audio
   */
  async saveFullSessionAudio(
    base64Wav: string,
    sessionId: string,
    duration: number
  ): Promise<Attachment> {
    console.log(`🎵 [AUDIO STORAGE] Saving full session audio for ${sessionId} (${duration.toFixed(1)}s)`);

    // Generate waveform for visualization
    const waveform = await this.generateWaveform(base64Wav);

    // Calculate size
    const base64Data = base64Wav.split(',')[1] || base64Wav;
    const size = Math.ceil(base64Data.length * 0.75);

    const attachment: Attachment = {
      id: `audio-${sessionId}-full-${Date.now()}`,
      type: 'audio',
      name: `Session Audio - Full Recording (Review).wav`,
      mimeType: 'audio/wav',
      size,
      createdAt: new Date().toISOString(),
      base64: base64Wav,
      waveform,
      duration,
    };

    // Phase 4: Save to content-addressable storage
    const caStorage = await getCAStorage();
    const hash = await caStorage.saveAttachment(attachment);
    attachment.hash = hash;
    await caStorage.addReference(hash, sessionId, attachment.id);

    console.log(`✅ [AUDIO STORAGE] Saved full session audio: ${attachment.id} (${(size / 1024 / 1024).toFixed(1)}MB) (hash: ${hash.substring(0, 8)}...)`);

    return attachment;
  }

  /**
   * Delete audio file from storage (Phase 4: Remove reference, GC handles deletion)
   */
  async deleteAudio(hash: string, sessionId: string, attachmentId: string): Promise<void> {
    const caStorage = await getCAStorage();
    await caStorage.removeReference(hash, sessionId, attachmentId);
    console.log(`🗑️  [AUDIO STORAGE] Removed reference for audio: ${attachmentId} (hash: ${hash.substring(0, 8)}...)`);
  }

  /**
   * Get total storage size for session audio (Phase 4: Use hash lookup)
   */
  async getSessionAudioSize(session: Session): Promise<number> {
    const caStorage = await getCAStorage();
    let totalSize = 0;

    // Sum segment sizes (Phase 4: Use hash if available, fallback to attachmentId)
    if (session.audioSegments) {
      for (const segment of session.audioSegments) {
        const identifier = segment.hash || segment.attachmentId;
        if (identifier) {
          const attachment = await caStorage.loadAttachment(identifier);
          if (attachment) totalSize += attachment.size;
        }
      }
    }

    // Add full audio size (Note: fullAudioAttachmentId may need migration to hash-based lookup)
    if (session.fullAudioAttachmentId) {
      const attachment = await caStorage.loadAttachment(session.fullAudioAttachmentId);
      if (attachment) totalSize += attachment.size;
    }

    return totalSize;
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

export const audioStorageService = new AudioStorageService();
