/**
 * Audio Concatenation Service
 *
 * Creates virtual continuous audio stream from individual audio segments.
 * Handles time mapping between segment-relative and session-absolute time.
 * Manages audio loading, caching, and playback coordination.
 */

import type { SessionAudioSegment } from '../types';
import { attachmentStorage } from './attachmentStorage';

interface SegmentTimeMapping {
  segmentId: string;
  segmentIndex: number;
  startTime: number; // Session-absolute time (seconds from session start)
  endTime: number;   // Session-absolute time
  duration: number;
  audioBuffer?: AudioBuffer;
  attachmentId: string;
}

interface ConcatenationOptions {
  gapDuration?: number;  // Silence between segments (ms), default: 200ms
  fadeInOut?: boolean;   // Crossfade between segments, default: false
  preloadNext?: boolean; // Preload next segment for smooth playback, default: true
}

export class AudioConcatenationService {
  private audioContext: AudioContext | null = null;
  private segmentMappings: Map<string, SegmentTimeMapping> = new Map();
  private totalDuration: number = 0;
  private loadedBuffers: Map<string, AudioBuffer> = new Map();
  // Session-based WAV cache: sessionId -> { blob, url, timestamp }
  private sessionWAVCache: Map<string, { blob: Blob; url: string; timestamp: number }> = new Map();

  /**
   * Initialize audio context
   */
  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.audioContext;
  }

  /**
   * Get the shared audio context (for playback components)
   */
  getSharedAudioContext(): AudioContext {
    return this.getAudioContext();
  }

  /**
   * Creates time mappings for all segments
   * This builds a virtual timeline without loading audio
   */
  buildTimeline(segments: SessionAudioSegment[], options: ConcatenationOptions = {}): void {
    const gapDuration = (options.gapDuration ?? 200) / 1000; // Convert to seconds
    this.segmentMappings.clear();
    this.totalDuration = 0;

    // Sort segments by timestamp
    const sortedSegments = [...segments].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    sortedSegments.forEach((segment, index) => {
      const startTime = this.totalDuration;
      const duration = segment.duration;
      const endTime = startTime + duration;

      this.segmentMappings.set(segment.id, {
        segmentId: segment.id,
        segmentIndex: index,
        startTime,
        endTime,
        duration,
        attachmentId: segment.attachmentId || '',
      });

      this.totalDuration = endTime;

      // Add gap (except after last segment)
      if (index < sortedSegments.length - 1) {
        this.totalDuration += gapDuration;
      }
    });

    console.log(`🎵 [AUDIO CONCAT] Timeline built: ${sortedSegments.length} segments, ${this.totalDuration.toFixed(1)}s total`);
  }

  /**
   * Maps segment-relative time to session-absolute time
   */
  segmentTimeToSessionTime(segmentId: string, segmentTime: number): number {
    const mapping = this.segmentMappings.get(segmentId);
    if (!mapping) {
      console.warn(`⚠️  [AUDIO CONCAT] Segment not found: ${segmentId}`);
      return 0;
    }
    return mapping.startTime + segmentTime;
  }

  /**
   * Maps session-absolute time to segment + offset
   */
  sessionTimeToSegment(sessionTime: number): { segmentId: string; offset: number } | null {
    for (const [segmentId, mapping] of this.segmentMappings.entries()) {
      if (sessionTime >= mapping.startTime && sessionTime < mapping.endTime) {
        return {
          segmentId,
          offset: sessionTime - mapping.startTime,
        };
      }
    }
    return null;
  }

  /**
   * Get total duration of virtual continuous stream
   */
  getTotalDuration(): number {
    return this.totalDuration;
  }

  /**
   * Get all segment mappings (for timeline visualization)
   */
  getSegmentMappings(): SegmentTimeMapping[] {
    return Array.from(this.segmentMappings.values()).sort((a, b) => a.segmentIndex - b.segmentIndex);
  }

  /**
   * Load audio buffer for a specific segment
   */
  async loadSegmentAudio(segmentId: string): Promise<AudioBuffer | null> {
    // Check cache first
    if (this.loadedBuffers.has(segmentId)) {
      return this.loadedBuffers.get(segmentId)!;
    }

    const mapping = this.segmentMappings.get(segmentId);
    if (!mapping || !mapping.attachmentId) {
      console.warn(`⚠️  [AUDIO CONCAT] Cannot load audio for segment ${segmentId}: no attachment ID`);
      return null;
    }

    try {
      const attachment = await attachmentStorage.getAttachment(mapping.attachmentId);
      if (!attachment || !attachment.base64) {
        console.warn(`⚠️  [AUDIO CONCAT] No audio data for segment ${segmentId}`);
        return null;
      }

      const audioContext = this.getAudioContext();
      const arrayBuffer = this.base64ToArrayBuffer(attachment.base64);
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Cache the buffer
      this.loadedBuffers.set(segmentId, audioBuffer);
      console.log(`✅ [AUDIO CONCAT] Loaded segment ${segmentId}: ${audioBuffer.duration.toFixed(1)}s`);

      return audioBuffer;
    } catch (error) {
      console.error(`❌ [AUDIO CONCAT] Failed to load segment ${segmentId}:`, error);
      return null;
    }
  }

  /**
   * Preload audio for segments around current time (for smooth playback)
   */
  async preloadAroundTime(sessionTime: number, windowSeconds: number = 30): Promise<void> {
    const segmentsToLoad: string[] = [];

    for (const [segmentId, mapping] of this.segmentMappings.entries()) {
      if (
        mapping.startTime <= sessionTime + windowSeconds &&
        mapping.endTime >= sessionTime - windowSeconds
      ) {
        if (!this.loadedBuffers.has(segmentId)) {
          segmentsToLoad.push(segmentId);
        }
      }
    }

    if (segmentsToLoad.length > 0) {
      console.log(`📦 [AUDIO CONCAT] Preloading ${segmentsToLoad.length} segments around ${sessionTime.toFixed(1)}s`);
      await Promise.all(segmentsToLoad.map(id => this.loadSegmentAudio(id)));
    }
  }

  /**
   * Create audio source for playback at given session time
   * Returns AudioBufferSourceNode ready to play
   */
  async createAudioSourceAtTime(
    sessionTime: number
  ): Promise<{ source: AudioBufferSourceNode; offset: number } | null> {
    const segmentInfo = this.sessionTimeToSegment(sessionTime);
    if (!segmentInfo) {
      console.warn(`⚠️  [AUDIO CONCAT] No segment at session time ${sessionTime.toFixed(1)}s`);
      return null;
    }

    const audioBuffer = await this.loadSegmentAudio(segmentInfo.segmentId);
    if (!audioBuffer) {
      return null;
    }

    const audioContext = this.getAudioContext();
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;

    return {
      source,
      offset: segmentInfo.offset,
    };
  }

  /**
   * Export concatenated audio as single WAV file (with session-based caching)
   * Loads all segments and concatenates them into one audio buffer
   *
   * @param segments - Audio segments to concatenate
   * @param options - Concatenation options
   * @param sessionId - Optional session ID for caching (recommended for performance)
   */
  async exportAsWAV(segments: SessionAudioSegment[], options: ConcatenationOptions = {}, sessionId?: string): Promise<Blob> {
    // Check cache first if sessionId is provided
    if (sessionId) {
      const cached = this.sessionWAVCache.get(sessionId);
      if (cached) {
        console.log(`✅ [AUDIO CONCAT] Using cached WAV for session ${sessionId} (${(cached.blob.size / 1024 / 1024).toFixed(1)}MB)`);
        return cached.blob;
      }
    }

    console.log(`🎵 [AUDIO CONCAT] Exporting ${segments.length} segments as WAV...`);

    this.buildTimeline(segments, options);
    const audioContext = this.getAudioContext();
    const gapDuration = (options.gapDuration ?? 200) / 1000;

    // Load all segment buffers IN PARALLEL (Task 1C optimization)
    console.log(`📦 [AUDIO CONCAT] Loading ${segments.length} audio segments in parallel...`);
    const startTime = performance.now();

    const bufferPromises = segments.map(async (segment, index) => {
      try {
        console.log(`[${index + 1}/${segments.length}] Loading segment ${segment.id}...`);
        const buffer = await this.loadSegmentAudio(segment.id);
        return { buffer, segment, index };
      } catch (error) {
        console.error(`❌ Failed to load segment ${segment.id}:`, error);
        return { buffer: null, segment, index };
      }
    });

    // Wait for all segments to load in parallel
    const results = await Promise.all(bufferPromises);

    // Extract buffers in original order
    const segmentBuffers: AudioBuffer[] = [];
    for (const result of results) {
      if (result.buffer) {
        segmentBuffers.push(result.buffer);
      } else {
        console.warn(`⚠️  Segment ${result.segment.id} failed to load, skipping`);
      }
    }

    const loadTime = performance.now() - startTime;
    console.log(`✅ [AUDIO CONCAT] Loaded ${segmentBuffers.length}/${segments.length} segments in ${loadTime.toFixed(0)}ms (parallel)`);
    console.log(`⚡ [PERFORMANCE] Average load time per segment: ${(loadTime / segments.length).toFixed(0)}ms`);

    if (segmentBuffers.length === 0) {
      throw new Error('No audio segments to export');
    }

    // Calculate total samples needed
    const sampleRate = audioContext.sampleRate;
    const gapSamples = Math.floor(gapDuration * sampleRate);
    const totalSamples = segmentBuffers.reduce((sum, buffer, index) => {
      const gap = index < segmentBuffers.length - 1 ? gapSamples : 0;
      return sum + buffer.length + gap;
    }, 0);

    // Create output buffer (mono for simplicity)
    const outputBuffer = audioContext.createBuffer(1, totalSamples, sampleRate);
    const outputChannel = outputBuffer.getChannelData(0);

    // Copy all segments into output buffer
    let offset = 0;
    for (let i = 0; i < segmentBuffers.length; i++) {
      const buffer = segmentBuffers[i];
      const inputChannel = buffer.getChannelData(0);

      // Copy samples
      outputChannel.set(inputChannel, offset);
      offset += buffer.length;

      // Add gap (silence)
      if (i < segmentBuffers.length - 1) {
        offset += gapSamples;
      }
    }

    // Convert to WAV blob
    const wavBlob = this.audioBufferToWAV(outputBuffer);
    console.log(`✅ [AUDIO CONCAT] Exported WAV: ${(wavBlob.size / 1024 / 1024).toFixed(1)}MB`);

    // Cache the result if sessionId is provided
    if (sessionId) {
      const url = URL.createObjectURL(wavBlob);
      this.sessionWAVCache.set(sessionId, {
        blob: wavBlob,
        url,
        timestamp: Date.now(),
      });
      console.log(`💾 [AUDIO CONCAT] Cached WAV for session ${sessionId}`);
    }

    return wavBlob;
  }

  /**
   * Export concatenated audio as downsampled WAV (for GPT-4o audio review)
   * Reduces file size by lowering sample rate (e.g., 16kHz → 8kHz)
   *
   * @param segments - Audio segments to concatenate
   * @param targetSampleRate - Target sample rate (default: 8000 Hz for smaller file size)
   * @param options - Concatenation options
   * @returns Downsampled WAV blob
   */
  async exportDownsampledWAV(
    segments: SessionAudioSegment[],
    targetSampleRate: number = 8000,
    options: ConcatenationOptions = {}
  ): Promise<Blob> {
    console.log(`🎵 [AUDIO CONCAT] Exporting downsampled WAV at ${targetSampleRate}Hz...`);

    this.buildTimeline(segments, options);
    const audioContext = this.getAudioContext();
    const gapDuration = (options.gapDuration ?? 200) / 1000;

    // Load all segment buffers IN PARALLEL (Task 1C optimization)
    console.log(`📦 [AUDIO CONCAT] Loading ${segments.length} audio segments in parallel...`);
    const startTime = performance.now();

    const bufferPromises = segments.map(async (segment, index) => {
      try {
        console.log(`[${index + 1}/${segments.length}] Loading segment ${segment.id}...`);
        const buffer = await this.loadSegmentAudio(segment.id);
        return { buffer, segment, index };
      } catch (error) {
        console.error(`❌ Failed to load segment ${segment.id}:`, error);
        return { buffer: null, segment, index };
      }
    });

    // Wait for all segments to load in parallel
    const results = await Promise.all(bufferPromises);

    // Extract buffers in original order
    const segmentBuffers: AudioBuffer[] = [];
    for (const result of results) {
      if (result.buffer) {
        segmentBuffers.push(result.buffer);
      } else {
        console.warn(`⚠️  Segment ${result.segment.id} failed to load, skipping`);
      }
    }

    const loadTime = performance.now() - startTime;
    console.log(`✅ [AUDIO CONCAT] Loaded ${segmentBuffers.length}/${segments.length} segments in ${loadTime.toFixed(0)}ms (parallel)`);
    console.log(`⚡ [PERFORMANCE] Average load time per segment: ${(loadTime / segments.length).toFixed(0)}ms`);

    if (segmentBuffers.length === 0) {
      throw new Error('No audio segments to export');
    }

    // Calculate total samples needed at TARGET sample rate
    const gapSamples = Math.floor(gapDuration * targetSampleRate);

    // Calculate downsampled duration for each buffer
    const downsampleRatio = targetSampleRate / audioContext.sampleRate;

    const totalSamples = segmentBuffers.reduce((sum, buffer, index) => {
      const gap = index < segmentBuffers.length - 1 ? gapSamples : 0;
      const downsampledLength = Math.floor(buffer.length * downsampleRatio);
      return sum + downsampledLength + gap;
    }, 0);

    // Create output buffer at target sample rate (mono for smaller file size)
    const outputBuffer = audioContext.createBuffer(1, totalSamples, targetSampleRate);
    const outputChannel = outputBuffer.getChannelData(0);

    // Downsample and copy all segments into output buffer
    let offset = 0;
    for (let i = 0; i < segmentBuffers.length; i++) {
      const buffer = segmentBuffers[i];
      const inputChannel = buffer.getChannelData(0); // Use first channel (mono)

      // Simple decimation downsampling
      const step = 1 / downsampleRatio;
      const downsampledLength = Math.floor(buffer.length * downsampleRatio);

      for (let j = 0; j < downsampledLength; j++) {
        const sourceIndex = Math.floor(j * step);
        outputChannel[offset + j] = inputChannel[sourceIndex];
      }

      offset += downsampledLength;

      // Add gap (silence)
      if (i < segmentBuffers.length - 1) {
        // Gap is already silence (zeros)
        offset += gapSamples;
      }
    }

    // Convert to WAV blob
    const wavBlob = this.audioBufferToWAV(outputBuffer);
    console.log(`✅ [AUDIO CONCAT] Exported downsampled WAV: ${(wavBlob.size / 1024 / 1024).toFixed(1)}MB at ${targetSampleRate}Hz`);

    return wavBlob;
  }

  /**
   * Export concatenated audio as MP3 (requires lamejs)
   */
  async exportAsMP3(segments: SessionAudioSegment[], options: ConcatenationOptions = {}): Promise<Blob> {
    // First create WAV
    const wavBlob = await this.exportAsWAV(segments, options);

    // TODO: Convert WAV to MP3 using lamejs
    // For now, return WAV (this will be implemented in export service)
    console.log('ℹ️  [AUDIO CONCAT] MP3 encoding will be handled by export service');
    return wavBlob;
  }

  /**
   * Get cached WAV URL for a session (if available)
   */
  getCachedWAVUrl(sessionId: string): string | null {
    const cached = this.sessionWAVCache.get(sessionId);
    return cached ? cached.url : null;
  }

  /**
   * Get cached WAV duration from timeline
   */
  getCachedDuration(): number {
    return this.totalDuration;
  }

  /**
   * Clear cached audio buffers and session WAV cache
   * @param sessionId - Optional session ID to clear only that session's cache
   */
  clearCache(sessionId?: string): void {
    if (sessionId) {
      // Clear only specific session's WAV cache
      const cached = this.sessionWAVCache.get(sessionId);
      if (cached) {
        URL.revokeObjectURL(cached.url);
        this.sessionWAVCache.delete(sessionId);
        console.log(`🗑️  [AUDIO CONCAT] Cleared WAV cache for session ${sessionId}`);
      }
    } else {
      // Clear all caches
      this.loadedBuffers.clear();

      // Revoke all blob URLs before clearing
      for (const [sessionId, cached] of this.sessionWAVCache.entries()) {
        URL.revokeObjectURL(cached.url);
      }
      this.sessionWAVCache.clear();

      console.log('🗑️  [AUDIO CONCAT] Cleared all audio caches');
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { segmentsCached: number; sessionsCached: number; totalSize: number } {
    let bufferSize = 0;
    for (const buffer of this.loadedBuffers.values()) {
      // Rough estimate: samples * channels * 4 bytes per float32
      bufferSize += buffer.length * buffer.numberOfChannels * 4;
    }

    let wavSize = 0;
    for (const cached of this.sessionWAVCache.values()) {
      wavSize += cached.blob.size;
    }

    return {
      segmentsCached: this.loadedBuffers.size,
      sessionsCached: this.sessionWAVCache.size,
      totalSize: bufferSize + wavSize,
    };
  }

  /**
   * Utility: Convert base64 to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const base64String = base64.split(',')[1] || base64;
    const binaryString = atob(base64String);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Utility: Convert AudioBuffer to WAV Blob
   */
  private audioBufferToWAV(buffer: AudioBuffer): Blob {
    const length = buffer.length * buffer.numberOfChannels * 2;
    const arrayBuffer = new ArrayBuffer(44 + length);
    const view = new DataView(arrayBuffer);

    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    const sampleRate = buffer.sampleRate;
    const numChannels = buffer.numberOfChannels;
    const bitsPerSample = 16;

    // RIFF header
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    writeString(8, 'WAVE');

    // fmt chunk
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // chunk size
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true); // byte rate
    view.setUint16(32, numChannels * (bitsPerSample / 8), true); // block align
    view.setUint16(34, bitsPerSample, true);

    // data chunk
    writeString(36, 'data');
    view.setUint32(40, length, true);

    // Write audio data
    const offset = 44;
    const channels: Float32Array[] = [];
    for (let i = 0; i < numChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    let pos = 0;
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, channels[channel][i]));
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(offset + pos, intSample, true);
        pos += 2;
      }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }
}

// Export singleton instance
export const audioConcatenationService = new AudioConcatenationService();
